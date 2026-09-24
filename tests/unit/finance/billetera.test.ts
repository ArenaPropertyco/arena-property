import { describe, expect, it } from 'vitest'
import {
  colorDeSaldo,
  cortar,
  figuraDeSaldo,
  filterOwnerStatements,
  filterOwnerWalletEntries,
  lineasDelCorte,
  naturalezaDeSaldo,
  OWNER_WALLET_ENTRY_KINDS,
  periodoAnterior,
  saldoConsolidado,
  saldoEstimadoDelMes,
  saldosPorPropiedad,
  sortOwnerWalletEntries,
} from '#shared/finance/billetera'
import type { CuotaLiquidable, LineaDeCorte, OwnerWalletEntry } from '#shared/finance/billetera'
import { mesAnterior, mesSiguiente } from '#shared/finance/estado-de-cuenta'
import type { LineaDelPropietario } from '#shared/finance/estado-de-cuenta'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-62 · RF-62.1…RF-62.5, RF-62.10 · D-08, D-09, D-51 · TR-02 — la billetera del
 * Propietario en el dominio puro.
 *
 * Pedro es dueño de la fracción 3/8 de la Casa P1 y de la 1/8 de la Casa P2. La
 * base le entrega sus cuotas (HU-23, HU-40) y aquí se corta el mes, se derivan los
 * saldos por propiedad y se decide qué cifra es confirmada. La base repite el
 * corte en `private.cortar_fraccion` con las mismas reglas.
 */

const PEDRO = 'user-pedro'
const P1 = { id: 'prop-1', name: 'Casa P1' }
const P2 = { id: 'prop-2', name: 'Casa P2' }

function cuota(cambios: Partial<Omit<CuotaLiquidable, 'amount'>> & { shareId: string, amount: number }): CuotaLiquidable {
  return {
    movementId: `mov-${cambios.shareId}`, propertyId: P1.id, fractionId: 'f3', fractionNumber: 3,
    kind: 'expense', incurredOn: '2026-09-15', payer: 'owner', payerId: PEDRO, reversedAt: null,
    ...cambios,
    amount: pesos(cambios.amount),
  }
}

const FRACCION_3 = { fractionId: 'f3', propertyId: P1.id, ownerId: PEDRO }

describe('RF-62.3 · el neto de una fracción en el mes', () => {
  it('CA-62.1 · un gasto prorrateado de $800.000 y un ingreso prorrateado de $400.000 dejan −$50.000', () => {
    const cuotas = [
      cuota({ shareId: 's1', kind: 'expense', amount: 100_000 }),
      cuota({ shareId: 's2', kind: 'income', amount: 50_000, incurredOn: '2026-09-20' }),
    ]

    const corte = cortar(cuotas, [], { ...FRACCION_3, period: '2026-09' })

    expect(corte.income).toBe(pesos(50_000))
    expect(corte.expenses).toBe(pesos(100_000))
    expect(corte.net).toBe(pesos(-50_000))
    expect(corte.lines).toHaveLength(2)
    expect(corte.lines.every(linea => !linea.adjustment)).toBe(true)
  })

  it('CA-62.2 · un ingreso atribuido de $640.000 (D-39) y un gasto de $80.000 prorrateado dejan +$630.000', () => {
    const cuotas = [
      cuota({ shareId: 's1', kind: 'income', amount: 640_000 }),
      cuota({ shareId: 's2', kind: 'expense', amount: 10_000 }),
    ]

    expect(cortar(cuotas, [], { ...FRACCION_3, period: '2026-09' }).net).toBe(pesos(630_000))
  })

  it('CA-62.4 · D-08 · las cuotas a cargo del titular del inventario no entran al corte del Propietario', () => {
    const cuotas = [
      cuota({ shareId: 's1', amount: 100_000, payer: 'inventory_holder', payerId: null }),
      cuota({ shareId: 's2', amount: 100_000, payer: 'owner', payerId: 'user-otra' }),
    ]

    const corte = cortar(cuotas, [], { ...FRACCION_3, period: '2026-09' })

    expect(corte.lines).toEqual([])
    expect(corte.net).toBe(pesos(0))
  })

  it('RF-62.3 · D-09 · solo entran las cuotas causadas hasta el mes del corte; las del mes siguiente esperan', () => {
    const cuotas = [
      cuota({ shareId: 's1', amount: 100_000, incurredOn: '2026-09-30' }),
      cuota({ shareId: 's2', amount: 100_000, incurredOn: '2026-10-01' }),
    ]

    expect(cortar(cuotas, [], { ...FRACCION_3, period: '2026-09' }).lines.map(linea => linea.shareId)).toEqual(['s1'])
  })

  it('RF-62.3 · una cuota revertida antes de liquidarse nunca entra', () => {
    const cuotas = [cuota({ shareId: 's1', amount: 100_000, reversedAt: '2026-09-20T10:00:00Z' })]

    expect(lineasDelCorte(cuotas, [], { ...FRACCION_3, period: '2026-09' })).toEqual([])
  })
})

