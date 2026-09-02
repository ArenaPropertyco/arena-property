/**
 * TR-02 · RF-D.4 — comisión porcentual del programa de referidos (HU-52).
 *
 * El porcentaje se guarda como entero de **puntos básicos** (10 % = 1000 pb) para
 * que nunca exista un porcentaje en coma flotante. La comisión es el truncamiento
 * al peso de `precio × porcentaje ÷ 100`.
 *
 * La multiplicación intermedia se hace en `bigint`: `precio × pb` puede superar el
 * rango exacto de `number` aunque el resultado final no lo haga, y un redondeo ahí
 * sería precisamente el error silencioso que prohíbe el principio 9.
 */

import type { CopAmount } from './importe'
import { pesos } from './importe'

/** Puntos básicos que equivalen a un punto porcentual. */
export const PUNTOS_BASICOS_POR_CIENTO = 100

/** Puntos básicos que equivalen al 100 %. */
export const PUNTOS_BASICOS_TOTALES = 10_000

/** Convierte un porcentaje legible (10, 3.33) en puntos básicos enteros. */
export function puntosBasicos(porcentaje: number): number {
  const convertido = porcentaje * PUNTOS_BASICOS_POR_CIENTO

  if (!Number.isInteger(Math.round(convertido * 1e6) / 1e6) || Math.abs(convertido - Math.round(convertido)) > 1e-9) {
    throw new RangeError(`Un porcentaje admite como máximo dos decimales: ${porcentaje}`)
  }

  return Math.round(convertido)
}

/** Comisión truncada al peso sobre un precio, con el porcentaje en puntos básicos. */
export function comision(precio: CopAmount, puntos: number): CopAmount {
  if (!Number.isInteger(puntos) || puntos < 0) {
    throw new RangeError(`Los puntos básicos deben ser un entero no negativo: ${puntos}`)
  }

  const producto = BigInt(precio) * BigInt(puntos)
  const truncada = producto / BigInt(PUNTOS_BASICOS_TOTALES)

  return pesos(Number(truncada))
}
