import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  formatearImporte,
  formatearPorcentaje,
  proporcionEnPuntosBasicos,
  regionDe,
} from '#shared/money/formato'

/**
 * TR-02 · RF-D.5 — presentación de importes y porcentajes.
 * Importes con `Intl.NumberFormat` en `es-CO` / `en-US` y sin decimales.
 * Porcentajes con un decimal: `37,5 %` en español, `37.5%` en inglés.
 *
 * El separador que `Intl` coloca tras el símbolo de moneda es un espacio duro
 * (U+00A0), por eso las expectativas lo escriben explícitamente.
 */

describe('formato de porcentajes', () => {
  it('CA-D.6 · 3 de 8 fracciones vendidas se muestran como 37,5 % en español y 37.5% en inglés', () => {
    const puntos = proporcionEnPuntosBasicos(3, 8)

    expect(puntos).toBe(3750)
    expect(formatearPorcentaje(puntos, 'es')).toBe('37,5 %')
    expect(formatearPorcentaje(puntos, 'en')).toBe('37.5%')
  })

  it('siempre muestra un decimal, incluso en porcentajes redondos', () => {
    expect(formatearPorcentaje(10_000, 'es')).toBe('100,0 %')
    expect(formatearPorcentaje(0, 'en')).toBe('0.0%')
  })

  it('redondea al decimal más cercano sin exponer más precisión de la debida', () => {
    expect(formatearPorcentaje(333, 'es')).toBe('3,3 %')
  })
})

describe('proporcionEnPuntosBasicos', () => {
  it('convierte una proporción en puntos básicos enteros', () => {
    expect(proporcionEnPuntosBasicos(1, 8)).toBe(1250)
    expect(proporcionEnPuntosBasicos(8, 8)).toBe(10_000)
    expect(proporcionEnPuntosBasicos(0, 8)).toBe(0)
  })

  it('un total de cero no produce porcentaje: no hay proporción que mostrar', () => {
    expect(() => proporcionEnPuntosBasicos(0, 0)).toThrowError(/total/i)
  })
})

describe('regiones de formato', () => {
  it('el español usa es-CO y el inglés en-US, igual que los locales de @nuxtjs/i18n', () => {
    expect(regionDe('es')).toBe('es-CO')
    expect(regionDe('en')).toBe('en-US')
  })
})

describe('formato de importes', () => {
  it('formatea en pesos colombianos sin decimales en ambos idiomas', () => {
    expect(formatearImporte(pesos(115_500_000), 'es')).toBe('$\u00A0115.500.000')
    expect(formatearImporte(pesos(115_500_000), 'en')).toBe('COP\u00A0115,500,000')
  })

  it('no muestra centavos nunca, porque el COP no los tiene', () => {
    expect(formatearImporte(pesos(12_501), 'es')).not.toContain(',0')
    expect(formatearImporte(pesos(12_501), 'en')).not.toContain('.0')
  })

  it('formatea el cero y los negativos', () => {
    expect(formatearImporte(pesos(0), 'es')).toBe('$\u00A00')
    expect(formatearImporte(pesos(-12_500), 'es')).toBe('-$\u00A012.500')
  })
})
