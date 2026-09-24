/**
 * HU-49, HU-50, HU-52, HU-56 — lo que las pantallas del programa de referidos
 * reciben ya resuelto por los composables. Solo tipos: la lógica vive en
 * `commission.ts`, `signup.ts`, `code.ts` y `withdrawals.ts`; el listado de
 * referidos (HU-53) tiene los suyos en `listing.ts`.
 */

import type { CopAmount } from '../money/importe'
import type { AccountKind } from './signup'
import type { WithdrawalRequest } from './withdrawals'

/** RF-49.5 · un Embajador tal como lo lista el Superadmin. */
export interface AmbassadorListed {
  id: string
  userId: string
  email: string
  fullName: string | null
  status: AmbassadorStatus
  code: string | null
  codeEnabled: boolean
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
  termsVersion: string
  enrolledAt: string
  approvedAt: string | null
}

/** RF-49.4 · la inscripción se aprueba antes de conceder el rol y el código. */
export type AmbassadorStatus = 'pending' | 'approved' | 'rejected' | 'suspended'

export const AMBASSADOR_STATUSES: readonly AmbassadorStatus[] = ['pending', 'approved', 'rejected', 'suspended']

/**
 * RF-52.4 · CA-52.1 · un Embajador en la pantalla de comisión: qué tipo lleva y
 * si es el suyo o el predeterminado que le toca por no tener asignación.
 */
export interface AmbassadorCommissionListed {
  ambassadorId: string
  email: string
  fullName: string | null
  /** Identificador del tipo asignado; `null` cuando cobra el predeterminado. */
  assignedTypeId: string | null
  /** Nombre del tipo que realmente le aplica, ya resuelto. */
  effectiveTypeName: string | null
  assignedAt: string | null
}

/**
 * HU-56 · RF-56.4 · D-20 · una solicitud de retiro tal como la lista la bandeja:
 * con quién la pide, sus datos bancarios de HU-49 para pagarle y cuánto tiene
 * disponible hoy. En la vista del propio Embajador los datos son los suyos.
 */
export interface WithdrawalListed extends WithdrawalRequest {
  ambassadorEmail: string
  ambassadorName: string | null
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
  /** El disponible del Embajador al momento de listar; `null` si no se pidió. */
  available: CopAmount | null
}
