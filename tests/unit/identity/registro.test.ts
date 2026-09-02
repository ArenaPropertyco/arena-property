import { describe, expect, it } from 'vitest'
import { normalizarCodigoReferido, validarRegistro } from '#shared/identity/registro'

/**
 * HU-04 · RF-04.1 y RF-04.4 — validación del registro en esquema tipado.
 * Los mensajes son claves i18n: la interfaz las traduce, el dominio no habla.
 */

const valido = {
  email: 'ana@ejemplo.com',
  password: 'Arena2026',
  passwordConfirm: 'Arena2026',
  referralCode: '',
}

describe('CA-04.1 · email inválido o contraseña débil se rechazan con errores por campo', () => {
  it('un registro válido no produce errores', () => {
    expect(validarRegistro(valido)).toEqual([])
  })

  it.each(['', 'ana', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'ana ejemplo@x.com'])('rechaza el email "%s"', (email) => {
    const errores = validarRegistro({ ...valido, email })

    expect(errores).toEqual([{ name: 'email', message: 'auth.validation.email_invalid' }])
  })

  it('rechaza una contraseña corta', () => {
    expect(validarRegistro({ ...valido, password: 'Ab1', passwordConfirm: 'Ab1' })).toEqual([
      { name: 'password', message: 'auth.validation.password_too_short' },
    ])
  })

  it('rechaza una contraseña sin letras o sin números', () => {
    expect(validarRegistro({ ...valido, password: '12345678', passwordConfirm: '12345678' })).toEqual([
      { name: 'password', message: 'auth.validation.password_needs_letter_and_digit' },
    ])
    expect(validarRegistro({ ...valido, password: 'abcdefgh', passwordConfirm: 'abcdefgh' })).toEqual([
      { name: 'password', message: 'auth.validation.password_needs_letter_and_digit' },
    ])
  })

  it('exige que la confirmación coincida', () => {
    expect(validarRegistro({ ...valido, passwordConfirm: 'Otra2026' })).toEqual([
      { name: 'passwordConfirm', message: 'auth.validation.password_mismatch' },
    ])
  })

  it('reporta cada campo por separado cuando fallan varios', () => {
    const errores = validarRegistro({ email: 'x', password: 'a', passwordConfirm: 'b', referralCode: '' })

    expect(errores.map(error => error.name)).toEqual(['email', 'password', 'passwordConfirm'])
  })

  it('el email se acepta con mayúsculas y espacios alrededor', () => {
    expect(validarRegistro({ ...valido, email: '  Ana@Ejemplo.COM ' })).toEqual([])
  })
})

describe('RF-04.4 · código de referido opcional', () => {
  it('vacío es válido: el campo es opcional', () => {
    expect(validarRegistro({ ...valido, referralCode: '' })).toEqual([])
    expect(validarRegistro({ ...valido, referralCode: undefined })).toEqual([])
  })

  it('se normaliza a mayúsculas sin espacios', () => {
    expect(normalizarCodigoReferido('  ar3n4-x9 ')).toBe('AR3N4-X9')
    expect(normalizarCodigoReferido('')).toBeNull()
    expect(normalizarCodigoReferido(undefined)).toBeNull()
  })

  it('un código con formato imposible se rechaza en el campo, sin bloquear el resto', () => {
    expect(validarRegistro({ ...valido, referralCode: '!!' })).toEqual([
      { name: 'referralCode', message: 'auth.validation.referral_code_format' },
    ])
  })

  it('un código con formato plausible pasa la validación de formulario', () => {
    expect(validarRegistro({ ...valido, referralCode: 'ARENA-7K2Q' })).toEqual([])
  })
})
