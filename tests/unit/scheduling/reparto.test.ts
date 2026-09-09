import { describe, expect, it } from 'vitest'
import { CRITERIO_POR_DEFECTO, cupoDeNoches, ErrorDeRejillaImposible, semanasNecesarias } from '#shared/scheduling/criterio'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { repartir } from '#shared/scheduling/reparto'
import { clasificacionBase, sugerirBloquesPico } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.3, RF-12.6, RF-12.7 · D-12 — el motor de reparto: cupo exacto por
 * fracción, sin noches compartidas, determinista, y que rechaza rejillas imposibles.
 */

/** Rejilla válida: 8 altas (con los 3 picos), 8 media-altas, 8 medias y el resto bajas. */
function clasificacionValida(anio: number): SemanaClasificada[] {
  const rejilla = rejillaDelAnio(anio)
  const picos = sugerirBloquesPico(anio, rejilla)
  const semanas = clasificacionBase(rejilla)
  const altas = new Set([picos.christmas, picos.new_year, picos.holy_week])
  for (let i = 0; altas.size < 8; i++) {
    if (!altas.has(i)) altas.add(i)
  }
  let mediaAltas = 0
  let medias = 0
  return semanas.map((semana) => {
    if (altas.has(semana.indice)) {
      const bloque = (Object.keys(picos) as (keyof typeof picos)[]).find(b => picos[b] === semana.indice) ?? null
      return { ...semana, temporada: 'alta', bloquePico: bloque }
    }
    if (mediaAltas < 8) {
      mediaAltas++
      return { ...semana, temporada: 'media_alta', bloquePico: null }
    }
    if (medias < 8) {
      medias++
      return { ...semana, temporada: 'media', bloquePico: null }
    }
    return { ...semana, temporada: 'baja', bloquePico: null }
  })
}

const ANIO = 2027
const BASE = 2026

describe('RF-12.3 · criterio por defecto (P-04)', () => {
  it('reparte 1 alta, 1 media-alta, 1 media y 3 bajas por fracción', () => {
    expect(CRITERIO_POR_DEFECTO).toEqual({ alta: 1, media_alta: 1, media: 1, baja: 3 })
    expect(semanasNecesarias(CRITERIO_POR_DEFECTO)).toEqual({ alta: 8, media_alta: 8, media: 8, baja: 24 })
    expect(cupoDeNoches(CRITERIO_POR_DEFECTO)).toEqual({ alta: 7, media_alta: 7, media: 7, baja: 21, total: 42 })
  })
})

describe('CA-12.2 · cupo exacto por fracción', () => {
  it('CA-12.2 · cada fracción recibe 7 noches altas, 7 media-altas, 7 medias y 21 bajas', () => {
    const reparto = repartir({ anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas: clasificacionValida(ANIO) })

    expect(reparto.asignaciones).toHaveLength(8)
    for (const asignacion of reparto.asignaciones) {
      expect(asignacion.cupo).toEqual({ alta: 7, media_alta: 7, media: 7, baja: 21 })
      expect(asignacion.noches).toHaveLength(42)
      expect(asignacion.semanas).toHaveLength(6)
    }
  })
})

describe('CA-12.3 · CA-12.8 · noches sin compartir y bolsa del Administrador', () => {
  it('CA-12.3 · ninguna noche pertenece a dos fracciones y las no asignadas van a la bolsa', () => {
    const rejilla = rejillaDelAnio(ANIO)
    const reparto = repartir({ anio: ANIO, anioBase: BASE, rejilla, semanas: clasificacionValida(ANIO) })

    const todas = reparto.asignaciones.flatMap(a => a.noches)
    expect(new Set(todas).size).toBe(todas.length)

    const asignadas = new Set(reparto.asignaciones.flatMap(a => a.semanas))
    const bolsa = new Set(reparto.bolsaDelAdministrador)
    expect([...asignadas].some(i => bolsa.has(i))).toBe(false)
    expect(asignadas.size + bolsa.size).toBe(rejilla.length)
  })

  it('CA-12.8 · de 51 o 52 semanas se reparten 48 y quedan 3 o 4 en la bolsa', () => {
    for (const anio of [2027, 2028, 2033]) {
      const rejilla = rejillaDelAnio(anio)
      const reparto = repartir({ anio, anioBase: BASE, rejilla, semanas: clasificacionValida(anio) })
      expect(new Set(reparto.asignaciones.flatMap(a => a.semanas)).size).toBe(48)
      expect(reparto.bolsaDelAdministrador).toHaveLength(rejilla.length - 48)
      expect([3, 4]).toContain(reparto.bolsaDelAdministrador.length)
    }
  })

  it('las semanas de la bolsa nunca son bloques pico', () => {
    const semanas = clasificacionValida(ANIO)
    const reparto = repartir({ anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas })
    const picos = semanas.filter(s => s.bloquePico).map(s => s.indice)
    expect(reparto.bolsaDelAdministrador.some(i => picos.includes(i))).toBe(false)
  })
})

describe('CA-12.6 · determinismo (I-10)', () => {
  it('CA-12.6 · el mismo año, rejilla y criterio ejecutados dos veces dan el mismo resultado', () => {
    const entrada = { anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas: clasificacionValida(ANIO) }
    expect(repartir(entrada)).toEqual(repartir({ ...entrada, semanas: [...entrada.semanas].reverse() }))
    expect(JSON.stringify(repartir(entrada))).toBe(JSON.stringify(repartir(entrada)))
  })
})

describe('CA-12.7 · rejilla imposible', () => {
  it('CA-12.7 · con solo 7 semanas altas el motor devuelve error de imposibilidad', () => {
    const semanas = clasificacionValida(ANIO)
    const alta = semanas.find(s => s.temporada === 'alta' && !s.bloquePico)!
    const rota = semanas.map(s => s.indice === alta.indice ? { ...s, temporada: 'baja' as const } : s)

    expect(() => repartir({ anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas: rota }))
      .toThrow(ErrorDeRejillaImposible)
    try {
      repartir({ anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas: rota })
    }
    catch (error) {
      const imposible = error as ErrorDeRejillaImposible
      expect(imposible.clave).toBe('calendar.errors.impossible_grid')
      expect(imposible.faltantes).toEqual([{ temporada: 'alta', necesarias: 8, disponibles: 7 }])
    }
  })

  it('RF-12.7 · con menos de 24 bajas también se rechaza', () => {
    const semanas = clasificacionValida(ANIO).map(s => s.temporada === 'baja' && s.indice > 40 ? { ...s, temporada: 'media' as const } : s)
    expect(() => repartir({ anio: ANIO, anioBase: BASE, rejilla: rejillaDelAnio(ANIO), semanas })).toThrow(ErrorDeRejillaImposible)
  })
})
