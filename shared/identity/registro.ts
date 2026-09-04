/**
 * HU-04 · RF-04.1 y RF-04.4 — esquema tipado del registro.
 *
 * Validación pura, sin dependencia de formularios ni de Supabase. Los mensajes son
 * claves i18n: la interfaz las traduce y el dominio no contiene texto visible. La
 * fortaleza mínima coincide con `minimum_password_length` de la configuración de
 * Supabase Auth, para que el servidor nunca rechace lo que el formulario aceptó.
 */

export const CLAVES_DE_VALIDACION = [
  'auth.validation.email_invalid',
  'auth.validation.password_too_short',
  'auth.validation.password_needs_letter_and_digit',
  'auth.validation.password_mismatch',
  'auth.validation.referral_code_format',
] as const

export type ClaveDeValidacion = typeof CLAVES_DE_VALIDACION[number]

export type CampoDeRegistro = 'email' | 'password' | 'passwordConfirm' | 'referralCode'

export interface DatosDeRegistro {
  email: string
  password: string
  passwordConfirm?: string
  referralCode?: string | null
}

export interface ErrorDeCampo {
  name: CampoDeRegistro
  message: ClaveDeValidacion
}

export const LONGITUD_MINIMA_DE_CONTRASENA = 8

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Código de referido: letras, dígitos y guiones, de 5 a 15 caracteres, en mayúsculas. */
const CODIGO_DE_REFERIDO = /^[A-Z0-9][A-Z0-9-]{4,14}$/

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Mayúsculas y sin espacios; vacío se vuelve `null` porque el campo es opcional. */
export function normalizarCodigoReferido(codigo: string | null | undefined): string | null {
  const limpio = (codigo ?? '').trim().toUpperCase()
  return limpio === '' ? null : limpio
}

/** ¿Tiene el código, ya normalizado, un formato plausible? Vacío o nulo no es un código. */
export function esCodigoReferidoValido(codigo: string | null | undefined): boolean {
  const normalizado = normalizarCodigoReferido(codigo)
  return normalizado !== null && CODIGO_DE_REFERIDO.test(normalizado)
}

export function validarRegistro(datos: DatosDeRegistro): ErrorDeCampo[] {
  const errores: ErrorDeCampo[] = []

  if (!EMAIL.test(normalizarEmail(datos.email ?? ''))) {
    errores.push({ name: 'email', message: 'auth.validation.email_invalid' })
  }

  const contrasena = datos.password ?? ''
  if (contrasena.length < LONGITUD_MINIMA_DE_CONTRASENA) {
    errores.push({ name: 'password', message: 'auth.validation.password_too_short' })
  }
  else if (!/[a-z]/i.test(contrasena) || !/\d/.test(contrasena)) {
    errores.push({ name: 'password', message: 'auth.validation.password_needs_letter_and_digit' })
  }

  if (datos.passwordConfirm !== undefined && datos.passwordConfirm !== contrasena) {
    errores.push({ name: 'passwordConfirm', message: 'auth.validation.password_mismatch' })
  }

  const codigo = normalizarCodigoReferido(datos.referralCode)
  if (codigo !== null && !CODIGO_DE_REFERIDO.test(codigo)) {
    errores.push({ name: 'referralCode', message: 'auth.validation.referral_code_format' })
  }

  return errores
}

/** Aviso que la interfaz muestra sobre el código escrito (CA-04.3: «se informa»). */
export type AvisoDeReferido = 'auth.register.referralApplied' | 'auth.register.referralIgnored'

export interface AtribucionDeRegistro {
  /** Lo que se persiste al registrarse; `null` cuando no hay código o no sirve. */
  referralCode: string | null
  aviso: AvisoDeReferido | null
}

/**
 * CA-04.3 · qué atribución deja un registro según el código escrito. Un código
 * válido se persiste normalizado; uno con formato inválido no bloquea el registro:
 * se descarta y se avisa. Sin código no hay atribución ni aviso. La base aplica
 * la misma regla en `private.normalizar_codigo_referido()`.
 */
export function atribucionDeRegistro(codigo: string | null | undefined): AtribucionDeRegistro {
  const normalizado = normalizarCodigoReferido(codigo)
  if (normalizado === null) {
    return { referralCode: null, aviso: null }
  }
  if (!CODIGO_DE_REFERIDO.test(normalizado)) {
    return { referralCode: null, aviso: 'auth.register.referralIgnored' }
  }
  return { referralCode: normalizado, aviso: 'auth.register.referralApplied' }
}
