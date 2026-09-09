import { describe, expect, it } from 'vitest'
import {
  confirmationDeadline,
  expiringWeeks,
  pendingConfirmations,
  quotaByState,
  validateCancellation,
  validateConfirmation,
  validateRelease,
  WEEK_CANCELLATION_DAYS,
  WEEK_CONFIRMATION_DAYS,
  weekErrorKey,
  weekState,
} from '#shared/scheduling/week-usage'
import type { OwnedWeek, UsageContext } from '#shared/scheduling/week-usage'

/**
 * HU-14 · RF-14.1…RF-14.7, RF-14.9 · D-14, D-15, D-31, D-33 · schedule.md P-10,
 * P-11, I-08, I-09 — la semana completa como unidad de uso: se confirma hasta 60
 * días antes, se cancela hasta 30, se libera cuando se quiera y caduca a 60 días.
 *
 * La fracción 3 eligió en 2027 la semana alta del 2 de enero, la media-alta del 27
 * de febrero, la media del 24 de abril y las bajas del 19 de junio, 14 de agosto y
 * 9 de octubre.
 */

function week(index: number, season: OwnedWeek['season'], startsOn: string, extra: Partial<OwnedWeek> = {}): OwnedWeek {
  const [y, m, d] = startsOn.split('-').map(Number)
  const end = new Date(Date.UTC(y!, m! - 1, d! + 7)).toISOString().slice(0, 10)
  return { week: index, season, startsOn, endsOn: end, confirmedAt: null, releasedAt: null, releaseReason: null, ...extra }
}

const ALTA = week(0, 'alta', '2027-01-02')
const MEDIA_ALTA = week(8, 'media_alta', '2027-02-27')
const MEDIA = week(16, 'media', '2027-04-24')
const BAJA_1 = week(24, 'baja', '2027-06-19')
const BAJA_2 = week(32, 'baja', '2027-08-14')
const BAJA_3 = week(40, 'baja', '2027-10-09')

function context(changes: Partial<UsageContext> = {}): UsageContext {
  return { calendarActive: true, today: '2026-10-01', activatedOn: null, blockedWeeks: new Set(), ...changes }
}