describe('RF-62.5 · movimientos tardíos y anulaciones', () => {
  const liquidadasEnSeptiembre: LineaDeCorte[] = [{
    shareId: 's1', movementId: 'mov-s1', kind: 'expense', entry: 'charge',
    amount: pesos(100_000), originPeriod: '2026-09', adjustment: false,
  }]

  it('CA-62.5 · un gasto causado el 20 de septiembre y registrado tras el corte entra en octubre como ajuste con origen septiembre', () => {
    const cuotas = [
      cuota({ shareId: 's1', amount: 100_000, incurredOn: '2026-09-10' }),
      cuota({ shareId: 's9', amount: 30_000, incurredOn: '2026-09-20' }),
    ]

    const octubre = cortar(cuotas, liquidadasEnSeptiembre, { ...FRACCION_3, period: '2026-10' })

    expect(octubre.lines).toEqual([
      expect.objectContaining({ shareId: 's9', entry: 'charge', originPeriod: '2026-09', adjustment: true }),
    ])
    expect(octubre.net).toBe(pesos(-30_000))
  })

  it('CA-62.5 · RF-62.5 · el corte de septiembre no cambia: cortarlo de nuevo con lo mismo devuelve lo mismo', () => {
    const cuotas = [
      cuota({ shareId: 's1', amount: 100_000, incurredOn: '2026-09-10' }),
      cuota({ shareId: 's9', amount: 30_000, incurredOn: '2026-09-20' }),
    ]

    const septiembre = cortar(cuotas, liquidadasEnSeptiembre, { ...FRACCION_3, period: '2026-09' })

    // Lo ya liquidado no vuelve a entrar; lo nuevo espera al corte siguiente.
    expect(septiembre.lines.map(linea => linea.shareId)).toEqual(['s9'])
    expect(septiembre.lines[0]!.adjustment).toBe(false)
  })

  it('RF-62.5 · la anulación de un gasto ya liquidado entra como reversa de periodo anterior, una sola vez', () => {
    const cuotas = [cuota({ shareId: 's1', amount: 100_000, incurredOn: '2026-09-10', reversedAt: '2026-10-05T12:00:00Z' })]

    const octubre = cortar(cuotas, liquidadasEnSeptiembre, { ...FRACCION_3, period: '2026-10' })
    expect(octubre.lines).toEqual([
      expect.objectContaining({ shareId: 's1', entry: 'reversal', kind: 'expense', originPeriod: '2026-09', adjustment: true }),
    ])
    expect(octubre.net).toBe(pesos(100_000))

    const noviembre = cortar(cuotas, [...liquidadasEnSeptiembre, ...octubre.lines], { ...FRACCION_3, period: '2026-11' })
    expect(noviembre.lines).toEqual([])
  })
})

describe('RF-62.3 · D-51 · el periodo que cierra el día 1', () => {
  it('el 1 de octubre en Bogotá se cierra septiembre; el 1 de enero, diciembre del año anterior', () => {
    expect(periodoAnterior('2026-10-01')).toBe('2026-09')
    expect(periodoAnterior('2027-01-01')).toBe('2026-12')
    expect(periodoAnterior('2026-10-15')).toBe('2026-09')
  })

  it('RF-63.9 · el tablero navega mes a mes sin aritmética en la vista', () => {
    expect(mesAnterior('2026-01')).toBe('2025-12')
    expect(mesSiguiente('2026-12')).toBe('2027-01')
    expect(mesSiguiente(mesAnterior('2026-06'))).toBe('2026-06')
  })
})

/** El histórico de Pedro: septiembre cortado en las dos casas, un pago confirmado y un retiro pagado. */
function entrada(cambios: Partial<Omit<OwnerWalletEntry, 'amount'>> & { id: string, kind: OwnerWalletEntry['kind'], amount: number }): OwnerWalletEntry {
  return {
    occurredOn: '2026-10-01', createdAt: '2026-10-01T05:05:00Z', propertyId: P1.id, propertyName: P1.name,
    fractionNumber: 3, period: '2026-09', statementId: null, paymentId: null, withdrawalId: null,
    ...cambios,
    amount: pesos(cambios.amount),
  }
}

const HISTORICO: OwnerWalletEntry[] = [
  entrada({ id: 'e1', kind: 'statement_closed', amount: -50_000, statementId: 'st-1' }),
  entrada({ id: 'e2', kind: 'statement_closed', amount: 630_000, statementId: 'st-2', propertyId: P2.id, propertyName: P2.name, fractionNumber: 1 }),
  entrada({ id: 'e3', kind: 'withdrawal_paid', amount: -300_000, withdrawalId: 'w-1', propertyId: P2.id, propertyName: P2.name, fractionNumber: null, period: null, occurredOn: '2026-10-08', createdAt: '2026-10-08T15:00:00Z' }),
]

