/**
 * HU-02 · RF-02.1, RF-02.3, RF-02.5 — cómo se resuelve la ficha pública de una
 * propiedad y en qué modo se presenta su plano elevado.
 */

import type { PropiedadPublica } from './catalogo-publico'
import { FRACCIONES_POR_PROPIEDAD } from './fracciones'
import type { MedioConUrl } from './vistas'

/** La ficha completa de RF-02.2 y RF-02.3, con sus medios ya firmados. */
export interface PropiedadPublicada extends PropiedadPublica {
  description: string
  amenities: string[]
  address: string | null
  videoUrl: string | null
  soldFractions: number
  fotos: MedioConUrl[]
  plano: MedioConUrl | null
  video: MedioConUrl | null
}

/** Campos que toda ficha publicada trae (CA-02.1). */
export const CAMPOS_DEL_DETALLE = [
  'id', 'slug', 'name', 'region', 'city', 'country', 'commercial', 'lowestPrice', 'availableFractions',
  'areaM2', 'bedrooms', 'bathrooms', 'parkingSpots', 'description', 'amenities', 'address', 'videoUrl',
  'fotos', 'plano', 'video',
] as const satisfies readonly (keyof PropiedadPublicada)[]

export type ResolucionDeDetalle
  = | { estado: 'no_encontrada' }
    | { estado: 'publicada', propiedad: PropiedadPublicada }
    /** RF-02.1 · el Administrador asignado y el Superadmin ven un borrador con distintivo. */
    | { estado: 'vista_previa', propiedad: PropiedadPublicada }

/**
 * RF-02.1 · qué hace la página con lo que la base devolvió. La RLS ya decidió si la
 * fila llega: al Visitante no le llega un borrador (404); a quien gestiona sí, y se
 * le muestra como vista previa.
 */
export function resolverDetalle(
  propiedad: PropiedadPublicada | null,
  actor: { puedeGestionar: boolean },
): ResolucionDeDetalle {
  if (!propiedad) {
    return { estado: 'no_encontrada' }
  }
  if (propiedad.visibility === 'published') {
    return { estado: 'publicada', propiedad }
  }
  return actor.puedeGestionar ? { estado: 'vista_previa', propiedad } : { estado: 'no_encontrada' }
}

/** CA-02.3 · RF-09.4 · disponibles = 8 − vendidas, acotado al rango posible. */
export function fraccionesDisponibles(vendidas: number): number {
  return Math.min(FRACCIONES_POR_PROPIEDAD, Math.max(0, FRACCIONES_POR_PROPIEDAD - vendidas))
}

export type ModoDelPlano = 'visor3d' | 'imagen'

/** CA-02.4 · sin WebGL o con movimiento reducido, la imagen estática; si no, el visor 3D. */
export function modoDelPlano(entorno: { webgl: boolean, reducirMovimiento: boolean }): ModoDelPlano {
  return entorno.webgl && !entorno.reducirMovimiento ? 'visor3d' : 'imagen'
}
