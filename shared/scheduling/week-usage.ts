/**
 * HU-14 · RF-14.1…RF-14.7, RF-14.9 · D-14, D-15, D-31, D-33 · schedule.md P-10,
 * P-11, I-08, I-09 — la semana completa como unidad de uso.
 *
 * Cada semana elegida (HU-12) se confirma como uso propio hasta 60 días antes de su
 * sábado de entrada; la que no se confirma caduca a la bolsa de renta. Una semana
 * confirmada se cancela hasta 30 días antes; cualquier semana propia se libera
 * cuando se quiera. Todo es puro: la base repite las reglas al persistir.
 */

import { CRITERIO_POR_DEFECTO } from './criterio'
import type { Criterio } from './criterio'
import type { Dia } from './rejilla'
import { diasEntre, sumarDias } from './rejilla'
import { TEMPORADAS } from './temporadas'
import type { Temporada } from './temporadas'

/** D-15 · P-11 · días antes de la entrada hasta los que se confirma una semana. */
export const WEEK_CONFIRMATION_DAYS = 60
/** D-14 · P-10 · días antes de la entrada hasta los que se cancela una semana confirmada. */
export const WEEK_CANCELLATION_DAYS = 30

export type ReleaseReason = 'cancelled' | 'voluntary' | 'expired'
export type WeekUsageState = 'elected' | 'confirmed' | 'used' | 'released'

/** Una semana de la fracción, con las marcas que la base guarda. */
export interface OwnedWeek {
  week: number
  season: Temporada
  startsOn: Dia
  endsOn: Dia
  confirmedAt: string | null
  releasedAt: string | null
  releaseReason: ReleaseReason | null
}

export interface UsageContext {
  /** D-31 · I-08 · sin interruptor no se confirma, cancela ni libera. */
  calendarActive: boolean
  today: Dia
  /** RF-14.1c · día de activación; las semanas con entrada anterior no se confirman. */
  activatedOn?: Dia | null
  /** RF-15.2 · semanas bloqueadas por el Administrador. */
  blockedWeeks?: ReadonlySet<number>
  confirmationDays?: number
  cancellationDays?: number
}

export const WEEK_USAGE_VALIDATION_KEYS = [
  'calendar.weeks.validation.calendar_inactive',
  'calendar.weeks.validation.not_own',
  'calendar.weeks.validation.already_confirmed',
  'calendar.weeks.validation.already_released',
  'calendar.weeks.validation.not_confirmed',
  'calendar.weeks.validation.in_the_past',
  'calendar.weeks.validation.before_activation',
  'calendar.weeks.validation.week_blocked',
  'calendar.weeks.validation.confirmation_closed',
  'calendar.weeks.validation.cancel_too_late',
] as const

export type WeekUsageValidationKey = typeof WEEK_USAGE_VALIDATION_KEYS[number]

export interface WeekUsageError {
  message: WeekUsageValidationKey
  deadline?: Dia
  days?: number
}

/** RF-13.2 · qué es hoy la semana: elegida, confirmada, usada o liberada. */
export function weekState(week: OwnedWeek, today: Dia): WeekUsageState {
  if (week.releasedAt) {
    return 'released'
  }
  if (week.confirmedAt) {
    return week.endsOn <= today ? 'used' : 'confirmed'
  }
  return 'elected'
}

/** RF-14.7 · el último día para confirmar la semana. */
export function confirmationDeadline(week: OwnedWeek, days: number = WEEK_CONFIRMATION_DAYS): Dia {
  return sumarDias(week.startsOn, -days)
}

function common(week: OwnedWeek | undefined, context: UsageContext): WeekUsageError | null {
  if (!context.calendarActive) {
    return { message: 'calendar.weeks.validation.calendar_inactive' }
  }
  if (!week) {
    return { message: 'calendar.weeks.validation.not_own' }
  }
  return null
}

/** RF-14.1 · CA-14.1 · CA-14.2 · CA-14.4 · lo que impide confirmar la semana. */
export function validateConfirmation(week: OwnedWeek | undefined, context: UsageContext): WeekUsageError[] {
  const base = common(week, context)
  if (base || !week) {
    return [base!]
  }
  if (week.releasedAt) {
    return [{ message: 'calendar.weeks.validation.already_released' }]
  }
  if (week.confirmedAt) {
    return [{ message: 'calendar.weeks.validation.already_confirmed' }]
  }
  if (week.startsOn < context.today) {
    return [{ message: 'calendar.weeks.validation.in_the_past' }]
  }
  if (context.activatedOn && week.startsOn < context.activatedOn) {
    return [{ message: 'calendar.weeks.validation.before_activation' }]
  }
  if (context.blockedWeeks?.has(week.week)) {
    return [{ message: 'calendar.weeks.validation.week_blocked' }]
  }
  const deadline = confirmationDeadline(week, context.confirmationDays ?? WEEK_CONFIRMATION_DAYS)
  if (context.today > deadline) {
    return [{ message: 'calendar.weeks.validation.confirmation_closed', deadline }]
  }
  return []
}

