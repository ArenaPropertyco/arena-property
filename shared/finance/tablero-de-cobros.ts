/**
 * HU-63 · RF-63.1…RF-63.3, RF-63.6, RF-63.7, RF-63.9, RF-63.10 · D-08, D-44,
 * D-51 · TR-02 — el tablero de cobros de una propiedad.
 *
 * Es la cara operativa de HU-62: no crea otro modelo de cobro, lo lee. Recibe
 * lo que la base sabe de un mes —las 8 fracciones, los cortes (del Propietario
 * o del titular del inventario), los saldos por Propietario, los cobros con sus
 * pagos y las solicitudes de retiro— y arma **siempre 8 filas**, una por
 * fracción, más un resumen que suma exactamente lo que suman las filas.
 *
 * Tres reglas que conviene leer antes que el código:
 *
 * 1. **Quién responde por la fracción (RF-63.1, D-08).** El Propietario si está
 *    vendida y con calendario activo; el titular del inventario en cualquier
 *    otro caso. Las cuotas del titular se ven para que la propiedad cuadre, pero
 *    no generan cobro (RF-63.7).
 * 2. **Un Propietario con dos fracciones liquida una sola vez (D-44, D-51).** El
 *    saldo y los cobros son por Propietario y propiedad, así que van en la
 *    fracción de menor número; las demás quedan **ligadas** a ella y no suman.
 * 3. **El mes en curso es estimado en el neto, nunca en el saldo (RF-63.2).** El
 *    saldo es la suma del histórico y está confirmado; el neto del mes cambia
 *    hasta el corte.
 */

import type { CopAmount } from '../money/importe'
import { CERO, restar, sumar, sumarTodos } from '../money/importe'
import type { PaymentChannel } from '../payments/pasarela'
import type { EstadoDeFraccion } from '../properties/fracciones'
import { FRACCIONES_POR_PROPIEDAD } from '../money/prorrateo'
import type { NaturalezaDeSaldo } from './billetera'
import { naturalezaDeSaldo } from './billetera'
import type { ChargeStatus, PaymentStatus } from './cobros'
import type { Mes } from './estado-de-cuenta'
import type { OwnerWithdrawalStatus } from './retiros-propietario'
import type { AccountKind } from '../referrals/signup'

// ── Lo que entra ────────────────────────────────────────────────────────────

export interface FraccionDelTablero {
  id: string
  number: number
  ownerId: string | null
  /** Nombre o correo del Propietario; `null` si no tiene. */
  ownerLabel: string | null
  status: EstadoDeFraccion
  calendarActive: boolean
}

/** Quién responde por una fracción. */
export type Responsable = 'owner' | 'inventory_holder'

/** El corte de una fracción en el mes: del Propietario (HU-62) o del titular del inventario (sus cuotas). */
export interface CorteDelTablero {
  fractionNumber: number
  responsible: Responsable
  income: CopAmount
  expenses: CopAmount
  net: CopAmount
}

export interface SaldoDelTablero {
  ownerId: string
  balance: CopAmount
}

export interface PagoDelTablero {
  id: string
  chargeId: string
  amount: CopAmount
  paidOn: string
  paymentMethodName: string
  description: string
  receiptPath: string | null
  channel: PaymentChannel
  provider: string | null
  externalReference: string | null
  status: PaymentStatus
  rejectionReason: string | null
}

export interface CobroDelTablero {
  id: string
  ownerId: string
  period: Mes
  amount: CopAmount
  paidAmount: CopAmount
  status: ChargeStatus
  payments: PagoDelTablero[]
}

export interface RetiroDelTablero {
  id: string
  ownerId: string
  amount: CopAmount
  status: OwnerWithdrawalStatus
  requestedOn: string
  bank: string
  accountKind: AccountKind
  accountNumber: string
  holder: string
  receiptPath: string | null
}

export interface EntradaDelTablero {
  period: Mes
  /** RF-63.2 · el mes en curso: su neto es estimado. */
  estimated: boolean
  fractions: readonly FraccionDelTablero[]
  statements: readonly CorteDelTablero[]
  balances: readonly SaldoDelTablero[]
  charges: readonly CobroDelTablero[]
  withdrawals: readonly RetiroDelTablero[]
}

// ── Las filas ───────────────────────────────────────────────────────────────

/** RF-63.2 · qué es cada fila: cobro, pago, al día, del titular del inventario o ligada a otra fracción del mismo dueño. */
export const NATURALEZAS_DE_FILA = ['charge', 'payout', 'settled', 'inventory_holder', 'linked'] as const
export type NaturalezaDeFila = typeof NATURALEZAS_DE_FILA[number]

