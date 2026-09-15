/**
 * HU-39 · RF-39.1, RF-39.2, RF-39.2b, RF-39.5 · D-25, D-39 — el tercero no
 * propietario y la semana que se le renta.
 *
 * Dos reglas viven aquí porque son de negocio y no de la pantalla:
 *
 * 1. **Qué semana admite renta (RF-39.2).** Solo las de la bolsa: liberadas,
 *    canceladas, caducadas o sobrantes de la rejilla. Nunca una que su Propietario
 *    tenga elegida, confirmada o no: sigue siendo suya hasta que la suelte.
 *
 * 2. **Con qué origen entró (RF-39.2b, D-39).** La reserva guarda de qué fracción
 *    salía la semana y con qué motivo, y ese par es el único dato con el que HU-40
 *    decide de quién es el ingreso. Se fija al crear la reserva y no se recalcula.
 *
 * Los datos del tercero se guardan con consentimiento explícito y se anonimizan a
 * los 5 años (D-25); el plazo lo aplica la base, aquí se exige el consentimiento.
 */

import type { OrigenDeSemana } from '../finance/ingresos'
import type { ReleaseReason } from './week-usage'

/** Documentos que acepta el registro de terceros. */
export const TIPOS_DE_DOCUMENTO = ['cc', 'ce', 'passport', 'nit'] as const
export type TipoDeDocumento = typeof TIPOS_DE_DOCUMENTO[number]

export const CAMPOS_DE_TERCERO = ['fullName', 'documentNumber', 'email', 'phone', 'consent'] as const
export type CampoDeTercero = typeof CAMPOS_DE_TERCERO[number]

export const CLAVES_DE_VALIDACION_DE_RENTA = [
  'rentals.validation.name_required',
  'rentals.validation.document_required',
  'rentals.validation.contact_required',
  'rentals.validation.email_invalid',
  'rentals.validation.consent_required',
  'rentals.validation.week_confirmed',
  'rentals.validation.week_owned',
  'rentals.validation.week_blocked',
  'rentals.validation.week_rented',
  'rentals.validation.selection_open',
] as const

export type ClaveDeValidacionDeRenta = typeof CLAVES_DE_VALIDACION_DE_RENTA[number]

export interface NuevoTercero {
  fullName: string
  documentKind: TipoDeDocumento
  documentNumber: string
  email: string | null
  phone: string | null
  /** RF-39.5 · D-25 · sin consentimiento explícito no se guardan sus datos. */
  consentAccepted: boolean
}

export interface ErrorDeTercero {
  name: CampoDeTercero
  message: ClaveDeValidacionDeRenta
}

/** Lo que de una semana decide si admite renta y con qué origen la admite. */
export interface EstadoDeSemanaParaRenta {
  week: number
  startsOn: string
  /** Fracción que la tiene asignada; `null` si nadie la eligió. */
  fraction: number | null
  confirmedAt: string | null
  releasedAt: string | null
  releaseReason: ReleaseReason | null
  blocked: boolean
  alreadyRented: boolean
  /** Con los turnos abiertos, una semana sin dueño todavía puede elegirse. */
  selectionComplete: boolean
}

export interface OrigenDeLaReserva {
  reason: OrigenDeSemana
  /** Fracción de la que salía la semana; `null` si era sobrante de la rejilla. */
  fraction: number | null
}

export type VeredictoDeRenta = { ok: true } | { ok: false, clave: ClaveDeValidacionDeRenta }

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** CA-39.3 · el documento sin puntos, guiones ni espacios, para comparar identidades. */
export function documentoNormalizado(documento: string): string {
  return documento.replace(/[^\dA-Za-z]/g, '').toUpperCase()
}

/** CA-39.3 · ¿el alta corresponde a un tercero ya registrado? */
export function esMismoTercero(
  registrado: { documentKind: TipoDeDocumento, documentNumber: string },
  candidato: { documentKind: TipoDeDocumento, documentNumber: string },
): boolean {
  return registrado.documentKind === candidato.documentKind
    && documentoNormalizado(registrado.documentNumber) === documentoNormalizado(candidato.documentNumber)
}

/** RF-39.1 · RF-39.5 · qué tercero entra al registro y cuál se rechaza. */
export function validarTercero(tercero: NuevoTercero): ErrorDeTercero[] {
  const errores: ErrorDeTercero[] = []

  if (tercero.fullName.trim() === '') {
    errores.push({ name: 'fullName', message: 'rentals.validation.name_required' })
  }
  if (documentoNormalizado(tercero.documentNumber) === '') {
    errores.push({ name: 'documentNumber', message: 'rentals.validation.document_required' })
  }

  const correo = tercero.email?.trim() ?? ''
  const telefono = tercero.phone?.trim() ?? ''
  if (correo === '' && telefono === '') {
    errores.push({ name: 'email', message: 'rentals.validation.contact_required' })
  }
  else if (correo !== '' && !CORREO.test(correo)) {
    errores.push({ name: 'email', message: 'rentals.validation.email_invalid' })
  }

  // RF-39.5 · D-25 · el consentimiento es condición de guardar, no una casilla más.
  if (!tercero.consentAccepted) {
    errores.push({ name: 'consent', message: 'rentals.validation.consent_required' })
  }

  return errores
}

/** RF-39.2 · CA-39.1 · ¿esta semana está en la bolsa de renta? */
export function puedeRentarseAUnTercero(semana: EstadoDeSemanaParaRenta): VeredictoDeRenta {
  if (semana.blocked) {
    return { ok: false, clave: 'rentals.validation.week_blocked' }
  }
  if (semana.alreadyRented) {
    return { ok: false, clave: 'rentals.validation.week_rented' }
  }

  if (semana.releasedAt !== null) {
    return { ok: true }
  }

  // Elegida por una fracción y no liberada: es suya, confirmada o no.
  if (semana.fraction !== null) {
    return { ok: false, clave: semana.confirmedAt !== null ? 'rentals.validation.week_confirmed' : 'rentals.validation.week_owned' }
  }

  // Sin dueño: solo es bolsa del Administrador con los turnos ya cerrados.
  return semana.selectionComplete ? { ok: true } : { ok: false, clave: 'rentals.validation.selection_open' }
}

/** RF-39.2b · CA-39.5 · D-39 · de qué fracción salía la semana y con qué motivo. */
export function origenDeSemanaRentada(semana: EstadoDeSemanaParaRenta): OrigenDeLaReserva {
  if (semana.releasedAt !== null && semana.releaseReason !== null) {
    return { reason: semana.releaseReason, fraction: semana.fraction }
  }

  return { reason: 'pool', fraction: null }
}
