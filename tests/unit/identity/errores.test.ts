import { describe, expect, it } from 'vitest'
import { CLAVES_DE_ERROR_DE_AUTH, claveDeErrorDeAuth, claveDeErrorDeCallbackOAuth } from '#shared/identity/errores'

/**
 * HU-04 · RF-04.5 — los errores de autenticación se traducen sin exponer detalle
 * técnico. La función devuelve una clave i18n, nunca el mensaje del proveedor.
 */

describe('claveDeErrorDeAuth', () => {
  it('email ya registrado', () => {
    expect(claveDeErrorDeAuth({ code: 'user_already_exists' })).toBe('auth.errors.email_in_use')
    expect(claveDeErrorDeAuth({ code: 'email_exists' })).toBe('auth.errors.email_in_use')
  })

  it('credenciales inválidas', () => {
    expect(claveDeErrorDeAuth({ code: 'invalid_credentials' })).toBe('auth.errors.invalid_credentials')
  })

  it('correo sin verificar', () => {
    expect(claveDeErrorDeAuth({ code: 'email_not_confirmed' })).toBe('auth.errors.email_not_verified')
  })

  it('límite de intentos', () => {
    expect(claveDeErrorDeAuth({ code: 'over_request_rate_limit' })).toBe('auth.errors.too_many_attempts')
    expect(claveDeErrorDeAuth({ code: 'over_email_send_rate_limit' })).toBe('auth.errors.too_many_attempts')
  })

  it('contraseña débil según el proveedor', () => {
    expect(claveDeErrorDeAuth({ code: 'weak_password' })).toBe('auth.errors.weak_password')
  })

  it('cualquier otro error cae en la clave genérica, sin filtrar el mensaje original', () => {
    const clave = claveDeErrorDeAuth({ code: 'unexpected_failure', message: 'pq: relation "auth.users" does not exist' })

    expect(clave).toBe('auth.errors.unknown')
    expect(clave).not.toContain('auth.users')
  })

  it('sin código ni mensaje también cae en la genérica', () => {
    expect(claveDeErrorDeAuth({})).toBe('auth.errors.unknown')
    expect(claveDeErrorDeAuth(null)).toBe('auth.errors.unknown')
  })

  it('el catálogo de claves es cerrado y toda salida pertenece a él', () => {
    const codigos = ['user_already_exists', 'invalid_credentials', 'email_not_confirmed', 'weak_password', 'x']
    for (const code of codigos) {
      expect(CLAVES_DE_ERROR_DE_AUTH).toContain(claveDeErrorDeAuth({ code }))
    }
  })
})

/**
 * HU-61 · RF-61.9 — el retorno de Google llega como parámetro de URL, no como
 * `ErrorDeAuth`: nunca hubo intercambio que produjera un `code` del SDK.
 */
describe('claveDeErrorDeCallbackOAuth', () => {
  it('CA-61.7 · el Visitante cancela el permiso en Google', () => {
    expect(claveDeErrorDeCallbackOAuth('access_denied')).toBe('auth.errors.oauth_cancelled')
  })

  it('cualquier otro error del proveedor cae en la clave genérica', () => {
    expect(claveDeErrorDeCallbackOAuth('server_error')).toBe('auth.errors.unknown')
  })

  it('sin error en la URL también cae en la genérica', () => {
    expect(claveDeErrorDeCallbackOAuth(null)).toBe('auth.errors.unknown')
    expect(claveDeErrorDeCallbackOAuth(undefined)).toBe('auth.errors.unknown')
  })
})
