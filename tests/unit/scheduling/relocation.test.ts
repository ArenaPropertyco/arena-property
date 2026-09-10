import { describe, expect, it } from 'vitest'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import {
  applyRelocation,
  closeWindowOutcome,
  defaultWindowOpening,
  firstTurnsOver,
  fromBogotaInput,
  movableWeeks,
  RELOCATION_TURN_HOURS,
  RELOCATION_WINDOW_DAYS,
  relocationErrorKey,
  relocationOrderFor,
  relocationTargetsFor,
  relocationTurnOf,
  remainingParts,
  rotateOrder,
  toBogotaInput,
  turnSlots,
  validateRelocation,
  windowClosesAt,
  windowPhase,
} from '#shared/scheduling/relocation'
import type { RelocationContext, RelocationTurn, RelocationWindow } from '#shared/scheduling/relocation'
import { selectionSummary } from '#shared/scheduling/selection'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import type { AllocationState } from '#shared/scheduling/week-projection'

/**
 * HU-59 · RF-59.1…RF-59.6, RF-59.8 · D-28, D-33, D-36 · schedule.md P-12, P-13,
 * P-14, I-02, I-03 — la ventana anual de reubicación por semanas: turnos rotativos
 * de 48 horas, movimiento de una semana elegida a otra libre de la misma temporada
 * y cierre con apertura por orden de llegada.
 *
 * Calendario 2027 (rejilla desde el sábado 2 de enero): 8 altas (0..7), 8
 * media-altas (8..15), 8 medias (16..23) y el resto bajas. La fracción 1 eligió
 * 0, 8, 16, 24, 25 y 26; la 2 eligió 1, 9, 17, 27, 28 y 29; la 3 eligió 2, 10, 18,
 * 30, 31 y 32.
 */

const ANIO = 2027
const rejilla = rejillaDelAnio(ANIO)
const classification: SemanaClasificada[] = clasificacionBase(rejilla).map(s => ({
  ...s,
  temporada: s.indice < 8 ? 'alta' : s.indice < 16 ? 'media_alta' : s.indice < 24 ? 'media' : 'baja',
}))

function allocation(fraction: number, week: number, extra: Partial<AllocationState> = {}): AllocationState {
  return { fraction, week, confirmedAt: null, releasedAt: null, releaseReason: null, ...extra }
}

const allocations: AllocationState[] = [
  allocation(1, 0), allocation(1, 8), allocation(1, 16), allocation(1, 24), allocation(1, 25), allocation(1, 26),
  allocation(2, 1), allocation(2, 9), allocation(2, 17), allocation(2, 27), allocation(2, 28), allocation(2, 29),
  allocation(3, 2), allocation(3, 10), allocation(3, 18), allocation(3, 30), allocation(3, 31), allocation(3, 32),
]

/** Ventana de 2027: abre el 1 de octubre de 2026 a las 00:00 de Bogotá, turnos [3, 1, 2]. */
const window: RelocationWindow = {
  opensAt: defaultWindowOpening(ANIO),
  durationDays: RELOCATION_WINDOW_DAYS,
  turnHours: RELOCATION_TURN_HOURS,
  order: [3, 1, 2],
  closedAt: null,
}

const OWN_TURN: RelocationTurn = { state: 'own', canRelocate: true, opensAt: '2026-10-03T05:00:00.000Z', closesAt: '2026-10-05T05:00:00.000Z', remainingMs: 1000, waitingFor: null }

function context(changes: Partial<RelocationContext> = {}): RelocationContext {
  return {
    rejilla,
    classification,
    allocations,
    blockedWeeks: new Set(),
    today: '2026-10-03',
    calendarActive: true,
    turn: OWN_TURN,
    ...changes,
  }
}

describe('RF-59.1 · P-12, P-13, P-14 · la ventana por defecto', () => {
  it('abre el 1 de octubre del año anterior a las 00:00 de Bogotá, dura 16 días y da 48 horas por fracción', () => {
    expect(defaultWindowOpening(ANIO)).toBe('2026-10-01T05:00:00.000Z')
    expect(RELOCATION_WINDOW_DAYS).toBe(16)
    expect(RELOCATION_TURN_HOURS).toBe(48)
    expect(windowClosesAt(window)).toBe('2026-10-17T05:00:00.000Z')
  })

  it('el instante se edita en hora de Bogotá y vuelve como instante', () => {
    expect(toBogotaInput('2026-10-01T05:00:00.000Z')).toBe('2026-10-01T00:00')
    expect(fromBogotaInput('2026-10-01T00:00')).toBe('2026-10-01T05:00:00.000Z')
  })

  it('cada fracción del orden recibe una franja consecutiva de 48 horas desde la apertura', () => {
    expect(turnSlots(window)).toEqual([
      { fraction: 3, position: 0, opensAt: '2026-10-01T05:00:00.000Z', closesAt: '2026-10-03T05:00:00.000Z' },
      { fraction: 1, position: 1, opensAt: '2026-10-03T05:00:00.000Z', closesAt: '2026-10-05T05:00:00.000Z' },
      { fraction: 2, position: 2, opensAt: '2026-10-05T05:00:00.000Z', closesAt: '2026-10-07T05:00:00.000Z' },
    ])
  })
})

