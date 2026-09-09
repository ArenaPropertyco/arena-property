import { describe, expect, it } from 'vitest'
import { applySwap, swappableWeeksFor, validateSwap, validateSwapRequest } from '#shared/scheduling/swaps'
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

describe('CA-12.11 · solicitud de intercambio del Propietario', () => {
  it('CA-12.11 · solo ofrece una semana propia por una ajena de la misma temporada', () => {
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 0, targetFraction: 3, requestedWeek: 2 }, { allocations })).toEqual([])
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 1, targetFraction: 2, requestedWeek: 0 }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.week_not_owned', weeks: [1, 0] }])
    expect(validateSwapRequest({ fraction: 1, offeredWeek: 0, targetFraction: 3, requestedWeek: 8 }, { allocations }))
      .toEqual([{ message: 'calendar.swaps.validation.different_season' }])
  })
})
