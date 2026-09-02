/**
 * TR-02 · RF-D.6 y RF-D.7 — presentación de cifras con su condición.
 *
 * La plataforma administra dinero ajeno: una cifra estimada jamás puede mostrarse
 * como confirmada (principio 9). Por eso la condición es un campo del dato y viaja
 * con él hasta la vista, que solo la traduce a color. Ninguna vista decide si algo
 * está confirmado, y ninguna repite la aritmética: para eso está este módulo.
 */

import type { CopAmount } from './importe'
import type { Idioma } from './formato'
import { formatearImporte, formatearPorcentaje } from './formato'

/** Condición de una cifra frente al usuario. */
export type Condicion = 'confirmado' | 'estimado'

export interface ImporteConCondicion {
  monto: CopAmount
  condicion: Condicion
}

export interface PorcentajeConCondicion {
  puntosBasicos: number
  condicion: Condicion
}

export interface CifraPresentada {
  texto: string
  condicion: Condicion
  /** Atajo para la vista; equivale a `condicion === 'confirmado'`. */
  esConfirmado: boolean
}

/** Marca un importe como confirmado. */
export function confirmado(monto: CopAmount): ImporteConCondicion {
  return { monto, condicion: 'confirmado' }
}

/** Marca un importe como estimado. */
export function estimado(monto: CopAmount): ImporteConCondicion {
  return { monto, condicion: 'estimado' }
}

/** Importe formateado junto con su condición. */
export function presentarImporte(valor: ImporteConCondicion, idioma: Idioma): CifraPresentada {
  return {
    texto: formatearImporte(valor.monto, idioma),
    condicion: valor.condicion,
    esConfirmado: valor.condicion === 'confirmado',
  }
}

/** Porcentaje formateado junto con su condición. */
export function presentarPorcentaje(valor: PorcentajeConCondicion, idioma: Idioma): CifraPresentada {
  return {
    texto: formatearPorcentaje(valor.puntosBasicos, idioma),
    condicion: valor.condicion,
    esConfirmado: valor.condicion === 'confirmado',
  }
}

/**
 * Color semántico de @nuxt/ui para una condición (principio 8): el verde queda
 * reservado a lo confirmado y lo que no lo está se muestra en rojo. Vive aquí para
 * que ninguna vista elija el color por su cuenta.
 */
export function colorDeCondicion(condicion: Condicion): 'success' | 'error' {
  return condicion === 'confirmado' ? 'success' : 'error'
}
