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
import type { EstadoDeFraccion } from '../properties/fracciones'
import type { Reparto } from './cuotas'
import type { ClaseDeMovimiento, MaestraContable } from './maestra'
import { esCategoriaDePropiedad } from './maestra'
import type { ItemParaGasto } from './mantenimiento'

export const CAMPOS_DE_MOVIMIENTO = [
  'amount', 'categoryId', 'paymentMethodId', 'accountId', 'incurredOn', 'description', 'fractionId', 'inventoryItemId',
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
  'finance.validation.fraction_required',
  'finance.validation.fraction_not_sold',
  'finance.validation.fraction_not_in_property',
  'finance.validation.fraction_not_expected',
  'finance.validation.item_not_in_property',
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
  /** RF-23.8 · D-41 · entre las 8 fracciones o a una sola. */
  allocation: Reparto
  /** RF-23.9 · la fracción imputada; solo con reparto `single_fraction`. */
  fractionId: string | null
  /** HU-27 · RF-27.1 · es un gasto de mantenimiento; se marca solo o por llevar ítem. */
  maintenance?: boolean
  /** HU-27 · RF-27.1 · el ítem del inventario al que se asocia; `null` si es general. */
  inventoryItemId?: string | null
}

/** Lo que de una fracción decide si se le puede imputar un gasto (RF-23.9). */
export interface FraccionImputable {
  id: string
  number: number
  status: EstadoDeFraccion
  ownerId: string | null
}

export interface ErrorDeMovimiento {
  name: CampoDeMovimiento
  message: ClaveDeValidacionDeMovimiento
}

/**
 * RF-23.2 · CA-23.3 · CA-23.6 · CA-23.9 · qué movimiento entra y cuál se rechaza,
 * con su mensaje. `fracciones` son las de la propiedad: deciden a cuál se puede
 * imputar (D-41).
 */
export function validarMovimiento(
  movimiento: NuevoMovimiento,
  maestra: MaestraContable,
  fracciones: readonly FraccionImputable[],
  items: readonly ItemParaGasto[] = [],
): ErrorDeMovimiento[] {
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

  // RF-23.8 · RF-23.9 · D-41 · el reparto directo exige una fracción vendida de la
  // propiedad; el prorrateado no admite fracción, para no dejar un dato ambiguo.
  if (movimiento.allocation === 'single_fraction') {
    const elegida = fracciones.find(fraccion => fraccion.id === movimiento.fractionId) ?? null
    if (!movimiento.fractionId) {
      errores.push({ name: 'fractionId', message: 'finance.validation.fraction_required' })
    }
    else if (!elegida) {
      errores.push({ name: 'fractionId', message: 'finance.validation.fraction_not_in_property' })
    }
    else if (elegida.status !== 'sold' || elegida.ownerId === null) {
      errores.push({ name: 'fractionId', message: 'finance.validation.fraction_not_sold' })
    }
  }
  else if (movimiento.fractionId) {
    errores.push({ name: 'fractionId', message: 'finance.validation.fraction_not_expected' })
  }

  // HU-27 · RF-27.1 · el ítem tiene que ser del inventario de la propiedad. Uno ya
  // dado de baja vale: un mantenimiento tardío es un gasto que ocurrió igual.
  const itemId = movimiento.inventoryItemId ?? null
  if (itemId !== null && !items.some(item => item.id === itemId)) {
    errores.push({ name: 'inventoryItemId', message: 'finance.validation.item_not_in_property' })
  }

  return errores
}

/** RF-23.4 · CA-23.4 · un movimiento no se elimina: se anula con motivo. */
export function validarAnulacionDeMovimiento(motivo: string): ClaveDeValidacionDeMovimiento[] {
  return motivo.trim() === '' ? ['finance.validation.reason_required'] : []
}
