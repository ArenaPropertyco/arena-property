import { describe, expect, it } from 'vitest'
import { columnaDesdeLunes, mesesDelAlmanaque } from '#shared/scheduling/almanaque'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionBase } from '#shared/scheduling/temporadas'
import { projectWeeks } from '#shared/scheduling/week-projection'

/**
 * HU-13 · RF-13.2 · RT-06 · D-42 — el almanaque reparte los días del año en doce
 * meses alineados en lunes y cada día sabe en qué semana de la rejilla cae.
 */

const rejilla = rejillaDelAnio(2027)
const cells = projectWeeks({
  today: '2026-10-01',
  ownFraction: 3,
  calendarActive: true,
  rejilla,
  classification: clasificacionBase(rejilla).map(s => ({ ...s, temporada: 'baja' as const })),
  allocations: [],
  blocks: [],
  selectionComplete: true,
  coOwners: [],
}).cells

describe('mesesDelAlmanaque', () => {
  it('devuelve los doce meses con sus días y los huecos que alinean el día 1 en lunes', () => {
    const meses = mesesDelAlmanaque(2027, cells)
    expect(meses).toHaveLength(12)
    expect(meses.map(m => m.dias.length)).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
    // El 1 de enero de 2027 es viernes: cuatro huecos (L, M, X, J).
    expect(meses[0]!.clave).toBe('2027-01')
    expect(meses[0]!.huecos).toBe(4)
    expect(columnaDesdeLunes('2027-01-04')).toBe(0)
    expect(columnaDesdeLunes('2027-01-03')).toBe(6)
  })

  it('cuenta el 29 de febrero en año bisiesto', () => {
    expect(mesesDelAlmanaque(2028, [])[1]!.dias).toHaveLength(29)
  })

  it('D-42 · las noches anteriores al primer sábado no pertenecen a ninguna semana; el sábado de salida ya es de la siguiente', () => {
    const enero = mesesDelAlmanaque(2027, cells)[0]!
    // El primer sábado de 2027 es el 2 de enero.
    expect(enero.dias[0]!.semana).toBeNull()
    expect(enero.dias[1]!.semana).toBe(0)
    expect(enero.dias[7]!.semana).toBe(0)
    expect(enero.dias[8]!.semana).toBe(1)
    // 2027 cierra en viernes: la última semana (25–31 de diciembre) cabe entera.
    const diciembre = mesesDelAlmanaque(2027, cells)[11]!
    expect(diciembre.dias[30]!.semana).toBe(rejilla.length - 1)
    expect(diciembre.dias[23]!.semana).toBe(rejilla.length - 2)
  })
})
