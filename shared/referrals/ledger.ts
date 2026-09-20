/**
 * HU-54 · RF-54.1…RF-54.7 · D-01, D-02, D-04, D-07 — la liberación de la
 * comisión y su periodo de gracia.
 *
 * El ciclo del saldo es `pendiente` → `en gracia` → `disponible` → `retirada`, con
 * `reversada` como salida (RF-54.1). Cinco reglas lo gobiernan:
 *
 * 1. **Se provisiona al cerrarse la compra (RF-53.3).** El monto se congela con el
 *    tipo del Embajador sobre el precio pactado (D-05) y queda pendiente. Sin tipo
 *    aplicable no se inventa una comisión (principio 9).
 * 2. **Se acredita al completarse el pago (RF-54.2).** Pasa a gracia, con fecha de
 *    habilitación a 30 días (D-02); es el único momento en que Arena devenga el
 *    egreso, en su propio libro y nunca en la propiedad (RF-54.6, D-01).
 * 3. **Todo es idempotente (RF-54.4).** Acreditar dos veces o correr la tarea de
 *    gracia dos veces devuelve el mismo libro.
 * 4. **La reversa depende del momento (RF-54.5).** Dentro de la gracia se reversa
 *    con contra-asiento; después, Arena asume la pérdida y lo deja escrito.
 * 5. **La suspensión depende del motivo (RF-54.7, D-07).** Administrativa no toca
 *    nada; por fraude o incumplimiento se pierden lo pendiente y lo en gracia.
 *
 * Todo es puro y trabaja sobre un libro en memoria; la base repite las mismas
 * reglas con disparadores y una tarea programada.
 */

import type { CopAmount } from '../money/importe'
import { CERO, sumarTodos } from '../money/importe'
import type { Attribution, ReferralStage } from './attribution'
import type { CommissionType, Day } from './commission'
import { commissionFor } from './commission'

/** RF-54.1 · los estados del saldo, en el orden del ciclo. */
export const COMMISSION_STATUSES = ['pending', 'in_grace', 'available', 'withdrawn', 'reversed'] as const

export type CommissionStatus = typeof COMMISSION_STATUSES[number]

/** D-02 · días de gracia desde el pago completo hasta que el saldo es retirable. */
export const GRACE_PERIOD_DAYS = 30

/** RF-55.2 · los movimientos de billetera que HU-54 produce; HU-56 añade los retiros. */
export const WALLET_MOVEMENT_KINDS = ['commission_credited', 'commission_available', 'commission_reversed'] as const

export type WalletMovementKind = typeof WALLET_MOVEMENT_KINDS[number]

/** D-07 · el tipo de suspensión decide qué pasa con el saldo. */
export type SuspensionKind = 'administrative' | 'breach_or_fraud'

export interface Commission {
  id: string
  attributionId: string
  ambassadorId: string
  /** La compra que la genera; una sola por prospecto (D-04). */
  planId: string
  propertyId: string
  fractionNumber: number
  /** RF-54.2 · el tipo y el precio con los que se calculó, congelados. */
  commissionTypeId: string
  agreedPrice: CopAmount
  amount: CopAmount
  status: CommissionStatus
  provisionedOn: Day
  completedOn: Day | null
  graceEndsOn: Day | null
  availableOn: Day | null
  reversedOn: Day | null
  reversalReason: string | null
  /** RF-54.5 · D-02 · anulada fuera de la gracia: Arena asumió la pérdida. */
  lossAssumedOn: Day | null
}

export interface WalletMovement {
  commissionId: string
  ambassadorId: string
  kind: WalletMovementKind
  amount: CopAmount
  occurredOn: Day
  note: string | null
}

/** D-01 · un asiento del libro de plataforma; la reversa es un contra-asiento sobre él. */
export interface PlatformEntry {
  kind: 'expense'
  sourceType: 'ambassador_commission'
  sourceId: string
  amount: CopAmount
  accruedOn: Day
  reversedOn: Day | null
  reverseReason: string | null
}

export interface CommissionLedger {
  commissions: Commission[]
  movements: WalletMovement[]
  platform: PlatformEntry[]
  /** RF-54.6 · siempre vacío: la comisión jamás se prorratea a la propiedad. */
  propertyShares: never[]
}

/** La compra que provisiona la comisión, con lo mínimo que hace falta congelar. */
export interface PurchaseForCommission {
  id: string
  agreedPrice: CopAmount
  propertyId: string
  fractionNumber: number
}

export function emptyLedger(): CommissionLedger {
  return { commissions: [], movements: [], platform: [], propertyShares: [] }
}

export interface CommissionBalances {
  pending: CopAmount
  inGrace: CopAmount
  available: CopAmount
  withdrawn: CopAmount
}

