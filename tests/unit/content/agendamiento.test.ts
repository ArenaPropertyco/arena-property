import { describe, expect, it } from 'vitest'
import {
  CUPO_PUBLICADO,
  ESTADIA_MINIMA_NOCHES,
  IDS_DE_AGENDAMIENTO,
  REGLAS_PUBLICADAS,
  SECCIONES_DE_AGENDAMIENTO,
  TEMPORADAS_PUBLICADAS,
  UNIDAD_DE_USO,
} from '#shared/content/agendamiento'
import { problemasDelManifiesto } from '#shared/content/manifiesto'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'
import { CRITERIO_POR_DEFECTO, cupoDeNoches } from '#shared/scheduling/criterio'
import { NOCHES_POR_SEMANA } from '#shared/scheduling/rejilla'
import { BLOQUES_PICO, TEMPORADAS } from '#shared/scheduling/temporadas'

/**
 * HU-43 · RF-43.1…RF-43.4 · D-32 · D-33 — la página pública no puede prometer
 * algo distinto al motor: el cupo publicado se deriva del criterio de HU-12.
 */

describe('CA-43.1 · el manifiesto declara las 4 temporadas y el cupo 7/7/7/21', () => {
  it('CA-43.1 · cuatro temporadas cuyas noches por fracción suman exactamente 42', () => {
    expect(TEMPORADAS_PUBLICADAS.map(t => t.id)).toEqual([...TEMPORADAS])
    expect(TEMPORADAS_PUBLICADAS.map(t => t.noches)).toEqual([7, 7, 7, 21])
    expect(TEMPORADAS_PUBLICADAS.reduce((suma, t) => suma + t.noches, 0)).toBe(42)
    expect(CUPO_PUBLICADO).toEqual({ semanas: 6, noches: 42 })
  })

  it('RF-43.4 · el manifiesto ordena hero, temporadas, reglas y CTA', () => {
    expect(SECCIONES_DE_AGENDAMIENTO.map(s => s.id)).toEqual([...IDS_DE_AGENDAMIENTO])
    expect(problemasDelManifiesto(SECCIONES_DE_AGENDAMIENTO)).toEqual([])
  })
})

describe('CA-43.2 · coherencia con el motor de HU-12 y con D-33', () => {
  it('CA-43.2 · las semanas y noches publicadas son las del criterio por defecto', () => {
    const cupo = cupoDeNoches(CRITERIO_POR_DEFECTO)
    for (const temporada of TEMPORADAS_PUBLICADAS) {
      expect(temporada.semanas).toBe(CRITERIO_POR_DEFECTO[temporada.id])
      expect(temporada.noches).toBe(cupo[temporada.id])
      expect(temporada.noches).toBe(temporada.semanas * NOCHES_POR_SEMANA)
    }
    expect(CUPO_PUBLICADO.noches).toBe(cupo.total)
  })

  it('CA-43.2 · D-33 · la unidad de uso es la semana completa: la estadía mínima publicada es la semana', () => {
    expect(UNIDAD_DE_USO).toBe('week')
    expect(ESTADIA_MINIMA_NOCHES).toBe(NOCHES_POR_SEMANA)
    for (const temporada of TEMPORADAS_PUBLICADAS) {
      expect(temporada.estadiaMinimaNoches).toBe(NOCHES_POR_SEMANA)
    }
  })

  it('RF-43.2 · las reglas publicadas son las que el motor aplica hoy: semanas completas, turnos, rotación, bloques pico, reubicación y confirmación', () => {
    expect([...REGLAS_PUBLICADAS]).toEqual(['whole_weeks', 'turns', 'rotation', 'peaks', 'relocation', 'confirmation'])
    expect(BLOQUES_PICO).toEqual(['christmas', 'new_year', 'holy_week'])
  })
})

describe('CA-43.3 · el CTA lleva al registro', () => {
  it('CA-43.3 · el destino del CTA es la ruta de registro', () => {
    expect(SECCIONES_DE_AGENDAMIENTO.find(s => s.id === 'cta')?.cta?.destino).toBe(RUTAS_PUBLICAS.registro)
  })
})
