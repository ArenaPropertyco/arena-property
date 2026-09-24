/**
 * HU-62 · RF-62.6, RF-62.7, RF-62.8, RF-62.11 · D-10, D-51 — el cobro por saldo
 * negativo y el pago que lo salda.
 *
 * Tras el corte, si la billetera de una propiedad queda en negativo nace un
 * **cobro** por lo que aún no está cobrado. El Propietario **reporta** un pago con
 * comprobante, medio, fecha, monto y descripción; el Administrador o el
 * Superadmin lo **confirman** o lo **rechazan** con motivo. El estado del cobro se
 * deriva de sus pagos: en revisión mientras haya uno reportado, pagado cuando lo
 * confirmado lo cubre, pendiente en cualquier otro caso.
 *
 * El pago lleva su **canal** (RF-62.11): manual hoy, pasarela después. El modelo
 * ya guarda proveedor y referencia externa, únicos por proveedor, para recibir de
 * forma idempotente lo que una pasarela notifique. Nada de esto instala una
 * dependencia (D-10). La base repite las reglas en `report_owner_payment`,
 * `confirm_owner_payment` y `reject_owner_payment`.
 */

import { esFecha } from '../dates/validacion'
import type { CopAmount } from '../money/importe'
import { CERO, esImporte, restar, sumarTodos } from '../money/importe'
import type { PaymentChannel } from '../payments/pasarela'
import type { OwnerWalletEntry } from './billetera'
import type { Mes } from './estado-de-cuenta'

// ── RF-62.6 · el cobro ──────────────────────────────────────────────────────

export const CHARGE_STATUSES = ['pending', 'under_review', 'paid'] as const
export type ChargeStatus = typeof CHARGE_STATUSES[number]

/** RF-62.6 · de cada estado, a cuáles se pasa. Pagado es final; a pagado solo se llega desde revisión. */
export const CHARGE_TRANSITIONS: Record<ChargeStatus, readonly ChargeStatus[]> = {
  pending: ['under_review'],
  under_review: ['paid', 'pending'],
  paid: [],
}

export function canTransitionCharge(from: ChargeStatus, to: ChargeStatus): boolean {
  return CHARGE_TRANSITIONS[from].includes(to)
}

export interface OwnerCharge {
  id: string
  ownerId: string
  propertyId: string
  /** El mes cuyo corte lo emitió. */
  period: Mes
  amount: CopAmount
  /** Lo ya confirmado contra este cobro. */
  paidAmount: CopAmount
  status: ChargeStatus
}

/** Lo que un cobro abierto todavía espera. */
function restanteDe(charge: Pick<OwnerCharge, 'amount' | 'paidAmount' | 'status'>): CopAmount {
  return charge.status === 'paid' ? CERO : restar(charge.amount, charge.paidAmount)
}

/**
 * CA-62.1 · CA-62.3 · RF-62.6 · el cobro que nace de un saldo: lo que falta por
 * cobrar que ningún cobro abierto cubre ya. Con saldo positivo o cero, o con
 * todo el déficit ya cobrado, no nace ninguno; así relanzar el corte no duplica.
 */
export function cobroDelCorte(balance: CopAmount, abiertos: readonly Pick<OwnerCharge, 'amount' | 'paidAmount' | 'status'>[]): CopAmount | null {
  if (balance >= 0) {
    return null
  }
  const cobrado = sumarTodos(abiertos.map(restanteDe))
  const deficit = restar(restar(CERO, balance), cobrado)
  return deficit > 0 ? deficit : null
}

// ── RF-62.7 · RF-62.11 · el pago ────────────────────────────────────────────

export const PAYMENT_STATUSES = ['reported', 'confirmed', 'rejected'] as const
export type PaymentStatus = typeof PAYMENT_STATUSES[number]

/** RF-62.11 · D-10 · el canal por el que llegó el pago; hoy solo existe el manual. */
export const PAYMENT_CHANNELS = ['manual', 'gateway'] as const satisfies readonly PaymentChannel[]

