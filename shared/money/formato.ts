/**
 * TR-02 · RF-D.5 — presentación de importes y porcentajes.
 *
 * Los importes se formatean con `Intl.NumberFormat` en `es-CO` / `en-US` y sin
 * decimales, porque el COP no opera con centavos. Los porcentajes se muestran con
 * un decimal. Las regiones son las mismas que declaran los locales de @nuxtjs/i18n
 * en `nuxt.config.ts`, para que no existan dos verdades sobre el idioma.
 *
 * El espacio antes del `%` en español lo fija la spec (CA-D.6): `Intl` en `es-CO`
 * no lo pone, así que se compone aparte en lugar de usar `style: 'percent'`.
 *
 * La tipografía de cifras (IBM Plex Mono) la aplica la interfaz con el token de
 * marca; aquí solo se produce el texto.
 */

import type { CopAmount } from './importe'
import { PUNTOS_BASICOS_TOTALES } from './comision'

/** Idiomas de la plataforma (RT-05). */
export type Idioma = 'es' | 'en'

const REGION: Record<Idioma, string> = {
  es: 'es-CO',
  en: 'en-US',
}

/** Región BCP 47 con que se formatea cada idioma. */
export function regionDe(idioma: Idioma): string {
  return REGION[idioma]
}

/** Importe en pesos, sin decimales, en el idioma indicado. */
export function formatearImporte(monto: CopAmount, idioma: Idioma): string {
  return new Intl.NumberFormat(REGION[idioma], {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(monto)
}

/** Porcentaje con un decimal, a partir de puntos básicos enteros. */
export function formatearPorcentaje(puntos: number, idioma: Idioma): string {
  const porcentaje = (puntos / PUNTOS_BASICOS_TOTALES) * 100

  const numero = new Intl.NumberFormat(REGION[idioma], {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(porcentaje)

  return idioma === 'es' ? `${numero} %` : `${numero}%`
}

/**
 * Proporción `parte / total` expresada en puntos básicos enteros.
 * Redondea al punto básico más cercano: la presentación solo muestra un decimal.
 */
export function proporcionEnPuntosBasicos(parte: number, total: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new RangeError(`El total debe ser un entero positivo para calcular una proporción: ${total}`)
  }

  return Math.round((parte / total) * PUNTOS_BASICOS_TOTALES)
}
