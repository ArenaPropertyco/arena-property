/**
 * HU-41 · RF-41.1, RF-41.2, RF-41.4 — manifiesto tipado de la página del modelo
 * de negocio.
 *
 * Qué es la copropiedad fraccionada (ocho fracciones, titularidad en fiducia,
 * derechos de uso por temporada, operación centralizada), qué hace Arena y qué
 * no es, y el camino de compra paso a paso de Visitante a Propietario. Todo son
 * claves i18n; los criterios se prueban contra este arreglo (RT-03).
 */

import { clavesDe } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DEL_MODELO = ['hero', 'structure', 'what_we_do', 'what_we_are_not', 'path', 'cta'] as const
export type IdDelModelo = typeof IDS_DEL_MODELO[number]

export type SeccionDelModelo = SeccionDePagina<IdDelModelo>

/** RF-41.1 · los cuatro pilares de la estructura del modelo. */
export const PILARES_DE_LA_ESTRUCTURA = ['fractions', 'ownership', 'seasons', 'operation'] as const
export type PilarDeLaEstructura = typeof PILARES_DE_LA_ESTRUCTURA[number]

/** Lo que Arena hace por cada inmueble: estructura, comercializa y administra. */
export const LO_QUE_HACEMOS = ['structure', 'commercialize', 'manage'] as const
export type LoQueHacemos = typeof LO_QUE_HACEMOS[number]

/** Lo que el modelo no es: ni fondo, ni tiempo compartido, ni promesa de renta. */
export const LO_QUE_NO_SOMOS = ['fund', 'timeshare', 'yield'] as const
export type LoQueNoSomos = typeof LO_QUE_NO_SOMOS[number]

/** RF-41.2 · el rol con el que se vive cada paso del camino de compra. */
export type RolDelCamino = 'visitor' | 'user' | 'owner'

export interface PasoDeCompra {
  id: string
  rol: RolDelCamino
}

/** RF-41.2 · Visitante → Usuario → Propietario, en el orden en que ocurre. */
export const PASOS_DE_COMPRA: readonly PasoDeCompra[] = [
  { id: 'explore', rol: 'visitor' },
  { id: 'account', rol: 'user' },
  { id: 'choose', rol: 'user' },
  { id: 'pay', rol: 'user' },
  { id: 'own', rol: 'owner' },
]

export const SECCIONES_DEL_MODELO: readonly SeccionDelModelo[] = [
  {
    id: 'hero',
    orden: 1,
    tituloKey: 'model.hero.title',
    claves: ['model.hero.headline', 'model.hero.description'],
  },
  {
    id: 'structure',
    orden: 2,
    tituloKey: 'model.structure.title',
    claves: [
      'model.structure.headline',
      'model.structure.description',
      ...clavesDe('model.structure.items', PILARES_DE_LA_ESTRUCTURA, ['title', 'description']),
    ],
  },
  {
    id: 'what_we_do',
    orden: 3,
    tituloKey: 'model.whatWeDo.title',
    claves: [
      'model.whatWeDo.headline',
      'model.whatWeDo.description',
      'model.whatWeDo.partner',
      ...clavesDe('model.whatWeDo.items', LO_QUE_HACEMOS, ['title', 'description']),
    ],
  },
  {
    id: 'what_we_are_not',
    orden: 4,
    tituloKey: 'model.whatWeAreNot.title',
    claves: clavesDe('model.whatWeAreNot.items', LO_QUE_NO_SOMOS, ['title', 'description']),
  },
  {
    id: 'path',
    orden: 5,
    tituloKey: 'model.path.title',
    claves: [
      'model.path.headline',
      'model.path.description',
      ...clavesDe('model.path.steps', PASOS_DE_COMPRA.map(paso => paso.id), ['title', 'description']),
      ...['visitor', 'user', 'owner'].map(rol => `model.path.roles.${rol}`),
    ],
  },
  {
    id: 'cta',
    orden: 6,
    tituloKey: 'model.cta.title',
    claves: ['model.cta.description'],
    cta: { labelKey: 'model.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
]

/** Imágenes oficiales que ilustran la página. */
export const IMAGENES_DEL_MODELO = {
  hero: '/media/invictvs-aereo-atardecer.jpg',
  structure: '/media/invictvs-unidad.jpg',
  path: '/media/invictvs-frontal.jpg',
} as const
