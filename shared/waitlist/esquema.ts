/**
 * HU-47 · RF-47.1, RF-47.2, RF-47.5 · D-25 — la inscripción en la lista de espera
 * de una propiedad: qué se pide y cómo se guarda.
 *
 * Nombre, correo y teléfono, con consentimiento explícito. Los datos se conservan
 * cinco años desde el consentimiento (plazo fiscal) y después se anonimizan; la
 * fecha sale de aquí para que la base y el servidor cuenten igual.
 */

import { normalizarEmail } from '../identity/registro'

/** D-25 · versión del texto de consentimiento que se aceptó. */
export const VERSION_DE_CONSENTIMIENTO = '2026-09-v1'

/** D-25 · años que se conservan los datos antes de anonimizarlos. */
export const RETENCION_EN_ANIOS = 5

export interface InscripcionEnListaDeEspera {
  propertyId: string
  fullName: string
  email: string
  phone: string
  /** RF-47.5 · el consentimiento es una casilla que la persona marca. */
  consent: boolean
}

export const CAMPOS_DE_LISTA_DE_ESPERA = ['fullName', 'email', 'phone', 'consent'] as const
export type CampoDeListaDeEspera = typeof CAMPOS_DE_LISTA_DE_ESPERA[number]

export const CLAVES_DE_VALIDACION_DE_LISTA_DE_ESPERA = [
  'waitlist.validation.name_required',
  'waitlist.validation.email_invalid',
  'waitlist.validation.phone_required',
  'waitlist.validation.consent_required',
] as const
export type ClaveDeValidacionDeListaDeEspera = typeof CLAVES_DE_VALIDACION_DE_LISTA_DE_ESPERA[number]

export interface ErrorDeListaDeEspera {
  name: CampoDeListaDeEspera
  message: ClaveDeValidacionDeListaDeEspera
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Se devuelven todos los errores, no el primero: el formulario los pinta a la vez. */
export function validarInscripcion(inscripcion: InscripcionEnListaDeEspera): ErrorDeListaDeEspera[] {
  const errores: ErrorDeListaDeEspera[] = []

  if ((inscripcion.fullName ?? '').trim() === '') {
    errores.push({ name: 'fullName', message: 'waitlist.validation.name_required' })
  }
  if (!CORREO.test(normalizarEmail(inscripcion.email ?? ''))) {
    errores.push({ name: 'email', message: 'waitlist.validation.email_invalid' })
  }
  if ((inscripcion.phone ?? '').trim() === '') {
    errores.push({ name: 'phone', message: 'waitlist.validation.phone_required' })
  }
  if (inscripcion.consent !== true) {
    errores.push({ name: 'consent', message: 'waitlist.validation.consent_required' })
  }

  return errores
}

/** Lo que se persiste: recortado y con el correo en minúsculas (RF-47.2). */
export function normalizarInscripcion(inscripcion: InscripcionEnListaDeEspera): InscripcionEnListaDeEspera {
  return {
    propertyId: inscripcion.propertyId,
    fullName: inscripcion.fullName.trim(),
    email: normalizarEmail(inscripcion.email),
    phone: inscripcion.phone.trim(),
    consent: inscripcion.consent === true,
  }
}

/** D-25 · el instante a partir del cual los datos se anonimizan. */
export function fechaDeAnonimizacion(consentimientoEn: string): string {
  const fecha = new Date(consentimientoEn)
  fecha.setUTCFullYear(fecha.getUTCFullYear() + RETENCION_EN_ANIOS)
  return fecha.toISOString()
}
