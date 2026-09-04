/**
 * HU-58 · RF-58.3, RF-58.6, RF-58.7 y D-10, D-31 — el plan de pagos y sus derivados.
 *
 * Nada de lo que hay aquí se guarda como columna (DT-04): el estado del plan, el
 * saldo, el interruptor de calendario y los eventos se **derivan** del precio
 * pactado y de los abonos vigentes cada vez que se preguntan. Así no pueden
 * desincronizarse de los hechos: anular un abono recalcula todo solo.
 *
 * La base repite el mismo cálculo en `public.estado_del_plan` para que la vista y
 * los disparadores lean una única verdad. Si divergen, hay un error.
 */

import type { CopAmount } from '../money/importe'
import { CERO, pesos, restar, sumarTodos } from '../money/importe'

export const ESTADOS_DE_PLAN = ['reserved', 'in_progress', 'completed', 'voided'] as const
export type EstadoDePlan = typeof ESTADOS_DE_PLAN[number]

/** RF-58.6 y RF-58.8 · lo que el plan emite hacia HU-54, una sola vez cada uno. */
export const EVENTOS_DEL_PLAN = ['payment_completed', 'purchase_voided'] as const
export type EventoDelPlan = typeof EVENTOS_DEL_PLAN[number]

/** Lo mínimo de un abono que el cálculo necesita. */
export interface AbonoDelPlan {
  amount: CopAmount
  /** RF-58.5 · anulado no cuenta, pero no desaparece. */
  voided: boolean
}

/** Suma de los abonos vigentes, exacta en pesos. */
export function abonado(abonos: readonly AbonoDelPlan[]): CopAmount {
  return sumarTodos(abonos.filter(abono => !abono.voided).map(abono => abono.amount))
}

/**
 * RF-58.3 · `Reservada` (sin abonos) → `En proceso de pago` (0 < abonado < precio)
 * → `Pago completado` (abonado = precio). Un plan anulado es `Anulado` sin más.
 *
 * Un total por encima del precio no es un estado: la base lo rechaza al abonar
 * (RF-58.4) y aquí se lanza, porque devolver «completado» escondería el error.
 */
export function estadoDelPlan(
  precioPactado: CopAmount,
  abonos: readonly AbonoDelPlan[],
  opciones: { anulado?: boolean } = {},
): EstadoDePlan {
  if (opciones.anulado) {
    return 'voided'
  }

  const total = abonado(abonos)

  if (total > precioPactado) {
    throw new RangeError(`RF-58.4 · lo abonado (${total}) supera el precio pactado (${precioPactado}).`)
  }
  if (total === CERO) {
    return 'reserved'
  }
  if (total === precioPactado) {
    return 'completed'
  }
  return 'in_progress'
}

export function saldoPendiente(precioPactado: CopAmount, abonos: readonly AbonoDelPlan[]): CopAmount {
  return restar(precioPactado, abonado(abonos))
}

/** RF-58.7 · D-31 · el derecho de uso existe solo con el pago completo. */
export function calendarioActivo(estado: EstadoDePlan): boolean {
  return estado === 'completed'
}

/** Evento que corresponde a un estado, si alguno. */
function eventoDe(estado: EstadoDePlan): EventoDelPlan | null {
  if (estado === 'completed') {
    return 'payment_completed'
  }
  if (estado === 'voided') {
    return 'purchase_voided'
  }
  return null
}

/**
 * RF-58.6 · idempotencia: el evento se emite solo si no se emitió antes. Recalcular
 * el plan diez veces produce el evento una vez.
 */
export function eventosPendientes(estado: EstadoDePlan, emitidos: readonly EventoDelPlan[]): EventoDelPlan[] {
  const evento = eventoDe(estado)

  return evento && !emitidos.includes(evento) ? [evento] : []
}

export interface PlanDerivado {
  estado: EstadoDePlan
  abonado: CopAmount
  saldo: CopAmount
  calendarioActivo: boolean
  /** Eventos que esta derivación emite; vacío si ya se emitieron. */
  eventos: EventoDelPlan[]
}

/** Todo lo derivable del plan, de una vez y con el mismo cálculo. */
export function derivarPlan(
  precioPactado: CopAmount,
  abonos: readonly AbonoDelPlan[],
  contexto: { anulado: boolean, emitidos: readonly EventoDelPlan[] },
): PlanDerivado {
  const estado = estadoDelPlan(precioPactado, abonos, { anulado: contexto.anulado })
  const total = abonado(abonos)

  return {
    estado,
    abonado: total,
    saldo: pesos(precioPactado - total),
    calendarioActivo: calendarioActivo(estado),
    eventos: eventosPendientes(estado, contexto.emitidos),
  }
}
