/**
 * HU-09 · RF-09.1…RF-09.4 — las 8 fracciones de una propiedad.
 *
 * Tres invariantes que este módulo no negocia:
 *
 *   1. Ocho, siempre. No pueden existir 7 ni 9 (RF-09.3), y el fraccionamiento es
 *      atómico: o salen las ocho o no sale ninguna.
 *   2. El precio es dinero (TR-02): entero de pesos y estrictamente mayor que cero.
 *   3. `sold` es terminal salvo para el Superadmin, que es la única vía de vuelta
 *      (traspaso D-17, anulación de compra D-31).
 *
 * El interruptor de calendario vive aquí como dato porque es columna de la fracción,
 * pero **no se marca a mano en ninguna operación**: lo deriva el plan de pagos
 * (HU-58 · RF-58.7). Ninguna función de este módulo lo escribe.
 */

import type { CopAmount } from '../money/importe'
import { esImporte } from '../money/importe'
import type { ComercialDerivado } from './estados'
import { estadoComercialDerivado } from './estados'

/** RF-09.1 · toda propiedad tiene exactamente 8 fracciones. */
export const FRACCIONES_POR_PROPIEDAD = 8

/** Numeración 1/8…8/8, única por propiedad y no editable. */
export const NUMEROS_DE_FRACCION: readonly number[] = Array.from(
  { length: FRACCIONES_POR_PROPIEDAD },
  (_, indice) => indice + 1,
)

export const ESTADOS_DE_FRACCION = ['available', 'reserved', 'sold'] as const
export type EstadoDeFraccion = typeof ESTADOS_DE_FRACCION[number]

/** RF-09.2 · lo que puede hacer cualquiera con permiso sobre la propiedad. */
export const TRANSICIONES_DE_FRACCION: Record<EstadoDeFraccion, readonly EstadoDeFraccion[]> = {
  available: ['reserved'],
  reserved: ['available', 'sold'],
  sold: [],
}

/**
 * Lo que **solo** el Superadmin puede hacer, encima de la tabla anterior: devolver
 * una fracción vendida a disponible. Es la única salida del estado terminal, y
 * existe porque D-17 (traspaso) y D-31 (anulación de compra) la necesitan.
 */
export const TRANSICIONES_DE_SUPERADMIN: Partial<Record<EstadoDeFraccion, readonly EstadoDeFraccion[]>> = {
  sold: ['available'],
}

/** Clave i18n del precio rechazado; `null` significa precio válido. */
export type ClaveDePrecio = 'properties.validation.price_not_positive'

/** Fracción recién creada, antes de existir en la base. */
export interface NuevaFraccion {
  propertyId: string
  number: number
  listPrice: CopAmount
  status: EstadoDeFraccion
  ownerId: string | null
  /** D-31 · lo abre el plan de pagos, nunca el fraccionamiento. */
  calendarActive: false
}

/** El fraccionamiento no pudo hacerse; nada se creó (RF-09.3). */
export class ErrorDeFraccionamiento extends Error {
  readonly clave = 'properties.errors.invalid_fractioning' as const

  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDeFraccionamiento'
  }
}

/** Transición de fracción rechazada (CA-09.3). */
export class ErrorDeTransicionDeFraccion extends Error {
  readonly clave = 'properties.errors.invalid_fraction_transition' as const

  constructor(
    readonly desde: EstadoDeFraccion,
    readonly hacia: EstadoDeFraccion,
    readonly comoSuperadmin: boolean,
  ) {
    super(`Transición inválida de fracción: ${desde} → ${hacia}${comoSuperadmin ? ' (Superadmin)' : ''}.`)
    this.name = 'ErrorDeTransicionDeFraccion'
  }
}

/** RF-09.2 · el precio de una fracción es dinero positivo. */
export function validarPrecioDeFraccion(precio: CopAmount): ClaveDePrecio | null {
  if (!esImporte(precio)) {
    throw new TypeError(`El precio de una fracción debe ser un entero de pesos: ${precio}`)
  }
  return precio > 0 ? null : 'properties.validation.price_not_positive'
}

/**
 * RF-09.3 · crea las 8 fracciones de golpe. Recibe un precio único para todas o los
 * ocho precios en el orden 1/8…8/8. Si algo no cuadra lanza antes de construir nada:
 * quien llama envuelve la escritura en una transacción y no queda a medias.
 */
export function fraccionar(propertyId: string, precio: CopAmount | readonly CopAmount[]): NuevaFraccion[] {
  const precios = Array.isArray(precio)
    ? [...precio as readonly CopAmount[]]
    : Array.from({ length: FRACCIONES_POR_PROPIEDAD }, () => precio as CopAmount)

  if (precios.length !== FRACCIONES_POR_PROPIEDAD) {
    throw new ErrorDeFraccionamiento(
      `Una propiedad se divide en exactamente ${FRACCIONES_POR_PROPIEDAD} fracciones; llegaron ${precios.length} precios.`,
    )
  }

  const invalido = precios.findIndex(valor => validarPrecioDeFraccion(valor) !== null)
  if (invalido >= 0) {
    throw new ErrorDeFraccionamiento(
      `El precio de la fracción ${invalido + 1}/${FRACCIONES_POR_PROPIEDAD} debe ser mayor que cero.`,
    )
  }

  return NUMEROS_DE_FRACCION.map(numero => ({
    propertyId,
    number: numero,
    listPrice: precios[numero - 1]!,
    status: 'available' as const,
    ownerId: null,
    calendarActive: false as const,
  }))
}

export function puedeTransicionarFraccion(
  desde: EstadoDeFraccion,
  hacia: EstadoDeFraccion,
  comoSuperadmin: boolean,
): boolean {
  if (TRANSICIONES_DE_FRACCION[desde].includes(hacia)) {
    return true
  }
  return comoSuperadmin && (TRANSICIONES_DE_SUPERADMIN[desde]?.includes(hacia) ?? false)
}

export function transicionarFraccion(
  desde: EstadoDeFraccion,
  hacia: EstadoDeFraccion,
  comoSuperadmin: boolean,
): EstadoDeFraccion {
  if (!puedeTransicionarFraccion(desde, hacia, comoSuperadmin)) {
    throw new ErrorDeTransicionDeFraccion(desde, hacia, comoSuperadmin)
  }
  return hacia
}

/**
 * RF-09.4 · el estado comercial de la propiedad después de mover una fracción.
 *
 * Se recibe el estado de las ocho y cuál cambia, en vez del agregado ya calculado:
 * así la derivación siempre parte de los hechos completos y no de un resumen que
 * pudo quedar desactualizado (DT-04: nada de estados marcados a mano).
 */
export function recalcularEstadoComercial(
  fracciones: readonly EstadoDeFraccion[],
  numero: number,
  nuevoEstado: EstadoDeFraccion,
): ComercialDerivado {
  if (!NUMEROS_DE_FRACCION.includes(numero)) {
    throw new RangeError(`La fracción ${numero} no existe: la numeración va de 1 a ${FRACCIONES_POR_PROPIEDAD}.`)
  }

  const actualizadas = [...fracciones]
  actualizadas[numero - 1] = nuevoEstado

  return estadoComercialDerivado(actualizadas)
}
