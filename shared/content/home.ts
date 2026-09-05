/**
 * HU-00 · RF-00.2 — manifiesto tipado de la home.
 *
 * La página recorre este arreglo y no fija secciones en el marcado: qué hay, en qué
 * orden, con qué título y adónde lleva cada CTA vive aquí, y es lo que prueban los
 * CA por contrato (RT-03, DT-10). Los textos son claves i18n; el contrato comprueba
 * que existan en ambos locales (CA-00.3).
 *
 * El contenido sale del sitio oficial (arena-property.com): Invictvs, Bocagrande,
 * los tres pilares del modelo, las propiedades activas y el cierre «Reserva tu cupo».
 */

import { RUTAS_PUBLICAS } from './rutas'
import type { RutaPublica } from './rutas'

export const IDS_DE_SECCION = ['navbar', 'hero', 'business_model', 'benefits', 'properties', 'cta', 'footer'] as const
export type IdDeSeccion = typeof IDS_DE_SECCION[number]

export interface CtaDeSeccion {
  labelKey: string
  destino: RutaPublica
}

export interface SeccionDeLaHome {
  id: IdDeSeccion
  orden: number
  tituloKey: string
  /** Claves i18n adicionales que la sección pinta (antetítulo, descripción, ítems). */
  claves: readonly string[]
  cta?: CtaDeSeccion
}

/** Los tres pilares de «¿Qué es Arena Property?» (RF-00.3). */
export const PILARES_DEL_MODELO = ['owner', 'price', 'carefree'] as const
export type PilarDelModelo = typeof PILARES_DEL_MODELO[number]

/** Ventajas del fraccionado frente a una propiedad completa (RF-00.4). */
export const BENEFICIOS = ['capital', 'weeks', 'income', 'management', 'ownership', 'transparency'] as const
export type Beneficio = typeof BENEFICIOS[number]

/** Datos duros del hero, sin cifras estimadas (principio 9): pisos, altura, entrega. */
export const DATOS_DEL_HERO = ['floors', 'height', 'delivery'] as const

function clavesDe(prefijo: string, ids: readonly string[], campos: readonly string[]): string[] {
  return ids.flatMap(id => campos.map(campo => `${prefijo}.${id}.${campo}`))
}

export const SECCIONES_DE_LA_HOME: readonly SeccionDeLaHome[] = [
  {
    id: 'navbar',
    orden: 1,
    tituloKey: 'home.sections.navbar',
    claves: [],
  },
  {
    id: 'hero',
    orden: 2,
    tituloKey: 'home.hero.title',
    claves: [
      'home.hero.headline',
      'home.hero.description',
      'home.hero.secondary',
      'home.hero.videoLabel',
      ...clavesDe('home.hero.facts', DATOS_DEL_HERO, ['value', 'label']),
    ],
    cta: { labelKey: 'home.hero.cta', destino: RUTAS_PUBLICAS.catalogo },
  },
  {
    id: 'business_model',
    orden: 3,
    tituloKey: 'home.model.title',
    claves: [
      'home.model.headline',
      'home.model.description',
      ...clavesDe('home.model.pillars', PILARES_DEL_MODELO, ['title', 'description']),
    ],
    cta: { labelKey: 'home.model.cta', destino: RUTAS_PUBLICAS.modelo },
  },
  {
    id: 'benefits',
    orden: 4,
    tituloKey: 'home.benefits.title',
    claves: [
      'home.benefits.headline',
      'home.benefits.description',
      ...clavesDe('home.benefits.items', BENEFICIOS, ['title', 'description']),
    ],
    cta: { labelKey: 'home.benefits.cta', destino: RUTAS_PUBLICAS.beneficios },
  },
  {
    id: 'properties',
    orden: 5,
    tituloKey: 'home.properties.title',
    claves: ['home.properties.headline', 'home.properties.description', 'home.properties.empty'],
    cta: { labelKey: 'home.properties.cta', destino: RUTAS_PUBLICAS.catalogo },
  },
  {
    id: 'cta',
    orden: 6,
    tituloKey: 'home.cta.title',
    claves: ['home.cta.description', 'home.cta.secondary'],
    cta: { labelKey: 'home.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
  {
    id: 'footer',
    orden: 7,
    tituloKey: 'home.sections.footer',
    claves: [],
  },
]

/** Las secciones que la página pinta entre la cabecera y el pie, en su orden. */
export function seccionesDeContenido(secciones: readonly SeccionDeLaHome[] = SECCIONES_DE_LA_HOME): SeccionDeLaHome[] {
  return [...secciones]
    .filter(seccion => seccion.id !== 'navbar' && seccion.id !== 'footer')
    .sort((a, b) => a.orden - b.orden)
}

/** Todas las claves i18n que el manifiesto promete (CA-00.3). */
export function clavesDelManifiesto(secciones: readonly SeccionDeLaHome[]): string[] {
  return [...new Set(secciones.flatMap(seccion => [
    seccion.tituloKey,
    ...seccion.claves,
    ...(seccion.cta ? [seccion.cta.labelKey] : []),
  ]))]
}

/**
 * RF-00.1 · el fondo animado del hero: el GIF oficial de Invictvs, con un fotograma
 * fijo como póster mientras carga y para quien pidió menos movimiento.
 */
export const FONDO_DEL_HERO = {
  gif: '/media/hero.gif',
  poster: '/media/hero-poster.jpg',
} as const

/** Cuántas propiedades activas muestra la home antes de mandar al catálogo. */
export const PROPIEDADES_EN_LA_HOME = 3

/** Imágenes oficiales que ilustran las secciones. */
export const IMAGENES_DE_LA_HOME = {
  model: '/media/invictvs-unidad.jpg',
  benefits: '/media/invictvs-terraza.jpg',
  cta: '/media/invictvs-fachada.jpg',
} as const
