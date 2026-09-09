import { describe, expect, it } from 'vitest'
import {
  destinatariosDeEmbajador,
  destinatariosDeFraccion,
  destinatariosDePropiedad,
  destinatariosDeSegmento,
  resolverDestinatarios,
} from '#shared/notifications/destinatarios'

/**
 * TR-03 · RF-N.3 — resolución de destinatarios como función pura, una por tipo
 * de evento. Sin base de datos: reciben los hechos y devuelven cuentas.
 */

const fracciones = [
  { id: 'f1', ownerId: 'ana' },
  { id: 'f2', ownerId: 'ana' },
  { id: 'f3', ownerId: 'luis' },
  { id: 'f4', ownerId: 'marta' },
  { id: 'f5', ownerId: 'pedro' },
  { id: 'f6', ownerId: 'sofia' },
  { id: 'f7', ownerId: null },
  { id: 'f8', ownerId: null },
]

describe('CA-N.1 · evento de fracción propia', () => {
  it('CA-N.1 · el conjunto de destinatarios es exactamente el propietario de esa fracción', () => {
    expect(destinatariosDeFraccion({ id: 'f3', ownerId: 'luis' })).toEqual(['luis'])
  })

  it('CA-16.2 · una fracción sin titular no notifica a nadie', () => {
    expect(destinatariosDeFraccion({ id: 'f7', ownerId: null })).toEqual([])
  })
})

describe('CA-N.2 · novedad de propiedad', () => {
  it('CA-N.2 · 5 propietarios, uno con 2 fracciones → 5 destinatarios sin duplicados', () => {
    const destinatarios = destinatariosDePropiedad(fracciones)

    expect(destinatarios).toHaveLength(5)
    expect(new Set(destinatarios).size).toBe(5)
    expect(destinatarios).toEqual(['ana', 'luis', 'marta', 'pedro', 'sofia'])
  })
})

describe('RF-N.3 · segmento de comunicado (HU-31) y embajador (HU-54, HU-57)', () => {
  const cuentas = [
    { id: 'a', roles: ['owner'] as const, status: 'active' as const },
    { id: 'b', roles: ['property_admin'] as const, status: 'active' as const },
    { id: 'c', roles: ['ambassador', 'user'] as const, status: 'active' as const },
    { id: 'd', roles: ['owner', 'ambassador'] as const, status: 'active' as const },
    { id: 'e', roles: ['owner'] as const, status: 'suspended' as const },
  ]

  it('el segmento de propietarios excluye a los suspendidos y no repite cuentas', () => {
    expect(destinatariosDeSegmento(cuentas, 'owners')).toEqual(['a', 'd'])
    expect(destinatariosDeSegmento(cuentas, 'ambassadors')).toEqual(['c', 'd'])
    expect(destinatariosDeSegmento(cuentas, 'property_admins')).toEqual(['b'])
    expect(destinatariosDeSegmento(cuentas, 'all')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('RF-57.2 · el embajador dueño del referido es el único destinatario', () => {
    expect(destinatariosDeEmbajador({ ambassadorId: 'c' })).toEqual(['c'])
    expect(destinatariosDeEmbajador({ ambassadorId: null })).toEqual([])
  })

  it('el despachador elige el resolutor por el alcance del tipo de evento', () => {
    expect(resolverDestinatarios({ kind: 'calendar_activated', entityType: 'payment_plan', entityId: 'p1', propertyId: 'x', payload: {} }, { fraccion: { id: 'f3', ownerId: 'luis' } }))
      .toEqual(['luis'])
    expect(resolverDestinatarios({ kind: 'announcement_published', entityType: 'announcement', entityId: 'n1', propertyId: 'x', payload: {} }, { fracciones }))
      .toHaveLength(5)
    expect(resolverDestinatarios({ kind: 'referral_paid', entityType: 'commission', entityId: 'c1', propertyId: null, payload: {} }, { atribucion: { ambassadorId: 'c' } }))
      .toEqual(['c'])
    expect(resolverDestinatarios({ kind: 'broadcast', entityType: 'broadcast', entityId: 'b1', propertyId: null, payload: {} }, { cuentas, segmento: 'owners' }))
      .toEqual(['a', 'd'])
  })

  it('sin el contexto que su alcance exige, no hay destinatarios: mejor nada que a todos', () => {
    expect(resolverDestinatarios({ kind: 'calendar_activated', entityType: 'payment_plan', entityId: 'p1', propertyId: 'x', payload: {} }, {}))
      .toEqual([])
  })
})
