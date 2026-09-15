import { describe, expect, it } from 'vitest'
import {
  ORIGENES_DE_SEMANA,
  comisionDeGestion,
  esAtribuible,
  repartirIngreso,
} from '#shared/finance/ingresos'
import type { OrigenDeSemana } from '#shared/finance/ingresos'
import type { FraccionParaCuota } from '#shared/finance/cuotas'
import { pesos, sumarTodos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'

/**
 * HU-40 · RF-40.2, RF-40.4, RF-40.5 · D-39 · TR-02 — a quién pertenece el ingreso
 * de una semana rentada a un tercero.
 *
 * La decisión es del **origen de la semana**, no del momento ni de quién registra:
 * liberada voluntariamente se atribuye a su fracción neta de comisión; cancelada,
 * caducada, reubicada o sobrante de la rejilla se prorratea entre las ocho.
 */

/** Ocho fracciones vendidas y con calendario activo desde 2026-01-01. */
function ochoActivas(): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, indice) => ({
    number: indice + 1,
    status: 'sold',
    ownerId: `titular-${indice + 1}`,
    calendarActive: true,
    calendarActivatedAt: '2026-01-01T05:00:00Z',
  }))
}

/** Ninguna vendida: todo lo asume el titular del inventario (D-08). */
function ochoLibres(): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, indice) => ({
    number: indice + 1,
    status: 'available',
    ownerId: null,
    calendarActive: false,
    calendarActivatedAt: null,
  }))
}

const CAUSACION = '2026-09-14'
const VEINTE_POR_CIENTO = puntosBasicos(20)

describe('RF-40.2 · el origen de la semana decide el destino del ingreso (D-39)', () => {
  it('solo la semana liberada voluntariamente es atribuible', () => {
    expect(esAtribuible('voluntary')).toBe(true)
    for (const origen of ORIGENES_DE_SEMANA.filter(o => o !== 'voluntary')) {
      expect(esAtribuible(origen), origen).toBe(false)
    }
  })

  it('el vocabulario de orígenes es el de RF-39.2b', () => {
    expect([...ORIGENES_DE_SEMANA]).toEqual(['voluntary', 'cancelled', 'expired', 'relocated', 'pool'])
  })
})

