/**
 * HU-12 · RF-12.3, RF-12.7 · D-12 · schedule.md P-04 — el criterio de reparto:
 * cuántas semanas de cada temporada recibe cada fracción, y qué exige eso de la
 * rejilla. Por defecto 1/1/1/3 semanas, que son 7/7/7/21 noches: 42 al año.
 */

import { FRACCIONES_POR_PROPIEDAD } from '../properties/fracciones'
import { NOCHES_POR_SEMANA } from './rejilla'
import { TEMPORADAS } from './temporadas'
import type { SemanaClasificada, Temporada } from './temporadas'

export type Criterio = Record<Temporada, number>

export const CRITERIO_POR_DEFECTO: Criterio = { alta: 1, media_alta: 1, media: 1, baja: 3 }

/** Semanas de cada temporada que la rejilla debe tener para repartir a las 8 fracciones. */
export function semanasNecesarias(criterio: Criterio): Criterio {
  return Object.fromEntries(TEMPORADAS.map(t => [t, criterio[t] * FRACCIONES_POR_PROPIEDAD])) as Criterio
}

/** El cupo anual de noches por fracción que sale del criterio (RF-12.3). */
export function cupoDeNoches(criterio: Criterio): Criterio & { total: number } {
  const porTemporada = Object.fromEntries(TEMPORADAS.map(t => [t, criterio[t] * NOCHES_POR_SEMANA])) as Criterio
  return { ...porTemporada, total: TEMPORADAS.reduce((suma, t) => suma + porTemporada[t], 0) }
}

export interface Faltante {
  temporada: Temporada
  necesarias: number
  disponibles: number
}

/** RF-12.7 · qué temporadas no alcanzan para cumplir el criterio. Vacío si todo cabe. */
export function validarRejillaParaCriterio(semanas: readonly SemanaClasificada[], criterio: Criterio): Faltante[] {
  const necesarias = semanasNecesarias(criterio)
  return TEMPORADAS
    .map(temporada => ({
      temporada,
      necesarias: necesarias[temporada],
      disponibles: semanas.filter(s => s.temporada === temporada).length,
    }))
    .filter(faltante => faltante.disponibles < faltante.necesarias)
}

/** CA-12.7 · la configuración se rechaza antes de persistir, con el detalle de lo que falta. */
export class ErrorDeRejillaImposible extends Error {
  readonly clave = 'calendar.errors.impossible_grid' as const

  constructor(readonly faltantes: Faltante[]) {
    super(`RF-12.7 · la rejilla no permite cumplir el criterio: ${faltantes.map(f => `${f.temporada} ${f.disponibles}/${f.necesarias}`).join(', ')}.`)
    this.name = 'ErrorDeRejillaImposible'
  }
}

export class ErrorDeClasificacionInvalida extends Error {
  readonly clave = 'calendar.errors.invalid_classification' as const

  constructor(readonly claves: readonly string[]) {
    super(`RF-12.2 · la clasificación de la rejilla no es válida: ${claves.join(', ')}.`)
    this.name = 'ErrorDeClasificacionInvalida'
  }
}