const DAY_MS = 24 * 60 * 60 * 1000

function addDays(day: Day, days: number): Day {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
}

/** D-02 · el día en que una comisión completada el día dado pasa a disponible. */
export function graceEndsOn(completedOn: Day): Day {
  return addDays(completedOn, GRACE_PERIOD_DAYS)
}

/** RF-54.1 · solo lo disponible se retira; ni lo pendiente ni lo en gracia (RT-08). */
export function isWithdrawable(commission: Pick<Commission, 'status'>): boolean {
  return commission.status === 'available'
}

/** Los saldos por estado, sumados en pesos exactos. */
export function balances(commissions: readonly Commission[]): CommissionBalances {
  const suma = (status: CommissionStatus) =>
    sumarTodos(commissions.filter(c => c.status === status).map(c => c.amount))

  return { pending: suma('pending'), inGrace: suma('in_grace'), available: suma('available'), withdrawn: suma('withdrawn') }
}

function liveCommissionOf(ledger: CommissionLedger, attributionId: string): Commission | undefined {
  return ledger.commissions.find(c => c.attributionId === attributionId && c.status !== 'reversed')
}

/**
 * RF-53.3 · RF-54.3 · D-04 · provisiona la comisión pendiente de una compra recién
 * cerrada. No lo hace si el referido no está en proceso de pago, si ya generó su
 * única comisión, si tiene otra viva o si no hay tipo aplicable.
 */
export function provision(
  ledger: CommissionLedger,
  attribution: Attribution,
  purchase: PurchaseForCommission,
  type: CommissionType | null,
  on: Day,
): CommissionLedger {
  if (attribution.stage !== 'payment_in_progress' || attribution.commissionedPurchaseId !== null || type === null) {
    return ledger
  }
  if (liveCommissionOf(ledger, attribution.id)) {
    return ledger
  }

  const commission: Commission = {
    id: `commission:${purchase.id}`,
    attributionId: attribution.id,
    ambassadorId: attribution.ambassadorId,
    planId: purchase.id,
    propertyId: purchase.propertyId,
    fractionNumber: purchase.fractionNumber,
    commissionTypeId: type.id,
    agreedPrice: purchase.agreedPrice,
    amount: commissionFor(type, purchase.agreedPrice),
    status: 'pending',
    provisionedOn: on,
    completedOn: null,
    graceEndsOn: null,
    availableOn: null,
    reversedOn: null,
    reversalReason: null,
    lossAssumedOn: null,
  }

  return { ...ledger, commissions: [...ledger.commissions, commission] }
}

function replace(ledger: CommissionLedger, commission: Commission): Commission[] {
  return ledger.commissions.map(c => c.id === commission.id ? commission : c)
}

/**
 * CA-54.1 · CA-54.3 · CA-54.5 · acredita la comisión de un plan cuyo pago se
 * completó: pasa a gracia, mueve la billetera y devenga el egreso una sola vez.
 * Sobre un plan sin comisión pendiente no hace nada, por eso reprocesar el evento
 * es inofensivo.
 */
export function credit(ledger: CommissionLedger, planId: string, on: Day): CommissionLedger {
  const pending = ledger.commissions.find(c => c.planId === planId && c.status === 'pending')
  if (!pending) {
    return ledger
  }

  const credited: Commission = { ...pending, status: 'in_grace', completedOn: on, graceEndsOn: graceEndsOn(on) }
  const movement: WalletMovement = {
    commissionId: credited.id, ambassadorId: credited.ambassadorId, kind: 'commission_credited',
    amount: credited.amount, occurredOn: on, note: null,
  }
  const entry: PlatformEntry = {
    kind: 'expense', sourceType: 'ambassador_commission', sourceId: credited.id,
    amount: credited.amount, accruedOn: on, reversedOn: null, reverseReason: null,
  }

  return {
    ...ledger,
    commissions: replace(ledger, credited),
    movements: [...ledger.movements, movement],
    platform: [...ledger.platform, entry],
  }
}

/**
 * CA-54.2 · DT-09 · pasa a disponible toda comisión cuya gracia venció al día
 * dado. Idempotente: lo ya disponible no se vuelve a mover.
 */
export function releaseGrace(ledger: CommissionLedger, today: Day): CommissionLedger {
  const vencidas = ledger.commissions.filter(c => c.status === 'in_grace' && c.graceEndsOn !== null && c.graceEndsOn <= today)
  if (vencidas.length === 0) {
    return ledger
  }

  const ids = new Set(vencidas.map(c => c.id))
  return {
    ...ledger,
    commissions: ledger.commissions.map(c => ids.has(c.id) ? { ...c, status: 'available', availableOn: today } : c),
    movements: [
      ...ledger.movements,
      ...vencidas.map<WalletMovement>(c => ({
        commissionId: c.id, ambassadorId: c.ambassadorId, kind: 'commission_available',
        amount: c.amount, occurredOn: today, note: null,
      })),
    ],
  }
}

