import { describe, expect, it } from 'vitest'
import { nochesVencidas, PLAZO_DE_LIBERACION_DIAS } from '#shared/scheduling/liberacion'

/**
 * HU-12 · RF-12.8 · D-15 · schedule.md P-11, I-09 — a 60 días de su fecha, una
 * noche sin estadía pasa a la bolsa de renta. Función pura e idempotente.
 */

const asignadas = [
  { fraccion: 1, noche: '2027-03-10' },
  { fraccion: 1, noche: '2027-03-11' },
  { fraccion: 1, noche: '2027-06-01' },
  { fraccion: 2, noche: '2027-03-10' },
]

describe('RF-12.8 · liberación automática', () => {
  it('el plazo por defecto es de 60 días (P-11)', () => {
    expect(PLAZO_DE_LIBERACION_DIAS).toBe(60)
  })

  it('libera las noches dentro del plazo que no tienen estadía declarada', () => {
    const vencidas = nochesVencidas(asignadas, [{ fraccion: 1, noches: ['2027-03-11'] }], '2027-01-10')

    expect(vencidas).toEqual([
      { fraccion: 1, noche: '2027-03-10' },
      { fraccion: 2, noche: '2027-03-10' },
    ])
  })

  it('una noche más allá del plazo todavía no se libera', () => {
    expect(nochesVencidas(asignadas, [], '2027-01-01').map(n => n.noche)).not.toContain('2027-06-01')
  })

  it('una noche ya pasada no se libera: ya no puede rentarse', () => {
    expect(nochesVencidas(asignadas, [], '2027-03-11')).toEqual([{ fraccion: 1, noche: '2027-03-11' }])
  })

  it('es idempotente: lo ya liberado no vuelve a salir', () => {
    const primera = nochesVencidas(asignadas, [], '2027-01-10')
    const segunda = nochesVencidas(asignadas, [], '2027-01-10', PLAZO_DE_LIBERACION_DIAS, new Set(primera.map(n => `${n.fraccion}:${n.noche}`)))
    expect(primera).toHaveLength(3)
    expect(segunda).toEqual([])
  })
})
