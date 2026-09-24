/**
 * HU-62 · RF-62.1…RF-62.5, RF-62.10, RF-62.14 · D-08, D-09, D-51 · TR-02 — la
 * billetera del Propietario: el corte mensual y los saldos por propiedad.
 *
 * La materia prima es la **cuota** de HU-23/HU-40 con su pagador. El corte de un
 * mes toma las cuotas a cargo del Propietario causadas hasta ese mes (D-09) que
 * ningún corte anterior liquidó, y las anulaciones de cuotas ya liquidadas; lo
 * que llega tarde entra como **ajuste de periodo anterior** (RF-62.5) y un corte
 * cerrado no se toca. Las cuotas del titular del inventario nunca entran (D-08).
 *
 * El saldo de cada propiedad no se guarda: se **deriva** del histórico
 * (RF-62.2) —el neto de cada corte, cada pago confirmado y cada retiro pagado— y
 * cada propiedad se liquida por separado (D-51): el total consolidado es solo
 * informativo. La base repite estas reglas en `private.cortar_fraccion` y en
 * `private.saldo_de_propietario`.
 */

import type { Idioma } from '../money/formato'
import type { CopAmount } from '../money/importe'
import { CERO, pesos, restar, sumar, sumarTodos } from '../money/importe'
import { confirmado, estimado, presentarImporte } from '../money/presentacion'
import type { CifraPresentada } from '../money/presentacion'
import type { Pagador } from './cuotas'
import type { LineaDelPropietario, Mes } from './estado-de-cuenta'
import { mesDe, saldoDelPeriodo } from './estado-de-cuenta'
import type { ClaseDeMovimiento } from './maestra'

// ── RF-62.3 · RF-62.4 · RF-62.5 · el corte ──────────────────────────────────

/** Una cuota tal como la base la entrega para liquidar. */
export interface CuotaLiquidable {
  shareId: string
  movementId: string
  propertyId: string
  fractionId: string
  fractionNumber: number
  kind: ClaseDeMovimiento
  amount: CopAmount
  /** D-09 · día de causación `AAAA-MM-DD`. */
  incurredOn: string
  payer: Pagador
  payerId: string | null
  /** RF-23.4 · la cuota quedó revertida al anularse el movimiento. */
  reversedAt: string | null
}

/** Cómo entra una cuota a un corte: como cargo o como reversa de un cargo anterior. */
export type EntradaDeCorte = 'charge' | 'reversal'

export interface LineaDeCorte {
  shareId: string
  movementId: string
  kind: ClaseDeMovimiento
  entry: EntradaDeCorte
  amount: CopAmount
  /** D-09 · el mes de causación de la cuota. */
  originPeriod: Mes
  /** RF-62.5 · nació en un mes anterior al del corte. */
  adjustment: boolean
}

export interface Corte {
  fractionId: string
  propertyId: string
  period: Mes
  lines: LineaDeCorte[]
  income: CopAmount
  expenses: CopAmount
  /** ingresos − gastos; negativo cuando la fracción debe. */
  net: CopAmount
}

export interface ContextoDeCorte {
  fractionId: string
  propertyId: string
  /** El titular al momento del corte: solo sus cuotas se liquidan. */
  ownerId: string
  period: Mes
}

/** Lo que basta saber de los cortes anteriores: qué cuota entró y cómo. */
export type LineaLiquidada = Pick<LineaDeCorte, 'shareId' | 'entry'>

function yaEntro(liquidadas: readonly LineaLiquidada[], shareId: string, entry: EntradaDeCorte): boolean {
  return liquidadas.some(linea => linea.shareId === shareId && linea.entry === entry)
}

/**
 * RF-62.3 · RF-62.5 · CA-62.4 · CA-62.5 · las líneas que entran al corte: los
 * cargos aún no liquidados causados hasta el mes, y las reversas de cargos ya
 * liquidados cuyo movimiento se anuló. Una cuota revertida antes de liquidarse
 * nunca entra: no hay nada que deshacer.
 */