describe('CA-59.6 · RF-59.2 · el turno rota cada año de forma determinista', () => {
  it('CA-59.6 · en 8 años consecutivos cada fracción abre la ventana exactamente una vez', () => {
    const base = [3, 1, 5, 2, 8, 4, 7, 6]
    const firsts = firstTurnsOver(base, 2027, 8)
    expect(firsts).toHaveLength(8)
    expect(new Set(firsts).size).toBe(8)
    expect(firsts[0]).toBe(3)
    expect(relocationOrderFor(base, 2027, 2035)).toEqual(base)
  })

  it('RF-59.2 · rotar es pasar la primera al final, tantas veces como años hayan pasado', () => {
    expect(rotateOrder([3, 1, 2], 1)).toEqual([1, 2, 3])
    expect(rotateOrder([3, 1, 2], 2)).toEqual([2, 3, 1])
    expect(rotateOrder([3, 1, 2], 3)).toEqual([3, 1, 2])
    expect(rotateOrder([], 5)).toEqual([])
    expect(relocationOrderFor([3, 1, 2], 2027, 2029)).toEqual([2, 3, 1])
    expect(relocationOrderFor([3, 1, 2], 2027, 2026)).toEqual([3, 1, 2])
  })
})

describe('RF-59.3 · RF-59.6 · el estado del turno según el instante', () => {
  it('la ventana está programada, por turnos, por orden de llegada o cerrada', () => {
    expect(windowPhase(window, '2026-09-30T12:00:00.000Z')).toBe('scheduled')
    expect(windowPhase(window, '2026-10-02T12:00:00.000Z')).toBe('turns')
    expect(windowPhase(window, '2026-10-10T12:00:00.000Z')).toBe('open')
    expect(windowPhase(window, '2026-10-17T05:00:00.000Z')).toBe('closed')
    expect(windowPhase({ ...window, closedAt: '2026-10-02T00:00:00.000Z' }, '2026-10-02T12:00:00.000Z')).toBe('closed')
  })

  it('CA-59.5 · antes de su franja la fracción espera y sabe a quién; en su franja puede y sabe cuánto le queda', () => {
    const waiting = relocationTurnOf(window, 1, '2026-10-02T05:00:00.000Z')
    expect(waiting).toMatchObject({ state: 'before', canRelocate: false, waitingFor: 3, opensAt: '2026-10-03T05:00:00.000Z' })

    const own = relocationTurnOf(window, 1, '2026-10-04T05:00:00.000Z')
    expect(own).toMatchObject({ state: 'own', canRelocate: true, closesAt: '2026-10-05T05:00:00.000Z', remainingMs: 24 * 60 * 60 * 1000 })
  })

  it('RF-59.6 · pasada su franja espera; terminados los turnos, la ventana abre por orden de llegada; cerrada, nada', () => {
    expect(relocationTurnOf(window, 3, '2026-10-04T05:00:00.000Z')).toMatchObject({ state: 'after', canRelocate: false })
    expect(relocationTurnOf(window, 3, '2026-10-10T05:00:00.000Z')).toMatchObject({ state: 'open', canRelocate: true, closesAt: '2026-10-17T05:00:00.000Z' })
    expect(relocationTurnOf(window, 3, '2026-10-20T05:00:00.000Z')).toMatchObject({ state: 'closed', canRelocate: false })
    expect(relocationTurnOf(window, 3, '2026-09-01T05:00:00.000Z')).toMatchObject({ state: 'scheduled', canRelocate: false, opensAt: '2026-10-01T05:00:00.000Z' })
    expect(relocationTurnOf(window, 7, '2026-10-04T05:00:00.000Z')).toMatchObject({ state: 'none', canRelocate: false })
  })

  it('el tiempo restante se descompone en días, horas y minutos', () => {
    expect(remainingParts(((2 * 24 + 3) * 60 + 7) * 60 * 1000 + 500)).toEqual({ days: 2, hours: 3, minutes: 7 })
    expect(remainingParts(-5)).toEqual({ days: 0, hours: 0, minutes: 0 })
  })
})