/** RF-14.6 · D-14 · CA-14.5 · lo que impide cancelar una semana confirmada. */
export function validateCancellation(week: OwnedWeek | undefined, context: UsageContext): WeekUsageError[] {
  const base = common(week, context)
  if (base || !week) {
    return [base!]
  }
  if (week.releasedAt) {
    return [{ message: 'calendar.weeks.validation.already_released' }]
  }
  if (!week.confirmedAt) {
    return [{ message: 'calendar.weeks.validation.not_confirmed' }]
  }
  const days = context.cancellationDays ?? WEEK_CANCELLATION_DAYS
  if (diasEntre(context.today, week.startsOn) < days) {
    return [{ message: 'calendar.weeks.validation.cancel_too_late', days }]
  }
  return []
}

/** RF-14.7 · CA-14.8 · lo que impide liberar una semana propia a la bolsa de renta. */
export function validateRelease(week: OwnedWeek | undefined, context: UsageContext): WeekUsageError[] {
  const base = common(week, context)
  if (base || !week) {
    return [base!]
  }
  if (week.releasedAt) {
    return [{ message: 'calendar.weeks.validation.already_released' }]
  }
  if (week.startsOn < context.today) {
    return [{ message: 'calendar.weeks.validation.in_the_past' }]
  }
  return []
}

/**
 * RF-14.7 · CA-14.7 · las semanas elegidas que caducan hoy: sin confirmar, sin
 * liberar, con entrada futura y a `days` días o menos. Misma regla que la tarea
 * diaria de la base (DT-09).
 */
export function expiringWeeks(weeks: readonly OwnedWeek[], today: Dia, days: number = WEEK_CONFIRMATION_DAYS): OwnedWeek[] {
  return weeks.filter(week =>
    !week.confirmedAt
    && !week.releasedAt
    && week.startsOn >= today
    && diasEntre(today, week.startsOn) <= days)
}

/** RF-14.9 · las semanas propias que faltan por confirmar, con su fecha límite, de la más cercana a la más lejana. */
export function pendingConfirmations(weeks: readonly OwnedWeek[], today: Dia, days: number = WEEK_CONFIRMATION_DAYS): { week: number, deadline: Dia }[] {
  return weeks
    .filter(week => !week.confirmedAt && !week.releasedAt && week.startsOn >= today)
    .map(week => ({ week: week.week, deadline: confirmationDeadline(week, days) }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
}

export interface SeasonQuota {
  required: number
  elected: number
  confirmed: number
  used: number
  released: number
}

/** RF-13.2 · CA-14.3 · cuántas semanas de cada temporada hay en cada estado frente al criterio. */
export function quotaByState(weeks: readonly OwnedWeek[], today: Dia, criteria: Criterio = CRITERIO_POR_DEFECTO): Record<Temporada, SeasonQuota> {
  const quota = Object.fromEntries(TEMPORADAS.map(season => [season, {
    required: criteria[season], elected: 0, confirmed: 0, used: 0, released: 0,
  }])) as Record<Temporada, SeasonQuota>
  for (const week of weeks) {
    quota[week.season][weekState(week, today)] += 1
  }
  return quota
}

/**
 * RF-14.10 · la base rechaza con el código de la regla en el mensaje; aquí se
 * vuelve clave i18n para que la pantalla explique el motivo (CA-14.4).
 */
export function weekErrorKey(message: string | null | undefined): WeekUsageValidationKey | null {
  const text = message ?? ''
  const rules: [string, WeekUsageValidationKey][] = [
    ['CA-14.0b', 'calendar.weeks.validation.before_activation'],
    ['CA-14.0', 'calendar.weeks.validation.calendar_inactive'],
    ['RF-14.3', 'calendar.weeks.validation.not_own'],
    ['CA-14.6', 'calendar.weeks.validation.already_released'],
    ['CA-14.8', 'calendar.weeks.validation.already_released'],
    ['CA-14.2', 'calendar.weeks.validation.already_confirmed'],
    ['CA-14.9', 'calendar.weeks.validation.already_confirmed'],
    ['RF-15.2', 'calendar.weeks.validation.week_blocked'],
    ['CA-14.5', 'calendar.weeks.validation.cancel_too_late'],
    ['no está confirmada', 'calendar.weeks.validation.not_confirmed'],
    ['ya pasó', 'calendar.weeks.validation.in_the_past'],
    ['RF-14.7', 'calendar.weeks.validation.confirmation_closed'],
  ]
  return rules.find(([code]) => text.includes(code))?.[1] ?? null
}
