import { describe, expect, it } from 'vitest'
import { bolsaDeRenta, semanasPorColocar } from '#shared/scheduling/bolsa'
import type { SemanaCandidata } from '#shared/scheduling/bolsa'

/**
 * HU-17 · RF-17.5 · HU-39 · RF-39.6 · HU-21 · RF-21.1b · D-39, D-43 — la bolsa de
 * renta vista por quien tiene que colocarla.
 *
 * El Administrador no necesita saber qué semanas hay: necesita saber **por qué**
 * están ahí. Una liberada voluntariamente no es una caducada: su renta es de la
 * fracción que la soltó y no de la propiedad, y esa diferencia tiene que verse
 * antes de colocarla, no después en el estado de cuenta.
 */

function semana(cambios: Partial<SemanaCandidata> & { week: number }): SemanaCandidata {
  const dia = `2027-${String(1 + Math.floor(cambios.week / 4)).padStart(2, '0')}-${String(1 + (cambios.week % 4) * 7).padStart(2, '0')}`
  return {
    startsOn: dia,
    endsOn: dia,
    season: 'baja',
    fraction: null,
    confirmedAt: null,
    releasedAt: null,
    releaseReason: null,
    blocked: false,
    alreadyRented: false,
    selectionComplete: true,
    ...cambios,
  }
}

const liberada = semana({ week: 4, fraction: 3, releasedAt: '2026-10-01T10:00:00Z', releaseReason: 'voluntary', season: 'alta' })
const caducada = semana({ week: 8, fraction: 5, releasedAt: '2026-10-02T10:00:00Z', releaseReason: 'expired' })
const sobrante = semana({ week: 12 })
const confirmada = semana({ week: 16, fraction: 2, confirmedAt: '2026-09-01T10:00:00Z' })

describe('CA-17.5 · la bolsa dice por qué está ahí cada semana (D-43)', () => {
  it('CA-17.5 · la liberada es atribuible a su fracción; la caducada se prorratea', () => {
    const bolsa = bolsaDeRenta([liberada, caducada])

    expect(bolsa.map(s => s.week)).toEqual([4, 8])
    expect(bolsa[0]).toMatchObject({ originReason: 'voluntary', originFraction: 3, attributable: true, season: 'alta' })
    expect(bolsa[1]).toMatchObject({ originReason: 'expired', originFraction: 5, attributable: false })
  })

  it('CA-17.5 · la sobrante de la rejilla entra sin fracción de origen y sin atribuir', () => {
    expect(bolsaDeRenta([sobrante])[0]).toMatchObject({ originReason: 'pool', originFraction: null, attributable: false })
  })

  it('CA-17.5 · una semana confirmada por su Propietario no es bolsa', () => {
    expect(bolsaDeRenta([confirmada])).toEqual([])
  })

  it('CA-17.5 · la bolsa va en orden de rejilla, no en el que venga', () => {
    expect(bolsaDeRenta([sobrante, liberada, caducada]).map(s => s.week)).toEqual([4, 8, 12])
  })
})

describe('CA-39.6 · la semana liberada figura disponible hasta que se coloca', () => {
  it('CA-39.6 · recién liberada, figura en la bolsa con su fracción de origen', () => {
    expect(bolsaDeRenta([liberada])).toHaveLength(1)
    expect(bolsaDeRenta([liberada])[0]).toMatchObject({ week: 4, originFraction: 3 })
  })

  it('CA-39.6 · rentada o bloqueada, deja de figurar como disponible', () => {
    expect(bolsaDeRenta([{ ...liberada, alreadyRented: true }])).toEqual([])
    expect(bolsaDeRenta([{ ...liberada, blocked: true }])).toEqual([])
  })
})

describe('CA-21.4 · las semanas por colocar son la alerta del Administrador', () => {
  const bolsa = bolsaDeRenta([caducada, liberada, sobrante])

  it('CA-21.4 · dos semanas sin tercero se listan por cercanía de su entrada', () => {
    expect(semanasPorColocar(bolsa, '2027-01-01').map(s => s.week)).toEqual([4, 8, 12])
  })

  it('CA-21.4 · colocada una de ellas, la alerta baja a las que quedan', () => {
    const despues = bolsaDeRenta([caducada, { ...liberada, alreadyRented: true }, sobrante])
    expect(semanasPorColocar(despues, '2027-01-01').map(s => s.week)).toEqual([8, 12])
  })

  it('CA-21.4 · una semana cuya entrada ya pasó deja de ser alerta: no hay nada que colocar', () => {
    expect(semanasPorColocar(bolsa, '2027-02-20').map(s => s.week)).toEqual([8, 12])
    expect(semanasPorColocar(bolsa, '2028-01-01')).toEqual([])
  })
})
