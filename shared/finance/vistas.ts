/**
 * HU-23 · las formas del movimiento y sus cuotas que comparten composables,
 * componentes y páginas. Solo tipos: llegan con los nombres de la maestra ya
 * resueltos y las cuotas ya generadas por la base.
 */

import type { CopAmount } from '../money/importe'
import type { Pagador } from './cuotas'
import type { ClaseDeMovimiento } from './maestra'

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
  createdAt: string
  voidedAt: string | null
  voidReason: string | null
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