export function lineasDelCorte(
  cuotas: readonly CuotaLiquidable[],
  liquidadas: readonly LineaLiquidada[],
  contexto: ContextoDeCorte,
): LineaDeCorte[] {
  const lineas: LineaDeCorte[] = []

  for (const cuota of cuotas) {
    if (cuota.fractionId !== contexto.fractionId || cuota.payer !== 'owner' || cuota.payerId !== contexto.ownerId) {
      continue
    }
    const originPeriod = mesDe(cuota.incurredOn)
    const cargada = yaEntro(liquidadas, cuota.shareId, 'charge')

    if (!cargada && cuota.reversedAt === null && originPeriod <= contexto.period) {
      lineas.push({ shareId: cuota.shareId, movementId: cuota.movementId, kind: cuota.kind, entry: 'charge', amount: cuota.amount, originPeriod, adjustment: originPeriod !== contexto.period })
    }
    else if (cargada && cuota.reversedAt !== null && !yaEntro(liquidadas, cuota.shareId, 'reversal')) {
      lineas.push({ shareId: cuota.shareId, movementId: cuota.movementId, kind: cuota.kind, entry: 'reversal', amount: cuota.amount, originPeriod, adjustment: true })
    }
  }

  return lineas
}

/** Lo que una lista de líneas suma para una clase: los cargos restan lo reversado. */
function totalDe(lineas: readonly LineaDeCorte[], kind: ClaseDeMovimiento): CopAmount {
  const cargos = sumarTodos(lineas.filter(linea => linea.kind === kind && linea.entry === 'charge').map(linea => linea.amount))
  const reversas = sumarTodos(lineas.filter(linea => linea.kind === kind && linea.entry === 'reversal').map(linea => linea.amount))
  return restar(cargos, reversas)
}

/** CA-62.1 · CA-62.2 · RF-62.3 · el corte de una fracción: sus líneas y neto = ingresos − gastos. */
export function cortar(
  cuotas: readonly CuotaLiquidable[],
  liquidadas: readonly LineaLiquidada[],
  contexto: ContextoDeCorte,
): Corte {
  const lines = lineasDelCorte(cuotas, liquidadas, contexto)
  const income = totalDe(lines, 'income')
  const expenses = totalDe(lines, 'expense')
  return { fractionId: contexto.fractionId, propertyId: contexto.propertyId, period: contexto.period, lines, income, expenses, net: restar(income, expenses) }
}

