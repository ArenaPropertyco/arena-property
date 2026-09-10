import { describe, expect, it } from 'vitest'
import { esCombinacionValida } from '#shared/permissions/roles'
import type { Rol } from '#shared/permissions/roles'
import {
  ACCOUNT_KINDS,
  canSignUp,
  rolesAfterApproval,
  signupErrorKey,
  TERMS_VERSION,
  validateSignup,
} from '#shared/referrals/signup'
import type { SignupDraft } from '#shared/referrals/signup'

/**
 * HU-49 · RF-49.1…RF-49.6 — la inscripción al Programa de Referidos.
 *
 * Solo Usuario y Propietario se inscriben; exige aceptar los términos con su
 * versión y datos bancarios completos; al aprobarse la cuenta **suma** el rol
 * Embajador sin perder el anterior, y nadie se inscribe dos veces.
 */

function draft(changes: Partial<SignupDraft> = {}): SignupDraft {
  return {
    termsAccepted: true,
    termsVersion: TERMS_VERSION,
    bank: { bank: 'Bancolombia', accountKind: 'savings', accountNumber: '12345678901', holder: 'Ana Ruiz' },
    ...changes,
  }
}

describe('CA-49.1 · RF-49.2 · RF-49.3 · la validación rechaza por campo', () => {
  it('CA-49.1 · una inscripción completa no tiene errores', () => {
    expect(validateSignup(draft())).toEqual([])
    expect(ACCOUNT_KINDS).toEqual(['savings', 'checking'])
  })

  it('CA-49.1 · sin aceptar los términos se rechaza en su campo', () => {
    expect(validateSignup(draft({ termsAccepted: false })))
      .toEqual([{ name: 'termsAccepted', message: 'referrals.signup.validation.terms_required' }])
  })

  it('RF-49.2 · la versión de los términos aceptada tiene que viajar', () => {
    expect(validateSignup(draft({ termsVersion: '' })))
      .toEqual([{ name: 'termsVersion', message: 'referrals.signup.validation.terms_version_missing' }])
  })

  it('CA-49.1 · RF-49.3 · los datos de pago incompletos se rechazan uno a uno', () => {
    const errores = validateSignup(draft({ bank: { bank: '  ', accountKind: 'savings', accountNumber: '', holder: '' } }))
    expect(errores).toEqual([
      { name: 'bank', message: 'referrals.signup.validation.bank_required' },
      { name: 'accountNumber', message: 'referrals.signup.validation.account_number_invalid' },
      { name: 'holder', message: 'referrals.signup.validation.holder_required' },
    ])
  })

  it('RF-49.3 · el número de cuenta admite solo dígitos, entre 5 y 20', () => {
    expect(validateSignup(draft({ bank: { ...draft().bank, accountNumber: '123-456' } })))
      .toEqual([{ name: 'accountNumber', message: 'referrals.signup.validation.account_number_invalid' }])
    expect(validateSignup(draft({ bank: { ...draft().bank, accountNumber: '1234' } })))
      .toEqual([{ name: 'accountNumber', message: 'referrals.signup.validation.account_number_invalid' }])
    expect(validateSignup(draft({ bank: { ...draft().bank, accountNumber: '1'.repeat(21) } })))
      .toEqual([{ name: 'accountNumber', message: 'referrals.signup.validation.account_number_invalid' }])
    expect(validateSignup(draft({ bank: { ...draft().bank, accountNumber: '12345' } }))).toEqual([])
  })

  it('RF-49.3 · el tipo de cuenta sale del vocabulario cerrado', () => {
    const invalido = { ...draft().bank, accountKind: 'cripto' as unknown as SignupDraft['bank']['accountKind'] }
    expect(validateSignup(draft({ bank: invalido })))
      .toEqual([{ name: 'accountKind', message: 'referrals.signup.validation.account_kind_invalid' }])
  })
})

