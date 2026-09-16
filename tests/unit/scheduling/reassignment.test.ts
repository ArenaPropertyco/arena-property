import { describe, expect, it } from 'vitest'
import { applyReassignment, reassignmentTargets, validateReassignment } from '#shared/scheduling/reassignment'
import type { ReassignmentContext } from '#shared/scheduling/reassignment'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import type { AllocationEntry } from '#shared/scheduling/swaps'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { Temporada } from '#shared/scheduling/temporadas'

/**
 * HU-17 · RF-17.1, RF-17.3, RF-17.4 · D-42 — el Administrador mueve una semana de
 * una fracción a una semana libre. El motor puro rechaza el solapamiento
 * (CA-17.2), exige motivo siempre (RF-17.4) y solo cruza de temporada por decisión
 * explícita (CA-17.3); la base repite las mismas reglas en `reassign_week`.
 */

const rejilla = rejillaDelAnio(2027)

function temporadaDe(indice: number): Temporada {
  if (indice < 8) return 'alta'
  if (indice < 16) return 'media_alta'
  if (indice < 24) return 'media'
  return 'baja'
}

const classification = clasificacionBase(rejilla).map(s => ({ ...s, temporada: temporadaDe(s.indice) }))

const allocations: AllocationEntry[] = [
  { fraction: 1, week: 0, season: 'alta' },
  { fraction: 1, week: 24, season: 'baja' },
  { fraction: 1, week: 40, season: 'baja' },
  { fraction: 2, week: 1, season: 'alta' },
  { fraction: 2, week: 25, season: 'baja' },
  { fraction: 3, week: 2, season: 'alta' },
  { fraction: 3, week: 8, season: 'media_alta' },
]

function contexto(cambios: Partial<ReassignmentContext> = {}): ReassignmentContext {
  return {
    allocations,
    releasedWeeks: new Set([40]),
    blockedWeeks: new Set([30]),
    rentedWeeks: new Set([31]),
    classification,
    rejilla,
    today: '2027-01-01',
    ...cambios,
  }
}

const propuesta = { fraction: 1, fromWeek: 24, toWeek: 26, reason: 'Obra en la cubierta', overrideSeason: false }

describe('CA-17.2 · una reasignación que generaría solapamiento se rechaza', () => {
  it('CA-17.2 · la semana de destino ya pertenece a otra fracción', () => {
    expect(validateReassignment({ ...propuesta, toWeek: 25 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.target_taken', weeks: [25] }])
  })

  it('CA-17.2 · a una semana libre de la misma temporada procede y la semana cambia de sitio', () => {
    expect(validateReassignment(propuesta, contexto())).toEqual([])

    const despues = applyReassignment(allocations, propuesta, classification)
    expect(despues.find(a => a.week === 26)).toEqual({ fraction: 1, week: 26, season: 'baja' })
    expect(despues.some(a => a.week === 24)).toBe(false)
    expect(despues).toHaveLength(allocations.length)
  })
})

describe('CA-17.3 · la excepción a la regla de temporada exige motivo y decisión explícita', () => {
  const cruce = { ...propuesta, toWeek: 3 }

  it('CA-17.3 · sin motivo se rechaza, aunque el Administrador haya marcado la excepción', () => {
    expect(validateReassignment({ ...cruce, reason: '   ', overrideSeason: true }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.reason_required' }])
  })

  it('CA-17.3 · con motivo pero sin marcar la excepción, el cambio de temporada se rechaza', () => {
    expect(validateReassignment(cruce, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.season_override_required', seasons: ['baja', 'alta'] }])
  })

  it('CA-17.3 · con motivo y excepción marcada procede, y la semana toma la temporada de destino', () => {
    expect(validateReassignment({ ...cruce, overrideSeason: true }, contexto())).toEqual([])
    expect(applyReassignment(allocations, { ...cruce, overrideSeason: true }, classification).find(a => a.week === 3))
      .toEqual({ fraction: 1, week: 3, season: 'alta' })
  })
})

describe('RF-17.3 · las demás invariantes del motor', () => {
  it('RF-17.4 · toda acción administrativa exige motivo, también dentro de la misma temporada', () => {
    expect(validateReassignment({ ...propuesta, reason: '' }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.reason_required' }])
  })

  it('RF-17.3 · la semana de origen debe ser de la fracción y no estar en la bolsa de renta', () => {
    expect(validateReassignment({ ...propuesta, fromWeek: 25 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.week_not_owned', weeks: [25] }])
    expect(validateReassignment({ ...propuesta, fromWeek: 40 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.week_released', weeks: [40] }])
  })

  it('RF-15.2 · RF-14.4 · el destino no puede estar bloqueado, rentado, fuera de la rejilla ni en el pasado', () => {
    expect(validateReassignment({ ...propuesta, toWeek: 30 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.target_blocked', weeks: [30] }])
    expect(validateReassignment({ ...propuesta, toWeek: 31 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.target_rented', weeks: [31] }])
    expect(validateReassignment({ ...propuesta, toWeek: 99 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.target_unknown', weeks: [99] }])
    expect(validateReassignment({ ...propuesta, toWeek: 26 }, contexto({ today: '2027-08-01' })))
      .toEqual([{ message: 'calendar.reassignment.validation.target_in_the_past', weeks: [26] }])
  })

  it('RF-17.3 · la misma semana no es un destino', () => {
    expect(validateReassignment({ ...propuesta, toWeek: 24 }, contexto()))
      .toEqual([{ message: 'calendar.reassignment.validation.same_week' }])
  })
})

describe('RF-17.1 · los destinos que se le ofrecen al Administrador', () => {
  it('son las semanas libres, futuras, sin bloqueo ni renta, marcando cuáles cruzan de temporada', () => {
    const destinos = reassignmentTargets(24, contexto({ today: '2027-06-01' }))
    const semanas = destinos.map(d => d.week)

    expect(semanas).not.toContain(24)
    expect(semanas).not.toContain(25)
    expect(semanas).not.toContain(30)
    expect(semanas).not.toContain(31)
    expect(semanas.every(w => w > 20)).toBe(true)
    expect(semanas).toEqual([...semanas].sort((a, b) => a - b))
    expect(destinos.find(d => d.week === 26)).toMatchObject({ season: 'baja', sameSeason: true })
    expect(destinos.find(d => d.week === 23)).toMatchObject({ season: 'media', sameSeason: false })
  })

  it('sin semana de origen conocida no hay destinos', () => {
    expect(reassignmentTargets(99, contexto())).toEqual([])
  })
})
