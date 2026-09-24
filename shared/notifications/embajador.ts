/**
 * HU-57 · RF-57.1…RF-57.4 · D-19 · TR-03 — lo que se le avisa al Embajador.
 *
 * Exactamente cinco eventos avisan (RF-57.1): el referido pasa a «en proceso de
 * pago», completa el pago, la comisión pasa a disponible, y el retiro se aprueba
 * o se paga. Ni la mera solicitud ni el rechazo avisan (CA-57.3): el rechazo se
 * ve en la bandeja con su motivo.
 *
 * El mapeo evento → destinatario + plantilla es puro (RF-57.3): el destinatario
 * es solo el Embajador dueño del referido o del retiro (RF-57.2), y la plantilla
 * se elige por su idioma. Que cada evento avise una sola vez lo garantiza la
 * clave del evento (RF-57.4): la base con `emitir_notificacion`, y aquí el
 * registro de emisiones de TR-03.
 */

import type { CopAmount } from '../money/importe'
import type { Day } from '../referrals/commission'
import type { ReferralStage } from '../referrals/attribution'
import type { WithdrawalStatus } from '../referrals/withdrawals'
import { destinatariosDeEmbajador } from './destinatarios'
import { idiomaDe, plantillaDe } from './plantillas'
import type { Idioma, Plantilla } from './plantillas'
import type { EventoDeNotificacion, TipoDeNotificacion } from './tipos'

/** RF-57.1 · los cinco eventos del programa, y solo esos. */
export const EVENTOS_DEL_EMBAJADOR = [
  'referral_in_progress',
  'referral_paid',
  'commission_available',
  'withdrawal_approved',
  'withdrawal_paid',
] as const satisfies readonly TipoDeNotificacion[]

export type EventoDelEmbajador = typeof EVENTOS_DEL_EMBAJADOR[number]

/** Un referido que cambió de etapa, con lo que la plantilla necesita decir. */
export interface CambioDeReferido {
  commissionId: string
  ambassadorUserId: string
  stage: ReferralStage
  referralLabel: string
  propertyName: string | null
  propertyId: string | null
  amount: CopAmount
  /** D-02 · el día en que la comisión sale de gracia; solo desde el pago completo. */
  availableOn: Day | null
}

/** RF-57.1 · el evento de un cambio de etapa, o nada si la etapa no avisa. */
export function eventoDeReferido(cambio: CambioDeReferido): EventoDeNotificacion | null {
  switch (cambio.stage) {
    case 'payment_in_progress':
      return {
        kind: 'referral_in_progress',
        entityType: 'commission',
        entityId: cambio.commissionId,
        propertyId: cambio.propertyId,
        payload: { referral_label: cambio.referralLabel, property_name: cambio.propertyName, amount: cambio.amount },
      }
    case 'paid':
      return {
        kind: 'referral_paid',
        entityType: 'commission',
        entityId: cambio.commissionId,
        propertyId: cambio.propertyId,
        payload: { referral_label: cambio.referralLabel, property_name: cambio.propertyName, amount: cambio.amount, available_on: cambio.availableOn },
      }
    default:
      return null
  }
}

/** RF-57.1 · D-02 · la comisión salió de gracia. */
export function eventoDeGracia(comision: { id: string, propertyId: string | null, amount: CopAmount }): EventoDeNotificacion {
  return {
    kind: 'commission_available',
    entityType: 'commission',
    entityId: comision.id,
    propertyId: comision.propertyId,
    payload: { amount: comision.amount },
  }
}

/** RF-57.1 · CA-57.3 · aprobada y pagada avisan; solicitada y rechazada, no. */
export function eventoDeRetiro(retiro: { id: string, amount: CopAmount, status: WithdrawalStatus }): EventoDeNotificacion | null {
  if (retiro.status !== 'approved' && retiro.status !== 'paid') {
    return null
  }
  return {
    kind: retiro.status === 'approved' ? 'withdrawal_approved' : 'withdrawal_paid',
    entityType: 'withdrawal_request',
    entityId: retiro.id,
    propertyId: null,
    payload: { amount: retiro.amount },
  }
}

export interface EmbajadorNotificable {
  userId: string
  /** El idioma del perfil; lo desconocido cae en español. */
  locale: string | null
}

export interface NotificacionParaEmbajador {
  destinatarios: string[]
  idioma: Idioma
  plantilla: Plantilla
}

/**
 * RF-57.2 · RF-57.3 · el destinatario y la plantilla de un evento del programa:
 * solo el Embajador dueño, en su idioma.
 */
export function notificarAlEmbajador(evento: EventoDeNotificacion, embajador: EmbajadorNotificable): NotificacionParaEmbajador {
  const idioma = idiomaDe(embajador.locale)
  return {
    destinatarios: destinatariosDeEmbajador({ ambassadorId: embajador.userId }),
    idioma,
    plantilla: plantillaDe(evento.kind, idioma, evento.payload),
  }
}