describe('CA-49.4 · RF-49.1 · solo Usuario y Propietario se inscriben', () => {
  it('CA-49.4 · un Administrador de Propiedad tiene la opción denegada', () => {
    expect(canSignUp(['property_admin'], false)).toEqual({ allowed: false, reason: 'referrals.signup.validation.role_not_allowed' })
  })

  it('CA-49.4 · el Superadmin tampoco se inscribe; el Usuario y el Propietario sí', () => {
    expect(canSignUp(['superadmin'], false).allowed).toBe(false)
    expect(canSignUp(['user'], false)).toEqual({ allowed: true, reason: null })
    expect(canSignUp(['owner'], false)).toEqual({ allowed: true, reason: null })
  })

  it('RF-49.1 · sin sesión no hay inscripción', () => {
    expect(canSignUp([], false).allowed).toBe(false)
  })

  /**
   * Toda cuenta lleva el rol Usuario desde el alta, y la matriz resuelve varios
   * roles por el alcance más amplio. Sin mirar la combinación resultante, el «no»
   * del Superadmin quedaba tapado por el «sí» del Usuario y la pantalla ofrecía un
   * formulario que la base rechaza (RF-07.1).
   */
  it('CA-49.4 · RF-07.1 · el Superadmin no se inscribe aunque acumule el rol Usuario', () => {
    expect(canSignUp(['superadmin', 'user'], false))
      .toEqual({ allowed: false, reason: 'referrals.signup.validation.role_not_allowed' })
  })

  it('CA-49.4 · RF-07.1 · tampoco el Administrador de Propiedad con rol Usuario', () => {
    expect(canSignUp(['property_admin', 'user'], false).allowed).toBe(false)
  })

  it('CA-49.4 · un Propietario con rol Usuario sí se inscribe', () => {
    expect(canSignUp(['owner', 'user'], false)).toEqual({ allowed: true, reason: null })
  })
})

describe('RF-49.1 · el rechazo de la base, con su motivo', () => {
  it('CA-49.4 · un rol operativo se reconoce por la regla que cita', () => {
    expect(signupErrorKey('CA-49.4 · RF-49.1 · el Superadmin y el Administrador de Propiedad no se inscriben como Embajador.'))
      .toBe('referrals.signup.validation.role_not_allowed')
  })

  it('CA-49.3 · una segunda inscripción se reconoce igual', () => {
    expect(signupErrorKey('CA-49.3 · RF-49.6 · esta cuenta ya está inscrita en el programa.'))
      .toBe('referrals.signup.validation.already_enrolled')
  })

  it('un fallo que no cita ninguna regla no se disfraza de validación', () => {
    expect(signupErrorKey('could not connect to server')).toBe(null)
  })
})

describe('CA-49.3 · RF-49.6 · nadie se inscribe dos veces', () => {
  it('CA-49.3 · una cuenta que ya es Embajador se rechaza', () => {
    expect(canSignUp(['owner', 'ambassador'], true))
      .toEqual({ allowed: false, reason: 'referrals.signup.validation.already_enrolled' })
  })

  it('CA-49.3 · una inscripción ya registrada bloquea aunque el rol todavía no esté', () => {
    expect(canSignUp(['user'], true))
      .toEqual({ allowed: false, reason: 'referrals.signup.validation.already_enrolled' })
  })
})

describe('CA-49.2 · RF-49.4 · al aprobar, el rol Embajador se suma', () => {
  it('CA-49.2 · un Propietario aprobado queda con Propietario y Embajador', () => {
    const roles = rolesAfterApproval(['owner'])
    expect(roles).toEqual(['owner', 'ambassador'])
    expect(esCombinacionValida(roles)).toBe(true)
  })

  it('CA-49.2 · un Usuario aprobado conserva su rol y suma el de Embajador, sin repetirlo', () => {
    expect(rolesAfterApproval(['user'])).toEqual(['user', 'ambassador'])
    expect(rolesAfterApproval(['user', 'ambassador'])).toEqual(['user', 'ambassador'])
  })

  it('CA-49.4 · una combinación prohibida no se produce: el rol operativo no suma Embajador', () => {
    const roles: readonly Rol[] = ['property_admin']
    expect(rolesAfterApproval(roles)).toEqual(['property_admin'])
    expect(esCombinacionValida(rolesAfterApproval(roles))).toBe(true)
  })
})
