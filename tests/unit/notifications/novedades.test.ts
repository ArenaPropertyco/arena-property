import { describe, expect, it } from 'vitest'
import { destinatariosDePropiedad } from '#shared/notifications/destinatarios'
import {
  cambiarVisibilidad,
  colorDeUrgencia,
  destinatariosDeNovedad,
  estadoDeNovedad,
  filtrarNovedades,
  filtroDeNovedadesVacio,
  novedadesAbiertas,
  ordenarNovedades,
  resolverNovedad,
  URGENCIAS,
  validarNovedad,
  visibleParaPropietarios,
} from '#shared/notifications/novedades'
import type { FraccionDestinataria, Novedad, NuevaNovedad } from '#shared/notifications/novedades'

/**
 * HU-29 · RF-29.1…RF-29.4 · HU-30 · RF-30.3 — la novedad como funciones puras:
 * validación del aviso, destinatarios de la propiedad, estado abierta/resuelta,
 * semántica de color de la urgencia y el historial filtrado. Sin base de datos.
 */

function nueva(cambios: Partial<NuevaNovedad> = {}): NuevaNovedad {
  return { propertyId: 'p1', fractionId: null, title: 'Corte de agua', body: 'El martes de 8 a 12.', urgency: 'important', active: true, ...cambios }
}

function novedad(cambios: Partial<Novedad> & { id: string }): Novedad {
  return {
    ...nueva(),
    propertyName: 'Casa Arena',
    fractionNumber: null,
    createdAt: '2026-09-20T10:00:00Z',
    createdByLabel: 'Ana',
    resolvedAt: null,
    status: 'open',
    ...cambios,
  }
}

describe('CA-29.2 · validación del aviso', () => {
  it('CA-29.2 · un aviso sin título se rechaza en su campo', () => {
    expect(validarNovedad(nueva({ title: '   ' }))).toEqual([{ name: 'title', message: 'announcements.validation.title_required' }])
  })

  it('CA-29.2 · un aviso sin urgencia se rechaza, y una urgencia fuera del catálogo también', () => {
    expect(validarNovedad(nueva({ urgency: '' as never }))).toEqual([{ name: 'urgency', message: 'announcements.validation.urgency_required' }])
    expect(validarNovedad(nueva({ urgency: 'critical' as never }))).toEqual([{ name: 'urgency', message: 'announcements.validation.urgency_required' }])
  })

  it('RF-29.1 · exige propiedad y descripción, y acota el largo del título y del cuerpo', () => {
    expect(validarNovedad(nueva({ propertyId: '' })).map(e => e.message)).toEqual(['announcements.validation.property_required'])
    expect(validarNovedad(nueva({ body: '' })).map(e => e.message)).toEqual(['announcements.validation.body_required'])
    expect(validarNovedad(nueva({ title: 'x'.repeat(121) })).map(e => e.message)).toEqual(['announcements.validation.title_too_long'])
    expect(validarNovedad(nueva({ body: 'x'.repeat(2001) })).map(e => e.message)).toEqual(['announcements.validation.body_too_long'])
  })

  it('RF-29.1 · un aviso completo no tiene errores, con cualquiera de las tres urgencias', () => {
    for (const urgency of URGENCIAS) {
      expect(validarNovedad(nueva({ urgency }))).toEqual([])
    }
  })
})

describe('CA-29.1 · destinatarios de la novedad', () => {
  it('CA-29.1 · una propiedad con 5 propietarios de 8 fracciones, uno con 2, produce exactamente esos 5 sin duplicados', () => {
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

    expect(destinatariosDePropiedad(fracciones)).toEqual(['ana', 'luis', 'marta', 'pedro', 'sofia'])
  })
})

describe('CA-29.4 · RF-29.5 · D-46 · novedad dirigida a una fracción', () => {
  const fracciones: FraccionDestinataria[] = [
    { id: 'f1', propertyId: 'p1', number: 1, ownerId: 'ana', ownerLabel: 'Ana' },
    { id: 'f2', propertyId: 'p1', number: 2, ownerId: 'ana', ownerLabel: 'Ana' },
    { id: 'f3', propertyId: 'p1', number: 3, ownerId: 'luis', ownerLabel: 'Luis' },
    { id: 'f4', propertyId: 'p1', number: 4, ownerId: null, ownerLabel: null },
    { id: 'g1', propertyId: 'p2', number: 1, ownerId: 'marta', ownerLabel: 'Marta' },
  ]

  it('CA-29.4 · dirigida a la fracción 3/8, el único destinatario es su titular', () => {
    expect(destinatariosDeNovedad({ propertyId: 'p1', fractionId: 'f3' }, fracciones)).toEqual(['luis'])
  })

  it('CA-29.4 · dirigida a toda la propiedad, van todos los titulares una vez cada uno', () => {
    expect(destinatariosDeNovedad({ propertyId: 'p1', fractionId: null }, fracciones)).toEqual(['ana', 'luis'])
  })

  it('RF-29.5 · una fracción sin titular, de otra propiedad o desconocida no tiene a quién', () => {
    expect(destinatariosDeNovedad({ propertyId: 'p1', fractionId: 'f4' }, fracciones)).toEqual([])
    expect(destinatariosDeNovedad({ propertyId: 'p1', fractionId: 'g1' }, fracciones)).toEqual([])
    expect(destinatariosDeNovedad({ propertyId: 'p1', fractionId: 'zz' }, fracciones)).toEqual([])
  })

  it('RF-29.5 · la validación rechaza una fracción que no sea de la propiedad', () => {
    expect(validarNovedad(nueva({ fractionId: 'g1' }), fracciones)).toEqual([{ name: 'fractionId', message: 'announcements.validation.fraction_not_in_property' }])
    expect(validarNovedad(nueva({ fractionId: 'f3' }), fracciones)).toEqual([])
    expect(validarNovedad(nueva({ fractionId: 'f3' }))).toEqual([])
  })
})

