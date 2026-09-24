/**
 * HU-62 · RF-62.9 · D-51 — el retiro del saldo positivo de una propiedad.
 *
 * Si la billetera de una propiedad queda en positivo, el Propietario pide
 * retirar hasta ese saldo indicando su cuenta de destino. El ciclo es
 * `solicitado → pagado` (con comprobante) o `solicitado → rechazado` (con
 * motivo), y solo hay una solicitud abierta por Propietario y propiedad. Pagar
 * resta del saldo y no devenga nada en la maestra (D-51). La base repite lo
 * mismo con una restricción única y funciones que validan antes de escribir.
 */

import type { CopAmount } from '../money/importe'
import { esImporte, restar, CERO } from '../money/importe'
import { ACCOUNT_KINDS } from '../referrals/signup'
import type { AccountKind } from '../referrals/signup'
import type { OwnerWalletEntry } from './billetera'

export const OWNER_WITHDRAWAL_STATUSES = ['requested', 'paid', 'rejected'] as const
export type OwnerWithdrawalStatus = typeof OWNER_WITHDRAWAL_STATUSES[number]

/** RF-62.9 · de cada estado, a cuáles se pasa. Los finales no se mueven. */
export const OWNER_WITHDRAWAL_TRANSITIONS: Record<OwnerWithdrawalStatus, readonly OwnerWithdrawalStatus[]> = {
  requested: ['paid', 'rejected'],
  paid: [],
  rejected: [],
}

export interface OwnerWithdrawal {
  id: string
  ownerId: string
  propertyId: string
  amount: CopAmount
  status: OwnerWithdrawalStatus
  requestedOn: string
  resolvedOn: string | null
  rejectionReason: string | null
  receiptPath: string | null
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
}

export interface NuevoRetiroDePropietario {
  amount: CopAmount | null
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
}

export const OWNER_WITHDRAWAL_VALIDATION_KEYS = [
  'ownerWallet.withdrawal.validation.amount_required',
  'ownerWallet.withdrawal.validation.above_balance',
  'ownerWallet.withdrawal.validation.open_request',
  'ownerWallet.withdrawal.validation.bank_required',
  'ownerWallet.withdrawal.validation.account_kind_required',
  'ownerWallet.withdrawal.validation.account_required',
  'ownerWallet.withdrawal.validation.holder_required',
] as const

export type OwnerWithdrawalValidationKey = typeof OWNER_WITHDRAWAL_VALIDATION_KEYS[number]

/** CA-62.10 · ¿hay una solicitud abierta sobre la propiedad? */
export function hasOpenOwnerWithdrawal(requests: readonly Pick<OwnerWithdrawal, 'status' | 'propertyId'>[], propertyId: string): boolean {
  return requests.some(request => request.propertyId === propertyId && request.status === 'requested')
}

/**
 * CA-62.10 · RF-62.9 · lo que impide solicitar; vacío si procede. Solo se retira
 * un saldo positivo, nunca más de él, y con una solicitud abierta se espera.
 */
export function validateOwnerWithdrawal(
  input: NuevoRetiroDePropietario,
  balance: CopAmount,
  requests: readonly Pick<OwnerWithdrawal, 'status' | 'propertyId'>[],
  propertyId?: string,
): OwnerWithdrawalValidationKey[] {
  const errors: OwnerWithdrawalValidationKey[] = []
  if (input.amount === null || !esImporte(input.amount) || input.amount <= 0) {
    errors.push('ownerWallet.withdrawal.validation.amount_required')
  }
  else if (balance <= 0 || input.amount > balance) {
    errors.push('ownerWallet.withdrawal.validation.above_balance')
  }
  if (propertyId !== undefined && hasOpenOwnerWithdrawal(requests, propertyId)) {
    errors.push('ownerWallet.withdrawal.validation.open_request')
  }
  if (input.bank.trim() === '') {
    errors.push('ownerWallet.withdrawal.validation.bank_required')
  }
  if (!ACCOUNT_KINDS.includes(input.accountKind)) {
    errors.push('ownerWallet.withdrawal.validation.account_kind_required')
  }
  if (input.accountNumber.trim() === '') {
    errors.push('ownerWallet.withdrawal.validation.account_required')
  }
  if (input.holder.trim() === '') {
    errors.push('ownerWallet.withdrawal.validation.holder_required')
  }
  return errors
}

export function canTransitionOwnerWithdrawal(from: OwnerWithdrawalStatus, to: OwnerWithdrawalStatus): boolean {
  return OWNER_WITHDRAWAL_TRANSITIONS[from].includes(to)
}

export type OwnerWithdrawalError
  = | 'ownerWallet.withdrawal.errors.invalid_transition'
    | 'ownerWallet.withdrawal.errors.reason_required'
    | 'ownerWallet.withdrawal.errors.receipt_required'

export interface TransicionDeRetiro {
  to: OwnerWithdrawalStatus
  on: string
  reason?: string | null
  receiptPath?: string | null
}

export type ResultadoDeRetiro
  = | { ok: true, request: OwnerWithdrawal }
    | { ok: false, error: OwnerWithdrawalError }

/** CA-62.9 · CA-62.10 · RF-62.9 · la solicitud tras una transición, o el error que la impide. Nunca muta la recibida. */
export function transitionOwnerWithdrawal(request: OwnerWithdrawal, input: TransicionDeRetiro): ResultadoDeRetiro {
  if (!canTransitionOwnerWithdrawal(request.status, input.to)) {
    return { ok: false, error: 'ownerWallet.withdrawal.errors.invalid_transition' }
  }
  if (input.to === 'rejected') {
    const motivo = input.reason?.trim() ?? ''
    if (motivo === '') {
      return { ok: false, error: 'ownerWallet.withdrawal.errors.reason_required' }
    }
    return { ok: true, request: { ...request, status: 'rejected', resolvedOn: input.on, rejectionReason: motivo } }
  }
  const ruta = input.receiptPath?.trim() ?? ''
  if (ruta === '') {
    return { ok: false, error: 'ownerWallet.withdrawal.errors.receipt_required' }
  }
  return { ok: true, request: { ...request, status: 'paid', resolvedOn: input.on, receiptPath: ruta } }
}

/**
 * CA-62.10 · RF-62.2 · D-51 · el retiro pagado resta del saldo de su propiedad,
 * una sola vez; la solicitud y el rechazo no mueven nada.
 */
export function settleOwnerWithdrawal(
  entries: readonly OwnerWalletEntry[],
  request: OwnerWithdrawal,
  on: string,
  propertyName = '',
): OwnerWalletEntry[] {
  if (request.status !== 'paid' || entries.some(entry => entry.withdrawalId === request.id)) {
    return [...entries]
  }
  return [...entries, {
    id: `withdrawal_paid:${request.id}`,
    kind: 'withdrawal_paid',
    amount: restar(CERO, request.amount),
    occurredOn: on,
    createdAt: `${on}T00:00:00Z`,
    propertyId: request.propertyId,
    propertyName,
    fractionNumber: null,
    period: null,
    statementId: null,
    paymentId: null,
    withdrawalId: request.id,
  }]
}
