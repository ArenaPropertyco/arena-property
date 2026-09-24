/**
 * HU-62 · RF-62.13 · D-19 · TR-03 — lo que se le avisa al Propietario y a la
 * administración de la propiedad.
 *
 * Cinco eventos avisan al Propietario: su corte mensual (diciendo si debe pagar
 * o puede retirar), la confirmación y el rechazo de su pago, y el pago y el
 * rechazo de su retiro. Uno avisa a la administración: el Propietario reportó un
 * pago que hay que revisar. Ni la mera solicitud de retiro ni el reporte en sí
 * avisan al Propietario: ya sabe lo que hizo.
 *
 * El mapeo evento → destinatario + plantilla es puro: el destinatario es solo el
 * Propietario dueño, o los administradores vigentes de la propiedad, y la
 * plantilla se elige por idioma. Que cada evento avise una sola vez lo garantiza
 * su clave (TR-03): la base con `emitir_notificacion`, y aquí el registro de
 * emisiones.
 */

import type { Mes } from '../finance/estado-de-cuenta'
import type { CopAmount } from '../money/importe'
import type { VinculosDePropiedad } from './destinatarios'
import { destinatariosDeAdministracion, destinatariosDePropietario } from './destinatarios'
import { idiomaDe, plantillaDe } from './plantillas'
import type { Idioma, Plantilla } from './plantillas'
import type { EventoDeNotificacion, TipoDeNotificacion } from './tipos'

/** RF-62.13 · los cinco eventos que le llegan al Propietario, y solo esos. */
export const EVENTOS_DEL_PROPIETARIO = [
  'owner_statement_closed',
  'owner_payment_confirmed',
  'owner_payment_rejected',
  'owner_withdrawal_paid',
  'owner_withdrawal_rejected',
] as const satisfies readonly TipoDeNotificacion[]

export type EventoDelPropietario = typeof EVENTOS_DEL_PROPIETARIO[number]

/** Qué le toca hacer al Propietario tras el corte. */
export type AccionTrasElCorte = 'pay' | 'withdraw' | 'none'

export interface CorteNotificable {
  propertyId: string
  propertyName: string
  ownerId: string
  period: Mes
  /** El neto del mes en esa propiedad. */
  net: CopAmount
  /** El saldo de la propiedad tras el corte: decide la acción. */
  balance: CopAmount
}

function accionDe(balance: CopAmount): AccionTrasElCorte {
  if (balance < 0) {
    return 'pay'
  }
  return balance > 0 ? 'withdraw' : 'none'
}

/** RF-62.13 · el corte de un mes en una propiedad: un evento por Propietario, propiedad y mes. */
export function eventoDeCorte(corte: CorteNotificable): EventoDeNotificacion {
  return {
    kind: 'owner_statement_closed',
    entityType: 'owner_statement',
    entityId: `${corte.propertyId}:${corte.ownerId}:${corte.period}`,
    propertyId: corte.propertyId,
    payload: { property_name: corte.propertyName, period: corte.period, amount: corte.net, balance: corte.balance, action: accionDe(corte.balance) },
  }
}

export interface PagoNotificable {
  id: string
  amount: CopAmount
  propertyId: string
  propertyName: string
  status: 'reported' | 'confirmed' | 'rejected'
  rejectionReason: string | null
}

/** RF-62.13 · reportado avisa a la administración; confirmado y rechazado, al Propietario. */
export function eventoDePagoDePropietario(pago: PagoNotificable): EventoDeNotificacion {
  const kind: TipoDeNotificacion = pago.status === 'reported'
    ? 'owner_payment_reported'
    : pago.status === 'confirmed' ? 'owner_payment_confirmed' : 'owner_payment_rejected'
  return {
    kind,
    entityType: 'owner_payment',
    entityId: pago.id,
    propertyId: pago.propertyId,
    payload: { amount: pago.amount, property_name: pago.propertyName, reason: pago.rejectionReason },
  }
}

export interface RetiroNotificable {
  id: string
  amount: CopAmount
  propertyId: string
  propertyName: string
  status: 'requested' | 'paid' | 'rejected'
  rejectionReason: string | null
}

/** RF-62.13 · pagado y rechazado avisan; la solicitud, no. */
export function eventoDeRetiroDePropietario(retiro: RetiroNotificable): EventoDeNotificacion | null {
  if (retiro.status === 'requested') {
    return null
  }
  return {
    kind: retiro.status === 'paid' ? 'owner_withdrawal_paid' : 'owner_withdrawal_rejected',
    entityType: 'owner_withdrawal',
    entityId: retiro.id,
    propertyId: retiro.propertyId,
    payload: { amount: retiro.amount, property_name: retiro.propertyName, reason: retiro.rejectionReason },
  }
}

export interface PropietarioNotificable {
  userId: string
  /** El idioma del perfil; lo desconocido cae en español. */
  locale: string | null
}

export interface NotificacionParaPropietario {
  destinatarios: string[]
  idioma: Idioma
  plantilla: Plantilla
}

/** RF-62.13 · el destinatario y la plantilla de un evento del Propietario: solo él, en su idioma. */
export function notificarAlPropietario(evento: EventoDeNotificacion, propietario: PropietarioNotificable): NotificacionParaPropietario {
  const idioma = idiomaDe(propietario.locale)
  return {
    destinatarios: destinatariosDePropietario({ ownerId: propietario.userId }),
    idioma,
    plantilla: plantillaDe(evento.kind, idioma, evento.payload),
  }
}

export interface NotificacionParaAdministracion {
  destinatarios: string[]
  /** Cada Administrador la recibe en su idioma; el despacho elige la plantilla por destinatario. */
  plantillaEn: (locale: string | null) => Plantilla
}

/** RF-62.13 · los administradores vigentes de la propiedad, una vez cada uno. */
export function notificarALaAdministracion(evento: EventoDeNotificacion, vinculos: VinculosDePropiedad): NotificacionParaAdministracion {
  return {
    destinatarios: destinatariosDeAdministracion(vinculos),
    plantillaEn: locale => plantillaDe(evento.kind, idiomaDe(locale), evento.payload),
  }
}
