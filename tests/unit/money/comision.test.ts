import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import { comision, puntosBasicos, PUNTOS_BASICOS_POR_CIENTO } from '#shared/money/comision'

/**
 * TR-02 · RF-D.4 — comisión porcentual del programa de referidos (HU-52).
 * `comisión = truncar(precio × porcentaje ÷ 100)` hacia abajo, al peso.
 * El porcentaje se guarda en puntos básicos enteros: 10 % = 1000 pb.
 */

describe('comisión sobre el precio de la fracción', () => {
  it('CA-D.5 · 10 % de 115.500.000 son 11.550.000, y 3,33 % trunca al peso sin decimales', () => {
    expect(comision(pesos(115_500_000), 1000)).toBe(11_550_000)

    const truncada = comision(pesos(115_500_000), 333)
    expect(truncada).toBe(3_846_150)
    expect(Number.isInteger(truncada)).toBe(true)
  })

  it('trunca hacia abajo cuando la división no es exacta', () => {
    // 3,33 % de 1.000.001 = 33.300,0333 → trunca a 33.300
    expect(comision(pesos(1_000_001), 333)).toBe(33_300)
  })

  it('una comisión del 0 % no genera saldo', () => {
    expect(comision(pesos(115_500_000), 0)).toBe(0)
  })

  it('conserva la exactitud con precios grandes, sin desbordar el entero seguro', () => {
    expect(comision(pesos(99_999_999_999), 1000)).toBe(9_999_999_999)
  })

  it('rechaza puntos básicos que no sean un entero no negativo', () => {
    expect(() => comision(pesos(1000), 10.5)).toThrowError(/puntos básicos/i)
    expect(() => comision(pesos(1000), -100)).toThrowError(/puntos básicos/i)
  })
})

describe('puntosBasicos', () => {
  it('convierte un porcentaje humano en puntos básicos enteros', () => {
    expect(puntosBasicos(10)).toBe(1000)
    expect(puntosBasicos(3.33)).toBe(333)
    expect(puntosBasicos(37.5)).toBe(3750)
  })

  it('un punto porcentual son 100 puntos básicos', () => {
    expect(PUNTOS_BASICOS_POR_CIENTO).toBe(100)
  })

  it('rechaza un porcentaje con más de dos decimales, que no cabe en puntos básicos', () => {
    expect(() => puntosBasicos(3.333)).toThrowError(/dos decimales/i)
  })
})
