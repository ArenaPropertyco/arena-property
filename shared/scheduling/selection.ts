/**
 * HU-12 · RF-12.3, RF-12.4, RF-12.5 · D-12, D-32 · schedule.md P-04, P-07, I-05,
 * I-10 — selección de semanas por turnos.
 *
 * Cada Propietario elige sus 6 semanas del año —1 alta, 1 media-alta, 1 media y 3
 * bajas por defecto— entre las que sigan libres cuando le llega el turno. El orden
 * del primer año es el de compra; los siguientes los fija el Administrador con una
 * sugerencia rotada. Todo es puro: la base repite las mismas reglas al persistir.
 */

import { CRITERIO_POR_DEFECTO } from './criterio'
import type { Criterio } from './criterio'
import { TEMPORADAS } from './temporadas'
import type { SemanaClasificada, Temporada } from './temporadas'

export const SELECTION_VALIDATION_KEYS = [
  'calendar.selection.validation.wrong_count',
  'calendar.selection.validation.wrong_composition',
  'calendar.selection.validation.week_unknown',
  'calendar.selection.validation.week_duplicated',
  'calendar.selection.validation.week_taken',
  'calendar.selection.validation.not_your_turn',
  'calendar.selection.validation.already_selected',
] as const

export type SelectionValidationKey = typeof SELECTION_VALIDATION_KEYS[number]

export interface SelectionError {
  message: SelectionValidationKey
  season?: Temporada
  required?: number
  chosen?: number
  weeks?: number[]
  waitingFor?: number | null
}

/** Una fracción en el orden de turnos del año, con lo que ya eligió. */
export interface SelectionTurn {
  fraction: number
  position: number
  /** Sin titular no hay turno: se salta (RF-12.4). */
  hasOwner: boolean
  selectedWeeks: number
}

export interface TurnStatus {
  position: number | null
  canSelect: boolean
  done: boolean
  /** La fracción cuyo turno bloquea a esta, si la hay. */
  waitingFor: number | null
}

/** P-04 · semanas que elige cada fracción: 6 con el criterio por defecto. */
export function weeksPerFraction(criteria: Criterio = CRITERIO_POR_DEFECTO): number {
  return TEMPORADAS.reduce((total, season) => total + criteria[season], 0)
}

/** Cuántas semanas de cada temporada trae una elección. */
export function selectionSummary(weeks: readonly number[], classification: readonly SemanaClasificada[]): Record<Temporada, number> {
  const seasonOf = new Map(classification.map(s => [s.indice, s.temporada]))
  const summary = Object.fromEntries(TEMPORADAS.map(t => [t, 0])) as Record<Temporada, number>
  for (const week of weeks) {
    const season = seasonOf.get(week)
    if (season) {
      summary[season] += 1
    }
  }
  return summary
}

/** RF-12.3 · las semanas que siguen libres, en orden de rejilla. */
export function availableWeeks(classification: readonly SemanaClasificada[], taken: ReadonlySet<number>): SemanaClasificada[] {
  return [...classification].filter(s => !taken.has(s.indice)).sort((a, b) => a.indice - b.indice)
}

/**
 * RF-12.4 · CA-12.4 · el orden del primer año: de la compra más antigua a la más
 * reciente; a igual fecha, por número; las fracciones sin compra quedan fuera.
 */
export function purchaseOrder(fractions: readonly { number: number, purchasedAt: string | null }[]): number[] {
  return fractions
    .filter((f): f is { number: number, purchasedAt: string } => f.purchasedAt !== null)
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt) || a.number - b.number)
    .map(f => f.number)
}

/** RF-12.5 · CA-12.6 · la sugerencia para el año siguiente: la primera pasa al final. */
export function suggestNextOrder(previous: readonly number[]): number[] {
  if (previous.length === 0) {
    return []
  }
  const [first, ...rest] = previous
  return [...rest, first!]
}

/** CA-12.6 · un orden válido es una permutación exacta de las fracciones con titular. */
export function isValidOrder(order: readonly number[], eligible: readonly number[]): boolean {
  if (order.length !== eligible.length || new Set(order).size !== order.length) {
    return false
  }
  const allowed = new Set(eligible)
  return order.every(fraction => allowed.has(fraction))
}

/** RF-12.4 · CA-12.5 · si a la fracción le toca elegir, ya eligió o espera a otra. */
export function turnOf(turns: readonly SelectionTurn[], fraction: number, criteria: Criterio = CRITERIO_POR_DEFECTO): TurnStatus {
  const needed = weeksPerFraction(criteria)
  const ordered = [...turns].sort((a, b) => a.position - b.position)
  const own = ordered.find(t => t.fraction === fraction)
  if (!own) {
    return { position: null, canSelect: false, done: false, waitingFor: null }
  }
  const done = own.selectedWeeks >= needed
  if (done || !own.hasOwner) {
    return { position: own.position, canSelect: false, done, waitingFor: null }
  }
  const blocking = ordered.find(t => t.position < own.position && t.hasOwner && t.selectedWeeks < needed)
  return {
    position: own.position,
    canSelect: blocking === undefined,
    done: false,
    waitingFor: blocking?.fraction ?? null,
  }
}

export interface SelectionContext {
  classification: readonly SemanaClasificada[]
  /** Semanas ya elegidas por cualquier fracción. */
  taken: ReadonlySet<number>
  criteria?: Criterio
  /** Si se conoce, la elección también se comprueba contra el turno. */
  turn?: TurnStatus
}

/** RF-12.3 · RF-12.4 · lo que impide una elección; vacío si procede. */
export function validateWeekSelection(weeks: readonly number[], context: SelectionContext): SelectionError[] {
  const criteria = context.criteria ?? CRITERIO_POR_DEFECTO

  if (context.turn?.done) {
    return [{ message: 'calendar.selection.validation.already_selected' }]
  }
  if (context.turn && !context.turn.canSelect) {
    return [{ message: 'calendar.selection.validation.not_your_turn', waitingFor: context.turn.waitingFor }]
  }

  const duplicated = weeks.filter((week, i) => weeks.indexOf(week) !== i)
  if (duplicated.length > 0) {
    return [{ message: 'calendar.selection.validation.week_duplicated', weeks: [...new Set(duplicated)] }]
  }
  const known = new Set(context.classification.map(s => s.indice))
  const unknown = weeks.filter(week => !known.has(week))
  if (unknown.length > 0) {
    return [{ message: 'calendar.selection.validation.week_unknown', weeks: unknown }]
  }

  const needed = weeksPerFraction(criteria)
  if (weeks.length !== needed) {
    return [{ message: 'calendar.selection.validation.wrong_count', required: needed, chosen: weeks.length }]
  }

  const errors: SelectionError[] = []
  const taken = weeks.filter(week => context.taken.has(week))
  if (taken.length > 0) {
    errors.push({ message: 'calendar.selection.validation.week_taken', weeks: taken })
  }

  const summary = selectionSummary(weeks, context.classification)
  for (const season of TEMPORADAS) {
    if (summary[season] !== criteria[season]) {
      errors.push({ message: 'calendar.selection.validation.wrong_composition', season, required: criteria[season], chosen: summary[season] })
    }
  }
  return errors
}
