import { describe, expect, it } from 'vitest'
import { pesos, sumarTodos } from '#shared/money/importe'
import { prorratear } from '#shared/money/prorrateo'

/**
 * TR-02 · RF-D.2 y RF-D.3 — reparto canónico de un monto entre fracciones.
 * `q = M div 8`, `r = M mod 8`; las primeras `r` fracciones por número ascendente
 * reciben `q + 1`. La suma de las cuotas es siempre exactamente `M`.
 */

describe('prorrateo entre las 8 fracciones', () => {
  it('CA-D.1 · un monto divisible reparte cuotas iguales sin residuo', () => {
    const cuotas = prorratear(pesos(100_000))

    expect(cuotas).toHaveLength(8)
    expect(cuotas.map(cuota => cuota.monto)).toEqual(Array.from({ length: 8 }, () => 12_500))
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(100_000)
    expect(cuotas.some(cuota => cuota.conResiduo)).toBe(false)
  })

  it('CA-D.2 · con residuo 1 solo la fracción 1/8 recibe el peso extra y queda marcada', () => {
    const cuotas = prorratear(pesos(100_001))

    expect(cuotas[0]).toMatchObject({ fraccion: 1, monto: 12_501, conResiduo: true })
    expect(cuotas.slice(1).map(cuota => cuota.monto)).toEqual(Array.from({ length: 7 }, () => 12_500))
    expect(cuotas.filter(cuota => cuota.conResiduo)).toHaveLength(1)
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(100_001)
  })

  it('CA-D.3 · con residuo 7 las fracciones 1/8 a 7/8 reciben el peso extra y la 8/8 no', () => {
    const cuotas = prorratear(pesos(100_007))

    expect(cuotas.slice(0, 7).map(cuota => cuota.monto)).toEqual(Array.from({ length: 7 }, () => 12_501))
    expect(cuotas[7]).toMatchObject({ fraccion: 8, monto: 12_500, conResiduo: false })
    expect(cuotas.filter(cuota => cuota.conResiduo).map(cuota => cuota.fraccion)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(100_007)
  })

  it('CA-D.4 · el mismo monto repartido dos veces produce exactamente el mismo reparto', () => {
    expect(prorratear(pesos(100_007))).toEqual(prorratear(pesos(100_007)))
    expect(prorratear(pesos(1))).toEqual(prorratear(pesos(1)))
  })
})

describe('invariante de exactitud del reparto', () => {
  it('la suma de las cuotas iguala el monto original para todo residuo posible', () => {
    for (let residuo = 0; residuo < 8; residuo++) {
      const monto = pesos(100_000 + residuo)
      const cuotas = prorratear(monto)

      expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(monto)
      expect(cuotas.filter(cuota => cuota.conResiduo)).toHaveLength(residuo)
    }
  })

  it('reparte montos menores que el número de fracciones sin perder ni inventar pesos', () => {
    const cuotas = prorratear(pesos(3))

    expect(cuotas.map(cuota => cuota.monto)).toEqual([1, 1, 1, 0, 0, 0, 0, 0])
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(3)
  })

  it('reparte un monto negativo (nota crédito) conservando la suma exacta', () => {
    const cuotas = prorratear(pesos(-100_001))

    expect(cuotas[0]).toMatchObject({ fraccion: 1, monto: -12_501, conResiduo: true })
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(-100_001)
  })

  it('acepta un número de partes distinto de 8', () => {
    const cuotas = prorratear(pesos(10), 3)

    expect(cuotas.map(cuota => cuota.monto)).toEqual([4, 3, 3])
    expect(sumarTodos(cuotas.map(cuota => cuota.monto))).toBe(10)
  })

  it('rechaza un número de partes que no sea un entero positivo', () => {
    expect(() => prorratear(pesos(100), 0)).toThrowError(/partes/i)
    expect(() => prorratear(pesos(100), 2.5)).toThrowError(/partes/i)
  })
})
