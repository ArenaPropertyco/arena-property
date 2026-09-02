/**
 * HU-04 · RF-04.5 — traducción de errores de autenticación.
 *
 * Convierte un error del proveedor en una clave i18n de un catálogo cerrado. El
 * mensaje original nunca llega a la interfaz: puede contener nombres de tablas,
 * códigos internos o pistas sobre qué cuentas existen.
 */

export const CLAVES_DE_ERROR_DE_AUTH = [
  'auth.errors.email_in_use',
  'auth.errors.invalid_credentials',
  'auth.errors.email_not_verified',
  'auth.errors.too_many_attempts',
  'auth.errors.weak_password',
  'auth.errors.oauth_cancelled',
  'auth.errors.unknown',
] as const

export type ClaveDeErrorDeAuth = typeof CLAVES_DE_ERROR_DE_AUTH[number]

export interface ErrorDeAuth {
  code?: string | null
  message?: string | null
  status?: number
}

/** Códigos de error de Supabase Auth con traducción propia. */
const POR_CODIGO: Record<string, ClaveDeErrorDeAuth> = {
  user_already_exists: 'auth.errors.email_in_use',
  email_exists: 'auth.errors.email_in_use',
  invalid_credentials: 'auth.errors.invalid_credentials',
  email_not_confirmed: 'auth.errors.email_not_verified',
  over_request_rate_limit: 'auth.errors.too_many_attempts',
  over_email_send_rate_limit: 'auth.errors.too_many_attempts',
  weak_password: 'auth.errors.weak_password',
}

/** Respuestas antiguas del proveedor que solo traen mensaje. */
const POR_MENSAJE: ReadonlyArray<[RegExp, ClaveDeErrorDeAuth]> = [
  [/already registered|already exists/i, 'auth.errors.email_in_use'],
  [/invalid login credentials/i, 'auth.errors.invalid_credentials'],
  [/email not confirmed/i, 'auth.errors.email_not_verified'],
  [/rate limit/i, 'auth.errors.too_many_attempts'],
]

export function claveDeErrorDeAuth(error: ErrorDeAuth | null | undefined): ClaveDeErrorDeAuth {
  if (!error) {
    return 'auth.errors.unknown'
  }

  const porCodigo = error.code ? POR_CODIGO[error.code] : undefined
  if (porCodigo) {
    return porCodigo
  }

  const mensaje = error.message ?? ''
  const porMensaje = POR_MENSAJE.find(([patron]) => patron.test(mensaje))

  return porMensaje ? porMensaje[1] : 'auth.errors.unknown'
}

/**
 * HU-61 · RF-61.9 — errores del retorno de un proveedor externo (Google). Llegan
 * como parámetro de la URL (`?error=...`), no como `ErrorDeAuth`: Supabase nunca
 * completa el intercambio, así que no hay `code` ni `message` del SDK que traducir.
 */
export function claveDeErrorDeCallbackOAuth(error: string | null | undefined): ClaveDeErrorDeAuth {
  if (!error) {
    return 'auth.errors.unknown'
  }

  if (error === 'access_denied') {
    return 'auth.errors.oauth_cancelled'
  }

  return 'auth.errors.unknown'
}
