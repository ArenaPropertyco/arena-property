/**
 * HU-56 · RF-56.1…RF-56.6 · D-01 · D-06 · D-20 — la solicitud de retiro y su ciclo.
 *
 * El Embajador pide retirar parte o todo su disponible (D-06), nunca por debajo
 * del mínimo que fija el Superadmin ni con otra solicitud abierta. La solicitud
 * recorre `solicitada → aprobada → pagada`, o `solicitada → rechazada` con
 * motivo (RF-56.2); las transiciones son explícitas y cualquier otra se rechaza.
 *
 * Tres cosas conviene tener presentes:
 *
 * 1. El disponible se descuenta al **aprobarse** (RF-56.3): `settle` deja el
 *    movimiento de billetera de cada paso, y solo el de aprobación resta.
 * 2. Pagar exige comprobante (RF-56.4) y **no devenga nada** (RF-56.5, D-01): el
 *    egreso ya se registró al acreditarse la comisión. `settle` no toca el libro
 *    de plataforma al pagar, y la base tampoco.
 * 3. Todo es puro; la base repite las mismas reglas con una restricción única
 *    para la solicitud abierta y con funciones que validan antes de escribir.
 */

import type { CopAmount } from '../money/importe'
import { esImporte, pesos } from '../money/importe'
import type { Day } from './commission'
import type { PlatformEntry } from './ledger'
import type { WalletEntry } from './wallet'

/** RF-56.2 · los estados del ciclo, en orden. */
export const WITHDRAWAL_STATUSES = ['requested', 'approved', 'paid', 'rejected'] as const

export type WithdrawalStatus = typeof WITHDRAWAL_STATUSES[number]

/** CA-56.5 · abierta es la que aún puede cambiar: solicitada o aprobada sin pagar. */
export const OPEN_WITHDRAWAL_STATUSES: readonly WithdrawalStatus[] = ['requested', 'approved']

/** D-06 · el mínimo con el que nace la plataforma, si el Superadmin no fijó otro. */
export const DEFAULT_MINIMUM_WITHDRAWAL: CopAmount = pesos(200_000)

/** RF-56.2 · de cada estado, a cuáles se puede pasar. Lo que no está aquí, no procede. */
export const WITHDRAWAL_TRANSITIONS: Record<WithdrawalStatus, readonly WithdrawalStatus[]> = {
  requested: ['approved', 'rejected'],
  approved: ['paid'],
  paid: [],
  rejected: [],
}

export interface WithdrawalRequest {
  id: string
  ambassadorId: string
  amount: CopAmount
  status: WithdrawalStatus
  requestedOn: Day
  /** Día en que se aprobó o rechazó. */
  resolvedOn: Day | null
  paidOn: Day | null
  rejectionReason: string | null
  /** RF-56.4 · el comprobante en Storage; sin él no hay pago. */
  receiptPath: string | null
}

export const WITHDRAWAL_VALIDATION_KEYS = [
  'wallet.withdrawal.validation.amount_required',
  'wallet.withdrawal.validation.below_minimum',
  'wallet.withdrawal.validation.above_available',
  'wallet.withdrawal.validation.open_request',
] as const

export type WithdrawalValidationKey = typeof WITHDRAWAL_VALIDATION_KEYS[number]

export type WithdrawalTransitionError
  = | 'wallet.withdrawal.errors.invalid_transition'
    | 'wallet.withdrawal.errors.reason_required'
    | 'wallet.withdrawal.errors.receipt_required'

/** Lo que la solicitud necesita saber de la billetera para validarse. */
export interface WalletForWithdrawal {
  available: CopAmount
  minimum: CopAmount
}

/** RF-56.1 · D-06 · el mínimo vigente: el fijado o, si nadie fijó, el inicial. */
export function withdrawalMinimum(setting: CopAmount | null | undefined): CopAmount {
  return setting ?? DEFAULT_MINIMUM_WITHDRAWAL
}

/** RF-56.1 · lo que impide fijar un mínimo; `null` si procede. */
export function validateMinimum(amount: CopAmount | null): 'wallet.minimum.validation.not_positive' | null {
  return amount !== null && esImporte(amount) && amount > 0 ? null : 'wallet.minimum.validation.not_positive'
}

/** CA-56.5 · RF-56.3 · ¿hay una solicitud que aún puede cambiar? */
export function hasOpenWithdrawal(requests: readonly Pick<WithdrawalRequest, 'status'>[]): boolean {
  return requests.some(request => OPEN_WITHDRAWAL_STATUSES.includes(request.status))
}

/**
 * CA-56.1 · CA-56.5 · RF-56.1 · lo que impide solicitar; vacío si procede. Solo
 * cuenta el disponible: ni lo pendiente ni lo en gracia se retira (RT-08).
 */
export function validateWithdrawal(
  amount: CopAmount | null,
  wallet: WalletForWithdrawal,
  requests: readonly Pick<WithdrawalRequest, 'status'>[],
): WithdrawalValidationKey[] {
  if (amount === null || !esImporte(amount) || amount <= 0) {
    return ['wallet.withdrawal.validation.amount_required']
  }
  const errors: WithdrawalValidationKey[] = []
  if (amount < wallet.minimum) {
    errors.push('wallet.withdrawal.validation.below_minimum')
  }
  if (amount > wallet.available) {
    errors.push('wallet.withdrawal.validation.above_available')
  }
  if (hasOpenWithdrawal(requests)) {
    errors.push('wallet.withdrawal.validation.open_request')
  }
  return errors
}

