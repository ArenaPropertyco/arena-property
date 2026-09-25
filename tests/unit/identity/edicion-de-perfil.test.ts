import { describe, expect, it } from 'vitest'
import {
  errorDePerfilDesdeBase,
  normalizarPerfil,
  validarCambioDeContrasena,
  validarCuenta,
  validarPerfil,
} from '#shared/identity/edicion-de-perfil'

/**
 * Edición del perfil: la propia cuenta cambia nombre, teléfono e idioma (nunca el
 * correo) y el Superadmin, además, el correo de cualquier cuenta. Cambiar la
 * contraseña pide la actual, salvo que la cuenta no tenga (alta con Google).
 */

describe('normalizarPerfil', () => {
  it('recorta espacios, deja null lo vacío y cae al español si el idioma no existe', () => {
    expect(normalizarPerfil({ fullName: '  Ana   Ruiz ', phone: ' ', locale: 'fr' })).toEqual({ fullName: 'Ana Ruiz', phone: null, locale: 'es' })
    expect(normalizarPerfil({ fullName: null, phone: '+57 300 123 4567', locale: 'en' })).toEqual({ fullName: null, phone: '+57 300 123 4567', locale: 'en' })
  })
})

describe('validarPerfil', () => {
  it('acepta un perfil completo y uno vacío', () => {
    expect(validarPerfil({ fullName: 'Ana Ruiz', phone: '+57 (300) 123-4567', locale: 'es' })).toEqual([])
    expect(validarPerfil({ fullName: '', phone: '', locale: 'en' })).toEqual([])
  })

  it('rechaza un nombre larguísimo, un teléfono con letras y un idioma desconocido', () => {
    const errores = validarPerfil({ fullName: 'a'.repeat(121), phone: '300-ABC', locale: 'fr' })
    expect(errores.map(e => e.message)).toEqual([
      'profile.validation.name_too_long',
      'profile.validation.phone_invalid',
      'profile.validation.locale_invalid',
    ])
  })

  it('un teléfono demasiado corto tampoco sirve', () => {
    expect(validarPerfil({ fullName: null, phone: '12345', locale: 'es' })[0]?.name).toBe('phone')
  })
})

describe('validarCuenta · lo que edita el Superadmin', () => {
  it('además del perfil exige un correo válido', () => {
    expect(validarCuenta({ fullName: 'Ana', phone: null, locale: 'es', email: 'ana@arena.co' })).toEqual([])
    expect(validarCuenta({ fullName: 'Ana', phone: null, locale: 'es', email: 'ana@' })).toEqual([
      { name: 'email', message: 'auth.validation.email_invalid' },
    ])
  })
})

describe('validarCambioDeContrasena', () => {
  it('con contraseña, pide la actual', () => {
    const errores = validarCambioDeContrasena({ actual: '', nueva: 'nueva1234', confirmacion: 'nueva1234' }, true)
    expect(errores).toEqual([{ name: 'actual', message: 'profile.password.validation.current_required' }])
  })

  it('sin contraseña (alta con Google), la crea sin pedir la actual', () => {
    expect(validarCambioDeContrasena({ actual: '', nueva: 'nueva1234', confirmacion: 'nueva1234' }, false)).toEqual([])
  })

  it('la nueva cumple las reglas del registro y coincide con la confirmación', () => {
    expect(validarCambioDeContrasena({ actual: 'vieja123', nueva: 'corta1', confirmacion: 'corta1' }, true)[0]?.message)
      .toBe('auth.validation.password_too_short')
    expect(validarCambioDeContrasena({ actual: 'vieja123', nueva: 'solotexto', confirmacion: 'solotexto' }, true)[0]?.message)
      .toBe('auth.validation.password_needs_letter_and_digit')
    expect(validarCambioDeContrasena({ actual: 'vieja123', nueva: 'nueva1234', confirmacion: 'otra1234' }, true))
      .toEqual([{ name: 'confirmacion', message: 'auth.validation.password_mismatch' }])
  })

  it('la nueva no puede ser igual a la actual', () => {
    expect(validarCambioDeContrasena({ actual: 'misma1234', nueva: 'misma1234', confirmacion: 'misma1234' }, true))
      .toEqual([{ name: 'nueva', message: 'profile.password.validation.same_as_current' }])
  })
})

describe('errorDePerfilDesdeBase', () => {
  it('traduce el código de la base a una clave i18n', () => {
    expect(errorDePerfilDesdeBase('PERFIL-TELEFONO · el teléfono no es válido')).toBe('profile.validation.phone_invalid')
    expect(errorDePerfilDesdeBase('PERFIL-NOMBRE · demasiado largo')).toBe('profile.validation.name_too_long')
    expect(errorDePerfilDesdeBase('otra cosa')).toBe('profile.errors.save_failed')
  })
})
