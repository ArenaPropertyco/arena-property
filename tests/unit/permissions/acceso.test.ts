import { describe, expect, it } from 'vitest'
import { decidirAcceso, RUTAS } from '#shared/permissions/acceso'

/**
 * HU-04 · RF-04.2 y HU-07 · RF-07.2 — la decisión de acceso a una ruta privada es
 * una función pura; el middleware de Nuxt solo la llama y redirige. Nivel N1.
 */

const sesionVerificada = {
  autenticado: true,
  verificado: true,
  estadoCuenta: 'active' as const,
  roles: ['user' as const],
}

describe('CA-04.4 · cuenta sin verificar', () => {
  it('una cuenta autenticada pero sin verificar el correo es redirigida a verificar', () => {
    const decision = decidirAcceso({ ...sesionVerificada, verificado: false }, { privada: true })

    expect(decision).toEqual({ permitido: false, motivo: 'no_verificado', redirigirA: RUTAS.verificar })
  })

  it('sin sesión, una ruta privada redirige a ingresar', () => {
    const decision = decidirAcceso(
      { autenticado: false, verificado: false, estadoCuenta: null, roles: [] },
      { privada: true },
    )

    expect(decision).toEqual({ permitido: false, motivo: 'no_autenticado', redirigirA: RUTAS.ingresar })
  })

  it('una cuenta verificada entra a una ruta privada sin capacidad exigida', () => {
    expect(decidirAcceso(sesionVerificada, { privada: true })).toEqual({ permitido: true })
  })

  it('una ruta pública se permite siempre, con o sin sesión', () => {
    expect(decidirAcceso({ autenticado: false, verificado: false, estadoCuenta: null, roles: [] }, {})).toEqual({ permitido: true })
    expect(decidirAcceso({ ...sesionVerificada, verificado: false }, {})).toEqual({ permitido: true })
  })
})

describe('CA-07.2 · capacidad exigida por la ruta', () => {
  it('sin la capacidad, deniega y devuelve al panel', () => {
    const decision = decidirAcceso(sesionVerificada, { privada: true, capacidad: 'administrar_usuarios_y_roles' })

    expect(decision).toEqual({ permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel })
  })

  it('con la capacidad, permite', () => {
    const decision = decidirAcceso(
      { ...sesionVerificada, roles: ['superadmin'] },
      { privada: true, capacidad: 'administrar_usuarios_y_roles' },
    )

    expect(decision).toEqual({ permitido: true })
  })

  it('la capacidad se evalúa sobre todos los roles acumulados', () => {
    const decision = decidirAcceso(
      { ...sesionVerificada, roles: ['owner', 'ambassador'] },
      { privada: true, capacidad: 'ver_saldo_y_retirar' },
    )

    expect(decision).toEqual({ permitido: true })
  })

  it('una capacidad condicionada por estado exige el contexto (D-31)', () => {
    const requisito = { privada: true, capacidad: 'reservar_en_su_fraccion' as const }
    const propietario = { ...sesionVerificada, roles: ['owner' as const] }

    expect(decidirAcceso(propietario, requisito).permitido).toBe(false)
    expect(decidirAcceso(propietario, { ...requisito, contexto: { calendarioActivo: true } }).permitido).toBe(true)
  })
})

describe('HU-33 · RF-33.1 · cuenta suspendida', () => {
  it('CA-33.2 · una cuenta suspendida pierde el acceso a toda ruta privada, aunque tenga el rol', () => {
    const decision = decidirAcceso(
      { ...sesionVerificada, estadoCuenta: 'suspended', roles: ['superadmin'] },
      { privada: true, capacidad: 'administrar_usuarios_y_roles' },
    )

    expect(decision).toEqual({ permitido: false, motivo: 'suspendido', redirigirA: RUTAS.suspendida })
  })

  it('la verificación se evalúa antes que la suspensión y esta antes que la capacidad', () => {
    const sinVerificar = decidirAcceso(
      { ...sesionVerificada, verificado: false, estadoCuenta: 'suspended' },
      { privada: true, capacidad: 'administrar_usuarios_y_roles' },
    )
    expect(sinVerificar).toMatchObject({ motivo: 'no_verificado' })
  })
})

