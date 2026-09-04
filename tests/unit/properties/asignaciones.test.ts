import { describe, expect, it } from 'vitest'
import {
  CLAVES_DE_VALIDACION_DE_ASIGNACION,
  cambiosDeAsignacion,
  cuentasPromovibles,
  filtrarCuentas,
  hayCambios,
  validarAsignacion,
} from '#shared/properties/asignaciones'

/**
 * HU-05 · RF-05.1 y RF-05.2 — qué administradores gestionan una propiedad.
 *
 * El Superadmin edita la lista completa desde la ficha; de ahí sale el cambio
 * mínimo que hay que aplicar. «Mínimo» no es una optimización: retirar y volver a
 * otorgar una asignación que no cambió inventaría un retiro que nunca ocurrió, y el
 * histórico de RF-05.2 dejaría de contar la verdad (principio 9).
 */

const ANA = 'b0000000-0000-4000-8000-00000000000a'
const LUIS = 'b0000000-0000-4000-8000-00000000000b'
const SOFIA = 'b0000000-0000-4000-8000-00000000000c'

describe('RF-05.2 · cambio mínimo de asignaciones', () => {
  it('otorga las que faltan', () => {
    expect(cambiosDeAsignacion([], [ANA, LUIS])).toEqual({ otorgar: [ANA, LUIS], retirar: [] })
  })

  it('retira las que ya no están en la lista', () => {
    expect(cambiosDeAsignacion([ANA, LUIS], [ANA])).toEqual({ otorgar: [], retirar: [LUIS] })
  })

  it('otorga y retira en la misma operación', () => {
    expect(cambiosDeAsignacion([ANA, LUIS], [LUIS, SOFIA]))
      .toEqual({ otorgar: [SOFIA], retirar: [ANA] })
  })

  /**
   * La prueba que de verdad protege el histórico: guardar la ficha sin tocar los
   * administradores no puede producir ni un retiro ni un alta.
   */
  it('RF-05.2 · una lista idéntica no toca nada, aunque llegue en otro orden', () => {
    const cambio = cambiosDeAsignacion([ANA, LUIS], [LUIS, ANA])

    expect(cambio).toEqual({ otorgar: [], retirar: [] })
    expect(hayCambios(cambio)).toBe(false)
  })

  it('quitarlos a todos es un retiro de todos, no un borrado', () => {
    expect(cambiosDeAsignacion([ANA, LUIS], [])).toEqual({ otorgar: [], retirar: [ANA, LUIS] })
  })

  it('ignora repeticiones y entradas vacías de la lista deseada', () => {
    expect(cambiosDeAsignacion([], [ANA, ANA, '  ', '', LUIS]))
      .toEqual({ otorgar: [ANA, LUIS], retirar: [] })
  })

  it('no altera las listas que recibe', () => {
    const actuales = [ANA, LUIS]
    const deseados = [LUIS]
    cambiosDeAsignacion(actuales, deseados)

    expect(actuales).toEqual([ANA, LUIS])
    expect(deseados).toEqual([LUIS])
  })

  it('un cambio con algo que hacer se reconoce como tal', () => {
    expect(hayCambios({ otorgar: [ANA], retirar: [] })).toBe(true)
    expect(hayCambios({ otorgar: [], retirar: [ANA] })).toBe(true)
    expect(hayCambios({ otorgar: [], retirar: [] })).toBe(false)
  })
})

describe('CA-05.1 · validación de la asignación', () => {
  const candidatos = [ANA, LUIS]

  it('una lista de administradores reales, hecha por el Superadmin, no produce errores', () => {
    expect(validarAsignacion([ANA], candidatos, { esSuperadmin: true })).toEqual([])
  })

  it('CA-05.1 · quien no es Superadmin no asigna propiedades', () => {
    expect(validarAsignacion([ANA], candidatos, { esSuperadmin: false }).map(e => e.name))
      .toEqual(['actor'])
  })

  it('CA-05.1 · no se asigna una propiedad a una cuenta sin rol Administrador', () => {
    expect(validarAsignacion([SOFIA], candidatos, { esSuperadmin: true }).map(e => e.name))
      .toEqual(['administradores'])
  })

  it('RF-05.1 · una propiedad admite más de un administrador', () => {
    expect(validarAsignacion([ANA, LUIS], candidatos, { esSuperadmin: true })).toEqual([])
  })

  it('RF-05.2 · dejar la lista vacía es válido: retirar a todos es una operación legítima', () => {
    expect(validarAsignacion([], candidatos, { esSuperadmin: true })).toEqual([])
  })

  it('toda clave de validación pertenece al catálogo cerrado', () => {
    const claves = validarAsignacion([SOFIA], candidatos, { esSuperadmin: false }).map(e => e.message)

    expect(claves.every(clave => CLAVES_DE_VALIDACION_DE_ASIGNACION.includes(clave))).toBe(true)
  })
})

describe('RF-05.1 · alta de Administrador desde una cuenta existente', () => {
  const cuentas = [
    { id: 'u1', email: 'ana@ejemplo.com', fullName: 'Ana Pérez', status: 'active' as const, roles: ['user' as const] },
    { id: 'u2', email: 'luis@ejemplo.com', fullName: null, status: 'active' as const, roles: ['user' as const, 'property_admin' as const] },
    { id: 'u3', email: 'sofia@ejemplo.com', fullName: 'Sofía', status: 'active' as const, roles: ['ambassador' as const] },
    { id: 'u4', email: 'raul@ejemplo.com', fullName: 'Raúl', status: 'suspended' as const, roles: ['user' as const] },
    { id: 'u5', email: 'super@arena.co', fullName: 'Super', status: 'active' as const, roles: ['superadmin' as const] },
  ]

  it('CA-05.1 · solo son promovibles las cuentas activas que aún no son Administrador', () => {
    expect(cuentasPromovibles(cuentas).map(c => c.id)).toEqual(['u1', 'u5'])
  })

  it('RF-07.1 · un Embajador no se convierte en Administrador: la combinación no está permitida', () => {
    expect(cuentasPromovibles(cuentas).some(c => c.id === 'u3')).toBe(false)
  })

  it('busca por nombre o correo, sin acentos ni mayúsculas', () => {
    expect(filtrarCuentas(cuentas, 'PEREZ').map(c => c.id)).toEqual(['u1'])
    expect(filtrarCuentas(cuentas, 'ejemplo').map(c => c.id)).toEqual(['u1', 'u2', 'u3', 'u4'])
    expect(filtrarCuentas(cuentas, 'sofia').map(c => c.id)).toEqual(['u3'])
    expect(filtrarCuentas(cuentas, '   ').length).toBe(5)
  })
})
