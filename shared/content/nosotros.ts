/**
 * HU-44 · RF-44.1…RF-44.4 — manifiesto de Sobre Nosotros: quiénes somos, las
 * preguntas frecuentes, los testimonios y la información de interés.
 *
 * Preguntas y testimonios son estructuras tipadas e iterables (RF-44.2): cada
 * entrada tiene identificador y claves i18n, y los criterios se prueban contra
 * ellas y contra el manifiesto, no contra el marcado (RT-03).
 */

import { clavesDe } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DE_NOSOTROS = ['who_we_are', 'faq', 'testimonials', 'info'] as const
export type IdDeNosotros = typeof IDS_DE_NOSOTROS[number]

export type SeccionDeNosotros = SeccionDePagina<IdDeNosotros>

export interface PreguntaFrecuente {
  id: string
  preguntaKey: string
  respuestaKey: string
}

const PREGUNTAS = ['what_is', 'ownership', 'weeks', 'expenses', 'income', 'transfer', 'operator', 'arena_role'] as const

/** RF-44.2 · las preguntas frecuentes, en el orden en que se leen. */
export const PREGUNTAS_FRECUENTES: readonly PreguntaFrecuente[] = PREGUNTAS.map(id => ({
  id,
  preguntaKey: `about.faq.items.${id}.question`,
  respuestaKey: `about.faq.items.${id}.answer`,
}))

export interface Testimonio {
  id: string
  autorKey: string
  rolKey: string
  citaKey: string
}

const VOCES = ['structuring', 'administration', 'operator'] as const

/**
 * RF-44.2 · testimonios como estructura iterable. Son las voces del equipo sobre
 * su compromiso en cada frente; se sustituyen por los de copropietarios cuando
 * existan, sin tocar la estructura.
 */
export const TESTIMONIOS: readonly Testimonio[] = VOCES.map(id => ({
  id,
  autorKey: `about.testimonials.items.${id}.author`,
  rolKey: `about.testimonials.items.${id}.role`,
  citaKey: `about.testimonials.items.${id}.quote`,
}))

/** RF-44.1 · la información de interés: lo que conviene saber antes de comprar. */
export const INFORMACION_DE_INTERES = ['trust', 'company', 'operator', 'expenses', 'transfer'] as const
export type InformacionDeInteres = typeof INFORMACION_DE_INTERES[number]

/** Quiénes somos: los tres frentes permanentes de Arena. */
export const FRENTES = ['structure', 'commercialize', 'manage'] as const

export const SECCIONES_DE_NOSOTROS: readonly SeccionDeNosotros[] = [
  {
    id: 'who_we_are',
    orden: 1,
    tituloKey: 'about.whoWeAre.title',
    claves: [
      'about.whoWeAre.headline',
      'about.whoWeAre.description',
      'about.whoWeAre.founder',
      ...clavesDe('about.whoWeAre.fronts', FRENTES, ['title', 'description']),
    ],
  },
  {
    id: 'faq',
    orden: 2,
    tituloKey: 'about.faq.title',
    claves: ['about.faq.headline', 'about.faq.description'],
  },
  {
    id: 'testimonials',
    orden: 3,
    tituloKey: 'about.testimonials.title',
    claves: ['about.testimonials.headline', 'about.testimonials.description'],
  },
  {
    id: 'info',
    orden: 4,
    tituloKey: 'about.info.title',
    claves: [
      'about.info.headline',
      'about.info.description',
      'about.info.ctaDescription',
      ...clavesDe('about.info.items', INFORMACION_DE_INTERES, ['title', 'description']),
    ],
    cta: { labelKey: 'about.info.cta', destino: RUTAS_PUBLICAS.registro },
  },
]

export const IMAGENES_DE_NOSOTROS = {
  /** La conversación privada, uno a uno. Ambientación generada (P-09). */
  whoWeAre: '/media/nosotros-quienes-somos.jpg',
  info: '/media/invictvs-fachada.jpg',
} as const
