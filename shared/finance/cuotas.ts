/**
 * HU-23 · RF-23.3, RF-23.6 · D-08, D-31 · TR-02 RF-D.2, RF-D.3 — las 8 cuotas de
 * un movimiento y quién paga cada una.
 *
 * El prorrateo es siempre 1/8 fijo y lo hace la función canónica de `shared/money`:
 * la suma de las cuotas es exactamente el monto y el residuo va a las primeras
 * fracciones por número ascendente, marcadas para que HU-24 lo haga explícito.
 *
 * El pagador es la traducción de D-08 y D-31: la cuota de una fracción sin vender,
 * o vendida con el calendario inactivo, la asume el **titular del inventario**
 * (Arena o el vendedor). El Propietario empieza a asumirla desde la primera
 * causación posterior a la activación de su calendario (RF-23.6): por eso se compara
 * la fecha de causación con la de activación, leída en la zona del negocio.
 *
 * La base repite este mismo cálculo en el disparador de `movements`, para que una
 * ruta nueva no pueda producir cuotas distintas de las que aquí se prueban.
 */

import { hoy } from '../dates/formato'
import type { CopAmount } from '../money/importe'
import { FRACCIONES_POR_PROPIEDAD, prorratear } from '../money/prorrateo'
import type { EstadoDeFraccion } from '../properties/fracciones'

/** Quién asume una cuota: el Propietario de la fracción o el titular del inventario. */
export const PAGADORES = ['owner', 'inventory_holder'] as const
export type Pagador = typeof PAGADORES[number]

/** Lo que de una fracción decide su cuota. */
export interface FraccionParaCuota {
  number: number
  status: EstadoDeFraccion
  ownerId: string | null
  calendarActive: boolean
  /** Instante ISO en que se activó el derecho de uso; `null` si nunca o si está apagado. */
  calendarActivatedAt: string | null
}

export interface CuotaGenerada {
  fraction: number
  amount: CopAmount
  /** RF-D.3 · absorbió un peso del residuo. */
  hasRemainder: boolean
  payer: Pagador
  /** Cuenta del Propietario cuando paga él; `null` cuando paga el titular del inventario. */
  payerId: string | null
}

export interface PagadorDeCuota {
  payer: Pagador
  payerId: string | null
}

/**
 * RF-23.6 · CA-23.7 · quién paga la cuota de una fracción para una causación dada.
 * El Propietario solo desde la primera causación posterior (o igual) a la activación.
 */
export function pagadorDe(fraccion: FraccionParaCuota, incurredOn: string): PagadorDeCuota {
  const activadoEl = fraccion.calendarActivatedAt ? hoy(new Date(fraccion.calendarActivatedAt)) : null
  const propietarioAsume = fraccion.status === 'sold'
    && fraccion.ownerId !== null
    && fraccion.calendarActive
    && activadoEl !== null
    && activadoEl <= incurredOn

  return propietarioAsume
    ? { payer: 'owner', payerId: fraccion.ownerId }
    : { payer: 'inventory_holder', payerId: null }
}

/** RF-23.3 · las 8 cuotas de un movimiento, por número de fracción ascendente. */
export function generarCuotas(
  monto: CopAmount,
  fracciones: readonly FraccionParaCuota[],
  incurredOn: string,
): CuotaGenerada[] {
  const ordenadas = [...fracciones].sort((a, b) => a.number - b.number)
  const numeros = ordenadas.map(fraccion => fraccion.number)
  const esperados = Array.from({ length: FRACCIONES_POR_PROPIEDAD }, (_, indice) => indice + 1)

  if (numeros.length !== FRACCIONES_POR_PROPIEDAD || numeros.some((numero, indice) => numero !== esperados[indice])) {
    throw new RangeError(`El prorrateo exige las 8 fracciones de la propiedad; llegaron ${numeros.length}.`)
  }

  return prorratear(monto, FRACCIONES_POR_PROPIEDAD).map((cuota, indice) => ({
    fraction: cuota.fraccion,
    amount: cuota.monto,
    hasRemainder: cuota.conResiduo,
    ...pagadorDe(ordenadas[indice]!, incurredOn),
  }))
}
