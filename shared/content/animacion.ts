/**
 * HU-00 · RF-00.7 · RT-12 — la configuración de `nuxt-aos` de cada sección, resuelta
 * por una función pura. Con `prefers-reduced-motion` no hay movimiento: la sección
 * aparece sin más (CA-00.4). La página solo extiende el resultado como atributos.
 */

import type { IdDeSeccion, SeccionDeLaHome } from './home'
import { seccionesDeContenido } from './home'

export type Animacion = Readonly<Record<string, string | number>>

/** Sin atributos: AOS no interviene y el marcado aparece estático. */
export const SIN_ANIMACION: Animacion = Object.freeze({})

export interface PreferenciasDeMovimiento {
  reducirMovimiento: boolean
}

/** Milisegundos entre una sección y la siguiente cuando entran escalonadas. */
const RETRASO_ENTRE_SECCIONES = 80

export function tieneAnimacion(animacion: Animacion): boolean {
  return 'data-aos' in animacion
}

export function animacionDeSeccion(seccion: SeccionDeLaHome, preferencias: PreferenciasDeMovimiento): Animacion {
  if (preferencias.reducirMovimiento || seccion.id === 'navbar' || seccion.id === 'footer') {
    return SIN_ANIMACION
  }

  const posicion = seccionesDeContenido().findIndex(candidata => candidata.id === seccion.id)

  return {
    'data-aos': 'fade-up',
    'data-aos-delay': Math.max(posicion, 0) * RETRASO_ENTRE_SECCIONES,
  }
}

export function animacionesDeLaHome(
  secciones: readonly SeccionDeLaHome[],
  preferencias: PreferenciasDeMovimiento,
): Record<IdDeSeccion, Animacion> {
  return Object.fromEntries(
    secciones.map(seccion => [seccion.id, animacionDeSeccion(seccion, preferencias)]),
  ) as Record<IdDeSeccion, Animacion>
}