export interface OwnerPayment {
  id: string
  chargeId: string
  amount: CopAmount
  paidOn: string
  /** RF-62.7 · de la maestra de HU-23. */
  paymentMethodId: string
  description: string
  /** Obligatorio en el canal manual. */
  receiptPath: string | null
  channel: PaymentChannel
  provider: string | null
  /** Única por proveedor: la clave de idempotencia de una pasarela. */
  externalReference: string | null
  status: PaymentStatus
  reportedAt: string
  resolvedOn: string | null
  rejectionReason: string | null
}

export interface NuevoPagoDePropietario {
  amount: CopAmount | null
  paidOn: string
  paymentMethodId: string
  description: string
  receiptPath: string | null
}

export const OWNER_PAYMENT_VALIDATION_KEYS = [
  'ownerWallet.payment.validation.amount_required',
  'ownerWallet.payment.validation.above_charge',
  'ownerWallet.payment.validation.method_required',
  'ownerWallet.payment.validation.description_required',
  'ownerWallet.payment.validation.date_invalid',
  'ownerWallet.payment.validation.receipt_required',
  'ownerWallet.payment.validation.charge_closed',
] as const

export type OwnerPaymentValidationKey = typeof OWNER_PAYMENT_VALIDATION_KEYS[number]

function pagosDe(charge: Pick<OwnerCharge, 'id'>, payments: readonly OwnerPayment[], status: PaymentStatus): OwnerPayment[] {
  return payments.filter(payment => payment.chargeId === charge.id && payment.status === status)
}

/** Lo confirmado contra el cobro. */
export function pagadoDeCobro(charge: Pick<OwnerCharge, 'id'>, payments: readonly OwnerPayment[]): CopAmount {
  return sumarTodos(pagosDe(charge, payments, 'confirmed').map(payment => payment.amount))
}

/** RF-62.8 · lo que el cobro aún debe: el monto menos lo confirmado. */
export function pendienteDeCobro(charge: Pick<OwnerCharge, 'id' | 'amount'>, payments: readonly OwnerPayment[]): CopAmount {
  return restar(charge.amount, pagadoDeCobro(charge, payments))
}

/** RF-62.7 · lo que todavía se puede reportar: lo pendiente menos lo que está en revisión. */
export function pendienteDeReportar(charge: Pick<OwnerCharge, 'id' | 'amount'>, payments: readonly OwnerPayment[]): CopAmount {
  return restar(pendienteDeCobro(charge, payments), sumarTodos(pagosDe(charge, payments, 'reported').map(payment => payment.amount)))
}

/**
 * CA-62.6 · RF-62.7 · lo que impide reportar un pago; vacío si procede. Un abono
 * parcial vale; un sobrepago, no (como en RF-58.4).
 */
export function validateOwnerPayment(
  input: NuevoPagoDePropietario,
  charge: OwnerCharge,
  payments: readonly OwnerPayment[],
): OwnerPaymentValidationKey[] {
  if (charge.status === 'paid') {
    return ['ownerWallet.payment.validation.charge_closed']
  }
  const errors: OwnerPaymentValidationKey[] = []
  if (input.amount === null || !esImporte(input.amount) || input.amount <= 0) {
    errors.push('ownerWallet.payment.validation.amount_required')
  }
  else if (input.amount > pendienteDeReportar(charge, payments)) {
    errors.push('ownerWallet.payment.validation.above_charge')
  }
  if (input.paymentMethodId.trim() === '') {
    errors.push('ownerWallet.payment.validation.method_required')
  }
  if (!esFecha(input.paidOn)) {
    errors.push('ownerWallet.payment.validation.date_invalid')
  }
  if (input.description.trim() === '') {
    errors.push('ownerWallet.payment.validation.description_required')
  }
  if ((input.receiptPath ?? '').trim() === '') {
    errors.push('ownerWallet.payment.validation.receipt_required')
  }
  return errors
}

/** CA-62.7 · CA-62.8 · RF-62.8 · el estado del cobro se deriva de sus pagos. */
export function estadoDelCobro(charge: Pick<OwnerCharge, 'id' | 'amount'>, payments: readonly OwnerPayment[]): ChargeStatus {
  if (pendienteDeCobro(charge, payments) <= 0) {
    return 'paid'
  }
  return pagosDe(charge, payments, 'reported').length > 0 ? 'under_review' : 'pending'
}

