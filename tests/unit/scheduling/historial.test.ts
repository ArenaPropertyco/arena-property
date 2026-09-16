import { describe, expect, it } from 'vitest'
import {
  esFutura,
  estadoHistorico,
  filtrarHistorial,
  filtroDeHistorialVacio,
  historialDeSemanas,
  ordenarHistorial,
  propiedadesDelHistorial,
  semanasPropias,
} from '#shared/scheduling/historial'
import type { SemanaHistorica } from '#shared/scheduling/historial'
import { pesos } from '#shared/money/importe'

/**
 * HU-20 · RF-20.1…RF-20.4 · D-42, D-43 — el historial de semanas del Propietario
 * como funciones puras: solo las de sus fracciones (CA-20.3), filtradas por
 * propiedad y rango (CA-20.1), futuras ascendentes y luego pasadas descendentes
 * (CA-20.2), y cada semana soltada con su destino real (RF-20.4).
 */

function semana(cambios: Partial<SemanaHistorica> & { week: number, startsOn: string }): SemanaHistorica {
  const [anio, mes, dia] = cambios.startsOn.split('-').map(Number) as [number, number, number]
  const salida = new Date(Date.UTC(anio, mes - 1, dia + 7)).toISOString().slice(0, 10)
  return {
    propertyId: 'p1',
    propertyName: 'Casa Arena',
    fraction: 3,
    endsOn: salida,
    season: 'baja',
    confirmedAt: null,
    releasedAt: null,
    releaseReason: null,
    rented: false,
    income: null,
    ...cambios,
  }
}

const HOY = '2027-01-01'

const confirmadaFutura = semana({ week: 5, startsOn: '2027-02-06', confirmedAt: '2026-11-01T10:00:00Z' })
const elegidaFutura = semana({ week: 20, startsOn: '2027-05-22' })
const usadaEnOtraPropiedad = semana({ week: 2, startsOn: '2026-01-16', propertyId: 'p2', propertyName: 'Refugio Salento', fraction: 1, confirmedAt: '2025-10-01T10:00:00Z' })
const liberadaYRentada = semana({ week: 30, startsOn: '2026-08-07', releasedAt: '2026-05-01T10:00:00Z', releaseReason: 'voluntary', rented: true, income: pesos(660_000) })
const ajena = semana({ week: 7, startsOn: '2027-02-20', fraction: 5, confirmedAt: '2026-12-01T10:00:00Z' })
const caducada = semana({ week: 40, startsOn: '2027-10-09', releasedAt: '2027-08-10T10:00:00Z', releaseReason: 'expired' })

const todas = [confirmadaFutura, elegidaFutura, usadaEnOtraPropiedad, liberadaYRentada, ajena, caducada]
const propias = [{ propertyId: 'p1', number: 3 }, { propertyId: 'p2', number: 1 }]

describe('CA-20.3 · las semanas de otro propietario no aparecen', () => {
  it('CA-20.3 · solo quedan las de las fracciones propias, aunque compartan propiedad', () => {
    const resultado = semanasPropias(todas, propias)

    expect(resultado).toHaveLength(5)
    expect(resultado.some(s => s.fraction === 5)).toBe(false)
  })
})

describe('CA-20.1 · filtro por propiedad y rango de fechas', () => {
  it('CA-20.1 · el resultado cumple los dos criterios a la vez', () => {
    const resultado = filtrarHistorial(semanasPropias(todas, propias), { propertyId: 'p1', desde: '2027-02-01', hasta: '2027-06-30' })

    expect(resultado.map(s => s.week).sort((a, b) => a - b)).toEqual([5, 20])
  })

  it('RF-20.2 · cada criterio funciona solo, y el filtro vacío no quita nada', () => {
    const mias = semanasPropias(todas, propias)

    expect(filtrarHistorial(mias, { ...filtroDeHistorialVacio(), propertyId: 'p2' }).map(s => s.week)).toEqual([2])
    expect(filtrarHistorial(mias, { ...filtroDeHistorialVacio(), desde: '2027-06-01' }).map(s => s.week)).toEqual([40])
    expect(filtrarHistorial(mias, { ...filtroDeHistorialVacio(), hasta: '2026-12-31' }).map(s => s.week).sort((a, b) => a - b)).toEqual([2, 30])
    expect(filtrarHistorial(mias, filtroDeHistorialVacio())).toHaveLength(5)
  })
})

describe('CA-20.2 · orden cronológico: futuras primero', () => {
  it('CA-20.2 · las futuras van ascendentes y después las pasadas descendentes', () => {
    const orden = ordenarHistorial(semanasPropias(todas, propias), HOY)

    expect(orden.map(s => s.week)).toEqual([5, 20, 40, 30, 2])
    expect(esFutura(confirmadaFutura, HOY)).toBe(true)
    expect(esFutura(liberadaYRentada, HOY)).toBe(false)
  })

  it('RF-20.2 · la semana que entra hoy todavía es futura', () => {
    expect(esFutura(semana({ week: 1, startsOn: HOY }), HOY)).toBe(true)
  })
})

describe('RF-20.1 · RF-20.4 · el estado real de cada semana', () => {
  it('RF-20.1 · elegida, confirmada, usada, cancelada, liberada y caducada se distinguen', () => {
    expect(estadoHistorico(elegidaFutura, HOY)).toBe('elected')
    expect(estadoHistorico(confirmadaFutura, HOY)).toBe('confirmed')
    expect(estadoHistorico(usadaEnOtraPropiedad, HOY)).toBe('used')
    expect(estadoHistorico(semana({ week: 9, startsOn: '2027-03-06', releasedAt: '2027-01-01T10:00:00Z', releaseReason: 'cancelled' }), HOY)).toBe('cancelled')
    expect(estadoHistorico(semana({ week: 9, startsOn: '2027-03-06', releasedAt: '2027-01-01T10:00:00Z', releaseReason: 'voluntary' }), HOY)).toBe('released')
    expect(estadoHistorico(caducada, HOY)).toBe('expired')
  })

  it('RF-20.4 · D-43 · la liberada que ya tiene tercero figura como rentada, con el ingreso de la fracción', () => {
    expect(estadoHistorico(liberadaYRentada, HOY)).toBe('rented')
    expect(liberadaYRentada.income).toBe(660_000)
  })

  it('RF-20.4 · sin renta no hay importe que mostrar', () => {
    const enBolsa = semana({ week: 9, startsOn: '2027-03-06', releasedAt: '2027-01-01T10:00:00Z', releaseReason: 'voluntary' })

    expect(enBolsa.rented).toBe(false)
    expect(enBolsa.income).toBeNull()
  })
})

describe('RF-20.3 · el historial completo', () => {
  it('compone propias → filtro → orden en una sola llamada', () => {
    const historial = historialDeSemanas(todas, propias, { ...filtroDeHistorialVacio(), propertyId: 'p1' }, HOY)

    expect(historial.map(s => s.week)).toEqual([5, 20, 40, 30])
  })

  it('las propiedades del historial salen sin repetir y por nombre', () => {
    expect(propiedadesDelHistorial(semanasPropias(todas, propias))).toEqual([
      { id: 'p1', name: 'Casa Arena' },
      { id: 'p2', name: 'Refugio Salento' },
    ])
  })
})
