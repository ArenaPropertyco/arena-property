import { describe, expect, it } from 'vitest'
import { ROLES_SEGMENTABLES, validarComunicado } from '#shared/notifications/comunicados'
import type { NuevoComunicado } from '#shared/notifications/comunicados'
import { destinatariosDeComunicado, resolverDestinatarios } from '#shared/notifications/destinatarios'
import type { CuentaConRoles } from '#shared/notifications/destinatarios'

/**
 * HU-31 · RF-31.1, RF-31.2 — el comunicado global y su segmento como funciones
 * puras: validación y resolución de destinatarios sobre roles y vínculos, sin
 * duplicados cuando una cuenta cumple varios criterios. Sin base de datos.
 */

const cuentas: CuentaConRoles[] = [
  { id: 'ana', roles: ['owner'], status: 'active' },
  { id: 'luis', roles: ['owner'], status: 'active' },
  { id: 'admin', roles: ['property_admin'], status: 'active' },
  { id: 'otroadmin', roles: ['property_admin'], status: 'active' },
  { id: 'emba', roles: ['ambassador', 'user'], status: 'active' },
  { id: 'dual', roles: ['owner', 'ambassador'], status: 'active' },
  { id: 'root', roles: ['superadmin'], status: 'active' },
  { id: 'nadie', roles: ['user'], status: 'active' },
  { id: 'suspendida', roles: ['owner'], status: 'suspended' },
]

/** La propiedad P: sus titulares y su Administrador asignado. */
const vinculosDeP = { ownerIds: ['ana', 'dual', 'ana', 'suspendida'], adminIds: ['admin'] }

function comunicado(cambios: Partial<NuevoComunicado> = {}): NuevoComunicado {
  return { title: 'Cierre de fin de año', body: 'Las oficinas cierran del 24 al 2.', segment: { kind: 'all' }, ...cambios }
}

describe('CA-31.1 · segmento por rol', () => {
  it('CA-31.1 · «rol Propietario» alcanza a todas las cuentas con ese rol y a ninguna más', () => {
    expect(destinatariosDeComunicado({ kind: 'roles', roles: ['owner'] }, cuentas)).toEqual(['ana', 'luis', 'dual'])
  })

  it('RF-31.2 · una cuenta suspendida no recibe comunicados aunque tenga el rol', () => {
    expect(destinatariosDeComunicado({ kind: 'roles', roles: ['owner'] }, cuentas)).not.toContain('suspendida')
  })
})

describe('CA-31.2 · segmento por propiedad', () => {
  it('CA-31.2 · «propiedad P» alcanza a los propietarios de P y a su administrador, sin repetir a quien tiene dos fracciones', () => {
    expect(destinatariosDeComunicado({ kind: 'property', propertyId: 'p1' }, cuentas, vinculosDeP)).toEqual(['ana', 'dual', 'admin'])
  })

  it('RF-31.2 · sin los vínculos de la propiedad no hay a quién mandar: mejor nadie que todos', () => {
    expect(destinatariosDeComunicado({ kind: 'property', propertyId: 'p1' }, cuentas)).toEqual([])
  })
})

describe('CA-31.3 · una cuenta con varios roles recibe una sola vez', () => {
  it('CA-31.3 · Propietario+Embajador con segmento «Propietarios y Embajadores» aparece una sola vez', () => {
    const destinatarios = destinatariosDeComunicado({ kind: 'roles', roles: ['owner', 'ambassador'] }, cuentas)

    expect(destinatarios.filter(id => id === 'dual')).toHaveLength(1)
    expect(destinatarios).toEqual(['ana', 'luis', 'emba', 'dual'])
  })

  it('RF-31.1 · «todos» es toda cuenta activa, incluida la que no tiene rol operativo', () => {
    expect(destinatariosDeComunicado({ kind: 'all' }, cuentas)).toEqual(['ana', 'luis', 'admin', 'otroadmin', 'emba', 'dual', 'root', 'nadie'])
  })

  it('RF-N.3 · el despachador resuelve un comunicado por su segmento', () => {
    const evento = { kind: 'broadcast' as const, entityType: 'broadcast', entityId: 'b1', propertyId: null, payload: {} }

    expect(resolverDestinatarios(evento, { cuentas, comunicado: { kind: 'roles', roles: ['property_admin'] } })).toEqual(['admin', 'otroadmin'])
    expect(resolverDestinatarios(evento, { cuentas, comunicado: { kind: 'property', propertyId: 'p1' }, vinculos: vinculosDeP })).toEqual(['ana', 'dual', 'admin'])
  })
})

describe('RF-31.1 · validación del comunicado', () => {
  it('RF-31.1 · exige título y cuerpo, con largo acotado', () => {
    expect(validarComunicado(comunicado({ title: ' ' })).map(e => e.message)).toEqual(['broadcasts.validation.title_required'])
    expect(validarComunicado(comunicado({ body: '' })).map(e => e.message)).toEqual(['broadcasts.validation.body_required'])
    expect(validarComunicado(comunicado({ title: 'x'.repeat(121) })).map(e => e.message)).toEqual(['broadcasts.validation.title_too_long'])
    expect(validarComunicado(comunicado({ body: 'x'.repeat(4001) })).map(e => e.message)).toEqual(['broadcasts.validation.body_too_long'])
  })

  it('RF-31.1 · un segmento por rol necesita al menos un rol del catálogo; uno por propiedad, la propiedad', () => {
    expect(validarComunicado(comunicado({ segment: { kind: 'roles', roles: [] } })).map(e => e.message)).toEqual(['broadcasts.validation.roles_required'])
    expect(validarComunicado(comunicado({ segment: { kind: 'roles', roles: ['superadmin' as never] } })).map(e => e.message)).toEqual(['broadcasts.validation.roles_required'])
    expect(validarComunicado(comunicado({ segment: { kind: 'property', propertyId: '' } })).map(e => e.message)).toEqual(['broadcasts.validation.property_required'])
  })

  it('RF-31.1 · los roles segmentables son Administrador, Propietario y Embajador', () => {
    expect([...ROLES_SEGMENTABLES]).toEqual(['property_admin', 'owner', 'ambassador'])
    expect(validarComunicado(comunicado({ segment: { kind: 'roles', roles: ['owner', 'ambassador'] } }))).toEqual([])
    expect(validarComunicado(comunicado({ segment: { kind: 'property', propertyId: 'p1' } }))).toEqual([])
  })
})
