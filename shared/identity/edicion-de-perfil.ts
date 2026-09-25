/**
 * Edición del perfil: lo que la propia cuenta cambia desde «Perfil» y lo que el
 * Superadmin cambia de cualquier cuenta desde «Roles».
 *
 * Funciones puras: normalizan y validan, y devuelven claves i18n. La base repite
 * las mismas reglas en `private.proteger_estado_de_cuenta()`, así que un cliente
 * que se salte la pantalla recibe el mismo rechazo.
 *
 * El correo no se edita desde el perfil: es la llave de acceso y vive en Supabase
 * Auth. Solo el Superadmin lo cambia, y siempre por la cuenta de acceso.
 */

import { LONGITUD_MINIMA_DE_CONTRASENA, normalizarEmail } from './registro'

export const IDIOMAS_DE_PERFIL = ['es', 'en'] as const
export type IdiomaDePerfil = typeof IDIOMAS_DE_PERFIL[number]

export const LONGITUD_MAXIMA_DE_NOMBRE = 120

/** Dígitos, espacios, guiones y paréntesis, con `+` opcional: de 7 a 20 caracteres. */
const TELEFONO = /^\+?[0-9 ()-]{7,20}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface DatosDePerfil {
  fullName: string | null
  phone: string | null
  locale: string
}

/** Lo que el Superadmin edita de una cuenta: el perfil y, además, el correo. */
export interface DatosDeCuenta extends DatosDePerfil {
  email: string
}

export type CampoDePerfil = 'fullName' | 'phone' | 'locale' | 'email'

export const CLAVES_DE_VALIDACION_DE_PERFIL = [
  'profile.validation.name_too_long',
  'profile.validation.phone_invalid',
  'profile.validation.locale_invalid',
  'auth.validation.email_invalid',
] as const

export type ClaveDeValidacionDePerfil = typeof CLAVES_DE_VALIDACION_DE_PERFIL[number]

export interface ErrorDePerfil {
  name: CampoDePerfil
  message: ClaveDeValidacionDePerfil
}

/** Espacios de más fuera; vacío se guarda como `null`, no como texto vacío. */
export function normalizarPerfil(datos: DatosDePerfil): { fullName: string | null, phone: string | null, locale: IdiomaDePerfil } {
  const nombre = (datos.fullName ?? '').replace(/\s+/g, ' ').trim()
  const telefono = (datos.phone ?? '').replace(/\s+/g, ' ').trim()
  return {
    fullName: nombre === '' ? null : nombre,
    phone: telefono === '' ? null : telefono,
    locale: (IDIOMAS_DE_PERFIL as readonly string[]).includes(datos.locale) ? datos.locale as IdiomaDePerfil : 'es',
  }
}

export function validarPerfil(datos: DatosDePerfil): ErrorDePerfil[] {
  const errores: ErrorDePerfil[] = []
  const nombre = (datos.fullName ?? '').replace(/\s+/g, ' ').trim()
  const telefono = (datos.phone ?? '').trim()

  if (nombre.length > LONGITUD_MAXIMA_DE_NOMBRE) {
    errores.push({ name: 'fullName', message: 'profile.validation.name_too_long' })
  }
  if (telefono !== '' && !TELEFONO.test(telefono)) {
    errores.push({ name: 'phone', message: 'profile.validation.phone_invalid' })
  }
  if (!(IDIOMAS_DE_PERFIL as readonly string[]).includes(datos.locale)) {
    errores.push({ name: 'locale', message: 'profile.validation.locale_invalid' })
  }
  return errores
}

export function validarCuenta(datos: DatosDeCuenta): ErrorDePerfil[] {
  const errores = validarPerfil(datos)
  if (!EMAIL.test(normalizarEmail(datos.email ?? ''))) {
    errores.push({ name: 'email', message: 'auth.validation.email_invalid' })
  }
  return errores
}

// ── Contraseña ─────────────────────────────────────────────────────────────

export interface CambioDeContrasena {
  actual: string
  nueva: string
  confirmacion: string
}

export type CampoDeContrasena = 'actual' | 'nueva' | 'confirmacion'

export const CLAVES_DE_VALIDACION_DE_CONTRASENA = [
  'profile.password.validation.current_required',
  'profile.password.validation.same_as_current',
  'auth.validation.password_too_short',
  'auth.validation.password_needs_letter_and_digit',
  'auth.validation.password_mismatch',
] as const

export type ClaveDeValidacionDeContrasena = typeof CLAVES_DE_VALIDACION_DE_CONTRASENA[number]

export interface ErrorDeContrasena {
  name: CampoDeContrasena
  message: ClaveDeValidacionDeContrasena
}

/**
 * Cambiar la contraseña pide la actual. Una cuenta creada con Google no tiene
 * ninguna: entonces se **crea**, y no hay actual que pedir. La nueva cumple las
 * mismas reglas que en el registro (RF-04.4).
 */
export function validarCambioDeContrasena(datos: CambioDeContrasena, tieneContrasena: boolean): ErrorDeContrasena[] {
  const errores: ErrorDeContrasena[] = []
  const nueva = datos.nueva ?? ''

  if (tieneContrasena && (datos.actual ?? '') === '') {
    errores.push({ name: 'actual', message: 'profile.password.validation.current_required' })
  }

  if (nueva.length < LONGITUD_MINIMA_DE_CONTRASENA) {
    errores.push({ name: 'nueva', message: 'auth.validation.password_too_short' })
  }
  else if (!/[a-z]/i.test(nueva) || !/\d/.test(nueva)) {
    errores.push({ name: 'nueva', message: 'auth.validation.password_needs_letter_and_digit' })
  }
  else if (tieneContrasena && nueva === datos.actual) {
    errores.push({ name: 'nueva', message: 'profile.password.validation.same_as_current' })
  }

  if ((datos.confirmacion ?? '') !== nueva) {
    errores.push({ name: 'confirmacion', message: 'auth.validation.password_mismatch' })
  }

  return errores
}

/** La base rechaza con un código en el mensaje; aquí se vuelve clave i18n. */
export function errorDePerfilDesdeBase(mensaje: string | null | undefined): ClaveDeValidacionDePerfil | 'profile.errors.save_failed' {
  const texto = mensaje ?? ''
  if (texto.includes('PERFIL-NOMBRE')) return 'profile.validation.name_too_long'
  if (texto.includes('PERFIL-TELEFONO')) return 'profile.validation.phone_invalid'
  return 'profile.errors.save_failed'
}
