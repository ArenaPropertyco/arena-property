import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato del principio 8 de la constitución ("La marca no se improvisa"):
 * los 9 colores y las 3 tipografías del manual salen de tokens, y ningún
 * color hexadecimal queda suelto en el código.
 */

const raiz = process.cwd()
const ARCHIVO_TOKENS = 'app/assets/css/main.css'

const constitucion = readFileSync(resolve(raiz, 'docs/constitution.md'), 'utf8')
const tokens = readFileSync(resolve(raiz, ARCHIVO_TOKENS), 'utf8')

/** Principio 8 es la única fuente de los colores de marca. */
const principio8 = constitucion.slice(
  constitucion.indexOf('8. **La marca no se improvisa.**'),
  constitucion.indexOf('9. **Honestidad en los datos.**'),
)

const coloresDeMarca = [...principio8.matchAll(/`(#[0-9A-Fa-f]{6})`/g)]
  .map(coincidencia => coincidencia[1]!.toUpperCase())

const TIPOGRAFIAS = ['Cormorant Garamond', 'DM Sans', 'IBM Plex Mono']

/** Archivos de código donde no puede aparecer un color suelto. */
function archivosDeCodigo(directorio: string, extensiones: string[]): string[] {
  const absoluto = resolve(raiz, directorio)
  let entradas: string[]
  try {
    entradas = readdirSync(absoluto)
  }
  catch {
    return []
  }

  return entradas.flatMap((entrada) => {
    const ruta = join(directorio, entrada)
    if (statSync(resolve(raiz, ruta)).isDirectory()) {
      return archivosDeCodigo(ruta, extensiones)
    }
    return extensiones.some(extension => entrada.endsWith(extension)) ? [ruta] : []
  })
}

describe('RT-07 · tokens de marca', () => {
  it('la constitución declara los 9 colores del manual', () => {
    expect(coloresDeMarca).toHaveLength(9)
  })

  it('los 9 colores del manual resuelven desde tokens', () => {
    const enMayusculas = tokens.toUpperCase()
    const faltantes = coloresDeMarca.filter(color => !enMayusculas.includes(color))

    expect(faltantes).toEqual([])
  })

  it('las 3 familias tipográficas resuelven desde tokens', () => {
    const faltantes = TIPOGRAFIAS.filter(familia => !tokens.includes(familia))

    expect(faltantes).toEqual([])
  })

  /**
   * El kit de marca son diez archivos que comparten un lienzo con todas las
   * variantes: cada uno pesa 319 K para enseñar una. Aquí solo entran los
   * recortados. El tope corta por lo sano si alguien vuelve a copiar el original.
   */
  it('los recursos de marca están y ninguno arrastra el lienzo completo', () => {
    const TOPE_KB = 60
    const recursos = [
      'app/assets/brand/icono-color.svg',
      'app/assets/brand/icono-blanco.svg',
      'app/assets/brand/logotipo-color.svg',
      'app/assets/brand/logotipo-blanco.svg',
      'public/favicon.svg',
      'public/favicon.ico',
      'public/apple-touch-icon.png',
    ]

    const pesados = recursos
      .map(ruta => ({ ruta, kb: statSync(resolve(raiz, ruta)).size / 1024 }))
      .filter(recurso => recurso.kb > TOPE_KB)

    expect(pesados).toEqual([])
  })

  it('no hay ningún color hexadecimal suelto fuera del archivo de tokens', () => {
    const fuentes = [
      ...archivosDeCodigo('app', ['.vue', '.ts', '.css']),
      ...archivosDeCodigo('shared', ['.ts']),
      ...archivosDeCodigo('server', ['.ts']),
    ].filter(ruta => ruta !== ARCHIVO_TOKENS)

    const conHexSuelto = fuentes.filter((ruta) => {
      const contenido = readFileSync(resolve(raiz, ruta), 'utf8')
      return /#[0-9a-fA-F]{3,8}\b/.test(contenido)
    })

    expect(conHexSuelto).toEqual([])
  })
})