/** D-51 · RF-62.3 · el mes que se cierra en un día dado: siempre el anterior. */
export function periodoAnterior(dia: string): Mes {
  const [anio, mes] = dia.slice(0, 7).split('-').map(Number) as [number, number]
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`
}

// ── RF-62.1 · RF-62.2 · los saldos ──────────────────────────────────────────

/** RF-62.2 · lo único que mueve el saldo: el corte, el pago confirmado y el retiro pagado. */
export const OWNER_WALLET_ENTRY_KINDS = ['statement_closed', 'payment_confirmed', 'withdrawal_paid'] as const

export type OwnerWalletEntryKind = typeof OWNER_WALLET_ENTRY_KINDS[number]

/** Un movimiento de la billetera. `amount` es su efecto en el saldo: el neto del corte con su signo, el pago en positivo, el retiro en negativo. */
export interface OwnerWalletEntry {
  id: string
  kind: OwnerWalletEntryKind
  amount: CopAmount
  occurredOn: string
  /** Desempata dos movimientos del mismo día. */
  createdAt: string
  propertyId: string
  propertyName: string
  fractionNumber: number | null
  /** El mes cortado, en los movimientos de corte. */
  period: Mes | null
  statementId: string | null
  paymentId: string | null
  withdrawalId: string | null
}

/** RF-62.6 · RF-62.9 · qué es un saldo: negativo se cobra, positivo se retira, cero está al día. */
export type NaturalezaDeSaldo = 'charge' | 'payout' | 'settled'

export function naturalezaDeSaldo(balance: CopAmount): NaturalezaDeSaldo {
  if (balance < 0) {
    return 'charge'
  }
  return balance > 0 ? 'payout' : 'settled'
}

export interface SaldoDePropiedad {
  propertyId: string
  propertyName: string
  balance: CopAmount
  nature: NaturalezaDeSaldo
}

export interface PropiedadDelPropietario {
  id: string
  name: string
}

/** RF-62.2 · el saldo de una propiedad es la suma de su histórico. */
export function saldoDePropiedad(entries: readonly OwnerWalletEntry[], propertyId: string): CopAmount {
  return sumarTodos(entries.filter(entry => entry.propertyId === propertyId).map(entry => entry.amount))
}

/**
 * CA-62.11 · RF-62.1 · D-51 · un saldo por propiedad, en cero si no hubo nada,
 * ordenados por nombre. Ninguno compensa a otro.
 */
export function saldosPorPropiedad(entries: readonly OwnerWalletEntry[], propiedades: readonly PropiedadDelPropietario[]): SaldoDePropiedad[] {
  return [...propiedades]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((propiedad) => {
      const balance = saldoDePropiedad(entries, propiedad.id)
      return { propertyId: propiedad.id, propertyName: propiedad.name, balance, nature: naturalezaDeSaldo(balance) }
    })
}

/** RF-62.1 · D-51 · el total de todas las propiedades: informativo, no liquidable. */
export function saldoConsolidado(entries: readonly OwnerWalletEntry[]): CopAmount {
  return entries.reduce<CopAmount>((total, entry) => sumar(total, entry.amount), CERO)
}

// ── RF-62.14 · histórico navegable ──────────────────────────────────────────

export interface OwnerWalletFilter {
  propertyId: string | null
  desde: string | null
  hasta: string | null
}

export function emptyOwnerWalletFilter(): OwnerWalletFilter {
  return { propertyId: null, desde: null, hasta: null }
}

export function hasActiveOwnerWalletFilter(filter: OwnerWalletFilter): boolean {
  return filter.propertyId !== null || filter.desde !== null || filter.hasta !== null
}

/** RF-62.14 · propiedad y periodo se combinan; los extremos cuentan. */
export function filterOwnerWalletEntries(entries: readonly OwnerWalletEntry[], filter: OwnerWalletFilter): OwnerWalletEntry[] {
  return entries.filter(entry =>
    (filter.propertyId === null || entry.propertyId === filter.propertyId)
    && (filter.desde === null || entry.occurredOn >= filter.desde)
    && (filter.hasta === null || entry.occurredOn <= filter.hasta))
}

/** RF-62.14 · los cortes, por propiedad y por el mes que cierran; los extremos del periodo cuentan por su mes. */
export function filterOwnerStatements<T extends { propertyId: string, period: Mes }>(cortes: readonly T[], filter: OwnerWalletFilter): T[] {
  return cortes.filter(corte =>
    (filter.propertyId === null || corte.propertyId === filter.propertyId)
    && (filter.desde === null || corte.period >= mesDe(filter.desde))
    && (filter.hasta === null || corte.period <= mesDe(filter.hasta)))
}

/** Del más reciente al más antiguo; el mismo día, el último creado primero. Devuelve una copia. */
export function sortOwnerWalletEntries(entries: readonly OwnerWalletEntry[]): OwnerWalletEntry[] {
  return [...entries].sort((a, b) =>
    b.occurredOn.localeCompare(a.occurredOn)
    || b.createdAt.localeCompare(a.createdAt)
    || a.id.localeCompare(b.id))
}

// ── RF-62.10 · RT-07 · RT-08 · la condición de cada cifra ───────────────────

/**
 * CA-62.12 · el saldo de un mes cerrado es confirmado; el del mes en curso, una
 * estimación que cambia hasta el corte. La vista solo traduce la condición.
 */
export function figuraDeSaldo(balance: CopAmount, cerrado: boolean, idioma: Idioma): CifraPresentada {
  return presentarImporte(cerrado ? confirmado(balance) : estimado(balance), idioma)
}

/** RT-07 · rojo solo a lo que se debe, verde solo a lo disponible, y ninguno de los dos a un estimado. */
export function colorDeSaldo(balance: CopAmount, cerrado: boolean): 'error' | 'success' | 'neutral' {
  if (!cerrado) {
    return 'neutral'
  }
  switch (naturalezaDeSaldo(balance)) {
    case 'charge':
      return 'error'
    case 'payout':
      return 'success'
    default:
      return 'neutral'
  }
}

/** CA-62.12 · el estimado del mes en curso: el neto de HU-19 sobre las cuotas vivas. */
export function saldoEstimadoDelMes(lineas: readonly LineaDelPropietario[], mes: Mes): CopAmount {
  return pesos(saldoDelPeriodo(lineas, mes))
}
