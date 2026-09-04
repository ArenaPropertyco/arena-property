/**
 * HU-06 · RF-06.1 y RF-06.5 — invitación a comprar una fracción.
 *
 * La invitación vincula un correo con la fracción X de la propiedad Y. Solo la hace
 * el Administrador asignado (o el Superadmin) y solo sobre una fracción que todavía
 * puede venderse: disponible o reservada. Una fracción vendida no admite otra
 * invitación (RF-06.5); la única vía de cambio de titular es el traspaso (D-17).
 *
 * El precio pactado viaja en la invitación porque es lo que se negoció con ese
 * comprador; al cerrarse la compra queda congelado en el plan de pagos (RF-58.1).
 *
 * RF-06.4 · también puede viajar el código del embajador que trajo al comprador:
 * quien invita lo escribe a propósito, así que un formato inválido se rechaza (no
 * se descarta en silencio como en el registro, CA-04.3). Si la cuenta se crea por la
 * invitación, nace con esa atribución; y si el perfil no tenía ninguna, el cierre
 * la arrastra al plan de pagos.
 */

import { esCodigoReferidoValido, normalizarCodigoReferido, normalizarEmail } from '../identity/registro'
import type { CopAmount } from '../money/importe'
import { esImporte } from '../money/importe'
import type { EstadoDeFraccion } from '../properties/fracciones'

export const ESTADOS_DE_INVITACION = ['pending', 'accepted', 'cancelled'] as const
export type EstadoDeInvitacion = typeof ESTADOS_DE_INVITACION[number]

/** RF-06.1 · estados de fracción sobre los que cabe invitar. */
export const ESTADOS_INVITABLES: readonly EstadoDeFraccion[] = ['available', 'reserved']

export function puedeInvitarse(estado: EstadoDeFraccion): boolean {
  return ESTADOS_INVITABLES.includes(estado)
}

export const CAMPOS_DE_INVITACION = ['actor', 'fractionStatus', 'email', 'agreedPrice', 'referralCode'] as const
export type CampoDeInvitacion = typeof CAMPOS_DE_INVITACION[number]

export const CLAVES_DE_VALIDACION_DE_INVITACION = [
  'purchases.validation.not_property_admin',
  'purchases.validation.fraction_not_invitable',
  'purchases.validation.email_invalid',
  'purchases.validation.price_not_positive',
  'purchases.validation.referral_code_format',
] as const

export type ClaveDeValidacionDeInvitacion = typeof CLAVES_DE_VALIDACION_DE_INVITACION[number]

export interface SolicitudDeInvitacion {
  fractionId: string
  propertyId: string
  fractionStatus: EstadoDeFraccion
  email: string
  agreedPrice: CopAmount
  /** RF-06.4 · código del embajador que trajo al comprador, si lo hay (HU-51). */
  referralCode?: string | null
}

export interface ErrorDeInvitacion {
  name: CampoDeInvitacion
  message: ClaveDeValidacionDeInvitacion
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarInvitacion(
  solicitud: SolicitudDeInvitacion,
  actor: { administraLaPropiedad: boolean },
): ErrorDeInvitacion[] {
  const errores: ErrorDeInvitacion[] = []

  // CA-06.1 · sin la propiedad asignada no se invita sobre ella.
  if (!actor.administraLaPropiedad) {
    errores.push({ name: 'actor', message: 'purchases.validation.not_property_admin' })
  }

  // CA-06.4 · RF-06.5 · vendida no se reinvita.
  if (!puedeInvitarse(solicitud.fractionStatus)) {
    errores.push({ name: 'fractionStatus', message: 'purchases.validation.fraction_not_invitable' })
  }

  if (!CORREO.test(normalizarEmail(solicitud.email))) {
    errores.push({ name: 'email', message: 'purchases.validation.email_invalid' })
  }

  if (!esImporte(solicitud.agreedPrice) || solicitud.agreedPrice <= 0) {
    errores.push({ name: 'agreedPrice', message: 'purchases.validation.price_not_positive' })
  }

  // RF-06.4 · vacío es «sin código»; escrito, tiene que tener formato plausible.
  const codigo = normalizarCodigoReferido(solicitud.referralCode)
  if (codigo !== null && !esCodigoReferidoValido(codigo)) {
    errores.push({ name: 'referralCode', message: 'purchases.validation.referral_code_format' })
  }

  return errores
}
