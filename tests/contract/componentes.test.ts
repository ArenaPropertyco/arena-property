import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato del principio 10 ("Interfaz por componentes"):
 *   - las páginas orquestan y los layouts estructuran: ninguno contiene formularios,
 *     tablas, alertas ni controles directamente;
 *   - los componentes presentan y emiten: ninguno consulta datos por su cuenta.
 */

const raiz = process.cwd()

function archivosVue(directorio: string): string[] {
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
      return archivosVue(ruta)
    }
    return entrada.endsWith('.vue') ? [ruta] : []
  })
}

/** Lo que una página o un layout no puede escribir: pertenece a un componente. */
const PROHIBIDO_EN_PAGINAS_Y_LAYOUTS = [
  '<UForm', '<UFormField', '<UInput', '<USelect', '<UTable', '<UBadge', '<UAlert',
  '<form', '<input', '<table',
]

/** Lo que un componente no puede hacer: consultar datos es de composables y páginas. */
const PROHIBIDO_EN_COMPONENTES = ['useSupabaseClient', 'useAsyncData', 'useFetch', '$fetch(']

const paginasYLayouts = [...archivosVue('app/pages'), ...archivosVue('app/layouts')]
const componentes = archivosVue('app/components')

describe('principio 10 · las páginas orquestan y los layouts estructuran', () => {
  it('hay páginas y layouts que revisar', () => {
    expect(paginasYLayouts.length).toBeGreaterThan(0)
  })

  it.each(paginasYLayouts)('%s no contiene formularios, tablas ni controles', (ruta) => {
    const contenido = readFileSync(resolve(raiz, ruta), 'utf8')
    const infracciones = PROHIBIDO_EN_PAGINAS_Y_LAYOUTS.filter(etiqueta => contenido.includes(etiqueta))

    expect(infracciones).toEqual([])
  })
})

describe('principio 10 · los componentes presentan y emiten', () => {
  it('hay componentes que revisar', () => {
    expect(componentes.length).toBeGreaterThan(2)
  })

  it.each(componentes)('%s no consulta datos por su cuenta', (ruta) => {
    const contenido = readFileSync(resolve(raiz, ruta), 'utf8')
    const infracciones = PROHIBIDO_EN_COMPONENTES.filter(llamada => contenido.includes(llamada))

    expect(infracciones).toEqual([])
  })
})
