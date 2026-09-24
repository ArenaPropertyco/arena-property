/**
 * HU-55 · RF-55.1…RF-55.5 · D-02 · D-20 — la billetera del Embajador.
 *
 * Los cuatro saldos no se guardan en ninguna parte: se **derivan** del histórico
 * de movimientos (RF-55.2). HU-54 escribe la acreditación, el paso a disponible
 * y la reversa; HU-56 añade la solicitud, la aprobación y el pago del retiro.
 * Lo pendiente todavía no ha entrado a la billetera —una comisión provisionada
 * no es un movimiento (RF-54.1)—, así que llega aparte como la provisión viva.
 *
 * Tres reglas gobiernan la agregación, y la base las repite en
 * `private.saldos_de_billetera`:
 *
 * 1. Por comisión, lo acreditado menos lo reversado es lo que cuenta; está en
 *    gracia mientras no se libere y disponible desde que se libera (D-02).
 * 2. El retiro descuenta al **aprobarse** (RF-56.3): ni la solicitud ni el pago
 *    mueven el saldo.
 * 3. Ganado es todo lo acreditado que no se reversó, sin importar si ya se retiró.
 *
 * Todo es puro y trabaja sobre listas en memoria.
 */

import type { CopAmount } from '../money/importe'
import { CERO, restar, sumar, sumarTodos } from '../money/importe'
import type { Idioma } from '../money/formato'
import { confirmado, estimado, presentarImporte } from '../money/presentacion'
import type { CifraPresentada } from '../money/presentacion'
import type { Day } from './commission'

/** RF-55.2 · todo lo que entra al histórico; los tres primeros los produce HU-54. */
export const WALLET_ENTRY_KINDS = [
  'commission_credited',
  'commission_available',
  'commission_reversed',
  'withdrawal_requested',
  'withdrawal_approved',
  'withdrawal_paid',
] as const

export type WalletEntryKind = typeof WALLET_ENTRY_KINDS[number]

/** RF-55.3 · un movimiento tal como lo lista la billetera. */
export interface WalletEntry {
  id: string
  kind: WalletEntryKind
  amount: CopAmount
  occurredOn: Day
  /** Desempata dos movimientos del mismo día. */
  createdAt: string
  commissionId: string | null
  withdrawalId: string | null
  /** RF-55.3 · el referido que generó la comisión, cuando la hay. */
  referralLabel: string | null
  propertyName: string | null
  fractionNumber: number | null
  /** D-02 · la fecha en que la comisión acreditada pasa a disponible. */
  graceEndsOn: Day | null
  note: string | null
}

/** RF-55.1 · una comisión provisionada que aún no entró a la billetera. */
export interface PendingCommission {
  id: string
  amount: CopAmount
}

export interface WalletBalances {
  pending: CopAmount
  inGrace: CopAmount
  available: CopAmount
  /** RF-56.3 · lo comprometido en retiros aprobados, pagados o no. */
  withdrawn: CopAmount
  reversed: CopAmount
  /** Lo acreditado que no se reversó, se haya retirado o no. */
  totalEarned: CopAmount
  /** CA-55.2 · D-02 · el día más próximo en que algo en gracia pasa a disponible. */
  nextAvailableOn: Day | null
}

/** Lo que el histórico dice de una comisión: cuánto entró, cuánto salió y si se liberó. */
interface EstadoDeComision {
  credited: CopAmount
  reversed: CopAmount
  released: boolean
  graceEndsOn: Day | null
}

function porComision(entries: readonly WalletEntry[]): Map<string, EstadoDeComision> {
  const estados = new Map<string, EstadoDeComision>()

  for (const entry of entries) {
    if (entry.commissionId === null) {
      continue
    }
    const estado = estados.get(entry.commissionId) ?? { credited: CERO, reversed: CERO, released: false, graceEndsOn: null }
    if (entry.kind === 'commission_credited') {
      estado.credited = sumar(estado.credited, entry.amount)
      estado.graceEndsOn = entry.graceEndsOn ?? estado.graceEndsOn
    }
    else if (entry.kind === 'commission_reversed') {
      estado.reversed = sumar(estado.reversed, entry.amount)
    }
    else if (entry.kind === 'commission_available') {
      estado.released = true
    }
    estados.set(entry.commissionId, estado)
  }

  return estados
}

