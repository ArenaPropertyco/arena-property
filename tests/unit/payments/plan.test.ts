import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  ESTADOS_DE_PLAN,
  EVENTOS_DEL_PLAN,
  abonado,
  calendarioActivo,
  derivarPlan,
  estadoDelPlan,
  eventosPendientes,
  saldoPendiente,
} from '#shared/payments/plan'
import type { AbonoDelPlan } from '#shared/payments/plan'

/**
 * HU-58 · RF-58.3, RF-58.6, RF-58.7 y D-31 — los estados se derivan, no se marcan.
 *
 * Todo lo que aquí se prueba es una función pura sobre el plan y sus abonos (DT-04):
 * el mismo cálculo que la base repite en `public.estado_del_plan`. Si un día
 * divergen, uno de los dos está mal, y este archivo es el que lo dice primero.
 */

const PRECIO = pesos(100_000_000)

function abono(monto: number, voided = false): AbonoDelPlan {
  return { amount: pesos(monto), voided }
}

describe('CA-58.1 · derivación del estado del plan', () => {
  it('el vocabulario del plan es cerrado', () => {
    expect(ESTADOS_DE_PLAN).toEqual(['reserved', 'in_progress', 'completed', 'voided'])
  })

  it('CA-58.1 · un plan de $100.000.000 sin abonos es «Reservada»', () => {
    expect(estadoDelPlan(PRECIO, [])).toBe('reserved')
  })

  it('CA-58.1 · con un abono de $30.000.000 es «En proceso de pago»', () => {
    expect(estadoDelPlan(PRECIO, [abono(30_000_000)])).toBe('in_progress')
  })

  it('CA-58.1 · con abonos que suman $100.000.000 es «Pago completado»', () => {
    expect(estadoDelPlan(PRECIO, [abono(30_000_000), abono(70_000_000)])).toBe('completed')
  })

  it('RF-58.5 · un abono anulado no cuenta: el estado se recalcula sin él', () => {
    expect(abonado([abono(30_000_000), abono(70_000_000, true)])).toBe(30_000_000)
    expect(estadoDelPlan(PRECIO, [abono(30_000_000), abono(70_000_000, true)])).toBe('in_progress')
  })

  it('CA-58.3 · anular el abono que completaba el pago devuelve el plan a «En proceso de pago»', () => {
    const antes = [abono(30_000_000), abono(70_000_000)]
    const despues = [abono(30_000_000), abono(70_000_000, true)]

    expect(estadoDelPlan(PRECIO, antes)).toBe('completed')
    expect(estadoDelPlan(PRECIO, despues)).toBe('in_progress')
  })

  it('RF-58.8 · un plan anulado es «Anulado» sin importar cuánto se abonó', () => {
    expect(estadoDelPlan(PRECIO, [abono(100_000_000)], { anulado: true })).toBe('voided')
  })

  it('CA-58.2 · un total abonado por encima del precio pactado es un estado imposible, no un estado', () => {
    expect(() => estadoDelPlan(PRECIO, [abono(100_000_001)])).toThrow(RangeError)
  })

  it('el saldo pendiente es exacto en pesos', () => {
    expect(saldoPendiente(PRECIO, [abono(30_000_000)])).toBe(70_000_000)
    expect(saldoPendiente(PRECIO, [abono(30_000_000), abono(70_000_000)])).toBe(0)
  })
})

describe('CA-58.8 · el interruptor de calendario se deriva del plan (D-31)', () => {
  it('CA-58.8 · «Pago completado» activa el calendario; cualquier otro estado lo deja inactivo', () => {
    expect(calendarioActivo('completed')).toBe(true)
    expect(calendarioActivo('reserved')).toBe(false)
    expect(calendarioActivo('in_progress')).toBe(false)
    expect(calendarioActivo('voided')).toBe(false)
  })

  it('CA-58.8 · un abono anulado que devuelve el plan a «En proceso» apaga el calendario', () => {
    const completo = derivarPlan(PRECIO, [abono(100_000_000)], { anulado: false, emitidos: [] })
    const revertido = derivarPlan(PRECIO, [abono(100_000_000, true)], { anulado: false, emitidos: [] })

    expect(completo.calendarioActivo).toBe(true)
    expect(revertido.calendarioActivo).toBe(false)
  })
})

describe('CA-58.4 · el evento de pago completado se emite una sola vez', () => {
  it('el catálogo de eventos es cerrado', () => {
    expect(EVENTOS_DEL_PLAN).toEqual(['payment_completed', 'purchase_voided'])
  })

  it('CA-58.4 · recalcular tres veces un plan completo produce el evento solo la primera', () => {
    const abonos = [abono(100_000_000)]
    let emitidos: string[] = []
    const emisiones: number[] = []

    for (let vez = 0; vez < 3; vez++) {
      const derivado = derivarPlan(PRECIO, abonos, { anulado: false, emitidos: emitidos as never })
      emisiones.push(derivado.eventos.length)
      emitidos = [...emitidos, ...derivado.eventos]
    }

    expect(emisiones).toEqual([1, 0, 0])
    expect(emitidos).toEqual(['payment_completed'])
  })

  it('CA-58.9 · la activación del calendario tampoco se repite: es idempotente', () => {
    const primera = derivarPlan(PRECIO, [abono(100_000_000)], { anulado: false, emitidos: [] })
    const segunda = derivarPlan(PRECIO, [abono(100_000_000)], { anulado: false, emitidos: primera.eventos })

    expect(primera.calendarioActivo).toBe(true)
    expect(segunda.calendarioActivo).toBe(true)
    expect(segunda.eventos).toEqual([])
  })

  it('un plan sin completar no emite nada', () => {
    expect(eventosPendientes('reserved', [])).toEqual([])
    expect(eventosPendientes('in_progress', [])).toEqual([])
  })

  it('CA-58.7 · la anulación de la compra emite exactamente un evento de reversa', () => {
    const primera = derivarPlan(PRECIO, [abono(40_000_000)], { anulado: true, emitidos: [] })
    const segunda = derivarPlan(PRECIO, [abono(40_000_000)], { anulado: true, emitidos: primera.eventos })

    expect(primera.eventos).toEqual(['purchase_voided'])
    expect(primera.calendarioActivo).toBe(false)
    expect(segunda.eventos).toEqual([])
  })

  it('un plan que se completó y luego se anula conserva el evento de pago y suma el de reversa', () => {
    const derivado = derivarPlan(PRECIO, [abono(100_000_000)], { anulado: true, emitidos: ['payment_completed'] })

    expect(derivado.estado).toBe('voided')
    expect(derivado.eventos).toEqual(['purchase_voided'])
  })
})
