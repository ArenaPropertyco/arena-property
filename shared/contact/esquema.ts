/**
 * HU-46 · RF-46.1…RF-46.4, RF-46.6 y HU-03 · RF-03.2, RF-03.3, RF-03.5 — un solo
 * esquema de validación para el formulario general y el de la ficha.
 *
 * Las opciones de las tres selecciones son catálogos cerrados: la interfaz los
 * recorre y la base los repite en sus restricciones. Los textos son claves i18n
 * (CA-46.3, CA-03.3). Se devuelven todos los errores, no el primero.
 */

import { esCodigoReferidoValido, normalizarCodigoReferido, normalizarEmail } from '../identity/registro'

/** RF-03.2 · las 4 intenciones de compra, en el orden de la spec. */
export const INTENCIONES_DE_COMPRA = ['second_home', 'truly_mine', 'same_place_every_summer', 'investment'] as const
export type IntencionDeCompra = typeof INTENCIONES_DE_COMPRA[number]

/** RF-46.2 · Vivienda Vacacional / Vivienda Residencial / Terreno. */
export const TIPOS_DE_PROPIEDAD = ['vacation', 'residential', 'land'] as const
export type TipoDePropiedad = typeof TIPOS_DE_PROPIEDAD[number]

/** RF-46.3 · Menos de $4M / Entre $4M y $7M / Más de $7M. */
export const RANGOS_DE_RENTA = ['under_4m', 'between_4m_7m', 'over_7m'] as const
export type RangoDeRenta = typeof RANGOS_DE_RENTA[number]

export function claveDeIntencion(intencion: IntencionDeCompra): string {
  return `contact.intents.${intencion}`
}

export function claveDeTipo(tipo: TipoDePropiedad): string {
  return `contact.propertyTypes.${tipo}`
}

export function claveDeRango(rango: RangoDeRenta): string {
  return `contact.incomeRanges.${rango}`
}

/** Todas las claves de opciones que los locales deben traer (CA-46.3, CA-03.3). */
export function clavesDeOpciones(): string[] {
  return [
    ...INTENCIONES_DE_COMPRA.map(claveDeIntencion),
    ...TIPOS_DE_PROPIEDAD.map(claveDeTipo),
    ...RANGOS_DE_RENTA.map(claveDeRango),
  ]
}

/** `general` es HU-46; `property`, el de la ficha (HU-03). */
export type ContextoDeContacto = 'general' | 'property'

export interface SolicitudDeContacto {
  firstName: string
  lastName: string
  email: string
  phone: string
  message: string
  intent: IntencionDeCompra | null
  propertyType?: TipoDePropiedad | null
  incomeRange?: RangoDeRenta | null
  /** RF-46.6 · RF-03.5 · prellenado si la sesión trae atribución (HU-51). */
  referralCode?: string | null
  /** RF-03.4 · la propiedad de la ficha desde la que se escribe. */
  propertyId?: string | null
}

export const CAMPOS_DE_CONTACTO = [
  'firstName', 'lastName', 'email', 'phone', 'message', 'intent', 'propertyType', 'incomeRange', 'referralCode',
] as const
export type CampoDeContacto = typeof CAMPOS_DE_CONTACTO[number]

export const CLAVES_DE_VALIDACION_DE_CONTACTO = [
  'contact.validation.first_name_required',
  'contact.validation.last_name_required',
  'contact.validation.email_invalid',
  'contact.validation.phone_required',
  'contact.validation.message_required',
  'contact.validation.intent_required',
  'contact.validation.property_type_required',
  'contact.validation.income_range_required',
  'contact.validation.referral_code_format',
] as const
export type ClaveDeValidacionDeContacto = typeof CLAVES_DE_VALIDACION_DE_CONTACTO[number]

export interface ErrorDeContacto {
  name: CampoDeContacto
  message: ClaveDeValidacionDeContacto
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function vacio(valor: string | null | undefined): boolean {
  return (valor ?? '').trim() === ''
}

function esOpcion<T extends string>(catalogo: readonly T[], valor: unknown): valor is T {
  return typeof valor === 'string' && (catalogo as readonly string[]).includes(valor)
}

export function validarContacto(solicitud: SolicitudDeContacto, contexto: ContextoDeContacto): ErrorDeContacto[] {
  const errores: ErrorDeContacto[] = []

  if (vacio(solicitud.firstName)) {
    errores.push({ name: 'firstName', message: 'contact.validation.first_name_required' })
  }
  if (vacio(solicitud.lastName)) {
    errores.push({ name: 'lastName', message: 'contact.validation.last_name_required' })
  }
  if (!CORREO.test(normalizarEmail(solicitud.email ?? ''))) {
    errores.push({ name: 'email', message: 'contact.validation.email_invalid' })
  }
  if (vacio(solicitud.phone)) {
    errores.push({ name: 'phone', message: 'contact.validation.phone_required' })
  }
  if (vacio(solicitud.message)) {
    errores.push({ name: 'message', message: 'contact.validation.message_required' })
  }
  // CA-03.1 · CA-46.3 · la intención es obligatoria y de catálogo cerrado.
  if (!esOpcion(INTENCIONES_DE_COMPRA, solicitud.intent)) {
    errores.push({ name: 'intent', message: 'contact.validation.intent_required' })
  }

  if (contexto === 'general') {
    if (!esOpcion(TIPOS_DE_PROPIEDAD, solicitud.propertyType)) {
      errores.push({ name: 'propertyType', message: 'contact.validation.property_type_required' })
    }
    if (!esOpcion(RANGOS_DE_RENTA, solicitud.incomeRange)) {
      errores.push({ name: 'incomeRange', message: 'contact.validation.income_range_required' })
    }
  }

  // RF-46.6 · opcional; escrito, con formato plausible.
  const codigo = normalizarCodigoReferido(solicitud.referralCode)
  if (codigo !== null && !esCodigoReferidoValido(codigo)) {
    errores.push({ name: 'referralCode', message: 'contact.validation.referral_code_format' })
  }

  return errores
}

/** Lo que se persiste: recortado, correo en minúsculas, código normalizado. */
export function normalizarContacto(solicitud: SolicitudDeContacto): SolicitudDeContacto {
  return {
    firstName: solicitud.firstName.trim(),
    lastName: solicitud.lastName.trim(),
    email: normalizarEmail(solicitud.email),
    phone: solicitud.phone.trim(),
    message: solicitud.message.trim(),
    intent: solicitud.intent,
    propertyType: solicitud.propertyType ?? null,
    incomeRange: solicitud.incomeRange ?? null,
    referralCode: normalizarCodigoReferido(solicitud.referralCode),
    propertyId: solicitud.propertyId ?? null,
  }
}
