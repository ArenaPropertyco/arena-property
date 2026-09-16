/**
 * HU-17 · RF-17.1, RF-17.3, RF-17.4 · D-42 — la reasignación administrativa de
 * una semana.
 *
 * El Administrador mueve una semana de una fracción a otra semana libre de la
 * rejilla: para sacarla de debajo de un bloqueo (HU-15) o para atender una
 * petición del titular. La reserva viaja con la semana —una confirmación no se
 * pierde por moverla— y el titular recibe aviso (RF-17.2).
 *
 * Las reglas son las del motor (RF-17.3): nunca dos fracciones en la misma semana
 * (CA-17.2), el destino no puede estar bloqueado, rentado ni en el pasado, y la
 * temporada se respeta salvo decisión explícita del Administrador, que además del
 * motivo de siempre (RF-17.4) marca la excepción para que quede registrada
 * (CA-17.3). Una semana ya liberada a la bolsa de renta no se mueve: ya no es de
 * nadie (D-43). La base repite estas reglas en `reassign_week`.
 */

import type { Dia, SemanaDeRejilla } from './rejilla'
import type { AllocationEntry } from './swaps'
import type { SemanaClasificada, Temporada } from './temporadas'

export const REASSIGNMENT_VALIDATION_KEYS = [
  'calendar.reassignment.validation.reason_required',
  'calendar.reassignment.validation.same_week',
  'calendar.reassignment.validation.week_not_owned',
  'calendar.reassignment.validation.week_released',
  'calendar.reassignment.validation.target_unknown',
  'calendar.reassignment.validation.target_in_the_past',
  'calendar.reassignment.validation.target_taken',
  'calendar.reassignment.validation.target_blocked',
  'calendar.reassignment.validation.target_rented',
  'calendar.reassignment.validation.season_override_required',
] as const

export type ReassignmentValidationKey = typeof REASSIGNMENT_VALIDATION_KEYS[number]

export interface ReassignmentProposal {
  fraction: number
  fromWeek: number
  toWeek: number
  reason: string
  /** CA-17.3 · la decisión explícita de cruzar de temporada. */
  overrideSeason: boolean
}

export interface ReassignmentContext {
  allocations: readonly AllocationEntry[]
  /** Semanas ya en la bolsa de renta: no se reasignan (D-43). */
  releasedWeeks: ReadonlySet<number>
  /** Semanas con bloqueo vigente (HU-15). */
  blockedWeeks: ReadonlySet<number>
  /** Semanas rentadas a un tercero (HU-39). */
  rentedWeeks: ReadonlySet<number>
  classification: readonly SemanaClasificada[]
  rejilla: readonly SemanaDeRejilla[]
  today: Dia
}

export interface ReassignmentError {
  message: ReassignmentValidationKey
  weeks?: number[]
  /** Origen y destino, cuando el error es el cambio de temporada. */
  seasons?: [Temporada, Temporada]
}

function seasonOf(week: number, context: ReassignmentContext): Temporada | undefined {
  return context.classification.find(s => s.indice === week)?.temporada
}

/** RF-17.3 · CA-17.2 · CA-17.3 · lo que impide la reasignación; vacío si procede. */
export function validateReassignment(proposal: ReassignmentProposal, context: ReassignmentContext): ReassignmentError[] {
  // RF-17.4 · toda acción administrativa sobre el calendario deja motivo (TR-01 · RF-A.4).
  if (proposal.reason.trim() === '') {
    return [{ message: 'calendar.reassignment.validation.reason_required' }]
  }
  if (proposal.fromWeek === proposal.toWeek) {
    return [{ message: 'calendar.reassignment.validation.same_week' }]
  }
  const origin = context.allocations.find(a => a.week === proposal.fromWeek && a.fraction === proposal.fraction)
  if (!origin) {
    return [{ message: 'calendar.reassignment.validation.week_not_owned', weeks: [proposal.fromWeek] }]
  }
  if (context.releasedWeeks.has(proposal.fromWeek)) {
    return [{ message: 'calendar.reassignment.validation.week_released', weeks: [proposal.fromWeek] }]
  }
  const target = context.rejilla.find(s => s.indice === proposal.toWeek)
  const targetSeason = seasonOf(proposal.toWeek, context)
  if (!target || !targetSeason) {
    return [{ message: 'calendar.reassignment.validation.target_unknown', weeks: [proposal.toWeek] }]
  }
  if (target.inicio < context.today) {
    return [{ message: 'calendar.reassignment.validation.target_in_the_past', weeks: [proposal.toWeek] }]
  }
  // CA-17.2 · una semana, una fracción.
  if (context.allocations.some(a => a.week === proposal.toWeek)) {
    return [{ message: 'calendar.reassignment.validation.target_taken', weeks: [proposal.toWeek] }]
  }
  if (context.blockedWeeks.has(proposal.toWeek)) {
    return [{ message: 'calendar.reassignment.validation.target_blocked', weeks: [proposal.toWeek] }]
  }
  if (context.rentedWeeks.has(proposal.toWeek)) {
    return [{ message: 'calendar.reassignment.validation.target_rented', weeks: [proposal.toWeek] }]
  }
  // CA-17.3 · D-28 · cruzar de temporada es una excepción que se marca, no un descuido.
  if (origin.season !== targetSeason && !proposal.overrideSeason) {
    return [{ message: 'calendar.reassignment.validation.season_override_required', seasons: [origin.season, targetSeason] }]
  }
  return []
}

/** El reparto tras la reasignación: la semana cambia de sitio y toma la temporada del destino. */
export function applyReassignment(
  allocations: readonly AllocationEntry[],
  proposal: ReassignmentProposal,
  classification: readonly SemanaClasificada[],
): AllocationEntry[] {
  const targetSeason = classification.find(s => s.indice === proposal.toWeek)?.temporada
  return allocations.map(entry =>
    entry.week === proposal.fromWeek && entry.fraction === proposal.fraction
      ? { ...entry, week: proposal.toWeek, season: targetSeason ?? entry.season }
      : entry,
  )
}

export interface ReassignmentTarget {
  week: number
  season: Temporada
  startsOn: Dia
  /** `false` cuando elegirla exige la excepción de CA-17.3. */
  sameSeason: boolean
}

/** RF-17.1 · los destinos posibles para una semana: libres, futuros, sin bloqueo ni renta. */
export function reassignmentTargets(fromWeek: number, context: ReassignmentContext): ReassignmentTarget[] {
  const originSeason = context.allocations.find(a => a.week === fromWeek)?.season
  if (!originSeason) {
    return []
  }
  const taken = new Set(context.allocations.map(a => a.week))
  return context.rejilla
    .filter(s => s.indice !== fromWeek && s.inicio >= context.today)
    .filter(s => !taken.has(s.indice) && !context.blockedWeeks.has(s.indice) && !context.rentedWeeks.has(s.indice))
    .flatMap<ReassignmentTarget>((s) => {
      const season = seasonOf(s.indice, context)
      return season ? [{ week: s.indice, season, startsOn: s.inicio, sameSeason: season === originSeason }] : []
    })
    .sort((a, b) => a.week - b.week)
}
