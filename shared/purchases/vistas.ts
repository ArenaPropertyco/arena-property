/**
 * HU-06 · las formas de la invitación que comparten composables, componentes y
 * páginas. Solo tipos: lo que la interfaz recibe ya resuelto.
 */

import type { CopAmount } from '../money/importe'
import type { EstadoDeInvitacion } from './invitaciones'

export interface InvitacionListada {
  id: string
  fractionId: string
  fractionNumber: number
  propertyId: string
  email: string
  /** Cuenta del invitado, si ya existe; sin ella la compra no puede cerrarse. */
  inviteeId: string | null
  status: EstadoDeInvitacion
  agreedPrice: CopAmount
  /** RF-06.4 · código del embajador escrito al invitar, si lo hubo. */
  referralCode: string | null
  createdAt: string
}

/** Una cuenta que ya existe, para vincularla sin crear otra (RF-06.1). */
export interface CuentaConocida {
  id: string
  email: string | null
  fullName: string | null
}
