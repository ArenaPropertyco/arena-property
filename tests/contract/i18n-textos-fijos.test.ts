import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * RT-05 · T-270 · ningún texto visible está escrito en el código: todo lo que se
 * lee en pantalla sale de `i18n/locales`. Se revisan las plantillas de páginas,
 * layouts y componentes buscando texto entre etiquetas y atributos visibles
 * estáticos (`label`, `title`, `placeholder`, `aria-label`, `description`, `alt`,
 * `text`). Las interpolaciones `{{ }}` y los comentarios no cuentan.
 */

const raiz = process.cwd()

function vistas(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    return statSync(ruta).isDirectory() ? vistas(ruta) : entrada.endsWith('.vue') ? [ruta] : []
  })
}

/** Dos letras seguidas: descarta símbolos sueltos como «·», «—» o «✦». */
const PALABRA = /\p{L}{2,}/u

function textosFijos(archivo: string): string[] {
  const codigo = readFileSync(archivo, 'utf8')
  const plantilla = codigo.match(/<template>([\s\S]*)<\/template>/)?.[1]
  if (!plantilla) {
    return []
  }
  const limpia = plantilla.replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, ' ')
  const relativo = archivo.slice(raiz.length + 1)

  const entreEtiquetas = [...limpia.matchAll(/>([^<>]+)</g)]
    .map(([, texto]) => texto!.trim())
    .filter(texto => PALABRA.test(texto))
    .map(texto => `${relativo}: «${texto}»`)
  const atributos = [...limpia.matchAll(/\s(label|title|placeholder|aria-label|description|alt|text)="([^"]*)"/g)]
    .filter(([, , valor]) => PALABRA.test(valor!))
    .map(([, atributo, valor]) => `${relativo}: ${atributo}="${valor}"`)

  return [...entreEtiquetas, ...atributos]
}

describe('RT-05 · sin textos fijos en las vistas', () => {
  const archivos = vistas(resolve(raiz, 'app'))

  it('hay vistas que revisar', () => {
    expect(archivos.length).toBeGreaterThan(50)
  })

  it('ninguna plantilla escribe texto visible a mano', () => {
    expect(archivos.flatMap(textosFijos)).toEqual([])
  })
})