/** La reversa de una comisión concreta, con billetera y contra-asiento cuando ya se había acreditado. */
function reverseOne(ledger: CommissionLedger, commission: Commission, on: Day, reason: string): CommissionLedger {
  const reversed: Commission = { ...commission, status: 'reversed', reversedOn: on, reversalReason: reason }
  const base = { ...ledger, commissions: replace(ledger, reversed) }

  if (commission.status === 'pending') {
    return base
  }

  return {
    ...base,
    movements: [...base.movements, {
      commissionId: commission.id, ambassadorId: commission.ambassadorId, kind: 'commission_reversed',
      amount: commission.amount, occurredOn: on, note: reason,
    }],
    platform: base.platform.map(e => e.sourceId === commission.id && e.reversedOn === null
      ? { ...e, reversedOn: on, reverseReason: reason }
      : e),
  }
}

/**
 * CA-54.4 · RF-54.5 · D-02 · la anulación de la compra. Pendiente o en gracia se
 * reversa; disponible o retirada no se toca y Arena deja constancia de la pérdida.
 */
export function reverse(ledger: CommissionLedger, planId: string, on: Day, reason: string): CommissionLedger {
  const commission = ledger.commissions.find(c => c.planId === planId && c.status !== 'reversed')
  if (!commission) {
    return ledger
  }

  if (commission.status === 'pending' || commission.status === 'in_grace') {
    return reverseOne(ledger, commission, on, reason)
  }

  if (commission.lossAssumedOn !== null) {
    return ledger
  }
  return { ...ledger, commissions: replace(ledger, { ...commission, lossAssumedOn: on }) }
}

/**
 * CA-54.8 · RF-54.7 · D-07 · la suspensión del Embajador. Administrativa conserva
 * todo; por fraude o incumplimiento pierde lo pendiente y lo en gracia, y lo
 * disponible queda a decisión del Superadmin.
 */
export function suspend(
  ledger: CommissionLedger,
  ambassadorId: string,
  kind: SuspensionKind,
  on: Day,
  reason: string,
): CommissionLedger {
  if (kind === 'administrative') {
    return ledger
  }

  return ledger.commissions
    .filter(c => c.ambassadorId === ambassadorId && (c.status === 'pending' || c.status === 'in_grace'))
    .reduce((acumulado, c) => reverseOne(acumulado, c, on, reason), ledger)
}

/** El total ganado en la historia: lo acreditado que no se reversó. */
export function totalEarned(commissions: readonly Commission[]): CopAmount {
  const acreditadas = commissions.filter(c => c.status === 'in_grace' || c.status === 'available' || c.status === 'withdrawn')
  return acreditadas.length === 0 ? CERO : sumarTodos(acreditadas.map(c => c.amount))
}

/** Una compra del prospecto, tal como la mira la recuperación. */
export interface PurchaseOfProspect extends PurchaseForCommission {
  closedOn: Day
  /** RF-58.8 · una compra anulada no paga comisión. */
  voided: boolean
  /** Día en que el pago se completó; `null` mientras siga en proceso. */
  completedOn: Day | null
}

export interface Recovery {
  purchase: PurchaseOfProspect
  /** La etapa a la que el referido tiene que ponerse al día. */
  stage: ReferralStage
}

/**
 * RF-51.3 · RF-54.2 · D-04 · qué compra tiene que recuperar un referido cuya
 * atribución llegó tarde.
 *
 * Quien hace clic en un enlace de referido, se registra sin escribir el código y
 * compra antes de entrar por primera vez al panel queda atribuido **después** de
 * que su compra se cerró. El cauce normal provisiona al cerrarse la compra, así
 * que sin esto el Embajador perdería una comisión que su enlace sí generó.
 *
 * Solo recupera un referido que siga en «registrado» y que nunca haya cobrado:
 * uno que ya va por su cauce normal no se toca, y la primera compra viva sigue
 * siendo la única que paga (D-04).
 */
export function recoveryFor(
  attribution: Pick<Attribution, 'stage' | 'commissionedPurchaseId'>,
  purchases: readonly PurchaseOfProspect[],
): Recovery | null {
  if (attribution.stage !== 'registered' || attribution.commissionedPurchaseId !== null) {
    return null
  }

  const primera = [...purchases]
    .filter(purchase => !purchase.voided)
    .sort((a, b) => a.closedOn.localeCompare(b.closedOn) || a.id.localeCompare(b.id))[0]

  if (!primera) {
    return null
  }

  return { purchase: primera, stage: primera.completedOn === null ? 'payment_in_progress' : 'paid' }
}
