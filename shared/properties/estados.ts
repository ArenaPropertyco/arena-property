/**
 * HU-08 · RF-08.2, RF-08.3, RF-08.4 — las dos máquinas de estado de la propiedad.
 *
 * D-18 fija un vocabulario único y **dos ejes que no se mezclan**:
 *
 *   Visibilidad · `draft` → `published` ↔ `inactive`
 *     Quién la ve. Solo `published` aparece en el catálogo público (HU-01).
 *
 *   Comercial · `coming_soon` → (`fractions_available` ↔ `sold_out`)
 *     Si está a la venta. `coming_soon` lo marca el Administrador a mano; los otros
 *     dos **se derivan** de las 8 fracciones (HU-09) y nadie los escribe.
 *
 * RF-08.4 exige que las transiciones válidas sean explícitas y que toda inválida se
 * rechace. Se modelan como tablas de datos, no como cadenas de `if`: así el test
 * puede recorrer los pares posibles y añadir un estado obliga a decidir su fila.
 */

import { FRACCIONES_POR_PROPIEDAD } from './fracciones'
import type { EstadoDeFraccion } from './fracciones'

export const VISIBILIDADES = ['draft', 'published', 'inactive'] as const
export type Visibilidad = typeof VISIBILIDADES[number]

export const COMERCIALES = ['coming_soon', 'fractions_available', 'sold_out'] as const
export type EstadoComercial = typeof COMERCIALES[number]

/** Estado comercial que se deriva de las fracciones; `coming_soon` nunca se deriva. */
export type ComercialDerivado = Exclude<EstadoComercial, 'coming_soon'>

export type Maquina = 'visibility' | 'commercial'

/**
 * Transiciones de visibilidad, tal como las dibuja RF-08.2.
 *
 * No hay vuelta a `draft`: lo que ya se mostró al público no puede volver a ser un
 * borrador. Retirarlo del catálogo es `inactive`, que sí es reversible (RF-11.4).
 */
export const TRANSICIONES_DE_VISIBILIDAD: Record<Visibilidad, readonly Visibilidad[]> = {
  draft: ['published'],
  published: ['inactive'],
  inactive: ['published'],
}

/**
 * Transiciones comerciales. `coming_soon` es una puerta de salida sin retorno:
 * RF-08.3 dice que la derivación manda «en cuanto la propiedad sale de Próximamente»,
 * y volver a anunciarla como futura después de haberla puesto a la venta contradice
 * lo que ya vio quien la estaba mirando (principio 9).
 */
export const TRANSICIONES_COMERCIALES: Record<EstadoComercial, readonly EstadoComercial[]> = {
  coming_soon: ['fractions_available', 'sold_out'],
  fractions_available: ['sold_out'],
  sold_out: ['fractions_available'],
}

/** Error tipado de una transición rechazada (RF-08.4). */
export class ErrorDeTransicion extends Error {
  readonly clave = 'properties.errors.invalid_transition' as const

  constructor(
    readonly maquina: Maquina,
    readonly desde: string,
    readonly hacia: string,
  ) {
    super(`Transición inválida en la máquina ${maquina}: ${desde} → ${hacia}.`)
    this.name = 'ErrorDeTransicion'
  }
}

export function puedeTransicionarVisibilidad(desde: Visibilidad, hacia: Visibilidad): boolean {
  return TRANSICIONES_DE_VISIBILIDAD[desde].includes(hacia)
}

export function transicionarVisibilidad(desde: Visibilidad, hacia: Visibilidad): Visibilidad {
  if (!puedeTransicionarVisibilidad(desde, hacia)) {
    throw new ErrorDeTransicion('visibility', desde, hacia)
  }
  return hacia
}

export function puedeTransicionarComercial(desde: EstadoComercial, hacia: EstadoComercial): boolean {
  return TRANSICIONES_COMERCIALES[desde].includes(hacia)
}

export function transicionarComercial(desde: EstadoComercial, hacia: EstadoComercial): EstadoComercial {
  if (!puedeTransicionarComercial(desde, hacia)) {
    throw new ErrorDeTransicion('commercial', desde, hacia)
  }
  return hacia
}

/** RF-08.2 · qué visibilidad se muestra en el catálogo público. */
export function apareceEnCatalogo(visibilidad: Visibilidad): boolean {
  return visibilidad === 'published'
}

/** HU-47 · condición de lista de espera: no queda ninguna fracción a la venta. */
export function hayFraccionesDisponibles(fracciones: readonly EstadoDeFraccion[]): boolean {
  return fracciones.includes('available')
}

/**
 * CA-08.2 · el estado comercial que sale de las 8 fracciones.
 *
 * `sold_out` exige las ocho vendidas. Todo lo demás sigue a la venta: una fracción
 * reservada puede caerse y volver a `available`, así que anunciar «Vendido» con
 * reservas en curso sería declarar como confirmado algo que no lo está. Que no queden
 * disponibles en este momento es la condición de lista de espera de HU-47, no un
 * estado (D-18: «Lista de espera no es un estado»).
 */
export function estadoComercialDerivado(fracciones: readonly EstadoDeFraccion[]): ComercialDerivado {
  if (fracciones.length !== FRACCIONES_POR_PROPIEDAD) {
    throw new RangeError(
      `El estado comercial se deriva de exactamente ${FRACCIONES_POR_PROPIEDAD} fracciones; llegaron ${fracciones.length}.`,
    )
  }

  return fracciones.every(estado => estado === 'sold') ? 'sold_out' : 'fractions_available'
}

/**
 * RF-08.3 · el estado comercial tal como lo lee la interfaz: mientras el
 * Administrador la tenga marcada como «Próximamente», no se deriva nada.
 */
export function estadoComercial(
  proximamente: boolean,
  fracciones: readonly EstadoDeFraccion[],
): EstadoComercial {
  return proximamente ? 'coming_soon' : estadoComercialDerivado(fracciones)
}
