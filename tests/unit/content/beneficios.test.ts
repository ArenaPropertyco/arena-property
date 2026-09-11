import { describe, expect, it } from 'vitest'
import {
  COMPARATIVO,
  CRITERIOS_DEL_COMPARATIVO,
  IDS_DE_BENEFICIOS,
  PRECIO_DE_FRACCION,
  PRECIO_DEL_APARTAMENTO,
  presentarCelda,
  problemasDelComparativo,
  SECCIONES_DE_BENEFICIOS,
  VENTAJAS,
} from '#shared/content/beneficios'
import { problemasDelManifiesto } from '#shared/content/manifiesto'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-42 · RF-42.1…RF-42.4 · TR-02 RF-D.6 — el comparativo vive en una estructura
 * tipada: toda fila tiene las dos columnas y toda cifra lleva su condición.
 */

describe('CA-42.1 · el comparativo está completo', () => {
  it('CA-42.1 · toda fila tiene valor en ambas columnas y ninguna celda queda sin condición', () => {
    expect(problemasDelComparativo(COMPARATIVO)).toEqual([])
    expect(COMPARATIVO.map(fila => fila.id)).toEqual([...CRITERIOS_DEL_COMPARATIVO])
    for (const fila of COMPARATIVO) {
      for (const celda of [fila.traditional, fila.fractional]) {
        expect(celda.textoKey !== undefined || celda.importe !== undefined).toBe(true)
        expect(['confirmado', 'estimado']).toContain(celda.condicion)
      }
    }
  })

  it('CA-42.1 · una celda sin valor o sin condición se detecta', () => {
    const rota = [{ ...COMPARATIVO[0]!, id: 'capital' as const, fractional: { condicion: 'confirmado' as const } }]
    expect(problemasDelComparativo(rota)).toEqual(['capital:fractional:sin_valor'])
  })

  it('RF-42.4 · el manifiesto ordena hero, comparativo, ventajas y CTA al registro', () => {
    expect(SECCIONES_DE_BENEFICIOS.map(s => s.id)).toEqual([...IDS_DE_BENEFICIOS])
    expect(problemasDelManifiesto(SECCIONES_DE_BENEFICIOS)).toEqual([])
    expect(SECCIONES_DE_BENEFICIOS.find(s => s.id === 'cta')?.cta?.destino).toBe(RUTAS_PUBLICAS.registro)
    expect(VENTAJAS.length).toBeGreaterThanOrEqual(6)
  })
})

describe('CA-42.2 · RF-D.6 · una cifra estimada nunca se presenta como confirmada', () => {
  it('CA-42.2 · el precio del apartamento completo es una estimación y sale marcada como tal', () => {
    const capital = COMPARATIVO.find(fila => fila.id === 'capital')!
    const presentada = presentarCelda(capital.traditional, 'es')
    expect(capital.traditional.importe).toBe(PRECIO_DEL_APARTAMENTO)
    expect(presentada.condicion).toBe('estimado')
    expect(presentada.esConfirmado).toBe(false)
  })

  it('CA-42.2 · el precio por fracción es el publicado y sale confirmado', () => {
    const capital = COMPARATIVO.find(fila => fila.id === 'capital')!
    expect(capital.fractional.importe).toBe(PRECIO_DE_FRACCION)
    expect(presentarCelda(capital.fractional, 'es').esConfirmado).toBe(true)
  })
})

describe('CA-42.3 · RF-D.5 · los importes se formatean por TR-02', () => {
  it('CA-42.3 · en español y en inglés, sin decimales y con el símbolo de COP', () => {
    const celda = { importe: pesos(173_000_000), condicion: 'confirmado' as const }
    expect(presentarCelda(celda, 'es').texto).toBe(formatearImporte(pesos(173_000_000), 'es'))
    expect(presentarCelda(celda, 'en').texto).toBe(formatearImporte(pesos(173_000_000), 'en'))
  })

  it('una celda de texto no formatea nada: devuelve su clave para traducir', () => {
    const celda = { textoKey: 'benefits.comparison.cells.usage.fractional', condicion: 'confirmado' as const }
    expect(presentarCelda(celda, 'es')).toEqual({ texto: null, textoKey: celda.textoKey, condicion: 'confirmado', esConfirmado: true })
  })

  it('el precio del apartamento completo es ocho veces el de la fracción', () => {
    expect(PRECIO_DEL_APARTAMENTO).toBe(pesos(173_000_000 * 8))
  })
})
