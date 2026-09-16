import { describe, expect, it } from 'vitest'
import { formatearPorcentaje } from '#shared/money/formato'
import { porcentajeVendido, proximasReservas, resumenDePropiedad, resumenesDelTablero } from '#shared/properties/tablero'
import type { PropiedadResumible, ReservaProxima } from '#shared/properties/tablero'

/**
 * HU-21 · RF-21.1, RF-21.2, RF-21.3 · TR-02 RF-D.5 — los indicadores del tablero
 * del Administrador son funciones puras: porcentaje vendido en puntos básicos,
 * próximas reservas solo futuras y ordenadas, y un resumen por propiedad
 * administrada, ni una más.
 */

function propiedad(cambios: Partial<PropiedadResumible> & { id: string }): PropiedadResumible {
  return { name: `Casa ${cambios.id}`, adminIds: [], fractionCount: 8, soldFractions: 0, ...cambios }
}

function reserva(cambios: Partial<ReservaProxima> & { startsOn: string }): ReservaProxima {
  return { propertyId: 'p1', fraction: 1, week: 10, endsOn: cambios.startsOn, ...cambios }
}

describe('CA-21.1 · porcentaje de fracciones vendidas', () => {
  it('CA-21.1 · 3 de 8 vendidas se muestra como «37,5 %» en español y «37.5%» en inglés', () => {
    const puntos = porcentajeVendido(3)

    expect(puntos).toBe(3750)
    expect(formatearPorcentaje(puntos, 'es')).toBe('37,5 %')
    expect(formatearPorcentaje(puntos, 'en')).toBe('37.5%')
  })

  it('RF-21.2 · el total por defecto son las 8 fracciones y una propiedad sin fraccionar vale 0', () => {
    expect(porcentajeVendido(8)).toBe(10000)
    expect(porcentajeVendido(0)).toBe(0)
    expect(porcentajeVendido(0, 0)).toBe(0)
  })
})

describe('CA-21.2 · próximas reservas', () => {
  const reservas = [
    reserva({ startsOn: '2027-09-04', week: 35 }),
    reserva({ startsOn: '2027-03-06', week: 9 }),
    reserva({ startsOn: '2027-01-02', week: 0 }),
    reserva({ startsOn: '2027-06-05', week: 22 }),
    reserva({ startsOn: '2027-05-01', week: 17 }),
  ]

  it('CA-21.2 · contiene solo las futuras, en orden ascendente', () => {
    const proximas = proximasReservas(reservas, '2027-04-01')

    expect(proximas.map(r => r.week)).toEqual([17, 22, 35])
  })

  it('CA-21.2 · la que entra hoy todavía cuenta, y el tope las recorta por cercanía', () => {
    expect(proximasReservas(reservas, '2027-03-06', 2).map(r => r.week)).toEqual([9, 17])
  })

  it('RF-21.1 · sin reservas futuras la lista queda vacía', () => {
    expect(proximasReservas(reservas, '2028-01-01')).toEqual([])
  })
})

describe('CA-21.3 · el tablero arma un resumen por propiedad administrada', () => {
  const propiedades = [
    propiedad({ id: 'p1', adminIds: ['ana'], soldFractions: 3 }),
    propiedad({ id: 'p2', adminIds: ['luis'] }),
    propiedad({ id: 'p3', adminIds: ['ana', 'luis'], soldFractions: 8 }),
    propiedad({ id: 'p4', adminIds: [] }),
    propiedad({ id: 'p5', adminIds: ['luis'] }),
  ]
  const contexto = {
    reservas: [reserva({ propertyId: 'p1', startsOn: '2027-05-01' }), reserva({ propertyId: 'p3', startsOn: '2027-01-01' })],
    conflictos: [{ propertyId: 'p1' }, { propertyId: 'p1' }, { propertyId: 'p2' }],
    solicitudes: [{ propertyId: 'p3' }],
    porColocar: [{ propertyId: 'p1' }],
    hoy: '2027-04-01',
  }

  it('CA-21.3 · un Administrador con 2 propiedades asignadas de 5 existentes obtiene exactamente 2 resúmenes', () => {
    const resumenes = resumenesDelTablero(propiedades, { id: 'ana', esSuperadmin: false }, contexto)

    expect(resumenes.map(r => r.id)).toEqual(['p1', 'p3'])
  })

  it('RF-21.3 · el Superadmin obtiene las 5, incluida la que no tiene Administrador', () => {
    expect(resumenesDelTablero(propiedades, { id: 'root', esSuperadmin: true }, contexto)).toHaveLength(5)
  })

  it('RF-21.1 · cada resumen trae el porcentaje, las próximas reservas y las alertas de su propiedad', () => {
    const [p1, p3] = resumenesDelTablero(propiedades, { id: 'ana', esSuperadmin: false }, contexto)

    expect(p1).toMatchObject({ soldFractions: 3, soldShare: 3750, alerts: { conflicts: 2, swapRequests: 0, weeksToPlace: 1 }, alertCount: 3 })
    expect(p1?.upcoming.map(r => r.startsOn)).toEqual(['2027-05-01'])
    expect(p3).toMatchObject({ soldShare: 10000, alerts: { conflicts: 0, swapRequests: 1, weeksToPlace: 0 }, alertCount: 1 })
    expect(p3?.upcoming).toEqual([])
  })

  it('RF-21.1 · el resumen de una propiedad recorta las próximas reservas al tope pedido', () => {
    const reservas = ['2027-05-01', '2027-05-08', '2027-05-15', '2027-05-22'].map(startsOn => reserva({ startsOn }))
    const resumen = resumenDePropiedad(propiedad({ id: 'p1' }), { reservas, alertas: { conflicts: 0, swapRequests: 0, weeksToPlace: 0 }, hoy: '2027-04-01', proximas: 2 })

    expect(resumen.upcoming).toHaveLength(2)
    expect(resumen.alertCount).toBe(0)
  })
})