describe('CA-59.2 · RF-59.4 · I-02 · una reubicación válida conserva el cupo y libera el origen', () => {
  it('CA-59.2 · mover la semana baja 24 a la 40 deja 1/1/1/3 y la 24 libre', () => {
    const move = { fraction: 1, fromWeek: 24, toWeek: 40 }
    expect(validateRelocation(move, context())).toEqual([])

    const after = applyRelocation(allocations, move)
    const own = after.filter(a => a.fraction === 1).map(a => a.week)
    expect(selectionSummary(own, classification)).toEqual({ alta: 1, media_alta: 1, media: 1, baja: 3 })
    expect(own).toContain(40)
    expect(after.some(a => a.week === 24)).toBe(false)
    expect(after).toHaveLength(allocations.length)
  })

  it('RF-59.3 · solo se mueven semanas propias elegidas, sin confirmar, sin liberar y futuras', () => {
    const own = [
      allocation(1, 0, { confirmedAt: '2026-09-01T10:00:00Z' }),
      allocation(1, 8),
      allocation(1, 16, { releasedAt: '2026-09-15T10:00:00Z', releaseReason: 'voluntary' }),
      allocation(1, 24),
      allocation(2, 1),
    ]
    expect(movableWeeks(own, 1, { rejilla, today: '2026-10-03' })).toEqual([8, 24])
    expect(movableWeeks(own, 1, { rejilla, today: '2027-03-01' })).toEqual([24])
  })

  it('RF-59.5 · los destinos de una semana son las libres de su temporada, futuras y sin bloquear', () => {
    const targets = relocationTargetsFor(24, context({ blockedWeeks: new Set([33]) })).map(s => s.indice)
    expect(targets).not.toContain(24)
    expect(targets).not.toContain(27)
    expect(targets).not.toContain(33)
    expect(targets).toContain(34)
    expect(targets.every(week => classification[week]!.temporada === 'baja')).toBe(true)
    expect(relocationTargetsFor(99, context())).toEqual([])
  })
})

describe('CA-59.1 · RF-59.4 · I-03 · nadie cambia de temporada', () => {
  it('CA-59.1 · una semana baja no se mueve a una alta libre', () => {
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 3 }, context()))
      .toEqual([{ message: 'calendar.relocation.validation.season_mismatch', from: 'baja', to: 'alta' }])
  })
})

describe('CA-59.3 · RF-59.5 · el destino tiene que estar libre', () => {
  it('CA-59.3 · una semana elegida por otra fracción se rechaza', () => {
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 27 }, context()))
      .toEqual([{ message: 'calendar.relocation.validation.week_taken', fraction: 2 }])
  })

  it('CA-59.3 · una semana bloqueada por el Administrador se rechaza', () => {
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ blockedWeeks: new Set([40]) })))
      .toEqual([{ message: 'calendar.relocation.validation.week_blocked' }])
  })

  it('CA-59.3 · una semana en la bolsa de renta se rechaza', () => {
    const rented = [...allocations, allocation(2, 40, { releasedAt: '2026-09-15T10:00:00Z', releaseReason: 'expired' })]
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ allocations: rented })))
      .toEqual([{ message: 'calendar.relocation.validation.week_rented' }])
  })

  it('RF-59.5 · una semana ya pasada, la misma semana o una fuera de la rejilla se rechazan', () => {
    expect(validateRelocation({ fraction: 1, fromWeek: 26, toWeek: 24 }, context({ today: '2027-07-01', allocations: allocations.filter(a => a.week !== 24) })))
      .toEqual([{ message: 'calendar.relocation.validation.in_the_past' }])
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 24 }, context()))
      .toEqual([{ message: 'calendar.relocation.validation.same_week' }])
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 99 }, context()))
      .toEqual([{ message: 'calendar.relocation.validation.week_unknown' }])
  })
})

describe('CA-59.4 · RF-59.3 · solo se mueven semanas elegidas pendientes de confirmar', () => {
  it('CA-59.4 · una semana confirmada o liberada no se mueve; una ajena tampoco', () => {
    const own = allocations.map(a => a.week === 24 ? allocation(1, 24, { confirmedAt: '2026-09-01T10:00:00Z' }) : a)
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ allocations: own })))
      .toEqual([{ message: 'calendar.relocation.validation.week_locked' }])
    const released = allocations.map(a => a.week === 24 ? allocation(1, 24, { releasedAt: '2026-09-01T10:00:00Z', releaseReason: 'voluntary' }) : a)
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ allocations: released })))
      .toEqual([{ message: 'calendar.relocation.validation.week_locked' }])
    expect(validateRelocation({ fraction: 1, fromWeek: 27, toWeek: 40 }, context()))
      .toEqual([{ message: 'calendar.relocation.validation.not_own' }])
  })
})

