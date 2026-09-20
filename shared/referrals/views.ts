/**
 * HU-49, HU-50, HU-52 — lo que las pantallas del programa de referidos reciben
 * ya resuelto por los composables. Solo tipos: la lógica vive en `commission.ts`,
 * `signup.ts` y `code.ts`; el listado de referidos (HU-53) tiene los suyos en
 * `listing.ts`.
 */

import type { AccountKind } from './signup'

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
