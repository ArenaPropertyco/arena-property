/**
 * HU-24 · RF-24.1, RF-24.2, RF-24.2b, RF-24.2c, RF-24.4 · D-39, D-41 — el detalle
 * de cómo se calculó una cuota.
 *
 * Función pura sobre el movimiento y la cuota ya persistidos: no consulta nada y no
 * recalcula el reparto, lo explica. Una misma cuota produce siempre el mismo
 * detalle, así que la pantalla no puede contradecir a la base.
 *
 * La regla que gobierna las tres variantes es la del principio 9: **la fórmula
 * «÷ 8» solo aparece cuando el reparto de verdad dividió entre ocho**. Sobre una
 * cuota imputada por un daño (D-41) o atribuida por una semana liberada (D-39)
 * enseñarla sería mentir sobre el cálculo, así que esas variantes ni siquiera
 * llevan el campo.
 */

import { FRACCIONES_POR_PROPIEDAD } from '../money/prorrateo'
import type { CopAmount } from '../money/importe'
import type { Reparto } from './cuotas'
import type { ClaseDeMovimiento } from './maestra'

/** La fórmula que se muestra, y solo, sobre una cuota prorrateada. */
export const FORMULA_DE_PRORRATEO = 'monto ÷ 8'

/** El movimiento y la cuota, tal como la base los devuelve. */
export interface CuotaConMovimiento {
  movementId: string
  kind: ClaseDeMovimiento
  allocation: Reparto
  /** Monto del movimiento: el gasto, o el bruto cobrado al tercero. */
  amount: CopAmount
  categoryName: string
  /** D-09 · día de causación. */
  incurredOn: string
  propertyName: string
  description: string
  fraction: number
  shareAmount: CopAmount
  hasRemainder: boolean
  /** RF-40.4 · solo en un ingreso atribuido. */
  commissionBasisPoints: number | null
  commissionAmount: CopAmount | null
  /** RF-24.2b · la semana de origen del ingreso atribuido. */
  weekStartsOn: string | null
  weekIndex: number | null
}

interface Comun {
  movementId: string
  kind: ClaseDeMovimiento
  categoryName: string
  incurredOn: string
  propertyName: string
  description: string
  fraction: number
}

/** RF-24.1 · CA-24.1 · CA-24.2 · la cuota salió de dividir el movimiento entre ocho. */
export interface DetalleProrrateado extends Comun {
  naturaleza: 'prorated'
  montoOriginal: CopAmount
  formula: typeof FORMULA_DE_PRORRATEO
  divisor: number
  cuota: CopAmount
  /** RF-D.3 · RF-24.2 · la cuota absorbió parte del residuo. */
  conResiduo: boolean
  /** Los pesos de residuo que esta cuota lleva de más; 0 si ninguno. */
  residuo: number
}

/** RF-24.2c · CA-24.2c · D-41 · el gasto se imputó íntegro a esta fracción. */
export interface DetalleImputado extends Comun {
  naturaleza: 'imputed'
  montoOriginal: CopAmount
  cuota: CopAmount
}

/** RF-24.2b · CA-24.2b · D-39 · el ingreso de una semana que esta fracción liberó. */
export interface DetalleAtribuido extends Comun {
  naturaleza: 'attributed'
  bruto: CopAmount
  comisionPuntosBasicos: number
  comision: CopAmount
  neto: CopAmount
  /** La semana rentada; `null` si la reserva no dejó su fecha. */
  semana: { indice: number, empiezaEl: string } | null
}

export type DetalleDeCuota = DetalleProrrateado | DetalleImputado | DetalleAtribuido

function comun(fila: CuotaConMovimiento): Comun {
  return {
    movementId: fila.movementId,
    kind: fila.kind,
    categoryName: fila.categoryName,
    incurredOn: fila.incurredOn,
    propertyName: fila.propertyName,
    description: fila.description,
    fraction: fila.fraction,
  }
}

/** RF-24.4 · el detalle de una cuota, según cómo se repartió de verdad su movimiento. */
export function detalleDeCuota(fila: CuotaConMovimiento): DetalleDeCuota {
  if (fila.allocation === 'prorated') {
    const cociente = Math.trunc(fila.amount / FRACCIONES_POR_PROPIEDAD)

    return {
      ...comun(fila),
      naturaleza: 'prorated',
      montoOriginal: fila.amount,
      formula: FORMULA_DE_PRORRATEO,
      divisor: FRACCIONES_POR_PROPIEDAD,
      cuota: fila.shareAmount,
      conResiduo: fila.hasRemainder,
      residuo: fila.shareAmount - cociente,
    }
  }

  // RF-24.2b · un ingreso atribuido solo se presenta como tal si la comisión quedó
  // registrada; sin ese dato no se inventan cifras y se explica como imputación.
  if (fila.kind === 'income' && fila.commissionAmount !== null && fila.commissionBasisPoints !== null) {
    return {
      ...comun(fila),
      naturaleza: 'attributed',
      bruto: fila.amount,
      comisionPuntosBasicos: fila.commissionBasisPoints,
      comision: fila.commissionAmount,
      neto: fila.shareAmount,
      semana: fila.weekIndex !== null && fila.weekStartsOn !== null
        ? { indice: fila.weekIndex, empiezaEl: fila.weekStartsOn }
        : null,
    }
  }

  return {
    ...comun(fila),
    naturaleza: 'imputed',
    montoOriginal: fila.amount,
    cuota: fila.shareAmount,
  }
}
