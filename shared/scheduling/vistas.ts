/**
 * HU-12, HU-13, HU-14, HU-15 — lo que las pantallas del calendario reciben ya
 * resuelto por los composables: turnos, solicitudes, fracciones propias y bloqueos.
 * Solo tipos: la lógica vive en `selection.ts`, `swaps.ts`, `week-usage.ts`,
 * `week-blocks.ts` y `week-projection.ts`.
 */

import type { Dia } from './rejilla'
import type { Temporada } from './temporadas'

/** Un turno del año tal como se lista: fracción, posición y cuánto lleva elegido (D-32). */
export interface SelectionTurnListed {
  fraction: number
  position: number
  ownerName: string | null
  hasOwner: boolean
  selectedWeeks: number
}

export type SwapRequestStatus = 'open' | 'approved' | 'rejected'

/** Una solicitud de intercambio con las semanas ya resueltas a índice y temporada. */
export interface SwapRequestListed {
  id: string
  requesterFraction: number
  offeredWeek: number
  targetFraction: number
  requestedWeek: number
  season: Temporada
  message: string | null
  status: SwapRequestStatus
  createdAt: string
  resolutionReason: string | null
}

/** Una fracción de quien mira, con su interruptor de calendario (D-31). */
export interface FraccionPropia {
  id: string
  number: number
  propertyId: string
  propertyName: string
  calendarActive: boolean
  /** RF-14.1c · día de activación en la zona del negocio, o `null`. */
  activadoEl: Dia | null
}

/** Un bloqueo del Administrador sobre una semana, con los conflictos abiertos que dejó (RF-15.4). */
export interface WeekBlockListed {
  id: string
  week: number
  startsOn: Dia
  endsOn: Dia
  season: Temporada
  reason: string
  createdAt: string
  liftedAt: string | null
  conflicts: { fraction: number, week: number }[]
}
