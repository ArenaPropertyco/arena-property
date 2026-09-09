import { describe, expect, it } from 'vitest'
import { conflictosDeReconfiguracion, requiereConfirmacion } from '#shared/scheduling/reconfiguracion'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { repartir } from '#shared/scheduling/reparto'
import { BLOQUES_PICO, clasificacionBase, sugerirBloquesPico } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.9 — reconfigurar con estadías existentes exige confirmación, no
 * borra nada y lista los conflictos que resolverá el Administrador (HU-17).
 */

function clasificacionValida(anio: number): SemanaClasificada[] {
  const rejilla = rejillaDelAnio(anio)
  const picos = sugerirBloquesPico(anio, rejilla)
  const altas = new Set([picos.christmas, picos.new_year, picos.holy_week])
  for (let i = 0; altas.size < 8; i++) {
    if (!altas.has(i)) altas.add(i)
  }
  let ma = 0
  let me = 0
  return clasificacionBase(rejilla).map((s) => {
    if (altas.has(s.indice)) {
      return { ...s, temporada: 'alta', bloquePico: BLOQUES_PICO.find(b => picos[b] === s.indice) ?? null }
    }
    if (ma < 8) {
      ma++
      return { ...s, temporada: 'media_alta', bloquePico: null }
    }
    if (me < 8) {
      me++
      return { ...s, temporada: 'media', bloquePico: null }
    }
    return { ...s, temporada: 'baja', bloquePico: null }
  })
}

const reparto = repartir({ anio: 2027, anioBase: 2026, rejilla: rejillaDelAnio(2027), semanas: clasificacionValida(2027) })

describe('RF-12.9 · reconfiguración con estadías', () => {
  it('sin estadías no hace falta confirmar', () => {
    expect(requiereConfirmacion([])).toBe(false)
    expect(requiereConfirmacion([{ id: 'e1', fraccion: 1, noches: ['2027-05-01'] }])).toBe(true)
  })

  it('una estadía dentro de las noches nuevas de su fracción no es conflicto', () => {
    const fraccion1 = reparto.asignaciones.find(a => a.fraccion === 1)!
    const estadia = { id: 'e1', fraccion: 1, noches: fraccion1.noches.slice(0, 2) }
    expect(conflictosDeReconfiguracion(reparto, [estadia])).toEqual([])
  })

  it('una estadía sobre noches que ahora son de otra fracción o de la bolsa se lista, no se borra', () => {
    const fraccion2 = reparto.asignaciones.find(a => a.fraccion === 2)!
    const estadia = { id: 'e2', fraccion: 1, noches: [fraccion2.noches[0]!, fraccion2.noches[1]!] }
    const conflictos = conflictosDeReconfiguracion(reparto, [estadia])

    expect(conflictos).toEqual([{ estadia: 'e2', fraccion: 1, noches: [fraccion2.noches[0], fraccion2.noches[1]], ahoraDe: 2 }])
  })
})
