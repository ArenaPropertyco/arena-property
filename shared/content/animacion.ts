/**
 * HU-00 · RF-00.7 · RT-12 — la configuración de `nuxt-aos` de cada sección, resuelta
 * por una función pura. Con `prefers-reduced-motion` no hay movimiento: la sección
 * aparece sin más (CA-00.4). La página solo extiende el resultado como atributos.
 *
 * Vale para cualquier página institucional: recibe el manifiesto y escalona las
 * entradas por la posición de cada sección dentro de él.
 */

import type { IdDeSeccion, SeccionDeLaHome } from './home'
import { SECCIONES_DE_LA_HOME } from './home'
import type { SeccionDePagina } from './manifiesto'
import { seccionesOrdenadas } from './manifiesto'

export type Animacion = Readonly<Record<string, string | number>>

/** Sin atributos: AOS no interviene y el marcado aparece estático. */
export const SIN_ANIMACION: Animacion = Object.freeze({})

export interface PreferenciasDeMovimiento {
  reducirMovimiento: boolean
}

/** Milisegundos entre una sección y la siguiente cuando entran escalonadas. */
const RETRASO_ENTRE_SECCIONES = 80

/** Secciones estructurales que nunca se animan: las pone el layout, no la página. */
const SIN_ANIMAR: readonly string[] = ['navbar', 'footer']

export function tieneAnimacion(animacion: Animacion): boolean {
  return 'data-aos' in animacion
}

/** Las secciones que la página pinta entre la cabecera y el pie, en su orden. */
function contenido<T extends SeccionDePagina>(secciones: readonly T[]): T[] {
  return seccionesOrdenadas(secciones).filter(seccion => !SIN_ANIMAR.includes(seccion.id))
}

export function animacionDeSeccion(
  seccion: SeccionDePagina,
  preferencias: PreferenciasDeMovimiento,
  secciones: readonly SeccionDePagina[] = SECCIONES_DE_LA_HOME,
): Animacion {
  if (preferencias.reducirMovimiento || SIN_ANIMAR.includes(seccion.id)) {
    return SIN_ANIMACION
  }

  const posicion = contenido(secciones).findIndex(candidata => candidata.id === seccion.id)

  return {
    'data-aos': 'fade-up',
    'data-aos-delay': Math.max(posicion, 0) * RETRASO_ENTRE_SECCIONES,
  }
}

/** La animación de cada sección de una página, por identificador. */
export function animacionesDePagina<Id extends string>(
  secciones: readonly SeccionDePagina<Id>[],
  preferencias: PreferenciasDeMovimiento,
): Record<Id, Animacion> {
  return Object.fromEntries(
    secciones.map(seccion => [seccion.id, animacionDeSeccion(seccion, preferencias, secciones)]),
  ) as Record<Id, Animacion>
}

export function animacionesDeLaHome(
  secciones: readonly SeccionDeLaHome[],
  preferencias: PreferenciasDeMovimiento,
): Record<IdDeSeccion, Animacion> {
  return animacionesDePagina(secciones, preferencias)
}
