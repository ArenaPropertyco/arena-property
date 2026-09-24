import { describe, expect, it } from 'vitest'
import {
  esResolubleEnTablero,
  filasDelTablero,
  filtrarFilasDelTablero,
  filtroDeTableroVacio,
  NATURALEZAS_DE_FILA,
  resumenDelTablero,
  resumenesGlobales,
} from '#shared/finance/tablero-de-cobros'
import type { CobroDelTablero, EntradaDelTablero, FraccionDelTablero, PagoDelTablero } from '#shared/finance/tablero-de-cobros'
import { pesos } from '#shared/money/importe'

/**
 * HU-63 · RF-63.1…RF-63.3, RF-63.7, RF-63.9, RF-63.10 · D-08, D-51 · TR-02 — el
 * tablero de cobros de una propiedad en el dominio puro.
 *
 * La Casa P1 tiene 8 fracciones: Ana tiene la 1/8 (debe $50.000), Beto la 3/8
 * (le deben $630.000), Carla la 5/8 (al día) y las demás están sin vender. La
 * base entrega los cortes del mes, los saldos, los cobros con sus pagos y las
 * solicitudes de retiro; aquí se arman las 8 filas y el resumen que cuadra con
 * ellas al peso.
 */

const ANA = 'user-ana'
const BETO = 'user-beto'
const CARLA = 'user-carla'

function fraccion(number: number, cambios: Partial<FraccionDelTablero> = {}): FraccionDelTablero {
  return { id: `f${number}`, number, ownerId: null, ownerLabel: null, status: 'available', calendarActive: false, ...cambios }
}

const FRACCIONES: FraccionDelTablero[] = [
  fraccion(1, { ownerId: ANA, ownerLabel: 'Ana', status: 'sold', calendarActive: true }),
  fraccion(2),
  fraccion(3, { ownerId: BETO, ownerLabel: 'Beto', status: 'sold', calendarActive: true }),
  fraccion(4),
  fraccion(5, { ownerId: CARLA, ownerLabel: 'Carla', status: 'sold', calendarActive: true }),
  fraccion(6),
  fraccion(7),
  fraccion(8),
]

function pago(cambios: Partial<PagoDelTablero> & { id: string }): PagoDelTablero {
  return {
    chargeId: 'ch-ana', amount: pesos(50_000), paidOn: '2026-10-05', paymentMethodName: 'Transferencia', description: 'Bancolombia',
    receiptPath: 'prop-1/user-ana/p.pdf', channel: 'manual', provider: null, externalReference: null, status: 'reported', rejectionReason: null,
    ...cambios,
  }
}

function cobroDeAna(cambios: Partial<CobroDelTablero> = {}): CobroDelTablero {
  return { id: 'ch-ana', ownerId: ANA, period: '2026-09', amount: pesos(50_000), paidAmount: pesos(0), status: 'pending', payments: [], ...cambios }
}

function entrada(cambios: Partial<EntradaDelTablero> = {}): EntradaDelTablero {
  return {
    period: '2026-09',
    estimated: false,
    fractions: FRACCIONES,
    statements: [
      { fractionNumber: 1, responsible: 'owner', income: pesos(50_000), expenses: pesos(100_000), net: pesos(-50_000) },
      { fractionNumber: 3, responsible: 'owner', income: pesos(640_000), expenses: pesos(10_000), net: pesos(630_000) },
    ],
    balances: [{ ownerId: ANA, balance: pesos(-50_000) }, { ownerId: BETO, balance: pesos(630_000) }, { ownerId: CARLA, balance: pesos(0) }],
    charges: [cobroDeAna()],
    withdrawals: [],
    ...cambios,
  }
}

