import { describe, expect, it } from 'vitest'
import { pesos, sumarTodos } from '#shared/money/importe'
import { generarCuotas, pagadorDe } from '#shared/finance/cuotas'
import type { FraccionParaCuota } from '#shared/finance/cuotas'

/**
 * HU-23 · RF-23.3, RF-23.6 · D-08, D-31 · TR-02 RF-D.2, RF-D.3 — las 8 cuotas de un
 * gasto y quién paga cada una. Función pura: el mismo gasto produce siempre las
 * mismas cuotas, y la base repite el mismo cálculo en su disparador.
 */

/** Ocho fracciones sin vender: todo lo paga el titular del inventario. */
function sinVender(): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, indice) => ({
    number: indice + 1,
    status: 'available',
    ownerId: null,
    calendarActive: false,
    calendarActivatedAt: null,
  }))
}

/** Las fracciones indicadas están vendidas y con el calendario activo desde 2026-01-01. */
function conActivas(numeros: number[]): FraccionParaCuota[] {
  return sinVender().map(fraccion => numeros.includes(fraccion.number)
    ? { ...fraccion, status: 'sold', ownerId: `titular-${fraccion.number}`, calendarActive: true, calendarActivatedAt: '2026-01-01T05:00:00Z' }
    : fraccion)
}

const CAUSACION = '2026-09-14'

describe('CA-23.1 · un gasto divisible se reparte en 8 cuotas iguales', () => {
  it('CA-23.1 · $100.000 produce 8 cuotas de $12.500 que suman exactamente $100.000', () => {
    const cuotas = generarCuotas(pesos(100_000), sinVender(), CAUSACION)

    expect(cuotas).toHaveLength(8)
    expect(cuotas.map(cuota => cuota.amount)).toEqual(Array(8).fill(12_500))
    expect(sumarTodos(cuotas.map(cuota => cuota.amount))).toBe(100_000)
    expect(cuotas.every(cuota => !cuota.hasRemainder)).toBe(true)
    expect(cuotas.map(cuota => cuota.fraction)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})

describe('CA-23.2 · un monto no divisible reparte el residuo según TR-02', () => {
  it('CA-23.2 · $100.001: la fracción 1/8 recibe 12.501, las demás 12.500, la suma es exacta y solo la primera lleva residuo', () => {
    const cuotas = generarCuotas(pesos(100_001), sinVender(), CAUSACION)

    expect(cuotas[0]).toMatchObject({ fraction: 1, amount: 12_501, hasRemainder: true })
    expect(cuotas.slice(1).map(cuota => cuota.amount)).toEqual(Array(7).fill(12_500))
    expect(cuotas.slice(1).every(cuota => !cuota.hasRemainder)).toBe(true)
    expect(sumarTodos(cuotas.map(cuota => cuota.amount))).toBe(100_001)
  })

  it('RF-23.7 · el reparto es determinista: el mismo gasto produce las mismas cuotas', () => {
    const una = generarCuotas(pesos(100_007), sinVender(), CAUSACION)
    const otra = generarCuotas(pesos(100_007), sinVender(), CAUSACION)

    expect(una).toEqual(otra)
    expect(una.filter(cuota => cuota.hasRemainder).map(cuota => cuota.fraction)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('CA-23.5 · las fracciones sin calendario activo las paga el titular del inventario', () => {
  it('CA-23.5 · con 3 calendarios activos y $80.000 salen 8 cuotas de $10.000: 3 del Propietario y 5 del inventario', () => {
    const cuotas = generarCuotas(pesos(80_000), conActivas([2, 5, 7]), CAUSACION)

    expect(cuotas.map(cuota => cuota.amount)).toEqual(Array(8).fill(10_000))
    expect(cuotas.filter(cuota => cuota.payer === 'owner').map(cuota => cuota.fraction)).toEqual([2, 5, 7])
    expect(cuotas.filter(cuota => cuota.payer === 'inventory_holder')).toHaveLength(5)
    expect(cuotas.find(cuota => cuota.fraction === 5)?.payerId).toBe('titular-5')
    expect(cuotas.filter(cuota => cuota.payer === 'inventory_holder').every(cuota => cuota.payerId === null)).toBe(true)
  })

  it('D-08 · ninguna cuota queda sin pagador ni se redistribuye entre los propietarios actuales', () => {
    const cuotas = generarCuotas(pesos(80_000), conActivas([1]), CAUSACION)

    expect(sumarTodos(cuotas.map(cuota => cuota.amount))).toBe(80_000)
    expect(cuotas.every(cuota => cuota.payer === 'owner' || cuota.payer === 'inventory_holder')).toBe(true)
    expect(cuotas.filter(cuota => cuota.payer === 'owner')).toHaveLength(1)
  })
})

describe('CA-23.7 · el Propietario asume la cuota desde la primera causación posterior a la activación', () => {
  const vendidaInactiva: FraccionParaCuota = {
    number: 3,
    status: 'sold',
    ownerId: 'titular-3',
    calendarActive: false,
    calendarActivatedAt: null,
  }

  it('CA-23.7 · una fracción vendida con calendario inactivo se imputa al titular del inventario', () => {
    expect(pagadorDe(vendidaInactiva, CAUSACION)).toEqual({ payer: 'inventory_holder', payerId: null })
  })

  it('CA-23.7 · activado el calendario, la causación siguiente se imputa al Propietario', () => {
    const activada = { ...vendidaInactiva, calendarActive: true, calendarActivatedAt: '2026-09-10T15:00:00Z' }

    expect(pagadorDe(activada, '2026-09-14')).toEqual({ payer: 'owner', payerId: 'titular-3' })
    expect(pagadorDe(activada, '2026-09-10')).toEqual({ payer: 'owner', payerId: 'titular-3' })
  })

  it('CA-23.7 · una causación anterior a la activación sigue siendo del inventario aunque hoy el calendario esté activo', () => {
    const activada = { ...vendidaInactiva, calendarActive: true, calendarActivatedAt: '2026-09-10T15:00:00Z' }

    expect(pagadorDe(activada, '2026-09-09')).toEqual({ payer: 'inventory_holder', payerId: null })
  })

  it('D-31 · la activación se lee en la zona del negocio: activada a las 23:30 de Bogotá cuenta ese mismo día', () => {
    const activada = { ...vendidaInactiva, calendarActive: true, calendarActivatedAt: '2026-09-11T04:30:00Z' }

    expect(pagadorDe(activada, '2026-09-10')).toEqual({ payer: 'owner', payerId: 'titular-3' })
  })
})

describe('RF-09.3 · el prorrateo exige las 8 fracciones', () => {
  it('con 7 fracciones no hay reparto posible', () => {
    expect(() => generarCuotas(pesos(100_000), sinVender().slice(0, 7), CAUSACION)).toThrow(/8 fracciones/)
  })

  it('con una fracción repetida tampoco', () => {
    const repetidas = [...sinVender().slice(0, 7), { ...sinVender()[0]! }]

    expect(() => generarCuotas(pesos(100_000), repetidas, CAUSACION)).toThrow(/8 fracciones/)
  })

  it('las cuotas salen por número ascendente aunque las fracciones lleguen desordenadas', () => {
    const cuotas = generarCuotas(pesos(100_003), [...sinVender()].reverse(), CAUSACION)

    expect(cuotas.map(cuota => cuota.fraction)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(cuotas.filter(cuota => cuota.hasRemainder).map(cuota => cuota.fraction)).toEqual([1, 2, 3])
  })
})
