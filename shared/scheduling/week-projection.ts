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
 *
 * D-43 · una semana liberada y una rentada no son lo mismo y no se pintan igual:
 * la primera sigue en la bolsa esperando quien la coloque, la segunda ya tiene
 * tercero. Solo la segunda puede llevar importe, y solo si ese ingreso es de la
 * fracción de quien mira: liberar no paga por sí solo (RF-40.7).
 */

import type { CopAmount } from '../money/importe'
import type { Dia, SemanaDeRejilla } from './rejilla'
import type { SemanaClasificada, Temporada } from './temporadas'
import { confirmationDeadline, pendingConfirmations, quotaByState, weekState } from './week-usage'
import type { OwnedWeek, ReleaseReason, SeasonQuota, WeekUsageState } from './week-usage'

export type WeekCellType = 'own' | 'other' | 'blocked' | 'released' | 'rented' | 'pool' | 'free'
export const WEEK_CELL_TYPES: readonly WeekCellType[] = ['own', 'other', 'blocked', 'released', 'rented', 'pool', 'free']

/** D-43 · una semana de la bolsa que ya tiene tercero, con el reparto de su ingreso. */
export interface RentedWeek {
  week: number
  /** Fracción a la que se acredita el ingreso; `null` si se prorrateó (D-39). */
  attributedFraction: number | null
  income: CopAmount | null
}

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
  /** D-43 · las semanas ya colocadas a un tercero; el resto de la bolsa sigue libre. */
  rentals?: readonly RentedWeek[]
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
  /**
   * RF-13.2b · D-43 · el ingreso de esta semana **cuando es de quien mira**: solo
   * en una semana rentada cuyo ingreso se atribuyó a su fracción. En cualquier otro
   * caso es `null`, porque una semana en la bolsa no promete importe alguno.
   */
  income: CopAmount | null
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
  const rentalOf = new Map((input.rentals ?? []).map(r => [r.week, r]))
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
      income: null,
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
        const rental = rentalOf.get(grid.indice)
        const propio = allocation.fraction === input.ownFraction
        return {
          ...base,
          type: rental ? 'rented' : 'released',
          state,
          fraction: allocation.fraction,
          ownerName: nameOf.get(allocation.fraction) ?? null,
          income: rental && propio && rental.attributedFraction === allocation.fraction ? rental.income : null,
        }
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

/**
 * El tablero de la propiedad para quien la gestiona (HU-13 · RF-13.3, HU-14 ·
 * RF-14.1, RF-14.6, RF-14.7): las mismas celdas que ve un Propietario, pero
 * ninguna es «propia». Cada semana con dueño lleva su fracción, su titular y su
 * estado, y admite acción solo si esa fracción tiene el calendario activo (D-31)
 * y la semana no pasó. La base repite estas reglas al confirmar, cancelar o
 * liberar en nombre del titular.
 */
export interface PropertyProjectionInput {
  today: Dia
  rejilla: readonly SemanaDeRejilla[]
  classification: readonly SemanaClasificada[]
  allocations: readonly AllocationState[]
  blocks: readonly { week: number, reason: string }[]
  selectionComplete: boolean
  /** Por fracción: nombre del titular y si su calendario está activo. */
  coOwners: readonly { fraction: number, name: string | null, calendarActive: boolean }[]
  rentals?: readonly RentedWeek[]
}

export interface PropertyProjection {
  cells: WeekCell[]
  /** El cupo por temporada de cada fracción con titular, para verlas lado a lado. */
  quotaByFraction: Map<number, Record<Temporada, SeasonQuota>>
}

export function projectPropertyWeeks(input: PropertyProjectionInput): PropertyProjection {
  const activeOf = new Map(input.coOwners.map(c => [c.fraction, c.calendarActive]))
  const base = projectWeeks({
    today: input.today,
    ownFraction: null,
    calendarActive: false,
    rejilla: input.rejilla,
    classification: input.classification,
    allocations: input.allocations,
    blocks: input.blocks,
    selectionComplete: input.selectionComplete,
    coOwners: input.coOwners,
    rentals: input.rentals,
  })

  const cells = base.cells.map<WeekCell>((cell) => {
    if (cell.type !== 'other' || cell.fraction === null) {
      return cell
    }
    const activa = activeOf.get(cell.fraction) ?? false
    const week: OwnedWeek = {
      week: cell.week,
      season: cell.season ?? 'baja',
      startsOn: cell.startsOn,
      endsOn: cell.endsOn,
      confirmedAt: cell.state === 'confirmed' || cell.state === 'used' ? 'yes' : null,
      releasedAt: null,
      releaseReason: null,
    }
    return {
      ...cell,
      deadline: cell.state === 'elected' ? confirmationDeadline(week) : null,
      actionable: activa && (cell.state === 'elected' || cell.state === 'confirmed') && cell.startsOn >= input.today,
    }
  })

  const quotaByFraction = new Map<number, Record<Temporada, SeasonQuota>>()
  for (const owner of input.coOwners) {
    const weeks = ownWeeksOf({ ...input, ownFraction: owner.fraction, calendarActive: owner.calendarActive })
    quotaByFraction.set(owner.fraction, quotaByState(weeks, input.today))
  }

  return { cells, quotaByFraction }
}