describe('RF-63.1 · RF-63.2 · las 8 filas y su naturaleza', () => {
  const filas = filasDelTablero(entrada())

  it('CA-63.1 · siempre hay 8 filas: la 1/8 es cobro en rojo, la 3/8 es pago en verde, la 5/8 y las demás están al día o son del titular del inventario', () => {
    expect(filas).toHaveLength(8)
    expect(filas.map(fila => fila.fractionNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])

    expect(filas[0]).toMatchObject({ responsible: 'owner', ownerLabel: 'Ana', balance: pesos(-50_000), nature: 'charge', net: pesos(-50_000) })
    expect(filas[2]).toMatchObject({ responsible: 'owner', ownerLabel: 'Beto', balance: pesos(630_000), nature: 'payout' })
    expect(filas[4]).toMatchObject({ responsible: 'owner', ownerLabel: 'Carla', balance: pesos(0), nature: 'settled', net: pesos(0) })
    for (const numero of [2, 4, 6, 7, 8]) {
      expect(filas[numero - 1], `fracción ${numero}`).toMatchObject({ responsible: 'inventory_holder', nature: 'inventory_holder', balance: pesos(0), net: pesos(0) })
    }
  })

  it('RF-63.1 · cada fila de cobro lleva el cobro del mes y los abiertos del Propietario', () => {
    expect(filas[0]!.charge?.id).toBe('ch-ana')
    expect(filas[0]!.openCharges.map(cobro => cobro.id)).toEqual(['ch-ana'])
    expect(filas[2]!.charge).toBeNull()
    expect(filas[0]!.hasReceipt).toBe(false)
  })

  it('RF-63.2 · las naturalezas son exactamente cinco', () => {
    expect(NATURALEZAS_DE_FILA).toEqual(['charge', 'payout', 'settled', 'inventory_holder', 'linked'])
  })

  it('D-44 · un Propietario con dos fracciones liquida en la de menor número; la otra queda ligada y no suma', () => {
    const conDos = filasDelTablero(entrada({ fractions: FRACCIONES.map(f => f.number === 2 ? fraccion(2, { ownerId: ANA, ownerLabel: 'Ana', status: 'sold', calendarActive: true }) : f) }))

    expect(conDos[0]).toMatchObject({ nature: 'charge', balance: pesos(-50_000), receivable: pesos(50_000) })
    expect(conDos[1]).toMatchObject({ nature: 'linked', linkedTo: 1, balance: pesos(0), receivable: pesos(0) })
  })

  it('RF-63.2 · el mes en curso se marca como estimado en el neto, nunca en el saldo', () => {
    const enCurso = filasDelTablero(entrada({ estimated: true }))
    expect(enCurso[0]!.netEstimated).toBe(true)
    expect(enCurso[0]!.nature).toBe('charge')
    expect(filas[0]!.netEstimated).toBe(false)
  })
})

describe('RF-63.7 · D-08 · las filas del titular del inventario', () => {
  it('CA-63.9 · una fracción vendida con calendario inactivo aparece como del titular del inventario, con sus cuotas y sin cobro', () => {
    const filas = filasDelTablero(entrada({
      fractions: FRACCIONES.map(f => f.number === 4 ? fraccion(4, { ownerId: 'user-dora', ownerLabel: 'Dora', status: 'sold', calendarActive: false }) : f),
      statements: [{ fractionNumber: 4, responsible: 'inventory_holder', income: pesos(0), expenses: pesos(10_000), net: pesos(-10_000) }],
      balances: [],
      charges: [],
    }))

    expect(filas[3]).toMatchObject({ responsible: 'inventory_holder', nature: 'inventory_holder', net: pesos(-10_000), expenses: pesos(10_000), charge: null, receivable: pesos(0) })
  })
})

describe('RF-63.3 · el resumen cuadra con las filas', () => {
  it('CA-63.2 · $50.000 por cobrar y $630.000 por pagar, y la suma de las filas coincide al peso', () => {
    const filas = filasDelTablero(entrada())
    const resumen = resumenDelTablero(filas)

    expect(resumen).toMatchObject({
      income: pesos(690_000), expenses: pesos(110_000), net: pesos(580_000),
      receivable: pesos(50_000), collected: pesos(0), underReview: pesos(0), payable: pesos(630_000), cashNet: pesos(-580_000),
    })
    expect(filas.reduce((total, fila) => total + fila.receivable, 0)).toBe(resumen.receivable)
    expect(filas.reduce((total, fila) => total + fila.payable, 0)).toBe(resumen.payable)
  })

  it('CA-63.11 · un pago en revisión va en su propia cifra y no suma a lo cobrado; el confirmado sí', () => {
    const enRevision = resumenDelTablero(filasDelTablero(entrada({ charges: [cobroDeAna({ status: 'under_review', payments: [pago({ id: 'p1', amount: pesos(20_000) })] })] })))
    expect(enRevision).toMatchObject({ receivable: pesos(50_000), collected: pesos(0), underReview: pesos(20_000) })

    const confirmado = resumenDelTablero(filasDelTablero(entrada({
      balances: [{ ownerId: ANA, balance: pesos(0) }, { ownerId: BETO, balance: pesos(630_000) }, { ownerId: CARLA, balance: pesos(0) }],
      charges: [cobroDeAna({ status: 'paid', paidAmount: pesos(50_000), payments: [pago({ id: 'p1', status: 'confirmed' })] })],
    })))
    expect(confirmado).toMatchObject({ receivable: pesos(0), collected: pesos(50_000), underReview: pesos(0) })
  })

  it('CA-63.7 · un abono parcial confirmado deja el cobro pendiente por la diferencia', () => {
    const filas = filasDelTablero(entrada({ charges: [cobroDeAna({ paidAmount: pesos(20_000), payments: [pago({ id: 'p1', amount: pesos(20_000), status: 'confirmed' })] })] }))
    expect(filas[0]).toMatchObject({ receivable: pesos(30_000), collected: pesos(20_000) })
  })
})