export interface FilaDelTablero {
  fractionId: string
  fractionNumber: number
  responsible: Responsable
  ownerId: string | null
  ownerLabel: string | null
  income: CopAmount
  expenses: CopAmount
  net: CopAmount
  /** RF-63.2 · el neto del mes en curso todavía cambia. */
  netEstimated: boolean
  /** El saldo del Propietario en la propiedad; cero en las filas del titular y en las ligadas. */
  balance: CopAmount
  nature: NaturalezaDeFila
  /** D-44 · la fracción del mismo dueño que lleva el saldo, cuando esta está ligada. */
  linkedTo: number | null
  /** El cobro emitido por el corte de este mes, si lo hubo. */
  charge: CobroDelTablero | null
  /** Los cobros del Propietario que aún esperan, de cualquier mes. */
  openCharges: CobroDelTablero[]
  /** RF-63.4 · los pagos en revisión de esos cobros. */
  reportedPayments: PagoDelTablero[]
  hasReceipt: boolean
  /** RF-63.6 · la solicitud de retiro abierta, si la hay. */
  withdrawal: RetiroDelTablero | null
  receivable: CopAmount
  collected: CopAmount
  underReview: CopAmount
  payable: CopAmount
}

function responsableDe(fraccion: FraccionDelTablero): Responsable {
  return fraccion.status === 'sold' && fraccion.ownerId !== null && fraccion.calendarActive ? 'owner' : 'inventory_holder'
}

function naturalezaDeFila(balance: CopAmount): Exclude<NaturalezaDeFila, 'inventory_holder' | 'linked'> {
  const naturaleza: NaturalezaDeSaldo = naturalezaDeSaldo(balance)
  return naturaleza
}

function pagosCon(cobros: readonly CobroDelTablero[], status: PaymentStatus): PagoDelTablero[] {
  return cobros.flatMap(cobro => cobro.payments.filter(pago => pago.status === status))
}

/**
 * CA-63.1 · CA-63.9 · RF-63.1 · RF-63.7 · las 8 filas, por número. Una fracción
 * que falte en la entrada se lista igual, vacía: un hueco se lee como un error.
 */
export function filasDelTablero(entrada: EntradaDelTablero): FilaDelTablero[] {
  const porNumero = new Map(entrada.fractions.map(fraccion => [fraccion.number, fraccion]))
  const saldoDe = new Map(entrada.balances.map(saldo => [saldo.ownerId, saldo.balance]))
  // D-44 · la fracción de menor número de cada Propietario es la que liquida.
  const liquidaEn = new Map<string, number>()
  for (const fraccion of [...entrada.fractions].sort((a, b) => a.number - b.number)) {
    if (responsableDe(fraccion) === 'owner' && fraccion.ownerId && !liquidaEn.has(fraccion.ownerId)) {
      liquidaEn.set(fraccion.ownerId, fraccion.number)
    }
  }

  return Array.from({ length: FRACCIONES_POR_PROPIEDAD }, (_, indice) => indice + 1).map((numero) => {
    const fraccion = porNumero.get(numero) ?? { id: `sin-fraccion-${numero}`, number: numero, ownerId: null, ownerLabel: null, status: 'available' as const, calendarActive: false }
    const responsible = responsableDe(fraccion)
    const corte = entrada.statements.find(candidato => candidato.fractionNumber === numero && candidato.responsible === responsible)
    const base = {
      fractionId: fraccion.id,
      fractionNumber: numero,
      responsible,
      ownerId: responsible === 'owner' ? fraccion.ownerId : null,
      ownerLabel: responsible === 'owner' ? fraccion.ownerLabel : null,
      income: corte?.income ?? CERO,
      expenses: corte?.expenses ?? CERO,
      net: corte?.net ?? CERO,
      netEstimated: entrada.estimated,
    }
    const vacia = {
      balance: CERO, linkedTo: null, charge: null, openCharges: [], reportedPayments: [], hasReceipt: false, withdrawal: null,
      receivable: CERO, collected: CERO, underReview: CERO, payable: CERO,
    }

    if (responsible !== 'owner' || !fraccion.ownerId) {
      return { ...base, ...vacia, nature: 'inventory_holder' }
    }
    const titular = liquidaEn.get(fraccion.ownerId)
    if (titular !== undefined && titular !== numero) {
      return { ...base, ...vacia, nature: 'linked', linkedTo: titular }
    }

    const balance = saldoDe.get(fraccion.ownerId) ?? CERO
    const cobros = entrada.charges.filter(cobro => cobro.ownerId === fraccion.ownerId)
    const charge = cobros.find(cobro => cobro.period === entrada.period) ?? null
    const openCharges = cobros.filter(cobro => cobro.status !== 'paid')
    const reportedPayments = pagosCon(openCharges, 'reported')
    const withdrawal = entrada.withdrawals.find(retiro => retiro.ownerId === fraccion.ownerId && retiro.status === 'requested') ?? null

    return {
      ...base,
      balance,
      nature: naturalezaDeFila(balance),
      linkedTo: null,
      charge,
      openCharges,
      reportedPayments,
      hasReceipt: reportedPayments.length > 0,
      withdrawal,
      receivable: sumarTodos(openCharges.map(cobro => restar(cobro.amount, cobro.paidAmount))),
      collected: sumarTodos(pagosCon(charge ? [charge] : [], 'confirmed').map(pago => pago.amount)),
      underReview: sumarTodos(reportedPayments.map(pago => pago.amount)),
      payable: balance > 0 ? balance : CERO,
    }
  })
}