describe('RF-62.1 · RF-62.2 · los saldos se derivan por propiedad', () => {
  it('CA-62.11 · cada propiedad tiene su saldo y su color, y el total no compensa entre propiedades', () => {
    const saldos = saldosPorPropiedad(HISTORICO, [P1, P2])

    expect(saldos).toEqual([
      { propertyId: P1.id, propertyName: P1.name, balance: pesos(-50_000), nature: 'charge' },
      { propertyId: P2.id, propertyName: P2.name, balance: pesos(330_000), nature: 'payout' },
    ])
    expect(saldoConsolidado(HISTORICO)).toBe(pesos(280_000))
  })

  it('RF-62.2 · un pago confirmado suma y salda el cobro; una propiedad sin movimientos aparece en cero', () => {
    const conPago = [...HISTORICO, entrada({ id: 'e4', kind: 'payment_confirmed', amount: 50_000, paymentId: 'pay-1', fractionNumber: null, period: null, occurredOn: '2026-10-06' })]
    const p3 = { id: 'prop-3', name: 'Casa P3' }

    const saldos = saldosPorPropiedad(conPago, [P1, P2, p3])

    expect(saldos.find(saldo => saldo.propertyId === P1.id)).toMatchObject({ balance: pesos(0), nature: 'settled' })
    expect(saldos.find(saldo => saldo.propertyId === p3.id)).toMatchObject({ balance: pesos(0), nature: 'settled' })
  })

  it('RF-62.6 · RF-62.9 · negativo es cobro, positivo es retiro, cero está al día', () => {
    expect(naturalezaDeSaldo(pesos(-1))).toBe('charge')
    expect(naturalezaDeSaldo(pesos(1))).toBe('payout')
    expect(naturalezaDeSaldo(pesos(0))).toBe('settled')
  })

  it('RF-62.2 · el histórico admite exactamente tres movimientos', () => {
    expect(OWNER_WALLET_ENTRY_KINDS).toEqual(['statement_closed', 'payment_confirmed', 'withdrawal_paid'])
  })
})

describe('RF-62.14 · histórico navegable', () => {
  it('ordena del más reciente al más antiguo y filtra por propiedad y periodo', () => {
    expect(sortOwnerWalletEntries(HISTORICO).map(entry => entry.id)).toEqual(['e3', 'e1', 'e2'])
    expect(filterOwnerWalletEntries(HISTORICO, { propertyId: P2.id, desde: null, hasta: null }).map(entry => entry.id)).toEqual(['e2', 'e3'])
    expect(filterOwnerWalletEntries(HISTORICO, { propertyId: null, desde: '2026-10-02', hasta: '2026-10-31' }).map(entry => entry.id)).toEqual(['e3'])
  })

  it('RF-62.14 · los cortes se filtran por propiedad y por el mes que cierran', () => {
    const cortes = [
      { id: 'st-1', propertyId: P1.id, period: '2026-08' },
      { id: 'st-2', propertyId: P1.id, period: '2026-09' },
      { id: 'st-3', propertyId: P2.id, period: '2026-09' },
    ]

    expect(filterOwnerStatements(cortes, { propertyId: P1.id, desde: null, hasta: null }).map(corte => corte.id)).toEqual(['st-1', 'st-2'])
    expect(filterOwnerStatements(cortes, { propertyId: null, desde: '2026-09-15', hasta: '2026-09-30' }).map(corte => corte.id)).toEqual(['st-2', 'st-3'])
  })
})

describe('RF-62.10 · RT-07 · RT-08 · la condición de cada cifra', () => {
  it('CA-62.12 · el saldo de un mes cerrado es confirmado y lleva su color; el del mes en curso es estimado y no lleva verde', () => {
    const cerrado = figuraDeSaldo(pesos(630_000), true, 'es')
    expect(cerrado).toEqual({ texto: formatearImporte(pesos(630_000), 'es'), condicion: 'confirmado', esConfirmado: true })
    expect(colorDeSaldo(pesos(630_000), true)).toBe('success')
    expect(colorDeSaldo(pesos(-50_000), true)).toBe('error')
    expect(colorDeSaldo(pesos(0), true)).toBe('neutral')

    const enCurso = figuraDeSaldo(pesos(630_000), false, 'es')
    expect(enCurso.condicion).toBe('estimado')
    expect(enCurso.esConfirmado).toBe(false)
    expect(colorDeSaldo(pesos(630_000), false)).toBe('neutral')
  })

  it('CA-62.12 · el estimado del mes en curso sale de las cuotas de HU-19, con la misma regla neto = ingresos − gastos', () => {
    const linea = (cambios: Partial<LineaDelPropietario> & { shareId: string }): LineaDelPropietario => ({
      movementId: 'm', propertyId: P1.id, propertyName: P1.name, fraction: 3, kind: 'expense', allocation: 'prorated',
      amount: pesos(10_000), movementAmount: pesos(80_000), categoryName: 'Aseo', incurredOn: '2026-10-05', description: '',
      hasRemainder: false, commissionBasisPoints: null, commissionAmount: null, weekIndex: null, weekStartsOn: null, reversedAt: null,
      ...cambios,
    })

    expect(saldoEstimadoDelMes([linea({ shareId: 'a' }), linea({ shareId: 'b', kind: 'income', amount: pesos(25_000) })], '2026-10')).toBe(pesos(15_000))
  })
})
