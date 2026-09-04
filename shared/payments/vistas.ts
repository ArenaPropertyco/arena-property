/**
 * HU-58 · las formas del plan y sus abonos que comparten composables, componentes
 * y páginas. Solo tipos: llegan con el estado ya derivado.
 */

import type { CopAmount } from '../money/importe'
import type { EstadoDePlan } from './plan'

export interface PlanDePagosListado {
  id: string
  fractionId: string
  fractionNumber: number
  propertyId: string
  propertyName: string
  ownerId: string
  ownerLabel: string
  agreedPrice: CopAmount
  paidTotal: CopAmount
  balance: CopAmount
  /** Derivado por la base (RF-58.3); la interfaz no lo recompone. */
  status: EstadoDePlan
  /** D-31 · el interruptor de la fracción, derivado del plan. */
  calendarActive: boolean
  referralCode: string | null
  closedAt: string
  voidedAt: string | null
  voidReason: string | null
}

export interface AbonoListado {
  id: string
  amount: CopAmount
  paidOn: string
  method: string
  note: string | null
  receiptPath: string
  /** URL firmada del comprobante; vacía si no pudo firmarse. */
  receiptUrl: string
  voidedAt: string | null
  voidReason: string | null
}
