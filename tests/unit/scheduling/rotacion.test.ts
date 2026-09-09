import { describe, expect, it } from 'vitest'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { repartir } from '#shared/scheduling/reparto'
import { fraccionDelBloque, posicionDe } from '#shared/scheduling/rotacion'
import { BLOQUES_PICO, clasificacionBase, sugerirBloquesPico } from '#shared/scheduling/temporadas'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'

/**
 * HU-12 · RF-12.4, RF-12.5 · D-13, D-27 · schedule.md I-05, I-06 — la rotación
 * anual de posiciones y la rotación estricta de bloques pico, sobre 8 años.
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
      const bloque = BLOQUES_PICO.find(b => picos[b] === s.indice) ?? null
      return { ...s, temporada: 'alta', bloquePico: bloque }
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

const BASE = 2026
const OCHO_ANIOS = Array.from({ length: 8 }, (_, i) => BASE + i)
const FRACCIONES = [1, 2, 3, 4, 5, 6, 7, 8]

describe('RF-12.4 · posición de reparto', () => {
  it('el desplazamiento es (año − año base) módulo 8, también hacia atrás', () => {
    expect(posicionDe(1, BASE, BASE)).toBe(0)
    expect(posicionDe(1, BASE + 1, BASE)).toBe(1)
    expect(posicionDe(8, BASE + 1, BASE)).toBe(0)
    expect(posicionDe(1, BASE + 8, BASE)).toBe(0)
    expect(posicionDe(1, BASE - 1, BASE)).toBe(7)
  })
})

describe('CA-12.4 · dos años consecutivos', () => {
  it('CA-12.4 · ninguna fracción repite posición ni bloque pico entre un año y el siguiente', () => {
    for (const anio of OCHO_ANIOS) {
      const a = repartir({ anio, anioBase: BASE, rejilla: rejillaDelAnio(anio), semanas: clasificacionValida(anio) })
      const b = repartir({ anio: anio + 1, anioBase: BASE, rejilla: rejillaDelAnio(anio + 1), semanas: clasificacionValida(anio + 1) })
      for (const f of FRACCIONES) {
        const hoy = a.asignaciones.find(x => x.fraccion === f)!
        const manana = b.asignaciones.find(x => x.fraccion === f)!
        expect(hoy.posicion).not.toBe(manana.posicion)
        for (const bloque of hoy.bloquesPico) {
          expect(manana.bloquesPico).not.toContain(bloque)
        }
      }
    }
  })
})

describe('CA-12.5 · ocho años consecutivos (I-06)', () => {
  const repartos = OCHO_ANIOS.map(anio => repartir({ anio, anioBase: BASE, rejilla: rejillaDelAnio(anio), semanas: clasificacionValida(anio) }))

  it('CA-12.5 · cada fracción ocupa las 8 posiciones exactamente una vez', () => {
    for (const f of FRACCIONES) {
      const posiciones = repartos.map(r => r.asignaciones.find(a => a.fraccion === f)!.posicion).sort((a, b) => a - b)
      expect(posiciones).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    }
  })

  it('CA-12.5 · cada fracción pasa por cada bloque pico exactamente una vez', () => {
    for (const f of FRACCIONES) {
      const bloques = repartos.flatMap(r => r.asignaciones.find(a => a.fraccion === f)!.bloquesPico)
      expect([...bloques].sort()).toEqual([...BLOQUES_PICO].sort())
    }
  })

  it('D-27 · en un mismo año ningún bloque pico se asigna a dos fracciones ni una fracción recibe dos', () => {
    for (const reparto of repartos) {
      const duenos = BLOQUES_PICO.map(b => reparto.bloquesPico[b])
      expect(new Set(duenos).size).toBe(3)
      expect(reparto.asignaciones.every(a => a.bloquesPico.length <= 1)).toBe(true)
    }
  })

  it('la fracción de cada bloque sale de una rotación independiente y determinista', () => {
    for (const anio of OCHO_ANIOS) {
      const reparto = repartir({ anio, anioBase: BASE, rejilla: rejillaDelAnio(anio), semanas: clasificacionValida(anio) })
      for (const bloque of BLOQUES_PICO) {
        expect(reparto.bloquesPico[bloque]).toBe(fraccionDelBloque(bloque, anio, BASE))
      }
    }
  })
})
