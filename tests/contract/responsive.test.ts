import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * RT-06 · T-269 · lo que rompe una vista a 320 px o en uno de los dos temas, dicho
 * como regla que se puede comprobar en el código:
 *
 * - Los colores salen de los tokens semánticos de `@nuxt/ui` o de la marca: una
 *   clase de la paleta de Tailwind (`bg-white`, `text-gray-500`…) no cambia con el
 *   tema y deja texto ilegible en el otro.
 * - Ningún ancho fijo de 320 px o más: desborda el móvil.
 * - Tres columnas o más solo desde un punto de quiebre (o sobre un bloque que en
 *   móvil está oculto): a 320 px no caben.
 * - Toda tabla va dentro de un contenedor con scroll horizontal.
 * - `UPageHeader` no trae margen propio: va dentro de un `UContainer`.
 */

const raiz = process.cwd()

function vistas(dir: string): string[] {
  return readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    return statSync(ruta).isDirectory() ? vistas(ruta) : entrada.endsWith('.vue') ? [ruta] : []
  })
}

const archivos = vistas(resolve(raiz, 'app')).map(ruta => ({
  ruta: ruta.slice(raiz.length + 1),
  codigo: readFileSync(ruta, 'utf8'),
}))

/** Cada lista de clases estática (`class="…"`) con el archivo en que aparece. */
const clases = archivos.flatMap(({ ruta, codigo }) =>
  [...codigo.matchAll(/\sclass="([^"]*)"/g)].map(([, lista]) => ({ ruta, lista: lista! })))

const PALETA = /(?:^|\s)(?:[a-z-]+:)*(?:bg|text|border|ring|divide|from|via|to)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow|amber|orange|emerald|sky|indigo|purple|pink|rose)-\d{2,3})(?:\/\d+)?(?=\s|$)/

describe('RT-06 · responsive y bitema', () => {
  it('hay vistas que revisar', () => {
    expect(archivos.length).toBeGreaterThan(50)
  })

  it('ningún color de la paleta de Tailwind: solo tokens que siguen al tema', () => {
    const fuera = clases.filter(({ lista }) => PALETA.test(lista)).map(({ ruta, lista }) => `${ruta}: ${lista}`)
    expect(fuera).toEqual([])
  })

  it('ningún ancho fijo de 320 px o más', () => {
    const fuera = clases
      .filter(({ lista }) => /(?:^|\s)(?:min-w|w|max-w)-\[(?:3[2-9]\d|[4-9]\d\d|\d{4,})px\]/.test(lista))
      .map(({ ruta, lista }) => `${ruta}: ${lista}`)
    expect(fuera).toEqual([])
  })

  it('tres columnas o más solo desde un punto de quiebre', () => {
    const fuera = clases
      .filter(({ lista }) => /(?:^|\s)grid-cols-(?:[3-9]|1[0-2])(?=\s|$)/.test(lista) && !/(?:^|\s)hidden(?=\s|$)/.test(lista))
      .map(({ ruta, lista }) => `${ruta}: ${lista}`)
    expect(fuera).toEqual([])
  })

  it('toda tabla tiene scroll horizontal', () => {
    const fuera = archivos
      .filter(({ codigo }) => codigo.includes('<UTable') && !/overflow-(?:x-)?auto/.test(codigo))
      .map(({ ruta }) => ruta)
    expect(fuera).toEqual([])
  })

  it('todo UPageHeader va dentro de un UContainer', () => {
    const fuera = archivos
      .filter(({ codigo }) => codigo.includes('<UPageHeader') && !/<UContainer[^>]*>\s*(?:<!--[\s\S]*?-->\s*)?<UPageHeader/.test(codigo))
      .map(({ ruta }) => ruta)
    expect(fuera).toEqual([])
  })
})
