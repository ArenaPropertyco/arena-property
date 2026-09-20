/**
 * HU-53 · RF-53.1…RF-53.5 — el listado de referidos del Embajador.
 *
 * Cada referido llega con su estado del ciclo (HU-51) y, si ya compró, con la
 * comisión provisionada por HU-54: monto congelado sobre el precio pactado y
 * estado de saldo. Un referido `Registrado` no muestra monto alguno (RF-53.3):
 * sin compra no hay precio pactado sobre el cual calcularlo, y mostrar una cifra
 * sería inventarla (principio 9).
 *
 * Filtrar, totalizar y ordenar son funciones puras; quién ve qué lo decide la
 * RLS (RF-53.5).
 */

import type { CopAmount } from '../money/importe'
import type { ReferralStage } from './attribution'
import { REFERRAL_STAGES } from './attribution'
import type { Day } from './commission'
import type { CommissionStatus } from './ledger'

/** RF-53.2 · exactamente Registrado, En proceso de pago y Pago completado. */
export const REFERRAL_STATES = REFERRAL_STAGES

export type ReferralState = ReferralStage

/** RF-53.3 · lo que el listado muestra de la comisión de un referido que ya compró. */
export interface ReferralCommission {
  amount: CopAmount
  status: CommissionStatus
  /** D-02 · la fecha en que pasa a disponible, mientras está en gracia. */
  graceEndsOn: Day | null
}

/** RF-53.1 · un referido tal como lo lista el Embajador. */
export interface ReferralRow {
  id: string
  prospectName: string | null
  prospectEmail: string
  referredOn: Day
  /** RF-53.1 · propiedad y fracción de interés, si ya existe compra. */
  propertyName: string | null
  fractionNumber: number | null
  stage: ReferralState
  commission: ReferralCommission | null
}

export interface ReferralFilter {
  stage: ReferralState | null
  desde: Day | null
  hasta: Day | null
}

export function emptyReferralFilter(): ReferralFilter {
  return { stage: null, desde: null, hasta: null }
}

export function hasActiveReferralFilter(filter: ReferralFilter): boolean {
  return filter.stage !== null || filter.desde !== null || filter.hasta !== null
}

/** CA-53.2 · RF-53.4 · estado y periodo se combinan; los extremos del periodo cuentan. */
export function filterReferrals(rows: readonly ReferralRow[], filter: ReferralFilter): ReferralRow[] {
  return rows.filter(row =>
    (filter.stage === null || row.stage === filter.stage)
    && (filter.desde === null || row.referredOn >= filter.desde)
    && (filter.hasta === null || row.referredOn <= filter.hasta))
}

export type ReferralTotals = Record<ReferralState, number> & { total: number }

/** CA-53.1 · RF-53.4 · cuántos hay en cada estado; siempre suman el total. */
export function referralTotals(rows: readonly ReferralRow[]): ReferralTotals {
  const totals: ReferralTotals = { registered: 0, payment_in_progress: 0, paid: 0, total: rows.length }
  for (const row of rows) {
    totals[row.stage] += 1
  }
  return totals
}

/** CA-53.3 · RF-53.3 · la comisión mostrada; nunca para un referido registrado. */
export function commissionShown(row: ReferralRow): ReferralCommission | null {
  return row.stage === 'registered' ? null : row.commission
}

/** RF-53.1 · del más reciente al más antiguo. Devuelve una copia. */
export function sortReferrals(rows: readonly ReferralRow[]): ReferralRow[] {
  return [...rows].sort((a, b) => b.referredOn.localeCompare(a.referredOn) || a.id.localeCompare(b.id))
}