// ── El resumen ──────────────────────────────────────────────────────────────

export interface ResumenDelTablero {
  income: CopAmount
  expenses: CopAmount
  net: CopAmount
  /** Lo que los cobros abiertos aún esperan. */
  receivable: CopAmount
  /** Lo confirmado contra los cobros de este mes. */
  collected: CopAmount
  /** RT-08 · lo reportado que nadie ha confirmado: nunca se suma a lo cobrado. */
  underReview: CopAmount
  /** Lo que la propiedad les debe a sus fracciones. */
  payable: CopAmount
  /** Por cobrar menos por pagar: lo que la propiedad neta espera de sus fracciones. */
  cashNet: CopAmount
}

/** CA-63.2 · CA-63.11 · RF-63.3 · el resumen sale de las mismas filas, así que cuadra al peso. */
export function resumenDelTablero(filas: readonly FilaDelTablero[]): ResumenDelTablero {
  const suma = (campo: keyof Pick<FilaDelTablero, 'income' | 'expenses' | 'receivable' | 'collected' | 'underReview' | 'payable'>) =>
    filas.reduce<CopAmount>((total, fila) => sumar(total, fila[campo]), CERO)
  const income = suma('income')
  const expenses = suma('expenses')
  const receivable = suma('receivable')
  const payable = suma('payable')
  return { income, expenses, net: restar(income, expenses), receivable, collected: suma('collected'), underReview: suma('underReview'), payable, cashNet: restar(receivable, payable) }
}

// ── RF-63.4 · RF-63.10 · qué se resuelve desde el tablero ───────────────────

/** CA-63.12 · solo un pago manual reportado se confirma o rechaza a mano; el de pasarela lo resuelve su proveedor. */
export function esResolubleEnTablero(pago: Pick<PagoDelTablero, 'status' | 'channel'>): boolean {
  return pago.status === 'reported' && pago.channel === 'manual'
}

// ── RF-63.9 · filtros ───────────────────────────────────────────────────────

export interface FiltroDeTablero {
  nature: NaturalezaDeFila | null
  status: ChargeStatus | null
}

export function filtroDeTableroVacio(): FiltroDeTablero {
  return { nature: null, status: null }
}

export function hayFiltroDeTableroActivo(filtro: FiltroDeTablero): boolean {
  return filtro.nature !== null || filtro.status !== null
}

/** RF-63.9 · naturaleza y estado del cobro del mes se combinan. */
export function filtrarFilasDelTablero(filas: readonly FilaDelTablero[], filtro: FiltroDeTablero): FilaDelTablero[] {
  return filas.filter(fila =>
    (filtro.nature === null || fila.nature === filtro.nature)
    && (filtro.status === null || fila.charge?.status === filtro.status))
}

// ── RF-63.8 · la vista global ───────────────────────────────────────────────

export interface FilaGlobal extends ResumenDelTablero {
  propertyId: string
  propertyName: string
}

/** CA-63.13 · una fila por propiedad, con el mismo resumen que su tablero. */
export function resumenesGlobales(propiedades: readonly { propertyId: string, propertyName: string, entrada: EntradaDelTablero }[]): FilaGlobal[] {
  return propiedades.map(propiedad => ({
    propertyId: propiedad.propertyId,
    propertyName: propiedad.propertyName,
    ...resumenDelTablero(filasDelTablero(propiedad.entrada)),
  }))
}
