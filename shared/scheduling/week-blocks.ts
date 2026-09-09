/**
 * HU-15 · RF-15.1, RF-15.4 · D-33 — bloqueos del Administrador por semanas
 * completas de la rejilla.
 *
 * Un bloqueo es una o más semanas con motivo obligatorio (CA-15.1). No borra
 * confirmaciones: si pisa una semana ya confirmada, la confirmación persiste y el
 * conflicto pasa a la bandeja de HU-17.
 */

import type { SemanaDeRejilla, Dia } from './rejilla'
import type { SemanaClasificada } from './temporadas'

export const WEEK_BLOCK_VALIDATION_KEYS = [
  'calendar.blocks.validation.reason_required',
  'calendar.blocks.validation.empty',
  'calendar.blocks.validation.week_unknown',
  'calendar.blocks.validation.in_the_past',
  'calendar.blocks.validation.already_blocked',
] as const

export type WeekBlockValidationKey = typeof WEEK_BLOCK_VALIDATION_KEYS[number]

export interface WeekBlockRequest {
  weeks: readonly number[]
  reason: string
}

export interface WeekBlockContext {
  classification: readonly SemanaClasificada[]
  rejilla: readonly SemanaDeRejilla[]
  today: Dia
  /** Semanas con bloqueo vigente. */
  blocked: ReadonlySet<number>
}

export interface WeekBlockError {
  name: 'semanas' | 'motivo'
  message: WeekBlockValidationKey
  weeks?: number[]
}

export function validateWeekBlock(request: WeekBlockRequest, context: WeekBlockContext): WeekBlockError[] {
  const errors: WeekBlockError[] = []

  // CA-15.1 · RF-15.5 · sin motivo no hay bloqueo ni auditoría que lo explique.
  if (request.reason.trim() === '') {
    errors.push({ name: 'motivo', message: 'calendar.blocks.validation.reason_required' })
  }

  if (request.weeks.length === 0) {
    errors.push({ name: 'semanas', message: 'calendar.blocks.validation.empty' })
    return errors
  }
  const known = new Set(context.classification.map(s => s.indice))
  const unknown = request.weeks.filter(week => !known.has(week))
  if (unknown.length > 0) {
    errors.push({ name: 'semanas', message: 'calendar.blocks.validation.week_unknown', weeks: unknown })
    return errors
  }
  const past = request.weeks.filter(week => (context.rejilla.find(s => s.indice === week)?.inicio ?? '') < context.today)
  if (past.length > 0) {
    errors.push({ name: 'semanas', message: 'calendar.blocks.validation.in_the_past', weeks: past })
    return errors
  }
  const already = request.weeks.filter(week => context.blocked.has(week))
  if (already.length > 0) {
    errors.push({ name: 'semanas', message: 'calendar.blocks.validation.already_blocked', weeks: already })
  }
  return errors
}

export interface ConfirmedWeek {
  fraction: number
  week: number
}

/** RF-15.4 · CA-15.3 · qué semanas confirmadas pisa el bloqueo. */
export function blockConflicts(weeks: readonly number[], confirmed: readonly ConfirmedWeek[]): ConfirmedWeek[] {
  const blocked = new Set(weeks)
  return confirmed.filter(entry => blocked.has(entry.week)).map(entry => ({ fraction: entry.fraction, week: entry.week }))
}
