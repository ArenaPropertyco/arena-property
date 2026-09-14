/**
 * HU-23 · RF-23.2, RF-23.4, RF-23.5, RF-23.7 · D-01, D-09 — validación de un
 * movimiento financiero de propiedad y de su anulación.
 *
 * El formulario valida con esto y muestra el mensaje; la base vuelve a comprobar
 * categoría, monto y motivo en su disparador, porque una ruta nueva podría saltarse
 * el formulario pero no la restricción.
 */

import { esFecha } from '../dates/validacion'
import type { CopAmount } from '../money/importe'
import { esImporte } from '../money/importe'
import type { ClaseDeMovimiento, MaestraContable } from './maestra'
import { esCategoriaDePropiedad } from './maestra'

export const CAMPOS_DE_MOVIMIENTO = [
  'amount', 'categoryId', 'paymentMethodId', 'accountId', 'incurredOn', 'description',
] as const
export type CampoDeMovimiento = typeof CAMPOS_DE_MOVIMIENTO[number]

export const CLAVES_DE_VALIDACION_DE_MOVIMIENTO = [
  'finance.validation.amount_not_positive',
  'finance.validation.category_required',
  'finance.validation.category_not_in_master',
  'finance.validation.category_not_allowed',
  'finance.validation.category_kind_mismatch',
  'finance.validation.method_required',
  'finance.validation.account_required',
  'finance.validation.date_invalid',
  'finance.validation.description_required',
  'finance.validation.reason_required',
] as const

export type ClaveDeValidacionDeMovimiento = typeof CLAVES_DE_VALIDACION_DE_MOVIMIENTO[number]

export interface NuevoMovimiento {
  propertyId: string
  kind: ClaseDeMovimiento
  amount: CopAmount
  categoryId: string
  paymentMethodId: string
  accountId: string
  /** D-09 · día de causación `AAAA-MM-DD`: el periodo al que se imputa. */
  incurredOn: string
  description: string
}

export interface ErrorDeMovimiento {
  name: CampoDeMovimiento
  message: ClaveDeValidacionDeMovimiento
}

/** RF-23.2 · CA-23.3 · CA-23.6 · qué movimiento entra y cuál se rechaza, con su mensaje. */
export function validarMovimiento(movimiento: NuevoMovimiento, maestra: MaestraContable): ErrorDeMovimiento[] {
  const errores: ErrorDeMovimiento[] = []

  if (!esImporte(movimiento.amount) || movimiento.amount <= 0) {
    errores.push({ name: 'amount', message: 'finance.validation.amount_not_positive' })
  }

  const categoria = maestra.categorias.find(entrada => entrada.id === movimiento.categoryId) ?? null
  if (movimiento.categoryId.trim() === '') {
    errores.push({ name: 'categoryId', message: 'finance.validation.category_required' })
  }
  else if (!categoria || !categoria.active) {
    errores.push({ name: 'categoryId', message: 'finance.validation.category_not_in_master' })
  }
  // D-01 · RF-23.5 · una categoría del libro de plataforma no se prorratea a nadie.
  else if (!esCategoriaDePropiedad(categoria)) {
    errores.push({ name: 'categoryId', message: 'finance.validation.category_not_allowed' })
  }
  else if (categoria.kind !== movimiento.kind) {
    errores.push({ name: 'categoryId', message: 'finance.validation.category_kind_mismatch' })
  }

  if (!maestra.medios.some(medio => medio.active && medio.id === movimiento.paymentMethodId)) {
    errores.push({ name: 'paymentMethodId', message: 'finance.validation.method_required' })
  }

  if (!maestra.cuentas.some(cuenta => cuenta.active && cuenta.id === movimiento.accountId)) {
    errores.push({ name: 'accountId', message: 'finance.validation.account_required' })
  }

  if (!esFecha(movimiento.incurredOn)) {
    errores.push({ name: 'incurredOn', message: 'finance.validation.date_invalid' })
  }

  if (movimiento.description.trim() === '') {
    errores.push({ name: 'description', message: 'finance.validation.description_required' })
  }

  return errores
}

/** RF-23.4 · CA-23.4 · un movimiento no se elimina: se anula con motivo. */
export function validarAnulacionDeMovimiento(motivo: string): ClaveDeValidacionDeMovimiento[] {
  return motivo.trim() === '' ? ['finance.validation.reason_required'] : []
}