describe('RF-63.4 · RF-63.10 · qué pago se resuelve desde el tablero', () => {
  it('CA-63.3 · la fila dice si hay comprobante reportado', () => {
    const filas = filasDelTablero(entrada({ charges: [cobroDeAna({ status: 'under_review', payments: [pago({ id: 'p1' })] })] }))
    expect(filas[0]!.hasReceipt).toBe(true)
    expect(filas[0]!.reportedPayments.map(p => p.id)).toEqual(['p1'])
  })

  it('CA-63.12 · un pago manual reportado se confirma desde el tablero; uno de pasarela o ya resuelto, no', () => {
    expect(esResolubleEnTablero(pago({ id: 'p1' }))).toBe(true)
    expect(esResolubleEnTablero(pago({ id: 'p2', channel: 'gateway', provider: 'wompi', externalReference: 'TX-1', receiptPath: null }))).toBe(false)
    expect(esResolubleEnTablero(pago({ id: 'p3', status: 'confirmed' }))).toBe(false)
  })
})

describe('RF-63.6 · RF-63.9 · retiros y filtros', () => {
  it('RF-63.6 · la fila de pago lleva la solicitud de retiro abierta, si la hay', () => {
    const filas = filasDelTablero(entrada({
      withdrawals: [{ id: 'w1', ownerId: BETO, amount: pesos(300_000), status: 'requested', requestedOn: '2026-10-05', bank: 'Bancolombia', accountKind: 'savings', accountNumber: '1', holder: 'Beto', receiptPath: null }],
    }))
    expect(filas[2]!.withdrawal?.id).toBe('w1')
    expect(filas[0]!.withdrawal).toBeNull()
  })

  it('RF-63.9 · filtra por naturaleza y por estado del cobro, combinables; el vacío deja todo', () => {
    const filas = filasDelTablero(entrada())

    expect(filtrarFilasDelTablero(filas, filtroDeTableroVacio())).toHaveLength(8)
    expect(filtrarFilasDelTablero(filas, { nature: 'charge', status: null }).map(f => f.fractionNumber)).toEqual([1])
    expect(filtrarFilasDelTablero(filas, { nature: null, status: 'pending' }).map(f => f.fractionNumber)).toEqual([1])
    expect(filtrarFilasDelTablero(filas, { nature: 'payout', status: 'pending' })).toEqual([])
    expect(filtrarFilasDelTablero(filas, { nature: 'inventory_holder', status: null })).toHaveLength(5)
  })
})

describe('RF-63.8 · la vista global del Superadmin', () => {
  it('CA-63.13 · cada fila coincide con el resumen del tablero de esa propiedad', () => {
    const p2 = entrada({
      fractions: FRACCIONES.map(f => f.number === 1 ? fraccion(1, { ownerId: 'user-eva', ownerLabel: 'Eva', status: 'sold', calendarActive: true }) : fraccion(f.number)),
      statements: [{ fractionNumber: 1, responsible: 'owner', income: pesos(0), expenses: pesos(80_000), net: pesos(-80_000) }],
      balances: [{ ownerId: 'user-eva', balance: pesos(-80_000) }],
      charges: [{ id: 'ch-eva', ownerId: 'user-eva', period: '2026-09', amount: pesos(80_000), paidAmount: pesos(0), status: 'under_review', payments: [pago({ id: 'p9', chargeId: 'ch-eva', amount: pesos(80_000) })] }],
    })

    const global = resumenesGlobales([{ propertyId: 'prop-1', propertyName: 'Casa P1', entrada: entrada() }, { propertyId: 'prop-2', propertyName: 'Casa P2', entrada: p2 }])

    expect(global).toEqual([
      { propertyId: 'prop-1', propertyName: 'Casa P1', ...resumenDelTablero(filasDelTablero(entrada())) },
      { propertyId: 'prop-2', propertyName: 'Casa P2', ...resumenDelTablero(filasDelTablero(p2)) },
    ])
    expect(global[1]).toMatchObject({ receivable: pesos(80_000), underReview: pesos(80_000), payable: pesos(0) })
  })
})