describe('CA-59.5 · RF-59.3 · RF-59.6 · I-08 · fuera de turno solo se consulta', () => {
  it('CA-59.5 · antes de su turno, con la ventana programada o cerrada, se rechaza con el instante que importa', () => {
    const before = relocationTurnOf(window, 1, '2026-10-02T05:00:00.000Z')
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ turn: before })))
      .toEqual([{ message: 'calendar.relocation.validation.outside_turn', opensAt: '2026-10-03T05:00:00.000Z', waitingFor: 3 }])
    const scheduled = relocationTurnOf(window, 1, '2026-09-01T05:00:00.000Z')
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ turn: scheduled })))
      .toEqual([{ message: 'calendar.relocation.validation.outside_turn', opensAt: '2026-10-03T05:00:00.000Z', waitingFor: null }])
    const closed = relocationTurnOf(window, 1, '2026-10-20T05:00:00.000Z')
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ turn: closed })))
      .toEqual([{ message: 'calendar.relocation.validation.window_closed' }])
  })

  it('CA-59.5 · I-08 · con el calendario inactivo la fracción conserva el turno pero no opera', () => {
    expect(validateRelocation({ fraction: 1, fromWeek: 24, toWeek: 40 }, context({ calendarActive: false })))
      .toEqual([{ message: 'calendar.relocation.validation.calendar_inactive' }])
  })

  it('RF-59.6 · en la fase por orden de llegada cualquier fracción con turno cumplido puede mover', () => {
    const open = relocationTurnOf(window, 3, '2026-10-10T05:00:00.000Z')
    expect(validateRelocation({ fraction: 3, fromWeek: 30, toWeek: 40 }, context({ turn: open }))).toEqual([])
  })
})

describe('CA-59.7 · RF-59.6 · cerrada la ventana, lo no reubicado se queda y lo liberado figura disponible', () => {
  it('CA-59.7 · el balance del cierre separa lo que se quedó, lo que se movió y lo que quedó libre', () => {
    const after = applyRelocation(applyRelocation(allocations, { fraction: 1, fromWeek: 24, toWeek: 40 }), { fraction: 3, fromWeek: 2, toWeek: 5 })
    const outcome = closeWindowOutcome(allocations, after)
    expect(outcome.moved).toEqual([{ fraction: 1, fromWeek: 24, toWeek: 40 }, { fraction: 3, fromWeek: 2, toWeek: 5 }])
    expect(outcome.freed).toEqual([2, 24])
    expect(outcome.kept).toHaveLength(allocations.length - 2)
    expect(outcome.kept.some(a => a.fraction === 2 && a.week === 27)).toBe(true)
  })
})

describe('RF-59.8 · el rechazo de la base se traduce a su motivo', () => {
  it('reconoce la regla por su código en el mensaje', () => {
    expect(relocationErrorKey('CA-59.1 · I-03 · la semana 3 es alta y la 24 baja.')).toBe('calendar.relocation.validation.season_mismatch')
    expect(relocationErrorKey('CA-59.3 · la semana 27 está elegida por la fracción 2.')).toBe('calendar.relocation.validation.week_taken')
    expect(relocationErrorKey('CA-59.3 · RF-15.2 · la semana 40 está bloqueada por el Administrador.')).toBe('calendar.relocation.validation.week_blocked')
    expect(relocationErrorKey('CA-59.3 · HU-39 · la semana 40 está en la bolsa de renta.')).toBe('calendar.relocation.validation.week_rented')
    expect(relocationErrorKey('CA-59.4 · la semana 24 ya está confirmada o liberada.')).toBe('calendar.relocation.validation.week_locked')
    expect(relocationErrorKey('CA-59.5 · todavía no es el turno de la fracción 1.')).toBe('calendar.relocation.validation.outside_turn')
    expect(relocationErrorKey('CA-59.7 · la ventana de 2027 está cerrada.')).toBe('calendar.relocation.validation.window_closed')
    expect(relocationErrorKey('CA-14.0 · I-08 · la fracción 1 no tiene el calendario activo.')).toBe('calendar.relocation.validation.calendar_inactive')
    expect(relocationErrorKey('algo inesperado')).toBeNull()
  })
})