describe('CA-29.5 · RF-29.6 · D-46 · estado activa/inactiva', () => {
  it('CA-29.5 · una novedad inactiva no es visible para los propietarios', () => {
    expect(visibleParaPropietarios(novedad({ id: 'a', active: false }))).toBe(false)
    expect(visibleParaPropietarios(novedad({ id: 'b' }))).toBe(true)
  })

  it('RF-29.6 · el interruptor cambia solo el estado y no toca lo demás', () => {
    const activa = novedad({ id: 'a' })
    const inactiva = cambiarVisibilidad(activa, false)

    expect(inactiva).toMatchObject({ id: 'a', active: false, title: 'Corte de agua', status: 'open' })
    expect(activa.active).toBe(true)
    expect(cambiarVisibilidad(activa, true)).toBe(activa)
  })
})

describe('RF-29.4 · RT-07 · semántica de color de la urgencia', () => {
  it('RF-29.4 · el rojo (error) se usa solo para urgente', () => {
    expect(colorDeUrgencia('urgent')).toBe('error')
    expect(colorDeUrgencia('important')).not.toBe('error')
    expect(colorDeUrgencia('informative')).not.toBe('error')
  })

  it('RF-29.4 · cada urgencia tiene un color propio y ninguno es un color suelto', () => {
    const colores = URGENCIAS.map(colorDeUrgencia)
    expect(new Set(colores).size).toBe(URGENCIAS.length)
    for (const color of colores) {
      expect(['neutral', 'warning', 'error']).toContain(color)
    }
  })
})

describe('RF-29.3 · estado abierta/resuelta y su historial', () => {
  const abiertaUrgente = novedad({ id: 'a', urgency: 'urgent', createdAt: '2026-09-18T10:00:00Z' })
  const abiertaInformativa = novedad({ id: 'b', urgency: 'informative', createdAt: '2026-09-20T10:00:00Z' })
  const resuelta = novedad({ id: 'c', propertyId: 'p2', propertyName: 'Invictvs', resolvedAt: '2026-09-19T10:00:00Z', status: 'resolved', createdAt: '2026-09-21T10:00:00Z' })
  const historial = [resuelta, abiertaInformativa, abiertaUrgente]

  it('RF-29.3 · el estado se deriva de la fecha de resolución y nunca se guarda aparte', () => {
    expect(estadoDeNovedad({ resolvedAt: null })).toBe('open')
    expect(estadoDeNovedad({ resolvedAt: '2026-09-19T10:00:00Z' })).toBe('resolved')
  })

  it('RF-29.3 · resolver deja fecha y estado, y una resuelta no cambia de fecha', () => {
    const resueltaAhora = resolverNovedad(abiertaUrgente, '2026-09-22T10:00:00Z')
    expect(resueltaAhora).toMatchObject({ resolvedAt: '2026-09-22T10:00:00Z', status: 'resolved' })
    expect(resolverNovedad(resuelta, '2026-09-22T10:00:00Z').resolvedAt).toBe('2026-09-19T10:00:00Z')
    expect(abiertaUrgente.resolvedAt).toBeNull()
  })

  it('RF-29.3 · las abiertas son las que alimentan las alertas del tablero (HU-21)', () => {
    expect(novedadesAbiertas(historial).map(n => n.id)).toEqual(['b', 'a'])
  })

  it('RF-29.4 · el orden pone primero lo abierto y, dentro, lo más urgente y lo más reciente', () => {
    expect(ordenarNovedades(historial).map(n => n.id)).toEqual(['a', 'b', 'c'])
  })

  it('RF-30.3 · el filtro por propiedad y por estado se combinan', () => {
    expect(filtrarNovedades(historial, { ...filtroDeNovedadesVacio(), propertyId: 'p2' }).map(n => n.id)).toEqual(['c'])
    expect(filtrarNovedades(historial, { ...filtroDeNovedadesVacio(), status: 'open' }).map(n => n.id)).toEqual(['b', 'a'])
    expect(filtrarNovedades(historial, { propertyId: 'p1', status: 'resolved' })).toEqual([])
    expect(filtrarNovedades(historial, filtroDeNovedadesVacio())).toHaveLength(3)
  })
})
