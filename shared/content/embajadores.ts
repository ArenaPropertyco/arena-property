/**
 * HU-48 · RF-48.1…RF-48.4 · D-02 · D-03 · D-04 · D-37 — manifiesto de la página
 * pública del Programa de Embajadores.
 *
 * El flujo (refiero → compra → paga la totalidad → se libera mi comisión), las
 * condiciones resumidas y el monto vigente, que **nunca** va fijo en el código:
 * lo publica el tipo de comisión predeterminado que administra el Superadmin
 * (HU-52, D-37). El CTA depende de la sesión: sin ella, al registro; con ella, a
 * la inscripción de HU-49.
 */

import { formatearImporte, formatearPorcentaje } from '../money/formato'
import type { Idioma } from '../money/formato'
import type { CopAmount } from '../money/importe'
import { ATTRIBUTION_WINDOW_DAYS } from '../referrals/attribution'
import type { CommissionKind, CommissionType } from '../referrals/commission'
import { clavesDe } from './manifiesto'
import type { SeccionDePagina } from './manifiesto'
import { RUTAS_PUBLICAS } from './rutas'

export const IDS_DE_EMBAJADORES = ['hero', 'flow', 'commission', 'terms', 'cta'] as const
export type IdDeEmbajadores = typeof IDS_DE_EMBAJADORES[number]

export type SeccionDeEmbajadores = SeccionDePagina<IdDeEmbajadores>

/** RF-48.1 · los cuatro pasos del programa, en el orden en que ocurren. */
export const PASOS_DEL_PROGRAMA = ['refer', 'purchase', 'pay', 'release'] as const
export type PasoDelPrograma = typeof PASOS_DEL_PROGRAMA[number]

/** RF-48.3 · las condiciones que se publican: las decisiones vigentes del programa. */
export const CONDICIONES_DEL_PROGRAMA = ['window', 'first_click', 'no_self', 'one_commission', 'grace', 'minimum', 'roles'] as const
export type CondicionDelPrograma = typeof CONDICIONES_DEL_PROGRAMA[number]

/** Cifras de las decisiones que las condiciones citan; salen del dominio, no de la vista. */
export const CIFRAS_DEL_PROGRAMA = {
  /** D-03 · días de la ventana de atribución desde el primer clic. */
  ventanaDias: ATTRIBUTION_WINDOW_DAYS,
  /** D-02 · días de gracia desde el pago completo hasta que la comisión es retirable. */
  graciaDias: 30,
} as const

/** RF-48.4 · adonde va el CTA con sesión: la inscripción como Embajador (HU-49). */
export const RUTA_DE_INSCRIPCION = '/panel/embajador' as const

/** CA-48.2 · sin sesión, primero el registro (HU-04); con sesión, la inscripción. */
export function destinoDelCtaDeEmbajadores(sesion: { autenticado: boolean }): string {
  return sesion.autenticado ? RUTA_DE_INSCRIPCION : RUTAS_PUBLICAS.registro
}

export interface ComisionPublicada {
  kind: CommissionKind
  name: string
  /** La cifra ya formateada por TR-02, para pintarla en IBM Plex Mono. */
  texto: string
}

/**
 * CA-48.1 · RF-48.2 · el monto vigente tal como se publica: el tipo
 * predeterminado con su cifra formateada. Sin tipo no se inventa nada.
 */
export function comisionPublicada(tipo: CommissionType | null, idioma: Idioma): ComisionPublicada | null {
  if (!tipo) {
    return null
  }
  return {
    kind: tipo.kind,
    name: tipo.name,
    texto: tipo.kind === 'fixed'
      ? formatearImporte((tipo.amount ?? 0) as CopAmount, idioma)
      : formatearPorcentaje(tipo.basisPoints ?? 0, idioma),
  }
}

export const SECCIONES_DE_EMBAJADORES: readonly SeccionDeEmbajadores[] = [
  {
    id: 'hero',
    orden: 1,
    tituloKey: 'ambassadors.hero.title',
    claves: ['ambassadors.hero.headline', 'ambassadors.hero.description'],
  },
  {
    id: 'flow',
    orden: 2,
    tituloKey: 'ambassadors.flow.title',
    claves: [
      'ambassadors.flow.headline',
      'ambassadors.flow.description',
      ...clavesDe('ambassadors.flow.steps', PASOS_DEL_PROGRAMA, ['title', 'description']),
    ],
  },
  {
    id: 'commission',
    orden: 3,
    tituloKey: 'ambassadors.commission.title',
    claves: [
      'ambassadors.commission.headline',
      'ambassadors.commission.description',
      'ambassadors.commission.percentageHint',
      'ambassadors.commission.fixedHint',
      'ambassadors.commission.unavailable',
    ],
  },
  {
    id: 'terms',
    orden: 4,
    tituloKey: 'ambassadors.terms.title',
    claves: [
      'ambassadors.terms.headline',
      'ambassadors.terms.description',
      ...clavesDe('ambassadors.terms.items', CONDICIONES_DEL_PROGRAMA, ['title', 'description']),
    ],
  },
  {
    id: 'cta',
    orden: 5,
    tituloKey: 'ambassadors.cta.title',
    claves: ['ambassadors.cta.description', 'ambassadors.cta.signedIn'],
    cta: { labelKey: 'ambassadors.cta.cta', destino: RUTAS_PUBLICAS.registro },
  },
]

export const IMAGENES_DE_EMBAJADORES = {
  hero: '/media/invictvs-hero.jpg',
} as const
