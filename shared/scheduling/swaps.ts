/**
 * HU-12 · RF-12.6 · D-28, D-32 · schedule.md I-06 — intercambio de semanas entre
 * fracciones.
 *
 * El Administrador o el Superadmin intercambian una semana de una fracción por una
 * de otra, siempre de la misma temporada (nadie convierte bajas en altas), sin
 * confirmación ni liberación encima y con motivo que va a la auditoría. El Propietario
 * puede solicitarlo ofreciendo una semana propia; el Administrador decide.
 *
 * Entre pedir y resolver pasa el tiempo: una semana puede confirmarse en medio y
 * dejar la solicitud sin salida. Eso se dice —no se descubre al fallar— con
 * `swapRequestBlocked`, y el rechazo de la base se traduce con `swapErrorKey`.
 */

import type { Temporada } from './temporadas'

export interface AllocationEntry {
  fraction: number
  week: number
  season: Temporada
}

export interface SwapSide {
  fraction: number
  week: number
}

export interface SwapProposal {
  from: SwapSide
  to: SwapSide
}

export const SWAP_VALIDATION_KEYS = [
  'calendar.swaps.validation.same_fraction',
  'calendar.swaps.validation.week_not_owned',
  'calendar.swaps.validation.different_season',
  'calendar.swaps.validation.week_locked',
  'calendar.swaps.validation.reason_required',
  'calendar.swaps.validation.already_resolved',
  'calendar.swaps.validation.not_allowed',
] as const

export type SwapValidationKey = typeof SWAP_VALIDATION_KEYS[number]

export interface SwapError {
  message: SwapValidationKey
  weeks?: number[]
}

export interface SwapContext {
  allocations: readonly AllocationEntry[]
  /** Semanas confirmadas o ya liberadas: no se mueven (RF-12.9, D-33). */
  lockedWeeks?: ReadonlySet<number>
  reason?: string
  /** El Administrador siempre deja motivo (TR-01 · RF-A.4). */
  requireReason?: boolean
}

function entryOf(allocations: readonly AllocationEntry[], side: SwapSide): AllocationEntry | undefined {
  return allocations.find(a => a.week === side.week && a.fraction === side.fraction)
}

/** RF-12.6 · CA-12.10 · lo que impide el intercambio; vacío si procede. */
export function validateSwap(proposal: SwapProposal, context: SwapContext): SwapError[] {
  if (context.requireReason && (context.reason ?? '').trim() === '') {
    return [{ message: 'calendar.swaps.validation.reason_required' }]
  }
  if (proposal.from.fraction === proposal.to.fraction) {
    return [{ message: 'calendar.swaps.validation.same_fraction' }]
  }
  const from = entryOf(context.allocations, proposal.from)
  const to = entryOf(context.allocations, proposal.to)
  const notOwned = [from ? null : proposal.from.week, to ? null : proposal.to.week].filter((w): w is number => w !== null)
  if (notOwned.length > 0) {
    return [{ message: 'calendar.swaps.validation.week_not_owned', weeks: notOwned }]
  }
  if (from!.season !== to!.season) {
    return [{ message: 'calendar.swaps.validation.different_season' }]
  }
  const locked = [proposal.from.week, proposal.to.week].filter(week => context.lockedWeeks?.has(week))
  if (locked.length > 0) {
    return [{ message: 'calendar.swaps.validation.week_locked', weeks: locked }]
  }
  return []
}

/** El reparto tras el intercambio: cada semana pasa a la otra fracción. */
export function applySwap(allocations: readonly AllocationEntry[], proposal: SwapProposal): AllocationEntry[] {
  return allocations.map((entry) => {
    if (entry.week === proposal.from.week && entry.fraction === proposal.from.fraction) {
      return { ...entry, fraction: proposal.to.fraction }
    }
    if (entry.week === proposal.to.week && entry.fraction === proposal.to.fraction) {
      return { ...entry, fraction: proposal.from.fraction }
    }
    return entry
  })
}

/** Las semanas de otras fracciones en la misma temporada que la dada, en orden de rejilla. */
export function swappableWeeksFor(week: number, allocations: readonly AllocationEntry[]): AllocationEntry[] {
  const own = allocations.find(a => a.week === week)
  if (!own) {
    return []
  }
  return allocations
    .filter(a => a.season === own.season && a.fraction !== own.fraction)
    .sort((a, b) => a.week - b.week)
}

/**
 * RF-12.6 · CA-12.11 · RF-12.9 · por qué una solicitud abierta ya no se puede
 * aprobar: alguna de sus dos semanas se confirmó o se liberó después de pedirla.
 * Devuelve las semanas que lo impiden; vacío si sigue viva.
 */
export function swapRequestBlocked(
  request: { offeredWeek: number, requestedWeek: number, status: string },
  lockedWeeks: ReadonlySet<number> | undefined,
): number[] {
  if (request.status !== 'open' || !lockedWeeks) {
    return []
  }
  return [request.offeredWeek, request.requestedWeek].filter(week => lockedWeeks.has(week))
}

/**
 * RF-12.6 · el rechazo de la base, reconocido por la regla que cita.
 *
 * Sin esto la pantalla dice «no pudimos» y se queda el motivo dentro: la base
 * sabe exactamente qué falló y quien decide merece leerlo.
 */
export function swapErrorKey(message: string): SwapValidationKey | null {
  if (message.includes('RF-12.9') || message.includes('confirmada o liberada')) {
    return 'calendar.swaps.validation.week_locked'
  }
  if (message.includes('misma temporada')) {
    return 'calendar.swaps.validation.different_season'
  }
  if (message.includes('ya fue resuelta')) {
    return 'calendar.swaps.validation.already_resolved'
  }
  if (message.includes('exige un motivo')) {
    return 'calendar.swaps.validation.reason_required'
  }
  if (message.includes('deben ser distintas') || message.includes('distinta')) {
    return 'calendar.swaps.validation.same_fraction'
  }
  if (message.includes('pertenecer a la fracción') || message.includes('semana propia') || message.includes('debe ser de la fracción')) {
    return 'calendar.swaps.validation.week_not_owned'
  }
  if (message.includes('CA-17.4') || message.includes('solo el titular')) {
    return 'calendar.swaps.validation.not_allowed'
  }
  return null
}

export interface SwapRequestDraft {
  fraction: number
  offeredWeek: number
  targetFraction: number
  requestedWeek: number
}

/** RF-12.6 · CA-12.11 · el Propietario solo ofrece una semana propia por una ajena de la misma temporada. */
export function validateSwapRequest(draft: SwapRequestDraft, context: Pick<SwapContext, 'allocations' | 'lockedWeeks'>): SwapError[] {
  return validateSwap(
    { from: { fraction: draft.fraction, week: draft.offeredWeek }, to: { fraction: draft.targetFraction, week: draft.requestedWeek } },
    { allocations: context.allocations, lockedWeeks: context.lockedWeeks },
  )
}
