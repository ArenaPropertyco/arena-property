import { describe, expect, it } from 'vitest'
import { agregarSerie, claveDePeriodo, etiquetaDePeriodo, PERIODOS, totalDeSerie } from '#shared/metrics/series'
import type { EventoDeSerie } from '#shared/metrics/series'

/**
 * HU-32 · RF-32.2 · RT-02 — las series por periodo son lógica pura sobre eventos
 * tipados: el gráfico solo recibe la serie ya calculada.
 *
 * Ocho eventos entre julio de 2026 y febrero de 2027. Se agregan por mes,
 * trimestre y año; los huecos del rango se rellenan con cero para que el
 * gráfico no salte periodos.
 */

const EVENTOS: EventoDeSerie[] = [
  { on: '2026-07-14', value: 1 },
  { on: '2026-09-02', value: 1 },
  { on: '2026-09-30', value: 1 },
  { on: '2026-10-01', value: 1 },
  { on: '2026-12-31', value: 1 },
  { on: '2027-01-01', value: 1 },
  { on: '2027-02-10', value: 1 },
  { on: '2027-02-11', value: 1 },
]

describe('RF-32.2 · la clave de periodo', () => {
  it('mensual, trimestral y anual salen de la fecha sin depender de la zona horaria', () => {
    expect(claveDePeriodo('2026-09-30', 'monthly')).toBe('2026-09')
    expect(claveDePeriodo('2026-09-30', 'quarterly')).toBe('2026-Q3')
    expect(claveDePeriodo('2026-10-01', 'quarterly')).toBe('2026-Q4')
    expect(claveDePeriodo('2026-12-31', 'yearly')).toBe('2026')
    expect(PERIODOS).toEqual(['monthly', 'quarterly', 'yearly'])
  })

  it('la etiqueta es legible en cada idioma', () => {
    expect(etiquetaDePeriodo('2026-09', 'monthly', 'es')).toBe('sep 2026')
    expect(etiquetaDePeriodo('2026-09', 'monthly', 'en')).toBe('Sep 2026')
    expect(etiquetaDePeriodo('2026-Q3', 'quarterly', 'es')).toBe('T3 2026')
    expect(etiquetaDePeriodo('2026-Q3', 'quarterly', 'en')).toBe('Q3 2026')
    expect(etiquetaDePeriodo('2026', 'yearly', 'es')).toBe('2026')
  })
})

describe('CA-32.2 · RF-32.2 · los buckets y los totales son correctos', () => {
  it('CA-32.2 · por mes: cada bucket cuenta lo suyo y la suma de buckets es el total', () => {
    const serie = agregarSerie(EVENTOS, 'monthly')
    expect(serie.map(b => [b.key, b.value])).toEqual([
      ['2026-07', 1], ['2026-08', 0], ['2026-09', 2], ['2026-10', 1], ['2026-11', 0], ['2026-12', 1], ['2027-01', 1], ['2027-02', 2],
    ])
    expect(totalDeSerie(serie)).toBe(8)
    expect(serie.reduce((suma, b) => suma + b.value, 0)).toBe(EVENTOS.reduce((suma, e) => suma + e.value, 0))
  })

  it('CA-32.2 · por trimestre y por año los cortes caen donde deben', () => {
    expect(agregarSerie(EVENTOS, 'quarterly').map(b => [b.key, b.value])).toEqual([
      ['2026-Q3', 3], ['2026-Q4', 2], ['2027-Q1', 3],
    ])
    expect(agregarSerie(EVENTOS, 'yearly').map(b => [b.key, b.value])).toEqual([['2026', 5], ['2027', 3]])
  })

  it('CA-32.2 · el valor se suma, no solo se cuenta: sirve para importes', () => {
    const importes: EventoDeSerie[] = [
      { on: '2026-09-12', value: 3_000_000 },
      { on: '2026-09-20', value: 1_500_000 },
      { on: '2026-11-03', value: 900_000 },
    ]
    const serie = agregarSerie(importes, 'monthly')
    expect(serie.map(b => [b.key, b.value, b.count])).toEqual([['2026-09', 4_500_000, 2], ['2026-10', 0, 0], ['2026-11', 900_000, 1]])
    expect(totalDeSerie(serie)).toBe(5_400_000)
  })

  it('un rango explícito rellena con ceros aunque no haya eventos en sus extremos', () => {
    const serie = agregarSerie(EVENTOS.slice(1, 3), 'monthly', { desde: '2026-08-01', hasta: '2026-11-30' })
    expect(serie.map(b => [b.key, b.value])).toEqual([['2026-08', 0], ['2026-09', 2], ['2026-10', 0], ['2026-11', 0]])
  })

  it('sin eventos ni rango, la serie es vacía y su total cero', () => {
    expect(agregarSerie([], 'monthly')).toEqual([])
    expect(totalDeSerie([])).toBe(0)
  })
})