/**
 * CA-55.1 · RF-55.2 · los saldos derivados del histórico y de las provisiones
 * vivas. Cumple siempre: disponible = acreditado − en gracia − retirado − reversado.
 */
export function walletBalances(entries: readonly WalletEntry[], pending: readonly PendingCommission[]): WalletBalances {
  let inGrace = CERO
  let released = CERO
  let reversed = CERO
  let credited = CERO
  let nextAvailableOn: Day | null = null

  for (const estado of porComision(entries).values()) {
    const neto = restar(estado.credited, estado.reversed)
    credited = sumar(credited, estado.credited)
    reversed = sumar(reversed, estado.reversed)
    if (estado.released) {
      released = sumar(released, neto)
    }
    else {
      inGrace = sumar(inGrace, neto)
      if (neto > 0 && estado.graceEndsOn !== null && (nextAvailableOn === null || estado.graceEndsOn < nextAvailableOn)) {
        nextAvailableOn = estado.graceEndsOn
      }
    }
  }

  const withdrawn = sumarTodos(entries.filter(entry => entry.kind === 'withdrawal_approved').map(entry => entry.amount))

  return {
    pending: sumarTodos(pending.map(comision => comision.amount)),
    inGrace,
    available: restar(released, withdrawn),
    withdrawn,
    reversed,
    totalEarned: restar(credited, reversed),
    nextAvailableOn,
  }
}

export interface WalletFilter {
  kind: WalletEntryKind | null
  desde: Day | null
  hasta: Day | null
}

export function emptyWalletFilter(): WalletFilter {
  return { kind: null, desde: null, hasta: null }
}

export function hasActiveWalletFilter(filter: WalletFilter): boolean {
  return filter.kind !== null || filter.desde !== null || filter.hasta !== null
}

/** CA-55.4 · RF-55.3 · tipo y periodo se combinan; los extremos del periodo cuentan. */
export function filterWalletEntries(entries: readonly WalletEntry[], filter: WalletFilter): WalletEntry[] {
  return entries.filter(entry =>
    (filter.kind === null || entry.kind === filter.kind)
    && (filter.desde === null || entry.occurredOn >= filter.desde)
    && (filter.hasta === null || entry.occurredOn <= filter.hasta))
}

/** RF-55.3 · del más reciente al más antiguo; el mismo día, el último creado primero. Devuelve una copia. */
export function sortWalletEntries(entries: readonly WalletEntry[]): WalletEntry[] {
  return [...entries].sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn)
    || b.createdAt.localeCompare(a.createdAt)
    || a.id.localeCompare(b.id))
}

export type WalletDirection = 'in' | 'out' | 'neutral'

/**
 * RF-55.3 · qué le hace cada movimiento al dinero del Embajador: entra, sale o
 * solo cambia de estado. La vista lo traduce a signo y color; no lo decide.
 */
export function walletEntryDirection(kind: WalletEntryKind): WalletDirection {
  switch (kind) {
    case 'commission_credited':
      return 'in'
    case 'commission_reversed':
    case 'withdrawal_approved':
      return 'out'
    default:
      return 'neutral'
  }
}

export interface WalletFigures {
  pending: CifraPresentada
  inGrace: CifraPresentada
  available: CifraPresentada
  totalEarned: CifraPresentada
}

/**
 * RF-55.1 · RF-55.5 · RT-08 · las cuatro cifras con su condición (TR-02, RF-D.6):
 * lo pendiente es una provisión y va como estimado; lo demás ya se acreditó.
 * Ninguna vista decide qué es confirmado: viene decidido.
 */
export function walletFigures(balances: WalletBalances, idioma: Idioma): WalletFigures {
  return {
    pending: presentarImporte(estimado(balances.pending), idioma),
    inGrace: presentarImporte(confirmado(balances.inGrace), idioma),
    available: presentarImporte(confirmado(balances.available), idioma),
    totalEarned: presentarImporte(confirmado(balances.totalEarned), idioma),
  }
}
