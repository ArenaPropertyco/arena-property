import { describe, expect, it } from 'vitest'
import {
  efectoDeSuspension,
  puedeSuspender,
  TIPOS_DE_SUSPENSION,
  validarSuspension,
} from '#shared/identity/suspension'
import type { CuentaConRoles } from '#shared/identity/cuentas'

/**
 * HU-33 · RF-33.1, RF-33.3, RF-33.6 · D-07 — lo que se decide antes de suspender.
 *
 * El motivo y el tipo son obligatorios (CA-33.1); el tipo dice qué pasa con el
 * saldo del Embajador (D-07) y la pantalla lo cuenta antes de confirmar. Solo el
 * Superadmin suspende, nunca a sí mismo ni a otro Superadmin: la base lo repite.
 */

const SUPERADMIN: CuentaConRoles = { id: 's1', email: 'super@arena.local', fullName: null, status: 'active', roles: ['user', 'superadmin'] }
const ANA: CuentaConRoles = { id: 'u1', email: 'ana@ejemplo.com', fullName: 'Ana', status: 'active', roles: ['user', 'owner', 'ambassador'] }
const SUSPENDIDA: CuentaConRoles = { ...ANA, id: 'u2', status: 'suspended' }

describe('CA-33.1 · RF-33.1 · RF-33.3 · motivo y tipo obligatorios', () => {
  it('CA-33.1 · sin motivo se rechaza, aunque haya tipo', () => {
    expect(validarSuspension({ kind: 'administrative', reason: '' })).toEqual(['account.suspension.validation.reason_required'])
    expect(validarSuspension({ kind: 'administrative', reason: '   ' })).toEqual(['account.suspension.validation.reason_required'])
  })

  it('RF-33.3 · sin tipo se rechaza, aunque haya motivo', () => {
    expect(validarSuspension({ kind: null, reason: 'Documentos vencidos.' })).toEqual(['account.suspension.validation.kind_required'])
  })

  it('con las dos cosas, procede; los tipos son exactamente los dos de D-07', () => {
    expect(validarSuspension({ kind: 'breach_or_fraud', reason: 'Autorreferencia probada.' })).toEqual([])
    expect(TIPOS_DE_SUSPENSION).toEqual(['administrative', 'breach_or_fraud'])
  })
})

describe('RF-33.3 · D-07 · el tipo decide el efecto sobre el saldo', () => {
  it('administrativa conserva los cuatro saldos y no pide decisión', () => {
    expect(efectoDeSuspension('administrative')).toEqual({ conservaSaldo: true, pierdePendienteYGracia: false, resuelveDisponible: false })
  })

  it('por incumplimiento o fraude pierde pendiente y en gracia, y lo disponible queda a decisión con constancia', () => {
    expect(efectoDeSuspension('breach_or_fraud')).toEqual({ conservaSaldo: false, pierdePendienteYGracia: true, resuelveDisponible: true })
  })
})

describe('RF-33.6 · solo el Superadmin suspende, y no a cualquiera', () => {
  it('el Superadmin suspende a una cuenta activa que no es Superadmin', () => {
    expect(puedeSuspender(['superadmin'], ANA, 's1')).toBe(true)
  })

  it('un Administrador no suspende a nadie', () => {
    expect(puedeSuspender(['property_admin'], ANA, 'a1')).toBe(false)
  })

  it('ni a sí mismo ni a otro Superadmin, ni a quien ya está suspendida', () => {
    expect(puedeSuspender(['superadmin'], SUPERADMIN, 's1')).toBe(false)
    expect(puedeSuspender(['superadmin'], { ...SUPERADMIN, id: 's2' }, 's1')).toBe(false)
    expect(puedeSuspender(['superadmin'], SUSPENDIDA, 's1')).toBe(false)
  })
})
