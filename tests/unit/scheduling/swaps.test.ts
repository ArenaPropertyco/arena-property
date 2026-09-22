import { describe, expect, it } from 'vitest'
import { applySwap, swapErrorKey, swappableWeeksFor, swapRequestBlocked, validateSwap, validateSwapRequest } from '#shared/scheduling/swaps'
import type { AllocationEntry } from '#shared/scheduling/swaps'

/**
 * HU-12 · RF-12.6 · D-28, D-32 · schedule.md I-06 — intercambio de semanas entre
 * fracciones: misma temporada, sin confirmar ni liberar, con motivo cuando lo hace el
 * Administrador; y la solicitud del Propietario, que ofrece una semana propia.
 */

const allocations: AllocationEntry[] = [
  { fraction: 1, week: 0, season: 'alta' },
  { fraction: 1, week: 24, season: 'baja' },
  { fraction: 2, week: 1, season: 'alta' },
  { fraction: 2, week: 25, season: 'baja' },
  { fraction: 3, week: 2, season: 'alta' },
  { fraction: 3, week: 8, season: 'media_alta' },
]

describe('CA-12.10 · intercambio entre fracciones', () => {
  it('CA-12.10 · misma temporada, sin estadías y con motivo: procede y cada semana cambia de fracción', () => {
    const proposal = { from: { fraction: 1, week: 0 }, to: { fraction: 2, week: 1 } }
    expect(validateSwap(proposal, { allocations, reason: 'Acuerdo entre titulares', requireReason: true })).toEqual([])

    const after = applySwap(allocations, proposal)
    expect(after.find(a => a.week === 0)?.fraction).toBe(2)
    expect(after.find(a => a.week === 1)?.fraction).toBe(1)
    expect(after).toHaveLength(allocations.length)
  })

  it('CA-12.10 · semanas de distinta temporada se rechazan', () => {
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 2, week: 25 } }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.different_season' }])
  })

  it('CA-12.10 · una semana confirmada o liberada no se intercambia', () => {
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 2, week: 1 } }, { allocations, lockedWeeks: new Set([1]) }))
      .toEqual([{ message: 'calendar.swaps.validation.week_locked', weeks: [1] }])
  })

  it('CA-12.10 · sin motivo, el Administrador no intercambia', () => {
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 2, week: 1 } }, { allocations, reason: '  ', requireReason: true }))
      .toEqual([{ message: 'calendar.swaps.validation.reason_required' }])
  })

  it('CA-12.10 · la semana debe pertenecer a la fracción indicada y las fracciones ser distintas', () => {
    expect(validateSwap({ from: { fraction: 1, week: 1 }, to: { fraction: 2, week: 0 } }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.week_not_owned', weeks: [1, 0] }])
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 1, week: 24 } }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.same_fraction' }])
  })

  it('las semanas intercambiables por una dada son las de otras fracciones en su temporada', () => {
    expect(swappableWeeksFor(0, allocations).map(a => a.week)).toEqual([1, 2])
    expect(swappableWeeksFor(8, allocations)).toEqual([])
  })
})

describe('CA-12.11 · RF-12.9 · una semana confirmada o liberada no entra en un intercambio', () => {
  const locked = new Set([24])

  it('CA-12.11 · RF-12.9 · ofrecer una semana confirmada se rechaza, y nombra la semana', () => {
    const errores = validateSwapRequest(
      { fraction: 1, offeredWeek: 24, targetFraction: 2, requestedWeek: 25 },
      { allocations, lockedWeeks: locked },
    )
    expect(errores).toEqual([{ message: 'calendar.swaps.validation.week_locked', weeks: [24] }])
  })

  it('RF-12.9 · una solicitud abierta cuya semana se confirmó después ya no se puede aprobar', () => {
    const abierta = { offeredWeek: 24, requestedWeek: 25, status: 'open' }
    expect(swapRequestBlocked(abierta, locked)).toEqual([24])
    expect(swapRequestBlocked({ ...abierta, offeredWeek: 26 }, locked)).toEqual([])
    // Sin saber qué está cerrado no se bloquea nada: la base sigue teniendo la última palabra.
    expect(swapRequestBlocked(abierta, undefined)).toEqual([])
    // Una ya resuelta no se marca: no hay nada que aprobar.
    expect(swapRequestBlocked({ ...abierta, status: 'approved' }, locked)).toEqual([])
  })

  it('RF-12.6 · RF-12.9 · el rechazo de la base se reconoce por la regla que cita', () => {
    expect(swapErrorKey('CA-12.10 · RF-12.9 · alguna de las semanas ya está confirmada o liberada.'))
      .toBe('calendar.swaps.validation.week_locked')
    expect(swapErrorKey('CA-12.10 · RF-12.6 · solo se intercambian semanas de la misma temporada (baja ≠ alta).'))
      .toBe('calendar.swaps.validation.different_season')
    expect(swapErrorKey('CA-12.11 · la solicitud ya fue resuelta.'))
      .toBe('calendar.swaps.validation.already_resolved')
    expect(swapErrorKey('CA-12.10 · RF-12.6 · el intercambio exige un motivo.'))
      .toBe('calendar.swaps.validation.reason_required')
    expect(swapErrorKey('CA-17.4 · solo el Administrador asignado resuelve solicitudes de intercambio.'))
      .toBe('calendar.swaps.validation.not_allowed')
    // Lo que no cita ninguna regla conocida se deja al mensaje genérico de quien llama.
    expect(swapErrorKey('algo se rompió')).toBeNull()
  })
})

describe('CA-12.12 · el intercambio no mira quién es el titular (D-44)', () => {
  // Supóngase que las fracciones 1 y 3 son de la misma persona: el motor no tiene
  // por qué saberlo. La unidad que intercambia es la fracción, no el dueño.
  it('CA-12.12 · dos fracciones del mismo titular se intercambian como cualquier otra pareja', () => {
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 0, targetFraction: 3, requestedWeek: 2 }, { allocations })).toEqual([])
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 3, week: 2 } }, { allocations, reason: 'Junta sus dos fracciones', requireReason: true })).toEqual([])
  })

  it('CA-12.12 · lo único que sigue prohibido es la fracción consigo misma', () => {
    expect(validateSwap({ from: { fraction: 1, week: 0 }, to: { fraction: 1, week: 24 } }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.same_fraction' }])
  })

  it('CA-12.12 · el selector ofrece todas las semanas de la temporada, sean de quien sean', () => {
    expect(swappableWeeksFor(0, allocations).map(a => a.week)).toEqual([1, 2])
  })
})

describe('CA-12.11 · solicitud de intercambio del Propietario', () => {
  it('CA-12.11 · solo ofrece una semana propia por una ajena de la misma temporada', () => {
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 0, targetFraction: 3, requestedWeek: 2 }, { allocations })).toEqual([])
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 1, targetFraction: 2, requestedWeek: 0 }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.week_not_owned', weeks: [1, 0] }])
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 0, targetFraction: 3, requestedWeek: 8 }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.different_season' }])
  })
})