describe('CA-40.1 · una semana cancelada se prorratea entre las 8', () => {
  it('CA-40.1 · $800.000 sobre una semana cancelada: cada fracción recibe $100.000 y la suma es exacta', () => {
    const reparto = repartirIngreso({
      bruto: pesos(800_000),
      origen: 'cancelled',
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: VEINTE_POR_CIENTO,
    })

    expect(reparto.naturaleza).toBe('prorated')
    expect(reparto.cuotas).toHaveLength(8)
    expect(reparto.cuotas.map(cuota => cuota.amount)).toEqual(Array(8).fill(100_000))
    expect(sumarTodos(reparto.cuotas.map(cuota => cuota.amount))).toBe(800_000)
    expect(reparto.comision).toBe(0)
  })

  it('CA-40.1 · una semana cancelada no paga comisión de gestión aunque la propiedad la tenga configurada', () => {
    const reparto = repartirIngreso({
      bruto: pesos(800_000),
      origen: 'cancelled',
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: VEINTE_POR_CIENTO,
    })

    expect(reparto.comision).toBe(0)
    expect(sumarTodos(reparto.cuotas.map(cuota => cuota.amount))).toBe(800_000)
  })

  it('D-08 · las fracciones sin calendario activo las cobra el titular del inventario', () => {
    const reparto = repartirIngreso({
      bruto: pesos(800_000),
      origen: 'expired',
      fraccionDeOrigen: null,
      fracciones: ochoLibres(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: null,
    })

    expect(reparto.cuotas.every(cuota => cuota.payer === 'inventory_holder')).toBe(true)
    expect(sumarTodos(reparto.cuotas.map(cuota => cuota.amount))).toBe(800_000)
  })

  it('RF-40.2 · una semana sobrante de la rejilla también se prorratea, sin fracción de origen', () => {
    const reparto = repartirIngreso({
      bruto: pesos(800_000),
      origen: 'pool',
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: null,
    })

    expect(reparto.naturaleza).toBe('prorated')
    expect(reparto.cuotas).toHaveLength(8)
  })
})

describe('CA-40.4 · una semana liberada voluntariamente es de quien la liberó', () => {
  const reparto = () => repartirIngreso({
    bruto: pesos(800_000),
    origen: 'voluntary',
    fraccionDeOrigen: 3,
    fracciones: ochoActivas(),
    incurredOn: CAUSACION,
    comisionPuntosBasicos: VEINTE_POR_CIENTO,
  })

  it('CA-40.4 · $800.000 al 20 %: la fracción 3/8 recibe $640.000 y las otras siete, nada', () => {
    const resultado = reparto()

    expect(resultado.naturaleza).toBe('attributed')
    expect(resultado.cuotas).toEqual([
      { fraction: 3, amount: 640_000, hasRemainder: false, payer: 'owner', payerId: 'titular-3' },
    ])
  })

  it('CA-40.4 · Arena registra $160.000 de comisión', () => {
    expect(reparto().comision).toBe(160_000)
  })

  it('CA-40.4 · neto + comisión suman exactamente el bruto', () => {
    const resultado = reparto()

    expect(resultado.cuotas[0]!.amount + resultado.comision).toBe(800_000)
  })

  it('RF-40.2 · la cuota atribuida no lleva residuo: no se dividió nada', () => {
    expect(reparto().cuotas[0]!.hasRemainder).toBe(false)
  })
})

describe('CA-40.6 · el neto se trunca al peso sin perder ni un peso (TR-02 RF-D.1)', () => {
  it('CA-40.6 · un bruto que no divide exacto: comisión + neto siguen sumando el bruto', () => {
    const reparto = repartirIngreso({
      bruto: pesos(333_333),
      origen: 'voluntary',
      fraccionDeOrigen: 5,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: puntosBasicos(17.5),
    })

    // 333.333 × 17,5 % = 58.333,275 → truncado 58.333; el neto absorbe el resto.
    expect(reparto.comision).toBe(58_333)
    expect(reparto.cuotas[0]!.amount).toBe(275_000)
    expect(reparto.cuotas[0]!.amount + reparto.comision).toBe(333_333)
  })

  it('CA-40.6 · el peso que el truncamiento deja suelto se queda en la fracción, nunca se pierde', () => {
    for (const bruto of [1, 7, 999, 100_001, 7_777_777]) {
      const reparto = repartirIngreso({
        bruto: pesos(bruto),
        origen: 'voluntary',
        fraccionDeOrigen: 1,
        fracciones: ochoActivas(),
        incurredOn: CAUSACION,
        comisionPuntosBasicos: puntosBasicos(33.33),
      })

      expect(reparto.cuotas[0]!.amount + reparto.comision, `bruto ${bruto}`).toBe(bruto)
      expect(reparto.comision).toBeGreaterThanOrEqual(0)
    }
  })

  it('una comisión del 0 % deja el bruto íntegro en la fracción', () => {
    const reparto = repartirIngreso({
      bruto: pesos(500_000),
      origen: 'voluntary',
      fraccionDeOrigen: 2,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: 0,
    })

    expect(reparto.comision).toBe(0)
    expect(reparto.cuotas[0]!.amount).toBe(500_000)
  })

  it('comisionDeGestion trunca hacia abajo, como RF-D.4', () => {
    expect(comisionDeGestion(pesos(800_000), VEINTE_POR_CIENTO)).toBe(160_000)
    expect(comisionDeGestion(pesos(333_333), puntosBasicos(17.5))).toBe(58_333)
  })
})

describe('CA-40.5 · sin comisión configurada el ingreso atribuido no se registra', () => {
  it('CA-40.5 · una semana liberada en una propiedad sin porcentaje se rechaza, en vez de inventar un reparto', () => {
    expect(() => repartirIngreso({
      bruto: pesos(800_000),
      origen: 'voluntary',
      fraccionDeOrigen: 3,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: null,
    })).toThrow(/comisión de gestión/i)
  })

  it('CA-40.5 · las demás semanas sí se registran sin ese dato: no dependen de él', () => {
    expect(() => repartirIngreso({
      bruto: pesos(800_000),
      origen: 'cancelled',
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: null,
    })).not.toThrow()
  })

  it('RF-40.4 · un porcentaje fuera de rango no se acepta', () => {
    for (const puntos of [-1, 10_001]) {
      expect(() => repartirIngreso({
        bruto: pesos(800_000),
        origen: 'voluntary',
        fraccionDeOrigen: 3,
        fracciones: ochoActivas(),
        incurredOn: CAUSACION,
        comisionPuntosBasicos: puntos,
      }), `${puntos} pb`).toThrow()
    }
  })
})

describe('RF-40.2 · la atribución exige una fracción de origen con titular', () => {
  it('sin fracción de origen no hay a quién atribuir', () => {
    expect(() => repartirIngreso({
      bruto: pesos(800_000),
      origen: 'voluntary',
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: VEINTE_POR_CIENTO,
    })).toThrow(/fracci/i)
  })

  it('a una fracción sin vender tampoco se le atribuye', () => {
    expect(() => repartirIngreso({
      bruto: pesos(800_000),
      origen: 'voluntary',
      fraccionDeOrigen: 3,
      fracciones: ochoLibres(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: VEINTE_POR_CIENTO,
    })).toThrow(/vendida/i)
  })

  it('un bruto que no es entero positivo de pesos se rechaza', () => {
    const base = {
      origen: 'cancelled' as OrigenDeSemana,
      fraccionDeOrigen: null,
      fracciones: ochoActivas(),
      incurredOn: CAUSACION,
      comisionPuntosBasicos: null,
    }

    expect(() => repartirIngreso({ ...base, bruto: pesos(0) })).toThrow()
    expect(() => repartirIngreso({ ...base, bruto: pesos(-1) })).toThrow()
  })
})
