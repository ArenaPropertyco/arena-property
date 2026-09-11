/**
 * HU-00 · RF-00.2 · D-38 — manifiesto tipado de la home.
 *
 * La página recorre este arreglo y no fija secciones en el marcado: qué hay, en qué
 * orden, con qué título y adónde lleva cada CTA vive aquí, y es lo que prueban los
 * CA por contrato (RT-03, DT-10). Los textos son claves i18n; el contrato comprueba
 * que existan en ambos locales (CA-00.3).
 *
 * El contenido sale del texto oficial del sitio: Invictvs, Bocagrande, los tres
 * pilares del modelo, los seis beneficios, las propiedades activas, el resumen del
 * agendamiento, los tres frentes de Arena y el cierre «Reserva tu cupo».
 */

import { CUPO_PUBLICADO, TEMPORADAS_PUBLICADAS } from './agendamiento'
import { clavesDe, clavesDeSecciones } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DE_SECCION = ['navbar', 'hero', 'business_model', 'benefits', 'properties', 'scheduling', 'what_we_do', 'cta', 'footer'] as const
export type IdDeSeccion = typeof IDS_DE_SECCION[number]

export type { CtaDeSeccion } from './manifiesto'

/** Una sección de la home: el manifiesto genérico con sus identificadores cerrados. */
export type SeccionDeLaHome = SeccionDePagina<IdDeSeccion>

/** Los tres pilares de «¿Qué es Arena Property?» (RF-00.3). */
export const PILARES_DEL_MODELO = ['owner', 'price', 'carefree'] as const
export type PilarDelModelo = typeof PILARES_DEL_MODELO[number]

/** Ventajas del fraccionado frente a una propiedad completa (RF-00.4), en el orden del texto oficial. */
export const BENEFICIOS = ['capital', 'income', 'ownership', 'weeks', 'management', 'transparency'] as const
export type Beneficio = typeof BENEFICIOS[number]

/** RF-00.10 · los tres frentes de Arena: estructura, comercializa y administra. */
export const FRENTES_DE_ARENA = ['structure', 'commercialize', 'manage'] as const
export type FrenteDeArena = typeof FRENTES_DE_ARENA[number]

/** Datos duros del hero, sin cifras estimadas (principio 9): pisos, altura, entrega. */
export const DATOS_DEL_HERO = ['floors', 'height', 'delivery'] as const

/**
 * RF-00.9 · CA-00.6 · la tabla de temporadas de la home **es** la de HU-43: la
 * misma referencia, derivada del criterio de HU-12. Una sola fuente para que la
 * portada no prometa nada distinto de lo que reparte el motor.
 */
export const TEMPORADAS_DE_LA_HOME = TEMPORADAS_PUBLICADAS
export const CUPO_DE_LA_HOME = CUPO_PUBLICADO

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
      'home.model.tagline',
      'home.model.description',
      'home.model.lead',
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
      'home.benefits.lead',
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
    id: 'scheduling',
    orden: 6,
    tituloKey: 'home.scheduling.title',
    claves: [
      'home.scheduling.headline',
      'home.scheduling.description',
      'home.scheduling.columns.season',
      'home.scheduling.columns.weeks',
      'home.scheduling.columns.nights',
      'home.scheduling.columns.minimum',
      'home.scheduling.total',
      'home.scheduling.wholeWeek',
      ...TEMPORADAS_DE_LA_HOME.map(temporada => `scheduling.seasons.names.${temporada.id}`),
    ],
    cta: { labelKey: 'home.scheduling.cta', destino: RUTAS_PUBLICAS.agendamiento },
  },
  {
    id: 'what_we_do',
    orden: 7,
    tituloKey: 'home.whatWeDo.title',
    claves: [
      'home.whatWeDo.headline',
      'home.whatWeDo.description',
      'home.whatWeDo.partner',
      ...clavesDe('home.whatWeDo.items', FRENTES_DE_ARENA, ['title', 'description']),
    ],
    cta: { labelKey: 'home.whatWeDo.cta', destino: RUTAS_PUBLICAS.nosotros },
  },
  {
    id: 'cta',
    orden: 8,
    tituloKey: 'home.cta.title',
    claves: ['home.cta.description', 'home.cta.secondary'],
    cta: { labelKey: 'home.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
  {
    id: 'footer',
    orden: 9,
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
  return clavesDeSecciones(secciones)
}

/**
 * RF-00.1 · el video de fondo del hero (H.264, sin audio, en bucle) con un
 * fotograma fijo como póster mientras carga y como único fondo para quien pidió
 * menos movimiento. Para cambiar el video basta con reemplazar el archivo.
 */
export const FONDO_DEL_HERO = {
  video: '/media/hero.mp4',
  poster: '/media/hero-poster.jpg',
} as const

/** Cuántas propiedades activas muestra la home antes de mandar al catálogo. */
export const PROPIEDADES_EN_LA_HOME = 3

/**
 * Imágenes que ilustran las secciones. Las de Invictvs son fotografía oficial
 * del inmueble; las nombradas por su propósito (`home-*`) son ambientación
 * generada con IA y no retratan ninguna propiedad real, por lo que solo
 * acompañan secciones conceptuales y nunca una ficha de propiedad (P-09).
 */
export const IMAGENES_DE_LA_HOME = {
  /** El activo en primera línea de playa, ambientado. */
  model: '/media/home-modelo.jpg',
  /** Un apartamento dividido en ocho. */
  benefits: '/media/home-fraccion-en-ocho.jpg',
  /** Fondo del banner de propiedades activas. */
  properties: '/media/invictvs-aereo-atardecer.jpg',
  /** El agendamiento: la vida que reparten las seis semanas. */
  scheduling: '/media/home-agendamiento.jpg',
  /** Estructurar, comercializar y administrar. */
  whatWeDo: '/media/home-estructuracion.jpg',
  cta: '/media/invictvs-fachada.jpg',
} as const
