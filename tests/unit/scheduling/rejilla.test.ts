import { describe, expect, it } from 'vitest'
import {
  diaDeLaSemana,
  esBisiesto,
  fechasEspecialesDelAnio,
  nochesDelAnio,
  primerSabado,
  rejillaDelAnio,
  sumarDias,
} from '#shared/scheduling/rejilla'

/**
 * HU-12 · RF-12.1 · D-11, D-30 — la rejilla anual sábado a sábado y las noches
 * que quedan fuera. Función pura sobre el año: sin zona horaria del navegador.
 */

const ANIOS = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

describe('CA-12.1 · rejilla anclada al primer sábado, semanas de 7 noches, sin huecos ni solapes', () => {
  it.each(ANIOS)('CA-12.1 · %i arranca el primer sábado y cada semana cubre 7 noches consecutivas', (anio) => {
    const rejilla = rejillaDelAnio(anio)
    const sabado = primerSabado(anio)

    expect(diaDeLaSemana(sabado)).toBe(6)
    expect(sabado.startsWith(`${anio}-01-`)).toBe(true)
    expect(rejilla[0]!.inicio).toBe(sabado)

    for (const semana of rejilla) {
      expect(semana.noches).toHaveLength(7)
      expect(semana.noches[0]).toBe(semana.inicio)
      expect(semana.fin).toBe(sumarDias(semana.inicio, 7))
      semana.noches.forEach((noche, i) => expect(noche).toBe(sumarDias(semana.inicio, i)))
    }
  })

  it.each(ANIOS)('CA-12.1 · %i no tiene huecos ni solapamientos entre semanas', (anio) => {
    const rejilla = rejillaDelAnio(anio)
    for (let i = 1; i < rejilla.length; i++) {
      expect(rejilla[i]!.inicio).toBe(rejilla[i - 1]!.fin)
      expect(rejilla[i]!.indice).toBe(rejilla[i - 1]!.indice + 1)
    }
    const todas = rejilla.flatMap(s => s.noches)
    expect(new Set(todas).size).toBe(todas.length)
  })
})

describe('CA-12.8 · la rejilla tiene 51 o 52 semanas completas dentro del año', () => {
  it.each(ANIOS)('CA-12.8 · %i tiene 51 o 52 semanas y ninguna se sale del año', (anio) => {
    const rejilla = rejillaDelAnio(anio)
    expect([51, 52]).toContain(rejilla.length)
    const ultima = rejilla[rejilla.length - 1]!
    expect(ultima.noches[6]! <= `${anio}-12-31`).toBe(true)
    expect(sumarDias(ultima.fin, 6) > `${anio}-12-31`).toBe(true)
  })
})

describe('CA-12.9 · rejilla ∪ Fechas Especiales = año completo (D-30, I-01)', () => {
  it.each(ANIOS)('CA-12.9 · %i: la unión cubre todas las noches del año sin huecos ni solapamientos', (anio) => {
    const enRejilla = rejillaDelAnio(anio).flatMap(s => s.noches)
    const especiales = fechasEspecialesDelAnio(anio)
    const anioCompleto = nochesDelAnio(anio)

    expect(enRejilla.length + especiales.length).toBe(anioCompleto.length)
    expect(new Set([...enRejilla, ...especiales])).toEqual(new Set(anioCompleto))
    expect(especiales.some(noche => enRejilla.includes(noche))).toBe(false)
  })

  it.each(ANIOS)('D-30 · %i deja entre 1 y 9 noches fuera de la rejilla', (anio) => {
    expect(fechasEspecialesDelAnio(anio).length).toBeGreaterThanOrEqual(1)
    expect(fechasEspecialesDelAnio(anio).length).toBeLessThanOrEqual(9)
  })

  it('el año tiene 365 noches, o 366 si es bisiesto', () => {
    expect(nochesDelAnio(2026)).toHaveLength(365)
    expect(nochesDelAnio(2028)).toHaveLength(366)
    expect(esBisiesto(2028)).toBe(true)
    expect(esBisiesto(2100)).toBe(false)
  })
})
