/**
 * HU-13 · RF-13.1b, RF-13.2, RF-13.3, RF-13.4 · D-16, D-31, D-33 — la proyección
 * del calendario por semanas.
 *
 * Función pura: recibe lo que la base sabe del año (rejilla clasificada, semanas
 * elegidas por cada fracción con sus marcas, bloqueos, copropietarios por nombre)
 * y quién mira, y devuelve una celda por semana con su tipo, su estado y si admite
 * acción. La interfaz solo pinta lo que sale de aquí.
 *
 * Con calendario inactivo (D-31) todo se ve y nada es accionable (RF-13.1b).
 */

import type { Dia, SemanaDeRejilla } from './rejilla'
import type { SemanaClasificada, Temporada } from './temporadas'
import { confirmationDeadline, pendingConfirmations, quotaByState, weekState } from './week-usage'
import type { OwnedWeek, ReleaseReason, SeasonQuota, WeekUsageState } from './week-usage'

export type WeekCellType = 'own' | 'other' | 'blocked' | 'rented' | 'pool' | 'free'
export const WEEK_CELL_TYPES: readonly WeekCellType[] = ['own', 'other', 'blocked', 'rented', 'pool', 'free']

export interface AllocationState {
  fraction: number
  week: number
  confirmedAt: string | null
  releasedAt: string | null
  releaseReason: ReleaseReason | null
}

export interface WeekProjectionInput {
  today: Dia
  /** La fracción de quien mira; `null` si no tiene ninguna en la propiedad. */
  ownFraction: number | null
  calendarActive: boolean
  activatedOn?: Dia | null
  rejilla: readonly SemanaDeRejilla[]
  classification: readonly SemanaClasificada[]
  allocations: readonly AllocationState[]
  blocks: readonly { week: number, reason: string }[]
  /** Con los turnos cerrados, las semanas sin dueño son bolsa del Administrador. */
  selectionComplete: boolean
  /** D-16 · lo único que se sabe de los copropietarios: nombre y fracción. */
  coOwners: readonly { fraction: number, name: string | null }[]
}

export interface WeekCell {
  week: number
  startsOn: Dia
  endsOn: Dia
  season: Temporada | null
  type: WeekCellType
  /** Solo para semanas con dueño: qué pasa con ellas. */
  state: WeekUsageState | null
  fraction: number | null
  ownerName: string | null
  reason: string | null
  /** RF-14.7 · último día para confirmar, solo en semanas propias elegidas. */
  deadline: Dia | null
  actionable: boolean
}

export interface WeekProjection {
  cells: WeekCell[]
  ownWeeks: OwnedWeek[]
  quota: Record<Temporada, SeasonQuota>
  pending: { week: number, deadline: Dia }[]
  readOnly: boolean
}

/** Las semanas de la fracción de quien mira, con temporada y fechas resueltas. */
export function ownWeeksOf(input: WeekProjectionInput): OwnedWeek[] {
  if (input.ownFraction === null) {
    return []
  }
  const seasonOf = new Map(input.classification.map(s => [s.indice, s.temporada]))
  const gridOf = new Map(input.rejilla.map(s => [s.indice, s]))
  return input.allocations
    .filter(a => a.fraction === input.ownFraction)
    .flatMap<OwnedWeek>((a) => {
      const grid = gridOf.get(a.week)
      const season = seasonOf.get(a.week)
      if (!grid || !season) {
        return []
      }
      return [{ week: a.week, season, startsOn: grid.inicio, endsOn: grid.fin, confirmedAt: a.confirmedAt, releasedAt: a.releasedAt, releaseReason: a.releaseReason }]
    })
    .sort((a, b) => a.week - b.week)
}

export function projectWeeks(input: WeekProjectionInput): WeekProjection {
  const ownWeeks = ownWeeksOf(input)
  const readOnly = input.ownFraction === null || !input.calendarActive
  const seasonOf = new Map(input.classification.map(s => [s.indice, s.temporada]))
  const allocationOf = new Map(input.allocations.map(a => [a.week, a]))
  const blockOf = new Map(input.blocks.map(b => [b.week, b]))
  const nameOf = new Map(input.coOwners.map(c => [c.fraction, c.name]))

  const cells = [...input.rejilla].sort((a, b) => a.indice - b.indice).map<WeekCell>((grid) => {
    const base: WeekCell = {
      week: grid.indice,
      startsOn: grid.inicio,
      endsOn: grid.fin,
      season: seasonOf.get(grid.indice) ?? null,
      type: 'free',
      state: null,
      fraction: null,
      ownerName: null,
      reason: null,
      deadline: null,
      actionable: false,
    }
    const block = blockOf.get(grid.indice)
    if (block) {
      return { ...base, type: 'blocked', reason: block.reason }
    }
    const allocation = allocationOf.get(grid.indice)
    if (allocation) {
      const week: OwnedWeek = {
        week: grid.indice,
        season: base.season ?? 'baja',
        startsOn: grid.inicio,
        endsOn: grid.fin,
        confirmedAt: allocation.confirmedAt,
        releasedAt: allocation.releasedAt,
        releaseReason: allocation.releaseReason,
      }
      const state = weekState(week, input.today)
      const own = allocation.fraction === input.ownFraction
      if (state === 'released') {
        return { ...base, type: 'rented', state, fraction: allocation.fraction, ownerName: nameOf.get(allocation.fraction) ?? null }
      }
      return {
        ...base,
        type: own ? 'own' : 'other',
        state,
        fraction: allocation.fraction,
        ownerName: nameOf.get(allocation.fraction) ?? null,
        deadline: own && state === 'elected' ? confirmationDeadline(week) : null,
        // Solo lo propio, con calendario activo, y solo mientras se pueda hacer algo con ello.
        actionable: own && !readOnly && (state === 'elected' || state === 'confirmed') && grid.inicio >= input.today,
      }
    }
    return { ...base, type: input.selectionComplete ? 'pool' : 'free' }
  })

  return {
    cells,
    ownWeeks,
    quota: quotaByState(ownWeeks, input.today),
    pending: pendingConfirmations(ownWeeks, input.today),
    readOnly,
  }
}
