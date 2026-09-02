import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato de HU-04 · RF-04.2 y HU-07 · RF-07.2: toda página bajo el panel declara
 * su requisito de acceso, y la guarda es global. Así no existe una página privada
 * "que se olvidó" de protegerse: la decisión la toma `decidirAcceso`, probada en N1.
 */

const raiz = process.cwd()

function paginas(directorio: string): string[] {
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
      return paginas(ruta)
    }
    return entrada.endsWith('.vue') ? [ruta] : []
  })
}

const privadas = [...paginas('app/pages/panel'), 'app/pages/panel.vue']
  .filter(ruta => existsSync(resolve(raiz, ruta)))

describe('RF-04.2 / RF-07.2 · rutas privadas', () => {
  it('la guarda de acceso es un middleware global', () => {
    expect(existsSync(resolve(raiz, 'app/middleware/acceso.global.ts'))).toBe(true)
  })

  it('hay páginas de panel que proteger', () => {
    expect(privadas.length).toBeGreaterThan(0)
  })

  it.each(privadas)('%s declara `acceso` con `privada` o `capacidad`', (ruta) => {
    const contenido = readFileSync(resolve(raiz, ruta), 'utf8')

    expect(contenido).toMatch(/definePageMeta\(\{[\s\S]*?acceso:\s*\{[\s\S]*?(privada:\s*true|capacidad:\s*')/)
  })
})
