/**
 * HU-40 · RF-40.2, RF-40.4, RF-40.5 · D-39 · TR-02 — a quién pertenece el ingreso
 * de una semana rentada a un tercero.
 *
 * La decisión es del **origen de la semana**, no de quién registra el ingreso ni de
 * cuándo: la reserva guardó de qué fracción salía y con qué motivo entró a la bolsa
 * de renta (HU-39 · RF-39.2b), y ese par es lo único que se mira.
 *
 *   - **Liberada voluntariamente** (RF-14.7): el ingreso es de esa fracción. Se le
 *     acredita íntegro menos la comisión de gestión, porque colocar una semana
 *     suelta es trabajo del operador y no del dueño.
 *   - **Cancelada, caducada, reubicada o sobrante de la rejilla**: se prorratea
 *     entre las ocho con la función canónica de TR-02, imputando al titular del
 *     inventario las de calendario inactivo (D-08).
 *
 * La asimetría es deliberada (D-39): premia avisar con tiempo, que es lo que deja
 * la semana colocable, y no premia el silencio de quien deja caducar la suya.
 */

import { comision as comisionTruncada, PUNTOS_BASICOS_TOTALES } from '../money/comision'
import type { CopAmount } from '../money/importe'
import { CERO, pesos, restar } from '../money/importe'
import type { CuotaGenerada, FraccionParaCuota } from './cuotas'
import { cuotaDirecta, generarCuotas } from './cuotas'

/**
 * RF-39.2b · con qué motivo entró la semana a la bolsa de renta. `pool` es la
 * semana que nadie eligió, sobrante de la rejilla, y por eso no tiene fracción de
 * origen. `relocated` queda reservado para la ventana de HU-59.
 */
export const ORIGENES_DE_SEMANA = ['voluntary', 'cancelled', 'expired', 'relocated', 'pool'] as const
export type OrigenDeSemana = typeof ORIGENES_DE_SEMANA[number]

/** Naturaleza del reparto de un ingreso: dividido entre ocho o atribuido a una. */
export type NaturalezaDeIngreso = 'prorated' | 'attributed'

export interface RepartoDeIngreso {
  naturaleza: NaturalezaDeIngreso
  /** Las ocho cuotas, o la única de la fracción que liberó la semana. */
  cuotas: CuotaGenerada[]
  /** RF-40.4 · comisión de gestión de Arena; cero cuando el ingreso se prorratea. */
  comision: CopAmount
}

export interface EntradaDeReparto {
  bruto: CopAmount
  origen: OrigenDeSemana
  /** Número de la fracción de la que salía la semana; `null` si era sobrante. */
  fraccionDeOrigen: number | null
  /** Las 8 fracciones de la propiedad, con su estado y su interruptor. */
  fracciones: readonly FraccionParaCuota[]
  /** D-09 · día de causación del ingreso. */
  incurredOn: string
  /** RF-40.4 · comisión de gestión de la propiedad; `null` si no está configurada. */
  comisionPuntosBasicos: number | null
}

/** RF-40.2 · D-39 · solo la semana liberada a propósito se atribuye a su fracción. */
export function esAtribuible(origen: OrigenDeSemana): boolean {
  return origen === 'voluntary'
}

/**
 * RF-40.4 · TR-02 RF-D.4 — la comisión de gestión sobre un bruto, truncada al peso.
 * El truncamiento es hacia abajo a propósito: el peso que sobra se queda en la
 * fracción, nunca en Arena, y así comisión + neto suman siempre el bruto.
 */
export function comisionDeGestion(bruto: CopAmount, puntos: number): CopAmount {
  if (!Number.isInteger(puntos) || puntos < 0 || puntos > PUNTOS_BASICOS_TOTALES) {
    throw new RangeError(`La comisión de gestión va de 0 a 10 000 puntos básicos: ${puntos}`)
  }

  return comisionTruncada(bruto, puntos)
}

/**
 * RF-40.2 · el reparto del ingreso de una semana rentada. La base repite esta misma
 * decisión en el disparador de `movements`, para que ninguna ruta pueda producir un
 * reparto distinto del que aquí se prueba.
 */
export function repartirIngreso(entrada: EntradaDeReparto): RepartoDeIngreso {
  if (!Number.isInteger(entrada.bruto) || entrada.bruto <= 0) {
    throw new RangeError(`El ingreso debe ser un entero de pesos mayor que cero: ${entrada.bruto}`)
  }

  if (!esAtribuible(entrada.origen)) {
    return {
      naturaleza: 'prorated',
      cuotas: generarCuotas(entrada.bruto, entrada.fracciones, entrada.incurredOn),
      comision: CERO,
    }
  }

  // RF-40.5 · CA-40.5 · sin porcentaje declarado no se inventa un reparto.
  if (entrada.comisionPuntosBasicos === null) {
    throw new RangeError(
      'RF-40.5 · la propiedad no tiene configurada su comisión de gestión: el ingreso de una semana liberada no se registra.',
    )
  }

  const fraccion = entrada.fracciones.find(candidata => candidata.number === entrada.fraccionDeOrigen) ?? null
  if (entrada.fraccionDeOrigen === null || !fraccion) {
    throw new RangeError(`La atribución exige la fracción que liberó la semana; llegó ${entrada.fraccionDeOrigen}.`)
  }

  const comision = comisionDeGestion(entrada.bruto, entrada.comisionPuntosBasicos)
  const neto = restar(entrada.bruto, comision)

  return {
    naturaleza: 'attributed',
    cuotas: [cuotaDirecta(pesos(neto), fraccion)],
    comision,
  }
}
