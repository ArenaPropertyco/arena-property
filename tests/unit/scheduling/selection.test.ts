import { describe, expect, it } from 'vitest'
import { CRITERIO_POR_DEFECTO } from '#shared/scheduling/criterio'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import {
  availableWeeks,
  isValidOrder,
  purchaseOrder,
  selectionSummary,
  suggestNextOrder,
  turnOf,
  validateWeekSelection,
  weeksPerFraction,
} from '#shared/scheduling/selection'
import type { SelectionTurn } from '#shared/scheduling/selection'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.3, RF-12.4, RF-12.5 · D-12, D-32 · schedule.md P-04, P-07, I-05,
 * I-10 — cada Propietario elige sus 6 semanas por turnos: composición exacta,
 * semanas libres, orden de compra el primer año y sugerencia rotada después.
 */

const ANIO = 2027
const rejilla = rejillaDelAnio(ANIO)

/** 8 altas (0..7), 8 media-altas (8..15), 8 medias (16..23) y el resto bajas. */
function classification(): SemanaClasificada[] {
  return clasificacionBase(rejilla).map(s => ({
    ...s,
    temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
  }))
}

const VALID_PICK = [0, 8, 16, 24, 25, 26]

function turns(selected: Record<number, number> = {}, unsold: number[] = []): SelectionTurn[] {
  return [3, 1, 5, 2, 8, 4, 7, 6].map((fraction, position) => ({
    fraction,
    position,
    hasOwner: !unsold.includes(fraction),
    selectedWeeks: selected[fraction] ?? 0,
  }))
}

describe('CA-12.2 · la elección es exactamente 1 alta, 1 media-alta, 1 media y 3 bajas', () => {
  it('CA-12.2 · el criterio por defecto son 6 semanas por fracción', () => {
    expect(weeksPerFraction(CRITERIO_POR_DEFECTO)).toBe(6)
  })

  it('CA-12.2 · una elección correcta no tiene errores y suma 7/7/7/21 noches', () => {
    expect(validateWeekSelection(VALID_PICK, { classification: classification(), taken: new Set() })).toEqual([])
    expect(selectionSummary(VALID_PICK, classification())).toEqual({ alta: 1, media_alta: 1, media: 1, baja: 3 })
  })

  it('CA-12.2 · dos altas y ninguna media se rechazan indicando la temporada', () => {
    const errors = validateWeekSelection([0, 1, 8, 24, 25, 26], { classification: classification(), taken: new Set() })
    expect(errors).toEqual([
      { message: 'calendar.selection.validation.wrong_composition', season: 'alta', required: 1, chosen: 2 },
      { message: 'calendar.selection.validation.wrong_composition', season: 'media', required: 1, chosen: 0 },
    ])
  })

  it('CA-12.2 · menos o más de 6 semanas se rechaza por cantidad', () => {
    expect(validateWeekSelection([0, 8, 16], { classification: classification(), taken: new Set() }))
      .toEqual([{ message: 'calendar.selection.validation.wrong_count', required: 6, chosen: 3 }])
    expect(validateWeekSelection([0, 8, 16, 24, 25, 26, 27], { classification: classification(), taken: new Set() }))
      .toEqual([{ message: 'calendar.selection.validation.wrong_count', required: 6, chosen: 7 }])
  })

  it('una semana repetida o fuera de la rejilla se rechaza', () => {
    expect(validateWeekSelection([0, 0, 8, 16, 24, 25], { classification: classification(), taken: new Set() }))
      .toEqual([{ message: 'calendar.selection.validation.week_duplicated', weeks: [0] }])
    expect(validateWeekSelection([0, 8, 16, 24, 25, 99], { classification: classification(), taken: new Set() }))
      .toEqual([{ message: 'calendar.selection.validation.week_unknown', weeks: [99] }])
  })
})

