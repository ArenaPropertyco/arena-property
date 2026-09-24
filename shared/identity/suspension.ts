/**
 * HU-33 · RF-33.1, RF-33.3, RF-33.6 · D-07 — lo que se decide antes de suspender
 * una cuenta.
 *
 * El motivo y el tipo son obligatorios: sin motivo no hay suspensión (CA-33.1) y
 * sin tipo no se sabe qué pasa con el saldo del Embajador (D-07). La pantalla
 * cuenta ese efecto antes de confirmar, para que la decisión se tome informada.
 * Solo el Superadmin suspende, nunca a sí mismo ni a otro Superadmin; la base
 * repite las mismas reglas en `suspend_account`.
 */

import type { Rol } from '../permissions/roles'
import type { CuentaConRoles } from './cuentas'

export const TIPOS_DE_SUSPENSION = ['administrative', 'breach_or_fraud'] as const
export type TipoDeSuspension = typeof TIPOS_DE_SUSPENSION[number]

export interface NuevaSuspension {
  kind: TipoDeSuspension | null
  reason: string
}

export const CLAVES_DE_VALIDACION_DE_SUSPENSION = [
  'account.suspension.validation.reason_required',
  'account.suspension.validation.kind_required',
] as const

export type ClaveDeValidacionDeSuspension = typeof CLAVES_DE_VALIDACION_DE_SUSPENSION[number]

/** CA-33.1 · RF-33.3 · lo que impide suspender; vacío si procede. */
export function validarSuspension(suspension: NuevaSuspension): ClaveDeValidacionDeSuspension[] {
  const errores: ClaveDeValidacionDeSuspension[] = []
  if (suspension.reason.trim() === '') {
    errores.push('account.suspension.validation.reason_required')
  }
  if (suspension.kind === null || !TIPOS_DE_SUSPENSION.includes(suspension.kind)) {
    errores.push('account.suspension.validation.kind_required')
  }
  return errores
}

export interface EfectoDeSuspension {
  /** Administrativa: los cuatro saldos se conservan y se pueden retirar. */
  conservaSaldo: boolean
  /** Por incumplimiento o fraude: lo pendiente y lo en gracia se pierden. */
  pierdePendienteYGracia: boolean
  /** Por incumplimiento o fraude: el Superadmin resuelve sobre lo disponible con constancia. */
  resuelveDisponible: boolean
}

/** RF-33.3 · D-07 · qué pasa con el saldo del Embajador según el tipo. */
export function efectoDeSuspension(kind: TipoDeSuspension): EfectoDeSuspension {
  const fraude = kind === 'breach_or_fraud'
  return { conservaSaldo: !fraude, pierdePendienteYGracia: fraude, resuelveDisponible: fraude }
}

/** RF-33.6 · el Superadmin suspende a una cuenta activa que no es Superadmin ni él mismo. */
export function puedeSuspender(rolesDelActor: readonly Rol[], objetivo: CuentaConRoles, idDelActor: string | null): boolean {
  return rolesDelActor.includes('superadmin')
    && objetivo.status === 'active'
    && objetivo.id !== idDelActor
    && !objetivo.roles.includes('superadmin')
}

/** RF-33.5 · reactivar es del Superadmin y solo sobre una cuenta suspendida. */
export function puedeReactivar(rolesDelActor: readonly Rol[], objetivo: CuentaConRoles): boolean {
  return rolesDelActor.includes('superadmin') && objetivo.status === 'suspended'
}
