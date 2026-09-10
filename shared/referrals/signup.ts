/**
 * HU-49 · RF-49.1…RF-49.6 — la inscripción al Programa de Referidos.
 *
 * Se inscriben Usuario y Propietario, nunca Superadmin ni Administrador: la
 * capacidad sale de la matriz de permisos (HU-07), no de una lista aparte. La
 * inscripción exige aceptar los términos —con la versión que se aceptó, para que
 * un cambio posterior no reescriba lo pactado— y datos bancarios completos.
 *
 * Al aprobarse, la cuenta **suma** el rol Embajador sin perder el anterior
 * (RF-49.4), respetando las combinaciones válidas de HU-07.
 */

import { puede } from '../permissions/mapa'
import { esCombinacionValida } from '../permissions/roles'
import type { Rol } from '../permissions/roles'

/** Versión vigente de los términos del programa; se persiste con la inscripción (RF-49.2). */
export const TERMS_VERSION = '2026-09-v1'

/** RF-49.3 · vocabulario cerrado del tipo de cuenta bancaria. */
export const ACCOUNT_KINDS = ['savings', 'checking'] as const

export type AccountKind = typeof ACCOUNT_KINDS[number]

export interface BankAccount {
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
}

export interface SignupDraft {
  termsAccepted: boolean
  termsVersion: string
  bank: BankAccount
}

export const SIGNUP_VALIDATION_KEYS = [
  'referrals.signup.validation.terms_required',
  'referrals.signup.validation.terms_version_missing',
  'referrals.signup.validation.bank_required',
  'referrals.signup.validation.account_kind_invalid',
  'referrals.signup.validation.account_number_invalid',
  'referrals.signup.validation.holder_required',
  'referrals.signup.validation.role_not_allowed',
  'referrals.signup.validation.already_enrolled',
] as const

export type SignupValidationKey = typeof SIGNUP_VALIDATION_KEYS[number]

export type SignupField = 'termsAccepted' | 'termsVersion' | 'bank' | 'accountKind' | 'accountNumber' | 'holder'

export interface SignupError {
  name: SignupField
  message: SignupValidationKey
}

/** RF-49.3 · el número de cuenta es solo dígitos, de 5 a 20. */
const ACCOUNT_NUMBER = /^\d{5,20}$/

/** CA-49.1 · lo que impide inscribirse, campo por campo; vacío si procede. */
export function validateSignup(draft: SignupDraft): SignupError[] {
  const errors: SignupError[] = []

  if (!draft.termsAccepted) {
    errors.push({ name: 'termsAccepted', message: 'referrals.signup.validation.terms_required' })
  }
  if ((draft.termsVersion ?? '').trim() === '') {
    errors.push({ name: 'termsVersion', message: 'referrals.signup.validation.terms_version_missing' })
  }

  const bank = draft.bank
  if ((bank?.bank ?? '').trim() === '') {
    errors.push({ name: 'bank', message: 'referrals.signup.validation.bank_required' })
  }
  if (!ACCOUNT_KINDS.includes(bank?.accountKind as AccountKind)) {
    errors.push({ name: 'accountKind', message: 'referrals.signup.validation.account_kind_invalid' })
  }
  if (!ACCOUNT_NUMBER.test((bank?.accountNumber ?? '').trim())) {
    errors.push({ name: 'accountNumber', message: 'referrals.signup.validation.account_number_invalid' })
  }
  if ((bank?.holder ?? '').trim() === '') {
    errors.push({ name: 'holder', message: 'referrals.signup.validation.holder_required' })
  }

  return errors
}

export interface SignupEligibility {
  allowed: boolean
  reason: SignupValidationKey | null
}

/**
 * CA-49.3 · CA-49.4 · RF-49.1 · RF-49.6 · quién puede inscribirse. Una inscripción
 * ya registrada pesa más que el rol: bloquea aunque el rol Embajador todavía no
 * esté concedido, porque la aprobación puede estar pendiente.
 */
export function canSignUp(roles: readonly Rol[], alreadyEnrolled: boolean): SignupEligibility {
  if (alreadyEnrolled) {
    return { allowed: false, reason: 'referrals.signup.validation.already_enrolled' }
  }
  // RF-07.1 · no basta la capacidad: hay que mirar los roles que quedarían.
  //
  // Toda cuenta lleva el rol Usuario desde el alta y la matriz resuelve varios
  // roles por el alcance más amplio, así que el «no» del Superadmin quedaba
  // tapado por el «sí» del Usuario. La combinación resultante es la que manda, y
  // es la misma regla que aplican `private.validar_roles` y `enroll_as_ambassador`.
  if (!puede(roles, 'inscribirse_como_embajador') || !esCombinacionValida([...roles, 'ambassador'])) {
    return { allowed: false, reason: 'referrals.signup.validation.role_not_allowed' }
  }
  return { allowed: true, reason: null }
}

/**
 * RF-49.1 · el rechazo de la base, reconocido por la regla que cita.
 *
 * La pantalla no adivina: si el motivo es uno de los previstos lo dice con sus
 * palabras, y si no, devuelve `null` para que quien llama muestre el error
 * genérico en vez de disfrazar un fallo de red de regla de negocio (principio 9).
 */
export function signupErrorKey(message: string): SignupValidationKey | null {
  if (message.includes('CA-49.4')) {
    return 'referrals.signup.validation.role_not_allowed'
  }
  if (message.includes('CA-49.3')) {
    return 'referrals.signup.validation.already_enrolled'
  }
  return null
}

/**
 * CA-49.2 · RF-49.4 · los roles tras aprobar: el Embajador se suma al que ya
 * había. Si la combinación resultante no fuera válida (HU-07), los roles quedan
 * como estaban: la aprobación no puede romper la matriz.
 */
export function rolesAfterApproval(roles: readonly Rol[]): Rol[] {
  if (roles.includes('ambassador')) {
    return [...roles]
  }
  const resultantes: Rol[] = [...roles, 'ambassador']
  return esCombinacionValida(resultantes) ? resultantes : [...roles]
}
