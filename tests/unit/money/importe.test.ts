import { describe, expect, it } from 'vitest'
import {
  CERO,
  esImporte,
  multiplicarPorEntero,
  pesos,
  restar,
  sumar,
} from '#shared/money/importe'

/**
 * TR-02 · RF-D.1 — el importe es un entero de pesos con tipo nominal.
 * Nivel N1: función pura, sin Nuxt ni base de datos.
 */

describe('pesos', () => {
  it('acepta un entero de pesos', () => {
    expect(pesos(115_500_000)).toBe(115_500_000)
  })

  it('acepta el cero y los negativos (notas crédito, ajustes)', () => {
    expect(pesos(0)).toBe(0)
    expect(pesos(-12_500)).toBe(-12_500)
  })

  it('rechaza un valor con decimales: el COP no opera con centavos', () => {
    expect(() => pesos(12_500.5)).toThrowError(/entero/i)
  })

  it('rechaza NaN e infinitos', () => {
    expect(() => pesos(Number.NaN)).toThrowError(/entero/i)
    expect(() => pesos(Number.POSITIVE_INFINITY)).toThrowError(/entero/i)
  })

  it('rechaza un valor fuera del rango exacto de enteros', () => {
    expect(() => pesos(Number.MAX_SAFE_INTEGER + 2)).toThrowError(/seguro/i)
  })
})

describe('esImporte', () => {
  it('reconoce un entero de pesos', () => {
    expect(esImporte(1000)).toBe(true)
  })

  it('no reconoce decimales ni valores no numéricos', () => {
    expect(esImporte(10.5)).toBe(false)
    expect(esImporte('1000')).toBe(false)
    expect(esImporte(Number.NaN)).toBe(false)
  })
})

describe('aritmética de importes', () => {
  it('suma sin salir del entero', () => {
    expect(sumar(pesos(12_501), pesos(12_500))).toBe(25_001)
  })

  it('resta sin salir del entero', () => {
    expect(restar(pesos(100_000), pesos(37_500))).toBe(62_500)
  })

  it('multiplica por un entero', () => {
    expect(multiplicarPorEntero(pesos(12_500), 8)).toBe(100_000)
  })

  it('rechaza multiplicar por un factor con decimales', () => {
    expect(() => multiplicarPorEntero(pesos(12_500), 1.5)).toThrowError(/entero/i)
  })

  it('CERO es el neutro de la suma', () => {
    expect(sumar(pesos(12_500), CERO)).toBe(12_500)
  })
})
