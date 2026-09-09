/**
 * HU-12 · RF-12.4, RF-12.5 · D-13, D-27 · schedule.md P-07, I-05, I-06 — las dos
 * rotaciones del motor, ambas deterministas sobre `año − año base`:
 *
 * - **Posición de reparto.** La fracción f ocupa la posición (f − 1 + d) mod 8,
 *   con d el desplazamiento del año. Cada año todas se corren una posición, así
 *   que nadie repite y en 8 años cada fracción pasa por las 8.
 * - **Bloques pico.** El bloque b va a la fracción (d + 3b) mod 8. Los tres
 *   bloques caen en fracciones distintas el mismo año (0, 3, 6), y con d
 *   corriéndose de uno en uno, cada fracción recibe cada bloque una vez en 8 años.
 */

import { FRACCIONES_POR_PROPIEDAD } from '../properties/fracciones'
import { BLOQUES_PICO } from './temporadas'
import type { BloquePico } from './temporadas'

export const POSICIONES = FRACCIONES_POR_PROPIEDAD

/** Separación entre bloques pico dentro del mismo año, para que no coincidan en una fracción. */
const SALTO_ENTRE_BLOQUES = 3

function modulo(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** (año − año base) módulo 8, también para años anteriores a la base. */
export function desplazamiento(anio: number, anioBase: number): number {
  return modulo(anio - anioBase, POSICIONES)
}

/** Posición 0..7 de la fracción 1..8 en el año. */
export function posicionDe(fraccion: number, anio: number, anioBase: number): number {
  return modulo(fraccion - 1 + desplazamiento(anio, anioBase), POSICIONES)
}

/** La fracción 1..8 que ocupa la posición 0..7 en el año. */
export function fraccionEnPosicion(posicion: number, anio: number, anioBase: number): number {
  return modulo(posicion - desplazamiento(anio, anioBase), POSICIONES) + 1
}

/** D-27 · la fracción 1..8 a la que le toca el bloque pico en el año. */
export function fraccionDelBloque(bloque: BloquePico, anio: number, anioBase: number): number {
  const orden = BLOQUES_PICO.indexOf(bloque)
  return modulo(desplazamiento(anio, anioBase) + SALTO_ENTRE_BLOQUES * orden, POSICIONES) + 1
}
