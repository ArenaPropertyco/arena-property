/**
 * HU-19 · RF-19.1, RF-19.2, RF-19.3 · HU-18 · RF-18.1, RF-18.2 · D-09, D-39, D-41 ·
 * TR-02 — el estado de cuenta del Propietario.
 *
 * La materia prima es la **cuota**: cada `movement_shares` de una fracción propia
 * con el movimiento que la originó. La RLS ya entregó solo las propias (RF-19.4);
 * aquí no se filtra por titular, se explica lo que llegó.
 *
 * Tres naturalezas, y cada una se rotula como lo que es (principio 9):
 *
 *   - **prorrateada**: 1/8 de un gasto común o de un ingreso por renta (D-08).
 *   - **atribuida**: el ingreso de una semana que la propia fracción liberó y se
 *     rentó, ya neto de la comisión de gestión (D-39). No es 1/8 de nada.
 *   - **imputada**: un gasto por daño o avería cargado íntegro a la fracción (D-41).
 *
 * El mes es el de la **causación** (D-09), nunca el del registro; y un mes sin
 * movimientos existe con ceros, porque un hueco se lee como un error (CA-19.3).
 */

import { CERO, pesos, sumarTodos } from '../money/importe'
import type { CopAmount } from '../money/importe'
import type { Reparto } from './cuotas'
import type { CuotaConMovimiento } from './detalle'
import type { ClaseDeMovimiento } from './maestra'

export type NaturalezaDeLinea = 'prorated' | 'attributed' | 'imputed'

/** Una cuota de la fracción propia con su movimiento, tal como la base la entrega. */
export interface LineaDelPropietario {
  shareId: string
  movementId: string
  propertyId: string
  propertyName: string
  fraction: number
  kind: ClaseDeMovimiento
  allocation: Reparto
  /** Lo que toca a la fracción. */
  amount: CopAmount
  /** El movimiento entero: el gasto, o el bruto cobrado al tercero. */
  movementAmount: CopAmount
  categoryName: string
  /** D-09 · día de causación `AAAA-MM-DD`. */
  incurredOn: string
  description: string
  hasRemainder: boolean
  commissionBasisPoints: number | null
  commissionAmount: CopAmount | null
  weekIndex: number | null
  weekStartsOn: string | null
  /** RF-23.4 · la cuota quedó revertida al anularse el movimiento. */
  reversedAt: string | null
}

/** RF-19.1 · qué es la línea de verdad. */
export function naturalezaDeLinea(linea: Pick<LineaDelPropietario, 'kind' | 'allocation'>): NaturalezaDeLinea {
  if (linea.allocation === 'prorated') {
    return 'prorated'
  }
  return linea.kind === 'income' ? 'attributed' : 'imputed'
}

/** Solo lo que sigue contando: una cuota revertida no suma ni se lista. */
export function lineasVigentes(lineas: readonly LineaDelPropietario[]): LineaDelPropietario[] {
  return lineas.filter(linea => linea.reversedAt === null)
}

export interface GrupoDeCategoria {
  kind: ClaseDeMovimiento
  naturaleza: NaturalezaDeLinea
  categoryName: string
  lineas: LineaDelPropietario[]
  total: CopAmount
}

const ORDEN_DE_CLASE: Record<ClaseDeMovimiento, number> = { income: 0, expense: 1 }
/** Lo propio de la fracción primero; lo dividido entre ocho, después. */
const ORDEN_DE_NATURALEZA: Record<NaturalezaDeLinea, number> = { attributed: 0, imputed: 1, prorated: 2 }

/** RF-19.1 · CA-19.2 · el desglose por categoría, con cada naturaleza aparte. */
export function desglosePorCategoria(lineas: readonly LineaDelPropietario[]): GrupoDeCategoria[] {
  const grupos = new Map<string, GrupoDeCategoria>()
  for (const linea of lineasVigentes(lineas)) {
    const naturaleza = naturalezaDeLinea(linea)
    const clave = `${linea.kind}|${naturaleza}|${linea.categoryName}`
    const grupo = grupos.get(clave) ?? { kind: linea.kind, naturaleza, categoryName: linea.categoryName, lineas: [], total: CERO }
    grupo.lineas.push(linea)
    grupos.set(clave, grupo)
  }
  return [...grupos.values()]
    .map(grupo => ({
      ...grupo,
      lineas: [...grupo.lineas].sort((a, b) => b.incurredOn.localeCompare(a.incurredOn)),
      total: sumarTodos(grupo.lineas.map(linea => linea.amount)),
    }))
    .sort((a, b) =>
      ORDEN_DE_CLASE[a.kind] - ORDEN_DE_CLASE[b.kind]
      || ORDEN_DE_NATURALEZA[a.naturaleza] - ORDEN_DE_NATURALEZA[b.naturaleza]
      || a.categoryName.localeCompare(b.categoryName))
}