describe('CA-12.3 · una semana ya elegida no se elige dos veces', () => {
  it('CA-12.3 · la semana de otra fracción se rechaza con su índice', () => {
    const errors = validateWeekSelection(VALID_PICK, { classification: classification(), taken: new Set([8, 25]) })
    expect(errors).toEqual([{ message: 'calendar.selection.validation.week_taken', weeks: [8, 25] }])
  })

  it('CA-12.3 · las semanas disponibles excluyen las ya elegidas', () => {
    const libres = availableWeeks(classification(), new Set([0, 1, 2]))
    expect(libres.filter(s => s.temporada === 'alta').map(s => s.indice)).toEqual([3, 4, 5, 6, 7])
    expect(libres).toHaveLength(rejilla.length - 3)
  })
})

describe('CA-12.4 · el orden del primer año es el orden de compra', () => {
  it('CA-12.4 · de la compra más antigua a la más reciente, sin fracciones sin titular', () => {
    const order = purchaseOrder([
      { number: 1, purchasedAt: '2026-05-10T10:00:00Z' },
      { number: 2, purchasedAt: null },
      { number: 3, purchasedAt: '2026-03-01T09:00:00Z' },
      { number: 4, purchasedAt: '2026-05-10T10:00:00Z' },
      { number: 5, purchasedAt: '2026-08-20T12:00:00Z' },
    ])
    expect(order).toEqual([3, 1, 4, 5])
  })
})

describe('CA-12.5 · cada fracción elige solo cuando le llega el turno', () => {
  it('CA-12.5 · la primera del orden puede elegir; la segunda espera a que la primera termine', () => {
    expect(turnOf(turns(), 3)).toEqual({ position: 0, canSelect: true, done: false, waitingFor: null })
    expect(turnOf(turns(), 1)).toEqual({ position: 1, canSelect: false, done: false, waitingFor: 3 })
  })

  it('CA-12.5 · con la primera completa, la segunda elige; la tercera espera a la segunda', () => {
    const state = turns({ 3: 6 })
    expect(turnOf(state, 1)).toMatchObject({ canSelect: true, waitingFor: null })
    expect(turnOf(state, 5)).toMatchObject({ canSelect: false, waitingFor: 1 })
    expect(turnOf(state, 3)).toMatchObject({ canSelect: false, done: true })
  })

  it('CA-12.5 · una fracción sin titular se salta y no bloquea a la siguiente', () => {
    const state = turns({ 3: 6 }, [1])
    expect(turnOf(state, 5)).toMatchObject({ canSelect: true, waitingFor: null })
    expect(turnOf(state, 1)).toMatchObject({ canSelect: false, done: false })
  })

  it('CA-12.5 · una fracción fuera del orden no tiene turno', () => {
    expect(turnOf(turns().slice(0, 4), 8)).toEqual({ position: null, canSelect: false, done: false, waitingFor: null })
  })

  it('CA-12.5 · la validación completa rechaza elegir fuera de turno o dos veces', () => {
    const base = { classification: classification(), taken: new Set<number>() }
    expect(validateWeekSelection(VALID_PICK, { ...base, turn: turnOf(turns(), 1) }))
      .toEqual([{ message: 'calendar.selection.validation.not_your_turn', waitingFor: 3 }])
    expect(validateWeekSelection(VALID_PICK, { ...base, turn: turnOf(turns({ 3: 6 }), 3) }))
      .toEqual([{ message: 'calendar.selection.validation.already_selected' }])
  })
})

describe('CA-12.6 · el orden del año siguiente se sugiere rotado y el Administrador lo confirma', () => {
  it('CA-12.6 · la sugerencia rota el orden anterior: la primera pasa al final', () => {
    expect(suggestNextOrder([3, 1, 5, 2, 8, 4, 7, 6])).toEqual([1, 5, 2, 8, 4, 7, 6, 3])
    expect(suggestNextOrder([])).toEqual([])
  })

  it('CA-12.6 · un orden válido es una permutación de las fracciones con titular', () => {
    expect(isValidOrder([2, 1, 3], [1, 2, 3])).toBe(true)
    expect(isValidOrder([2, 1], [1, 2, 3])).toBe(false)
    expect(isValidOrder([2, 1, 1], [1, 2, 3])).toBe(false)
    expect(isValidOrder([2, 1, 3, 9], [1, 2, 3])).toBe(false)
  })
})
