import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato de RF-D.7 y del principio 3: ninguna vista replica aritmética monetaria
 * ni formatea cifras por su cuenta. Todo eso vive en `shared/money`.
 */

const raiz = process.cwd()

/** Marcadores de cálculo o formateo numérico que no pueden aparecer en una vista. */
const PROHIBIDO = [
  { patron: /Intl\.NumberFormat/, motivo: 'formatea cifras: usa shared/money/formato' },
  { patron: /\.toFixed\(/, motivo: 'redondea cifras: usa shared/money/formato' },
  { patron: /Math\.(round|floor|ceil|trunc)\(/, motivo: 'redondea: usa shared/money' },
  { patron: /\/\s*8\b/, motivo: 'prorratea: usa shared/money/prorrateo' },
]

function vistas(directorio: string): string[] {
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
      return vistas(ruta)
    }
    return entrada.endsWith('.vue') ? [ruta] : []
  })
}

describe('RF-D.7 · la aritmética monetaria no vive en las vistas', () => {
  it('ningún componente, layout o página calcula ni formatea cifras por su cuenta', () => {
    const infracciones = vistas('app').flatMap((ruta) => {
      const contenido = readFileSync(resolve(raiz, ruta), 'utf8')
      return PROHIBIDO
        .filter(({ patron }) => patron.test(contenido))
        .map(({ motivo }) => `${ruta}: ${motivo}`)
    })

    expect(infracciones).toEqual([])
  })

  it('la comprobación está mirando vistas de verdad', () => {
    expect(vistas('app').length).toBeGreaterThan(0)
  })
})
