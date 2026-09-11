/**
 * HU-43 · RF-43.1…RF-43.4 · D-32 · D-33 · D-36 — manifiesto de la página del
 * sistema de agendamiento.
 *
 * La página pública no puede prometer algo distinto al motor (CA-43.2): la tabla
 * de temporadas se **deriva** del criterio por defecto de HU-12, no se escribe a
 * mano. Seis semanas al año por fracción, que son 42 noches: 1/1/1/3 semanas, o
 * 7/7/7/21 noches. Con D-33 la unidad de uso es la semana completa, así que la
 * estadía mínima publicada es la semana; la reserva por noches y sus mínimos
 * (D-11, D-29) quedan suspendidos y no se publican.
 */

import { CRITERIO_POR_DEFECTO, cupoDeNoches } from '../scheduling/criterio'
import { NOCHES_POR_SEMANA } from '../scheduling/rejilla'
import { BLOQUES_PICO, TEMPORADAS } from '../scheduling/temporadas'
import type { Temporada } from '../scheduling/temporadas'
import { clavesDe } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DE_AGENDAMIENTO = ['hero', 'seasons', 'rules', 'cta'] as const
export type IdDeAgendamiento = typeof IDS_DE_AGENDAMIENTO[number]

export type SeccionDeAgendamiento = SeccionDePagina<IdDeAgendamiento>

/** D-33 · la unidad de uso que el motor aplica hoy. */
export const UNIDAD_DE_USO = 'week' as const

/** D-33 · sin estadías por noches, lo mínimo que se usa es la semana entera. */
export const ESTADIA_MINIMA_NOCHES = NOCHES_POR_SEMANA

export interface TemporadaPublicada {
  id: Temporada
  semanas: number
  noches: number
  estadiaMinimaNoches: number
}

const cupo = cupoDeNoches(CRITERIO_POR_DEFECTO)

/** RF-43.1 · CA-43.1 · las cuatro temporadas con su cupo, derivado del criterio. */
export const TEMPORADAS_PUBLICADAS: readonly TemporadaPublicada[] = TEMPORADAS.map(temporada => ({
  id: temporada,
  semanas: CRITERIO_POR_DEFECTO[temporada],
  noches: cupo[temporada],
  estadiaMinimaNoches: ESTADIA_MINIMA_NOCHES,
}))

/** El total anual por fracción, en las dos unidades. */
export const CUPO_PUBLICADO = {
  semanas: TEMPORADAS.reduce((suma, temporada) => suma + CRITERIO_POR_DEFECTO[temporada], 0),
  noches: cupo.total,
} as const

/** RF-43.2 · las reglas visibles al comprador, las que el motor aplica hoy. */
export const REGLAS_PUBLICADAS = ['whole_weeks', 'turns', 'rotation', 'peaks', 'relocation', 'confirmation'] as const
export type ReglaPublicada = typeof REGLAS_PUBLICADAS[number]

/** Los tres bloques pico, en el orden fijo que usa la rotación. */
export const BLOQUES_PICO_PUBLICADOS = BLOQUES_PICO

export const SECCIONES_DE_AGENDAMIENTO: readonly SeccionDeAgendamiento[] = [
  {
    id: 'hero',
    orden: 1,
    tituloKey: 'scheduling.hero.title',
    claves: ['scheduling.hero.headline', 'scheduling.hero.description'],
  },
  {
    id: 'seasons',
    orden: 2,
    tituloKey: 'scheduling.seasons.title',
    claves: [
      'scheduling.seasons.headline',
      'scheduling.seasons.description',
      'scheduling.seasons.columns.season',
      'scheduling.seasons.columns.weeks',
      'scheduling.seasons.columns.nights',
      'scheduling.seasons.columns.minimum',
      'scheduling.seasons.total',
      'scheduling.seasons.wholeWeek',
      ...TEMPORADAS.map(temporada => `scheduling.seasons.names.${temporada}`),
    ],
  },
  {
    id: 'rules',
    orden: 3,
    tituloKey: 'scheduling.rules.title',
    claves: [
      'scheduling.rules.headline',
      'scheduling.rules.description',
      ...clavesDe('scheduling.rules', REGLAS_PUBLICADAS, ['title', 'description']),
      ...BLOQUES_PICO.map(bloque => `scheduling.rules.peakBlocks.${bloque}`),
    ],
  },
  {
    id: 'cta',
    orden: 4,
    tituloKey: 'scheduling.cta.title',
    claves: ['scheduling.cta.description'],
    cta: { labelKey: 'scheduling.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
]

export const IMAGENES_DE_AGENDAMIENTO = {
  /** El final de un día de uso, a la hora azul. Ambientación generada (P-09). */
  hero: '/media/agendamiento-hero.jpg',
} as const
