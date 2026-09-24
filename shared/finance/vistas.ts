/**
 * HU-23 · las formas del movimiento y sus cuotas que comparten composables,
 * componentes y páginas. Solo tipos: llegan con los nombres de la maestra ya
 * resueltos y las cuotas ya generadas por la base.
 */

import type { CopAmount } from '../money/importe'
import type { Pagador, Reparto } from './cuotas'
import type { ClaseDeMovimiento } from './maestra'
import type { FraccionImputable } from './movimientos'

export interface MovimientoListado {
  id: string
  propertyId: string
  kind: ClaseDeMovimiento
  amount: CopAmount
  categoryName: string
  paymentMethodName: string
  accountName: string
  /** D-09 · día de causación `AAAA-MM-DD`. */
  incurredOn: string
  description: string
  /** RF-23.8 · D-41 · entre las 8 fracciones o a una sola. */
  allocation: Reparto
  /** RF-23.9 · número de la fracción imputada; `null` si se prorrateó. */
  fractionNumber: number | null
  /** RF-40.4 · comisión de gestión del ingreso atribuido; `null` en los demás. */
  commissionBasisPoints: number | null
  commissionAmount: CopAmount | null
  /** RF-24.2b · la semana rentada que originó el ingreso. */
  weekIndex: number | null
  weekStartsOn: string | null
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
  /** HU-27 · RF-27.1 · es un gasto de mantenimiento. */
  maintenance: boolean
  /** HU-27 · RF-27.3 · el ítem del inventario al que se asoció; `null` si es general. */
  inventoryItemId: string | null
  inventoryItemName: string | null
  /** HU-27 · CA-27.3 · la factura adjunta y su URL firmada; vacía si no pudo firmarse. */
  attachmentPath: string | null
  attachmentUrl: string | null
}

export interface CuotaListada {
  id: string
  movementId: string
  fraction: number
  amount: CopAmount
  /** RF-D.3 · absorbió un peso del residuo; HU-24 lo hace explícito. */
  hasRemainder: boolean
  payer: Pagador
  /** Nombre o correo del Propietario que paga; `null` cuando paga el titular del inventario. */
  payerLabel: string | null
  /** RF-23.4 · la cuota quedó revertida al anularse el movimiento. */
  reversedAt: string | null
}

/** Una fracción tal como la ofrece el formulario para imputarle un gasto (RF-23.9). */
export interface FraccionImputableListada extends FraccionImputable {
  /** Nombre o correo del titular (D-16); `null` si no está vendida. */
  ownerLabel: string | null
}

// ── HU-62 · la billetera del Propietario tal como la leen composables y vistas ─

/** HU-62 · RF-62.7 · un pago tal como lo lista el cobro, con el nombre del medio. */
export interface OwnerPaymentListed {
  id: string
  chargeId: string
  amount: CopAmount
  paidOn: string
  paymentMethodName: string
  description: string
  receiptPath: string | null
  channel: 'manual' | 'gateway'
  provider: string | null
  externalReference: string | null
  status: 'reported' | 'confirmed' | 'rejected'
  reportedAt: string
  resolvedOn: string | null
  rejectionReason: string | null
}

/** HU-62 · RF-62.6 · un cobro con sus pagos y el nombre de su propiedad. */
export interface OwnerChargeListed {
  id: string
  ownerId: string
  propertyId: string
  propertyName: string
  /** `AAAA-MM` · el mes cuyo corte lo emitió. */
  period: string
  amount: CopAmount
  paidAmount: CopAmount
  status: 'pending' | 'under_review' | 'paid'
  payments: OwnerPaymentListed[]
}

/** HU-62 · RF-62.14 · un corte mensual tal como se lista en el histórico. */
export interface OwnerStatementListed {
  id: string
  propertyId: string
  propertyName: string
  fractionNumber: number
  /** `AAAA-MM`. */
  period: string
  income: CopAmount
  expenses: CopAmount
  net: CopAmount
  /** RF-62.5 · alguna de sus líneas viene de un mes anterior. */
  hasAdjustments: boolean
  closedAt: string
}

/** HU-62 · RF-62.9 · una solicitud de retiro con el nombre de su propiedad. */
export interface OwnerWithdrawalListed {
  id: string
  ownerId: string
  propertyId: string
  propertyName: string
  amount: CopAmount
  status: 'requested' | 'paid' | 'rejected'
  requestedOn: string
  resolvedOn: string | null
  rejectionReason: string | null
  receiptPath: string | null
  bank: string
  accountKind: 'savings' | 'checking'
  accountNumber: string
  holder: string
}