/** Un mes como `AAAA-MM`. */
export type Mes = string

/** D-09 · el mes de causación de un día `AAAA-MM-DD`. */
export function mesDe(dia: string): Mes {
  return dia.slice(0, 7)
}

export interface MesAgregado {
  mes: Mes
  ingresos: CopAmount
  gastos: CopAmount
  neto: CopAmount
  /** Cuántas cuotas vigentes cayeron en el mes. */
  movimientos: number
}

/** RF-19.2 · CA-19.1 · ingresos, gastos y neto de un mes; neto = ingresos − gastos. */
export function agregarMes(lineas: readonly LineaDelPropietario[], mes: Mes): MesAgregado {
  const delMes = lineasVigentes(lineas).filter(linea => mesDe(linea.incurredOn) === mes)
  const ingresos = sumarTodos(delMes.filter(linea => linea.kind === 'income').map(linea => linea.amount))
  const gastos = sumarTodos(delMes.filter(linea => linea.kind === 'expense').map(linea => linea.amount))
  return { mes, ingresos, gastos, neto: pesos(ingresos - gastos), movimientos: delMes.length }
}

function mesSiguiente(mes: Mes): Mes {
  const [anio, numero] = mes.split('-').map(Number) as [number, number]
  return numero === 12 ? `${anio + 1}-01` : `${anio}-${String(numero + 1).padStart(2, '0')}`
}

/** RF-19.2 · CA-19.3 · todos los meses del rango, en orden, con ceros donde no hubo nada. */
export function historicoMensual(lineas: readonly LineaDelPropietario[], desde: Mes, hasta: Mes): MesAgregado[] {
  const meses: MesAgregado[] = []
  for (let mes = desde; mes <= hasta; mes = mesSiguiente(mes)) {
    meses.push(agregarMes(lineas, mes))
  }
  return meses
}

/** El rango de un año natural, para el histórico navegable. */
export function mesesDelAnio(anio: number): [Mes, Mes] {
  return [`${anio}-01`, `${anio}-12`]
}

/** RF-18.1 · el estado de cuenta del periodo: el neto del mes. */
export function saldoDelPeriodo(lineas: readonly LineaDelPropietario[], mes: Mes): CopAmount {
  return agregarMes(lineas, mes).neto
}

export interface IngresosPorRenta {
  /** D-08 · 1/8 de las semanas rentadas que no eran de nadie. */
  prorated: CopAmount
  /** D-39 · lo que produjeron las semanas que la propia fracción liberó, ya neto. */
  attributed: CopAmount
  total: CopAmount
}

/** RF-18.2 · CA-18.3 · lo que la fracción recibió por renta a terceros, por naturaleza. */
export function ingresosPorRenta(lineas: readonly LineaDelPropietario[]): IngresosPorRenta {
  const ingresos = lineasVigentes(lineas).filter(linea => linea.kind === 'income')
  const prorated = sumarTodos(ingresos.filter(linea => linea.allocation === 'prorated').map(linea => linea.amount))
  const attributed = sumarTodos(ingresos.filter(linea => linea.allocation === 'single_fraction').map(linea => linea.amount))
  return { prorated, attributed, total: pesos(prorated + attributed) }
}

/** RF-19.3 · la línea, en la forma que `detalleDeCuota` (HU-24) explica. */
export function cuotaConMovimientoDe(linea: LineaDelPropietario): CuotaConMovimiento {
  return {
    movementId: linea.movementId,
    kind: linea.kind,
    allocation: linea.allocation,
    amount: linea.movementAmount,
    categoryName: linea.categoryName,
    incurredOn: linea.incurredOn,
    propertyName: linea.propertyName,
    description: linea.description,
    fraction: linea.fraction,
    shareAmount: linea.amount,
    hasRemainder: linea.hasRemainder,
    commissionBasisPoints: linea.commissionBasisPoints,
    commissionAmount: linea.commissionAmount,
    weekStartsOn: linea.weekStartsOn,
    weekIndex: linea.weekIndex,
  }
}
