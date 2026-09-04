/**
 * HU-58 · RF-58.2, RF-58.4, RF-58.5 — validación de un abono y de su anulación.
 *
 * El formulario valida con esto y muestra el mensaje; la base vuelve a comprobar el
 * sobrepago y el comprobante por sí sola, porque una ruta nueva podría saltarse el
 * formulario pero no la restricción.
 */

import type { CopAmount } from '../money/importe'
import { esImporte } from '../money/importe'
import type { EstadoDePlan } from './plan'

/**
 * Medios de pago mientras no exista la maestra contable de HU-23 (RF-23.1). Es un
 * vocabulario provisional: cuando la maestra llegue, el abono referenciará sus filas
 * y esta lista desaparece. Los nombres visibles salen de i18n (`payments.methods`).
 */
export const METODOS_DE_PAGO = ['transfer', 'cash', 'card', 'check', 'other'] as const
export type MetodoDePago = typeof METODOS_DE_PAGO[number]

export const CAMPOS_DE_ABONO = ['amount', 'paidOn', 'method', 'receiptPath', 'plan'] as const
export type CampoDeAbono = typeof CAMPOS_DE_ABONO[number]

export const CLAVES_DE_VALIDACION_DE_ABONO = [
  'payments.validation.amount_not_positive',
  'payments.validation.overpayment',
  'payments.validation.date_invalid',
  'payments.validation.method_required',
  'payments.validation.receipt_required',
  'payments.validation.plan_not_open',
  'payments.validation.reason_required',
] as const

export type ClaveDeValidacionDeAbono = typeof CLAVES_DE_VALIDACION_DE_ABONO[number]

export interface NuevoAbono {
  amount: CopAmount
  /** Día de calendario `AAAA-MM-DD`; el abono se imputa a esa fecha. */
  paidOn: string
  /** Medio de pago. Referenciará la maestra de HU-23 cuando exista. */
  method: string
  /** Ruta en Storage del comprobante; obligatorio (RF-58.2). */
  receiptPath: string | null
  note: string | null
}

export interface ContextoDelPlan {
  precioPactado: CopAmount
  abonado: CopAmount
  estado: EstadoDePlan
}

export interface ErrorDeAbono {
  name: CampoDeAbono
  message: ClaveDeValidacionDeAbono
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

function esFechaValida(texto: string): boolean {
  if (!FECHA.test(texto)) {
    return false
  }
  const fecha = new Date(`${texto}T00:00:00Z`)
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(texto)
}

export function validarAbono(abono: NuevoAbono, plan: ContextoDelPlan): ErrorDeAbono[] {
  const errores: ErrorDeAbono[] = []

  // RF-58.8 · sobre un plan completado o anulado no se abona más.
  if (plan.estado === 'completed' || plan.estado === 'voided') {
    errores.push({ name: 'plan', message: 'payments.validation.plan_not_open' })
  }

  if (!esImporte(abono.amount) || abono.amount <= 0) {
    errores.push({ name: 'amount', message: 'payments.validation.amount_not_positive' })
  }
  // CA-58.2 · RF-58.4 · nada de sobrepago silencioso.
  else if (plan.abonado + abono.amount > plan.precioPactado) {
    errores.push({ name: 'amount', message: 'payments.validation.overpayment' })
  }

  if (!esFechaValida(abono.paidOn)) {
    errores.push({ name: 'paidOn', message: 'payments.validation.date_invalid' })
  }

  if (abono.method.trim() === '') {
    errores.push({ name: 'method', message: 'payments.validation.method_required' })
  }

  // CA-58.6 · el comprobante es obligatorio.
  if ((abono.receiptPath ?? '').trim() === '') {
    errores.push({ name: 'receiptPath', message: 'payments.validation.receipt_required' })
  }

  return errores
}

/** RF-58.5 · un abono no se elimina: se anula con motivo. */
export function validarAnulacion(motivo: string): ClaveDeValidacionDeAbono[] {
  return motivo.trim() === '' ? ['payments.validation.reason_required'] : []
}
