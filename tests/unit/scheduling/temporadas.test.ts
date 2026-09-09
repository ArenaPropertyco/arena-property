import { describe, expect, it } from 'vitest'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import {
  BLOQUES_PICO,
  clasificacionBase,
  fechaDePascua,
  semanaQueContiene,
  sugerirBloquesPico,
  TEMPORADAS,
  validarClasificacion,
} from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.2 · D-27 — la clasificación de semanas y los bloques pico.
 * schedule.md P-05 y P-06.
 */

const rejilla = rejillaDelAnio(2027)

describe('RF-12.2 · vocabulario y validación de la clasificación', () => {
  it('las cuatro temporadas y los tres bloques pico son catálogos cerrados', () => {
    expect([...TEMPORADAS]).toEqual(['alta', 'media_alta', 'media', 'baja'])
    expect([...BLOQUES_PICO]).toEqual(['christmas', 'new_year', 'holy_week'])
  })

  it('la clasificación base cubre todas las semanas de la rejilla', () => {
    const base = clasificacionBase(rejilla)
    expect(base).toHaveLength(rejilla.length)
    expect(validarClasificacion(rejilla, base)).toEqual([])
  })

  it('una semana sin clasificar se señala con su clave', () => {
    const base = clasificacionBase(rejilla).slice(1)
    expect(validarClasificacion(rejilla, base).map(e => e.message)).toContain('calendar.validation.week_unclassified')
  })

  it('P-06 · un bloque pico solo cabe en una semana alta y una sola vez', () => {
    const base = clasificacionBase(rejilla)
    base[10] = { ...base[10]!, temporada: 'baja', bloquePico: 'christmas' }
    base[11] = { ...base[11]!, temporada: 'alta', bloquePico: 'christmas' }
    const claves = validarClasificacion(rejilla, base).map(e => e.message)

    expect(claves).toContain('calendar.validation.peak_not_high')
    expect(claves).toContain('calendar.validation.peak_duplicated')
  })
})

describe('P-06 · sugerencia de bloques pico por fecha', () => {
  it('la Pascua se calcula bien para años conocidos', () => {
    expect(fechaDePascua(2026)).toBe('2026-04-05')
    expect(fechaDePascua(2027)).toBe('2027-03-28')
    expect(fechaDePascua(2028)).toBe('2028-04-16')
  })

  it('Navidad, Año Nuevo y Semana Santa caen en las semanas que contienen sus fechas', () => {
    const sugeridos = sugerirBloquesPico(2027, rejilla)
    expect(semanaQueContiene(rejilla, '2027-12-24')?.indice).toBe(sugeridos.christmas)
    expect(semanaQueContiene(rejilla, '2027-12-31')?.indice).toBe(sugeridos.new_year)
    expect(semanaQueContiene(rejilla, '2027-03-26')?.indice).toBe(sugeridos.holy_week)
  })

  it('una fecha fuera de la rejilla no tiene semana', () => {
    expect(semanaQueContiene(rejilla, '2027-01-01')).toBeNull()
  })
})