describe('RF-14.7 · D-15 · P-11 · plazos y estado de una semana', () => {
  it('los plazos son 60 días para confirmar y 30 para cancelar', () => {
    expect(WEEK_CONFIRMATION_DAYS).toBe(60)
    expect(WEEK_CANCELLATION_DAYS).toBe(30)
    expect(confirmationDeadline(ALTA)).toBe('2026-11-03')
  })

  it('el estado sale de las marcas y de la fecha: elegida, confirmada, usada o liberada', () => {
    expect(weekState(ALTA, '2026-10-01')).toBe('elected')
    expect(weekState({ ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, '2026-10-01')).toBe('confirmed')
    expect(weekState({ ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, '2027-01-09')).toBe('used')
    expect(weekState({ ...ALTA, releasedAt: '2026-11-04T08:15:00Z', releaseReason: 'expired' }, '2026-12-01')).toBe('released')
  })
})

describe('CA-14.1 · confirmar una semana propia elegida y futura', () => {
  it('CA-14.1 · una semana propia elegida se confirma; una ajena se rechaza', () => {
    expect(validateConfirmation(ALTA, context())).toEqual([])
    expect(validateConfirmation(undefined, context())).toEqual([{ message: 'calendar.weeks.validation.not_own' }])
  })

  it('RF-14.1 · una semana ya pasada no se confirma', () => {
    expect(validateConfirmation(ALTA, context({ today: '2027-01-03' }))).toEqual([{ message: 'calendar.weeks.validation.in_the_past' }])
  })

  it('RF-14.7 · pasado el plazo de 60 días la confirmación está cerrada', () => {
    expect(validateConfirmation(ALTA, context({ today: '2026-11-04' }))).toEqual([{ message: 'calendar.weeks.validation.confirmation_closed', deadline: '2026-11-03' }])
    expect(validateConfirmation(ALTA, context({ today: '2026-11-03' }))).toEqual([])
  })
})

describe('CA-14.2 · una semana confirmada, liberada o cancelada no se confirma de nuevo', () => {
  it('CA-14.2 · ya confirmada se rechaza', () => {
    expect(validateConfirmation({ ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, context()))
      .toEqual([{ message: 'calendar.weeks.validation.already_confirmed' }])
  })

  it('CA-14.2 · CA-14.6 · liberada o cancelada se rechaza', () => {
    expect(validateConfirmation({ ...ALTA, releasedAt: '2026-10-02T10:00:00Z', releaseReason: 'cancelled' }, context()))
      .toEqual([{ message: 'calendar.weeks.validation.already_released' }])
  })
})

describe('CA-14.0 · I-08 · sin calendario activo no se confirma, cancela ni libera', () => {
  it('CA-14.0 · inactivo se rechaza; activado, la misma confirmación se acepta', () => {
    expect(validateConfirmation(ALTA, context({ calendarActive: false }))).toEqual([{ message: 'calendar.weeks.validation.calendar_inactive' }])
    expect(validateConfirmation(ALTA, context({ calendarActive: true }))).toEqual([])
    expect(validateCancellation({ ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, context({ calendarActive: false })).map(e => e.message))
      .toContain('calendar.weeks.validation.calendar_inactive')
    expect(validateRelease(ALTA, context({ calendarActive: false })).map(e => e.message)).toContain('calendar.weeks.validation.calendar_inactive')
  })
})

describe('CA-14.0b · RF-14.1c · el primer año solo cuentan las semanas posteriores a la activación', () => {
  it('CA-14.0b · activado el 15 de julio, la semana de junio no se confirma y la de agosto sí', () => {
    const ctx = context({ activatedOn: '2027-07-15', today: '2027-05-01' })
    expect(validateConfirmation(BAJA_1, ctx)).toEqual([{ message: 'calendar.weeks.validation.before_activation' }])
    expect(validateConfirmation(BAJA_2, { ...ctx, today: '2027-06-01' })).toEqual([])
  })
})

describe('CA-14.4 · RF-15.2 · una semana bloqueada no se confirma', () => {
  it('CA-14.4 · el bloqueo del Administrador rechaza la confirmación con motivo', () => {
    expect(validateConfirmation(BAJA_1, context({ blockedWeeks: new Set([24]) }))).toEqual([{ message: 'calendar.weeks.validation.week_blocked' }])
  })
})

describe('CA-14.5 · D-14 · P-10 · cancelación hasta 30 días antes', () => {
  const confirmed = { ...BAJA_1, confirmedAt: '2026-10-01T10:00:00Z' }

  it('CA-14.5 · a 45 días se acepta; a 20 se rechaza; justo a 30 se acepta', () => {
    expect(validateCancellation(confirmed, context({ today: '2027-05-05' }))).toEqual([])
    expect(validateCancellation(confirmed, context({ today: '2027-05-30' }))).toEqual([{ message: 'calendar.weeks.validation.cancel_too_late', days: 30 }])
    expect(validateCancellation(confirmed, context({ today: '2027-05-20' }))).toEqual([])
  })

  it('RF-14.6 · solo se cancela una semana confirmada', () => {
    expect(validateCancellation(BAJA_1, context())).toEqual([{ message: 'calendar.weeks.validation.not_confirmed' }])
    expect(validateCancellation({ ...BAJA_1, releasedAt: '2027-01-01T00:00:00Z', releaseReason: 'voluntary' }, context()))
      .toEqual([{ message: 'calendar.weeks.validation.already_released' }])
  })
})

describe('RF-14.7 · liberación voluntaria y caducidad', () => {
  it('CA-14.8 · una semana propia futura se libera; una ya liberada o pasada, no', () => {
    expect(validateRelease(BAJA_2, context())).toEqual([])
    expect(validateRelease({ ...BAJA_2, releasedAt: '2027-01-01T00:00:00Z', releaseReason: 'voluntary' }, context()))
      .toEqual([{ message: 'calendar.weeks.validation.already_released' }])
    expect(validateRelease(ALTA, context({ today: '2027-01-05' }))).toEqual([{ message: 'calendar.weeks.validation.in_the_past' }])
    expect(validateRelease(undefined, context())).toEqual([{ message: 'calendar.weeks.validation.not_own' }])
  })

  it('CA-14.7 · a 60 días caducan las semanas sin confirmar; las confirmadas y las pasadas, no', () => {
    const weeks = [ALTA, { ...MEDIA_ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, MEDIA, BAJA_1]
    expect(expiringWeeks(weeks, '2026-11-04').map(w => w.week)).toEqual([0])
    expect(expiringWeeks(weeks, '2027-01-03').map(w => w.week)).toEqual([])
    expect(expiringWeeks(weeks, '2027-02-24').map(w => w.week)).toEqual([16])
  })

  it('RF-14.9 · las confirmaciones pendientes se listan con su fecha límite, de la más cercana a la más lejana', () => {
    const weeks: OwnedWeek[] = [BAJA_1, { ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' }, MEDIA, { ...BAJA_2, releasedAt: '2027-01-01T00:00:00Z', releaseReason: 'voluntary' }]
    expect(pendingConfirmations(weeks, '2026-10-01')).toEqual([
      { week: 16, deadline: '2027-02-23' },
      { week: 24, deadline: '2027-04-20' },
    ])
  })
})

describe('CA-14.3 · el cupo por temporada se lleva por estado', () => {
  it('CA-14.3 · elegidas, confirmadas, usadas y liberadas suman lo que dicta el criterio y nunca más', () => {
    const weeks = [
      { ...ALTA, confirmedAt: '2026-10-01T10:00:00Z' },
      MEDIA_ALTA,
      { ...MEDIA, releasedAt: '2027-01-01T00:00:00Z', releaseReason: 'voluntary' as const },
      { ...BAJA_1, confirmedAt: '2027-01-01T00:00:00Z' },
      BAJA_2,
      BAJA_3,
    ]
    const quota = quotaByState(weeks, '2027-07-01')
    expect(quota.alta).toEqual({ required: 1, elected: 0, confirmed: 0, used: 1, released: 0 })
    expect(quota.media).toEqual({ required: 1, elected: 0, confirmed: 0, used: 0, released: 1 })
    expect(quota.baja).toEqual({ required: 3, elected: 2, confirmed: 0, used: 1, released: 0 })
    for (const season of ['alta', 'media_alta', 'media', 'baja'] as const) {
      const q = quota[season]
      expect(q.elected + q.confirmed + q.used + q.released).toBeLessThanOrEqual(q.required)
    }
  })
})

describe('RF-14.10 · CA-14.4 · el rechazo de la base se traduce a su motivo', () => {
  it('reconoce la regla por su código en el mensaje', () => {
    expect(weekErrorKey('CA-14.0 · I-08 · la fracción 1 no tiene el calendario activo.')).toBe('calendar.weeks.validation.calendar_inactive')
    expect(weekErrorKey('CA-14.0b · RF-14.1c · la semana 2 empieza antes de la activación del calendario.')).toBe('calendar.weeks.validation.before_activation')
    expect(weekErrorKey('CA-15.2 · RF-15.2 · la semana 33 está bloqueada por el Administrador.')).toBe('calendar.weeks.validation.week_blocked')
    expect(weekErrorKey('CA-14.5 · RF-14.6 · la cancelación de la semana 9 se cerró 30 días antes de su entrada.')).toBe('calendar.weeks.validation.cancel_too_late')
    expect(weekErrorKey('RF-14.7 · la confirmación de la semana 9 se cerró 60 días antes de su entrada.')).toBe('calendar.weeks.validation.confirmation_closed')
    expect(weekErrorKey('algo inesperado')).toBeNull()
  })
})