/** CA-56.3 · RF-56.2 · ¿existe la transición en la tabla? */
export function canTransition(from: WithdrawalStatus, to: WithdrawalStatus): boolean {
  return WITHDRAWAL_TRANSITIONS[from].includes(to)
}

export interface TransitionInput {
  to: WithdrawalStatus
  on: Day
  /** CA-56.4 · obligatorio al rechazar. */
  reason?: string | null
  /** CA-56.6 · obligatorio al pagar. */
  receiptPath?: string | null
}

export type TransitionResult
  = | { ok: true, request: WithdrawalRequest }
    | { ok: false, error: WithdrawalTransitionError }

/**
 * CA-56.3 · CA-56.4 · CA-56.6 · RF-56.2 · la solicitud tras una transición, o el
 * error que la impide. Nunca muta la recibida.
 */
export function transition(request: WithdrawalRequest, input: TransitionInput): TransitionResult {
  if (!canTransition(request.status, input.to)) {
    return { ok: false, error: 'wallet.withdrawal.errors.invalid_transition' }
  }

  switch (input.to) {
    case 'approved':
      return { ok: true, request: { ...request, status: 'approved', resolvedOn: input.on } }
    case 'rejected': {
      const motivo = input.reason?.trim() ?? ''
      if (motivo === '') {
        return { ok: false, error: 'wallet.withdrawal.errors.reason_required' }
      }
      return { ok: true, request: { ...request, status: 'rejected', resolvedOn: input.on, rejectionReason: motivo } }
    }
    case 'paid': {
      const ruta = input.receiptPath?.trim() ?? ''
      if (ruta === '') {
        return { ok: false, error: 'wallet.withdrawal.errors.receipt_required' }
      }
      return { ok: true, request: { ...request, status: 'paid', paidOn: input.on, receiptPath: ruta } }
    }
    default:
      return { ok: false, error: 'wallet.withdrawal.errors.invalid_transition' }
  }
}

/** La billetera y el libro de plataforma sobre los que se liquida un retiro. */
export interface WithdrawalLedger {
  entries: WalletEntry[]
  /** D-01 · el libro de Arena; el retiro nunca le añade una fila. */
  platform: PlatformEntry[]
}

const ENTRY_OF_STATUS: Partial<Record<WithdrawalStatus, WalletEntry['kind']>> = {
  requested: 'withdrawal_requested',
  approved: 'withdrawal_approved',
  paid: 'withdrawal_paid',
}

/**
 * CA-56.2 · CA-56.7 · RF-56.3 · RF-56.5 · lo que cada paso deja en la billetera:
 * solicitud, aprobación —la única que descuenta— y pago. El rechazo no deja nada,
 * y ninguno toca el libro de plataforma. Idempotente: el mismo paso dos veces no
 * duplica el movimiento.
 */
export function settle(ledger: WithdrawalLedger, request: WithdrawalRequest, status: WithdrawalStatus, on: Day): WithdrawalLedger {
  const kind = ENTRY_OF_STATUS[status]
  if (!kind || ledger.entries.some(entry => entry.withdrawalId === request.id && entry.kind === kind)) {
    return ledger
  }

  const entry: WalletEntry = {
    id: `${kind}:${request.id}`,
    kind,
    amount: request.amount,
    occurredOn: on,
    createdAt: `${on}T00:00:00Z`,
    commissionId: null,
    withdrawalId: request.id,
    referralLabel: null,
    propertyName: null,
    fractionNumber: null,
    graceEndsOn: null,
    note: null,
  }

  return { entries: [...ledger.entries, entry], platform: ledger.platform }
}

/** RF-56.4 · el bucket del comprobante y lo que admite. */
export const BUCKET_DE_COMPROBANTES = 'withdrawal-receipts'
export const MIMES_DE_COMPROBANTE: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const TAMANO_MAXIMO_DE_COMPROBANTE = 10 * 1024 * 1024

export const CLAVES_DE_VALIDACION_DE_COMPROBANTE = [
  'wallet.receipt.validation.format',
  'wallet.receipt.validation.empty',
  'wallet.receipt.validation.too_large',
] as const

export type ClaveDeValidacionDeComprobante = typeof CLAVES_DE_VALIDACION_DE_COMPROBANTE[number]

/** CA-56.6 · RF-56.4 · lo que impide subir el comprobante; `null` si procede. */
export function validarComprobante(archivo: { mime: string, size: number }): ClaveDeValidacionDeComprobante | null {
  if (!MIMES_DE_COMPROBANTE.includes(archivo.mime)) {
    return 'wallet.receipt.validation.format'
  }
  if (archivo.size <= 0) {
    return 'wallet.receipt.validation.empty'
  }
  if (archivo.size > TAMANO_MAXIMO_DE_COMPROBANTE) {
    return 'wallet.receipt.validation.too_large'
  }
  return null
}

/** RF-56.4 · la ruta en el bucket: el Embajador primero, que es de donde la política lee. */
export function rutaDeComprobante(ambassadorId: string, requestId: string, nombre: string): string {
  const extension = nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')).toLowerCase() : ''
  return `${ambassadorId}/${requestId}${extension}`
}
