/**
 * HU-09 · RF-09.5 y D-17 — traspaso de titular de una fracción vendida.
 *
 * No hay mercado secundario en el MVP. El traspaso (reventa, herencia, cesión) es una
 * operación manual del Superadmin que **obliga a resolver explícitamente** qué pasa
 * con las semanas ya confirmadas y con las cuotas pendientes: por eso los dos destinos
 * son obligatorios y no tienen valor por omisión. Un traspaso que no los decide deja
 * derechos de uso y deuda sin dueño, que es justo lo que el principio 9 prohíbe.
 *
 * Lo que este módulo **no** hace: tocar el interruptor de calendario. Titularidad y
 * derecho de uso son ejes independientes (D-31) y el segundo lo deriva el plan de
 * pagos (HU-58), nunca una operación manual.
 */

import { armarEntrada } from '../audit/diferencia'
import type { EntradaDeAuditoria } from '../audit/diferencia'
import type { EstadoDeFraccion } from './fracciones'

/** Acción con la que el traspaso queda en el registro de auditoría (TR-01). */
export const ACCION_DE_TRASPASO = 'fraction.transferida' as const

/** Qué pasa con las estadías ya confirmadas de la fracción. */
export const DESTINOS_DE_RESERVAS = ['transfer', 'cancel'] as const
export type DestinoDeReservas = typeof DESTINOS_DE_RESERVAS[number]

/** Qué pasa con las cuotas pendientes del plan de pagos. */
export const DESTINOS_DE_CUOTAS = ['transfer', 'settle_with_previous'] as const
export type DestinoDeCuotas = typeof DESTINOS_DE_CUOTAS[number]

export const CAMPOS_DE_TRASPASO = [
  'actor',
  'fractionStatus',
  'newOwnerId',
  'bookings',
  'installments',
  'reason',
] as const

export type CampoDeTraspaso = typeof CAMPOS_DE_TRASPASO[number]

export const CLAVES_DE_VALIDACION_DE_TRASPASO = [
  'properties.validation.transfer_requires_superadmin',
  'properties.validation.transfer_only_sold',
  'properties.validation.transfer_new_owner_required',
  'properties.validation.transfer_bookings_required',
  'properties.validation.transfer_installments_required',
  'properties.validation.transfer_reason_required',
] as const

export type ClaveDeValidacionDeTraspaso = typeof CLAVES_DE_VALIDACION_DE_TRASPASO[number]

export interface SolicitudDeTraspaso {
  fractionId: string
  propertyId: string
  fractionStatus: EstadoDeFraccion
  previousOwnerId: string
  newOwnerId: string
  bookings: DestinoDeReservas | null
  installments: DestinoDeCuotas | null
  reason: string
}

export interface ErrorDeTraspaso {
  name: CampoDeTraspaso
  message: ClaveDeValidacionDeTraspaso
}

/** Lo que la operación debe ejecutar, ya resuelto y sin ambigüedad. */
export interface EfectosDeTraspaso {
  fractionId: string
  /** Queda vinculado como titular. */
  newOwnerId: string
  /** Pierde el acceso a la fracción y a lo que cuelga de ella. */
  revokedFrom: string
  /** Las estadías futuras se cancelan en vez de heredarse. */
  cancelFutureStays: boolean
  /** A quién le queda el plan de pagos con sus cuotas pendientes. */
  planOwnerId: string
}

export interface PlanDeTraspaso {
  efectos: EfectosDeTraspaso
  auditoria: EntradaDeAuditoria
}

function vacio(texto: string | null | undefined): boolean {
  return (texto ?? '').trim() === ''
}

export function validarTraspaso(
  solicitud: SolicitudDeTraspaso,
  actor: { esSuperadmin: boolean },
): ErrorDeTraspaso[] {
  const errores: ErrorDeTraspaso[] = []

  if (!actor.esSuperadmin) {
    errores.push({ name: 'actor', message: 'properties.validation.transfer_requires_superadmin' })
  }

  if (solicitud.fractionStatus !== 'sold') {
    errores.push({ name: 'fractionStatus', message: 'properties.validation.transfer_only_sold' })
  }

  if (vacio(solicitud.newOwnerId) || solicitud.newOwnerId === solicitud.previousOwnerId) {
    errores.push({ name: 'newOwnerId', message: 'properties.validation.transfer_new_owner_required' })
  }

  if (!DESTINOS_DE_RESERVAS.includes(solicitud.bookings as DestinoDeReservas)) {
    errores.push({ name: 'bookings', message: 'properties.validation.transfer_bookings_required' })
  }

  if (!DESTINOS_DE_CUOTAS.includes(solicitud.installments as DestinoDeCuotas)) {
    errores.push({ name: 'installments', message: 'properties.validation.transfer_installments_required' })
  }

  // RF-A.4 · el registro de auditoría de esta acción no admite motivo vacío.
  if (vacio(solicitud.reason)) {
    errores.push({ name: 'reason', message: 'properties.validation.transfer_reason_required' })
  }

  return errores
}

/**
 * CA-09.5 · efectos del traspaso y su entrada de auditoría.
 *
 * Los destinos entran en el estado posterior para que el diff de RF-A.7 los muestre:
 * quien lea el registro dentro de un año tiene que poder ver qué se decidió sobre las
 * reservas y las cuotas, no solo que el titular cambió.
 */
export function planDeTraspaso(solicitud: SolicitudDeTraspaso): PlanDeTraspaso {
  const errores = validarTraspaso(solicitud, { esSuperadmin: true })
  if (errores.length > 0) {
    throw new RangeError(`Traspaso inválido: ${errores.map(error => error.name).join(', ')}.`)
  }

  return {
    efectos: {
      fractionId: solicitud.fractionId,
      newOwnerId: solicitud.newOwnerId,
      revokedFrom: solicitud.previousOwnerId,
      cancelFutureStays: solicitud.bookings === 'cancel',
      planOwnerId: solicitud.installments === 'transfer'
        ? solicitud.newOwnerId
        : solicitud.previousOwnerId,
    },
    auditoria: armarEntrada({
      accion: ACCION_DE_TRASPASO,
      entidad: { tipo: 'fraction', id: solicitud.fractionId },
      propiedadId: solicitud.propertyId,
      motivo: solicitud.reason.trim(),
      anterior: { owner_id: solicitud.previousOwnerId },
      posterior: {
        owner_id: solicitud.newOwnerId,
        bookings_destination: solicitud.bookings,
        installments_destination: solicitud.installments,
      },
    }),
  }
}