/** RF-62.8 · el cobro con lo pagado y el estado que sus pagos le dan. */
export function aplicarPagos(charge: OwnerCharge, payments: readonly OwnerPayment[]): OwnerCharge {
  return { ...charge, paidAmount: pagadoDeCobro(charge, payments), status: estadoDelCobro(charge, payments) }
}

export type OwnerPaymentError
  = | 'ownerWallet.payment.errors.invalid_transition'
    | 'ownerWallet.payment.errors.reason_required'

export interface ResolucionDePago {
  to: Exclude<PaymentStatus, 'reported'>
  on: string
  /** CA-62.8 · obligatorio al rechazar. */
  reason?: string | null
}

export type ResultadoDeResolucion
  = | { ok: true, payment: OwnerPayment }
    | { ok: false, error: OwnerPaymentError }

/** CA-62.8 · CA-62.9 · RF-62.8 · un pago reportado se confirma o se rechaza, una sola vez. Nunca muta el recibido. */
export function resolveOwnerPayment(payment: OwnerPayment, input: ResolucionDePago): ResultadoDeResolucion {
  if (payment.status !== 'reported') {
    return { ok: false, error: 'ownerWallet.payment.errors.invalid_transition' }
  }
  if (input.to === 'rejected') {
    const motivo = input.reason?.trim() ?? ''
    if (motivo === '') {
      return { ok: false, error: 'ownerWallet.payment.errors.reason_required' }
    }
    return { ok: true, payment: { ...payment, status: 'rejected', resolvedOn: input.on, rejectionReason: motivo } }
  }
  return { ok: true, payment: { ...payment, status: 'confirmed', resolvedOn: input.on, rejectionReason: null } }
}

/**
 * CA-62.7 · RF-62.2 · D-51 · el pago confirmado entra a la billetera de su
 * propiedad, una sola vez; el reportado y el rechazado no mueven nada. No
 * devenga ningún movimiento en la maestra.
 */
export function settleOwnerPayment(
  entries: readonly OwnerWalletEntry[],
  payment: OwnerPayment,
  charge: Pick<OwnerCharge, 'propertyId'>,
  on: string,
  propertyName = '',
): OwnerWalletEntry[] {
  if (payment.status !== 'confirmed' || entries.some(entry => entry.paymentId === payment.id)) {
    return [...entries]
  }
  return [...entries, {
    id: `payment_confirmed:${payment.id}`,
    kind: 'payment_confirmed',
    amount: payment.amount,
    occurredOn: on,
    createdAt: `${on}T00:00:00Z`,
    propertyId: charge.propertyId,
    propertyName,
    fractionNumber: null,
    period: null,
    statementId: null,
    paymentId: payment.id,
    withdrawalId: null,
  }]
}

/** CA-62.13 · RF-62.11 · una referencia externa es única por proveedor; los pagos manuales no tienen. */
export function referenciaExternaOcupada(payments: readonly Pick<OwnerPayment, 'provider' | 'externalReference'>[], provider: string | null, reference: string | null): boolean {
  if (provider === null || reference === null) {
    return false
  }
  return payments.some(payment => payment.provider === provider && payment.externalReference === reference)
}

// ── RF-62.7 · el comprobante ────────────────────────────────────────────────

/** Bucket privado y aparte: el comprobante es un documento del Propietario. */
export const BUCKET_DE_COMPROBANTES_DE_PROPIETARIO = 'owner-receipts'

/** RF-62.7 · la ruta: la propiedad primero y el Propietario después, que es de donde las políticas leen. */
export function rutaDeComprobanteDePropietario(propertyId: string, ownerId: string, entityId: string, nombre: string): string {
  const extension = nombre.includes('.') ? nombre.slice(nombre.lastIndexOf('.')).toLowerCase() : ''
  return `${propertyId}/${ownerId}/${entityId}${extension}`
}