describe('HU-25 · RF-25.5 · HU-32 · RF-32.3 · rutas reservadas al Superadmin', () => {
  it('CA-32.3 · un rol que no es Superadmin es denegado y devuelto al panel', () => {
    for (const roles of [['property_admin'], ['owner', 'ambassador'], ['user']] as const) {
      expect(decidirAcceso({ ...sesionVerificada, roles: [...roles] }, { soloSuperadmin: true }))
        .toEqual({ permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel })
    }
  })

  it('RF-25.5 · el Superadmin entra, también cuando acumula otros roles', () => {
    expect(decidirAcceso({ ...sesionVerificada, roles: ['superadmin'] }, { soloSuperadmin: true })).toEqual({ permitido: true })
    expect(decidirAcceso({ ...sesionVerificada, roles: ['owner', 'superadmin'] }, { soloSuperadmin: true })).toEqual({ permitido: true })
  })

  it('la reserva implica ruta privada: sin sesión o suspendido se deniega antes de mirar el rol', () => {
    expect(decidirAcceso({ ...sesionVerificada, autenticado: false, roles: ['superadmin'] }, { soloSuperadmin: true })).toMatchObject({ motivo: 'no_autenticado' })
    expect(decidirAcceso({ ...sesionVerificada, estadoCuenta: 'suspended', roles: ['superadmin'] }, { soloSuperadmin: true })).toMatchObject({ motivo: 'suspendido' })
  })
})

describe('HU-55 · RF-55.4 · D-20 · la billetera y la bandeja de retiros', () => {
  it('CA-55.5 · el Embajador entra a su billetera; quien no lo es, no', () => {
    expect(decidirAcceso({ ...sesionVerificada, roles: ['ambassador'] }, { capacidad: 'ver_saldo_y_retirar' })).toEqual({ permitido: true })
    expect(decidirAcceso({ ...sesionVerificada, roles: ['owner', 'ambassador'] }, { capacidad: 'ver_saldo_y_retirar' })).toEqual({ permitido: true })
    for (const roles of [['owner'], ['property_admin'], ['user']] as const) {
      expect(decidirAcceso({ ...sesionVerificada, roles: [...roles] }, { capacidad: 'ver_saldo_y_retirar' }))
        .toEqual({ permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel })
    }
  })

  it('CA-55.5 · D-20 · el Superadmin lee las billeteras desde la bandeja de retiros, no desde la de un Embajador', () => {
    expect(decidirAcceso({ ...sesionVerificada, roles: ['superadmin'] }, { capacidad: 'aprobar_pagos_comision' })).toEqual({ permitido: true })
    expect(decidirAcceso({ ...sesionVerificada, roles: ['ambassador'] }, { capacidad: 'aprobar_pagos_comision' }))
      .toEqual({ permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel })
  })
})

describe('HU-63 · RF-63.8 · el tablero de cobros', () => {
  it('CA-63.10 · el Superadmin y el Administrador entran; el Propietario no accede a ningún tablero', () => {
    for (const capacidad of ['confirmar_pagos_de_propietarios', 'pagar_saldos_de_fracciones'] as const) {
      expect(decidirAcceso({ ...sesionVerificada, roles: ['superadmin'] }, { capacidad })).toEqual({ permitido: true })
      expect(decidirAcceso({ ...sesionVerificada, roles: ['property_admin'] }, { capacidad })).toEqual({ permitido: true })
      for (const roles of [['owner'], ['ambassador'], ['user'], ['owner', 'ambassador']] as const) {
        expect(decidirAcceso({ ...sesionVerificada, roles: [...roles] }, { capacidad }), roles.join('+'))
          .toEqual({ permitido: false, motivo: 'sin_capacidad', redirigirA: RUTAS.panel })
      }
    }
  })
})
