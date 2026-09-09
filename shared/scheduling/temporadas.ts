/**
 * HU-12 · RF-12.2 · D-27 · schedule.md P-05, P-06 — la clasificación de las
 * semanas de la rejilla y los bloques pico.
 */

import type { Dia, SemanaDeRejilla } from './rejilla'
import { diaDesde, sumarDias } from './rejilla'

export const TEMPORADAS = ['alta', 'media_alta', 'media', 'baja'] as const
export type Temporada = typeof TEMPORADAS[number]

/** P-06 · Navidad, Año Nuevo y Semana Santa, en ese orden fijo: la rotación lo usa. */
export const BLOQUES_PICO = ['christmas', 'new_year', 'holy_week'] as const
export type BloquePico = typeof BLOQUES_PICO[number]

export interface SemanaClasificada {
  indice: number
  temporada: Temporada
  bloquePico: BloquePico | null
}

export const CLAVES_DE_VALIDACION_DE_CALENDARIO = [
  'calendar.validation.week_unclassified',
  'calendar.validation.week_unknown',
  'calendar.validation.peak_not_high',
  'calendar.validation.peak_duplicated',
] as const
export type ClaveDeValidacionDeCalendario = typeof CLAVES_DE_VALIDACION_DE_CALENDARIO[number]

export interface ErrorDeClasificacion {
  /** `week-<indice>` o `weeks` cuando es global. */
  name: string
  message: ClaveDeValidacionDeCalendario
}

/** Punto de partida: toda la rejilla en baja, sin bloques. El Administrador sube lo que toque. */
export function clasificacionBase(rejilla: readonly SemanaDeRejilla[]): SemanaClasificada[] {
  return rejilla.map(semana => ({ indice: semana.indice, temporada: 'baja', bloquePico: null }))
}

export function validarClasificacion(
  rejilla: readonly SemanaDeRejilla[],
  clasificacion: readonly SemanaClasificada[],
): ErrorDeClasificacion[] {
  const errores: ErrorDeClasificacion[] = []
  const indicesDeRejilla = new Set(rejilla.map(s => s.indice))
  const clasificadas = new Map(clasificacion.map(s => [s.indice, s]))

  for (const indice of indicesDeRejilla) {
    if (!clasificadas.has(indice)) {
      errores.push({ name: `week-${indice}`, message: 'calendar.validation.week_unclassified' })
    }
  }

  const vistos = new Set<BloquePico>()
  for (const semana of [...clasificacion].sort((a, b) => a.indice - b.indice)) {
    if (!indicesDeRejilla.has(semana.indice)) {
      errores.push({ name: `week-${semana.indice}`, message: 'calendar.validation.week_unknown' })
      continue
    }
    if (semana.bloquePico) {
      if (semana.temporada !== 'alta') {
        errores.push({ name: `week-${semana.indice}`, message: 'calendar.validation.peak_not_high' })
      }
      if (vistos.has(semana.bloquePico)) {
        errores.push({ name: `week-${semana.indice}`, message: 'calendar.validation.peak_duplicated' })
      }
      vistos.add(semana.bloquePico)
    }
  }

  return errores
}

/** Domingo de Pascua por el algoritmo de Meeus/Jones/Butcher, válido para el calendario gregoriano. */
export function fechaDePascua(anio: number): Dia {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return diaDesde(anio, mes, dia)
}

export function semanaQueContiene(rejilla: readonly SemanaDeRejilla[], dia: Dia): SemanaDeRejilla | null {
  return rejilla.find(semana => dia >= semana.inicio && dia < semana.fin) ?? null
}

/**
 * P-06 · dónde caen los bloques pico este año: Navidad en la semana del 24 de
 * diciembre, Año Nuevo en la del 31 y Semana Santa en la del Viernes Santo. Si
 * la fecha queda fuera de la rejilla (Fechas Especiales), va a la semana vecina.
 */
export function sugerirBloquesPico(anio: number, rejilla: readonly SemanaDeRejilla[]): Record<BloquePico, number> {
  const ultima = rejilla[rejilla.length - 1]!.indice
  const primera = rejilla[0]!.indice
  const indiceDe = (dia: Dia, respaldo: number) => semanaQueContiene(rejilla, dia)?.indice ?? respaldo

  const newYear = indiceDe(diaDesde(anio, 12, 31), ultima)
  let christmas = indiceDe(diaDesde(anio, 12, 24), ultima)
  // Los años en que el 31 queda fuera de la rejilla, la última semana contiene a
  // la vez Nochebuena y Nochevieja. Son bloques distintos por definición (D-27),
  // así que Navidad se corre a la semana anterior; el Administrador puede moverla.
  if (christmas === newYear) {
    christmas = newYear - 1
  }

  return {
    christmas,
    new_year: newYear,
    holy_week: indiceDe(sumarDias(fechaDePascua(anio), -2), primera),
  }
}

/** Sugerencia inicial: todo baja salvo los tres bloques pico, en alta. El resto lo decide el Administrador. */
export function clasificacionSugerida(anio: number, rejilla: readonly SemanaDeRejilla[]): SemanaClasificada[] {
  const picos = sugerirBloquesPico(anio, rejilla)
  return clasificacionBase(rejilla).map((semana) => {
    const bloque = BLOQUES_PICO.find(b => picos[b] === semana.indice) ?? null
    return bloque ? { ...semana, temporada: 'alta', bloquePico: bloque } : semana
  })
}
