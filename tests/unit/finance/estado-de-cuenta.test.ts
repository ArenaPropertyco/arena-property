import { describe, expect, it } from 'vitest'
import { generarCuotas } from '#shared/finance/cuotas'
import type { FraccionParaCuota } from '#shared/finance/cuotas'
import { detalleDeCuota } from '#shared/finance/detalle'
import {
  agregarMes,
  cuotaConMovimientoDe,
  desglosePorCategoria,
  historicoMensual,
  ingresosPorRenta,
  lineasVigentes,
  mesDe,
  mesesDelAnio,
  naturalezaDeLinea,
  saldoDelPeriodo,
} from '#shared/finance/estado-de-cuenta'
import type { LineaDelPropietario } from '#shared/finance/estado-de-cuenta'
import { pesos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'

/**
 * HU-19 · RF-19.1, RF-19.2, RF-19.3 · HU-18 · RF-18.2 · D-09, D-39, D-41 · TR-02 —
 * el estado de cuenta del Propietario como funciones puras sobre las cuotas que
 * la RLS le entrega: desglose por categoría rotulando cada naturaleza, agregación
 * mensual sin huecos y el enlace de cada línea al detalle de HU-24.
 */

function linea(cambios: Partial<LineaDelPropietario> & { shareId: string }): LineaDelPropietario {
  return {
    movementId: `m-${cambios.shareId}`,
    propertyId: 'p1',
    propertyName: 'Casa Arena',
    fraction: 3,
    kind: 'expense',
    allocation: 'prorated',
    amount: pesos(10_000),
    movementAmount: pesos(80_000),
    categoryName: 'Mantenimiento',
    incurredOn: '2026-09-14',
    description: 'Bomba de la piscina',
    hasRemainder: false,
    commissionBasisPoints: null,
    commissionAmount: null,
    weekIndex: null,
    weekStartsOn: null,
    reversedAt: null,
    ...cambios,
  }
}

/** Ocho fracciones vendidas y activas: cada cuota va a su titular. */
function ochoActivas(): FraccionParaCuota[] {
  return Array.from({ length: 8 }, (_, indice) => ({
    number: indice + 1,
    status: 'sold',
    ownerId: `titular-${indice + 1}`,
    calendarActive: true,
    calendarActivatedAt: '2026-01-01T05:00:00Z',
  }))
}

const septiembre: LineaDelPropietario[] = [
  linea({ shareId: 'renta-prorrateada', kind: 'income', categoryName: 'Renta a terceros', amount: pesos(100_000), movementAmount: pesos(800_000), incurredOn: '2026-09-02', description: 'Renta semana 10', weekIndex: 10, weekStartsOn: '2026-03-14' }),
  linea({ shareId: 'renta-atribuida', kind: 'income', allocation: 'single_fraction', categoryName: 'Renta a terceros', amount: pesos(660_000), movementAmount: pesos(800_000), commissionBasisPoints: puntosBasicos(1750), commissionAmount: pesos(140_000), incurredOn: '2026-09-05', description: 'Renta semana 17', weekIndex: 17, weekStartsOn: '2026-05-02' }),
  linea({ shareId: 'gasto-prorrateado' }),
  linea({ shareId: 'gasto-imputado', allocation: 'single_fraction', categoryName: 'Reparaciones', amount: pesos(150_000), movementAmount: pesos(150_000), incurredOn: '2026-09-20', description: 'Vidrio roto' }),
  linea({ shareId: 'gasto-revertido', amount: pesos(999), movementAmount: pesos(7_992), incurredOn: '2026-09-21', reversedAt: '2026-09-22T10:00:00Z' }),
]
const agosto = linea({ shareId: 'gasto-agosto', amount: pesos(5_000), movementAmount: pesos(40_000), incurredOn: '2026-08-30' })
const lineas = [...septiembre, agosto]

describe('CA-19.2 · la cuota del Propietario es exactamente 1/8 del gasto', () => {
  it('CA-19.2 · un gasto de $80.000 produce una línea de $10.000 exactos para la fracción', () => {
    const cuota = generarCuotas(pesos(80_000), ochoActivas(), '2026-09-14').find(c => c.fraction === 3)!
    const desglose = desglosePorCategoria([linea({ shareId: 's1', amount: cuota.amount, hasRemainder: cuota.hasRemainder })])

    expect(cuota.amount).toBe(10_000)
    expect(desglose).toHaveLength(1)
    expect(desglose[0]).toMatchObject({ categoryName: 'Mantenimiento', kind: 'expense', naturaleza: 'prorated', total: 10_000 })
    expect(desglose[0]?.lineas[0]?.amount).toBe(10_000)
  })

  it('RF-19.1 · cada naturaleza se rotula como lo que es: prorrateada, atribuida o imputada', () => {
    expect(naturalezaDeLinea(septiembre[0]!)).toBe('prorated')
    expect(naturalezaDeLinea(septiembre[1]!)).toBe('attributed')
    expect(naturalezaDeLinea(septiembre[3]!)).toBe('imputed')
  })

  it('RF-19.1 · el desglose agrupa por categoría y naturaleza, ingresos antes que gastos, sin líneas revertidas', () => {
    const grupos = desglosePorCategoria(septiembre)

    expect(grupos.map(g => [g.kind, g.naturaleza, g.categoryName])).toEqual([
      ['income', 'attributed', 'Renta a terceros'],
      ['income', 'prorated', 'Renta a terceros'],
      ['expense', 'imputed', 'Reparaciones'],
      ['expense', 'prorated', 'Mantenimiento'],
    ])
    expect(grupos.find(g => g.naturaleza === 'prorated' && g.kind === 'expense')?.lineas.map(l => l.shareId)).toEqual(['gasto-prorrateado'])
    expect(lineasVigentes(septiembre).map(l => l.shareId)).not.toContain('gasto-revertido')
  })
})

describe('CA-19.1 · la agregación mensual', () => {
  it('CA-19.1 · ingresos, gastos y neto coinciden con el cálculo manual y neto = ingresos − gastos', () => {
    const mes = agregarMes(lineas, '2026-09')

    expect(mes).toEqual({ mes: '2026-09', ingresos: 760_000, gastos: 160_000, neto: 600_000, movimientos: 4 })
    expect(mes.neto).toBe(mes.ingresos - mes.gastos)
  })

  it('D-09 · una línea se imputa al mes de su causación, no al de su registro', () => {
    expect(agregarMes(lineas, '2026-08')).toEqual({ mes: '2026-08', ingresos: 0, gastos: 5_000, neto: -5_000, movimientos: 1 })
    expect(mesDe('2026-08-30')).toBe('2026-08')
  })

  it('RF-18.1 · el saldo del periodo es el neto del mes', () => {
    expect(saldoDelPeriodo(lineas, '2026-09')).toBe(600_000)
  })
})

describe('CA-19.3 · un mes sin movimientos muestra ceros, no huecos', () => {
  it('CA-19.3 · el histórico de julio a octubre trae los cuatro meses, con ceros donde no hubo nada', () => {
    const historico = historicoMensual(lineas, '2026-07', '2026-10')

    expect(historico.map(m => m.mes)).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(historico[0]).toEqual({ mes: '2026-07', ingresos: 0, gastos: 0, neto: 0, movimientos: 0 })
    expect(historico[3]).toEqual({ mes: '2026-10', ingresos: 0, gastos: 0, neto: 0, movimientos: 0 })
    expect(historico[2]?.neto).toBe(600_000)
  })

  it('RF-19.2 · el año completo son doce meses, de enero a diciembre', () => {
    const [desde, hasta] = mesesDelAnio(2026)
    const historico = historicoMensual(lineas, desde, hasta)

    expect(historico).toHaveLength(12)
    expect(historico[0]?.mes).toBe('2026-01')
    expect(historico[11]?.mes).toBe('2026-12')
  })
})

describe('RF-18.2 · CA-18.3 · los ingresos por renta que tocan a la fracción, por naturaleza', () => {
  it('CA-18.3 · un ingreso de $800.000 prorrateado llega a la fracción como $100.000 exactos', () => {
    const cuota = generarCuotas(pesos(800_000), ochoActivas(), '2026-09-02').find(c => c.fraction === 3)!
    const ingresos = ingresosPorRenta([linea({ shareId: 'r', kind: 'income', amount: cuota.amount, movementAmount: pesos(800_000) })])

    expect(ingresos).toEqual({ prorated: 100_000, attributed: 0, total: 100_000 })
  })

  it('CA-18.3 · RT-08 · con $800.001 la fracción 1/8 recibe $100.001 marcados con residuo, sin redondeo silencioso', () => {
    const cuotas = generarCuotas(pesos(800_001), ochoActivas(), '2026-09-02')
    const primera = cuotas.find(c => c.fraction === 1)!
    const tercera = cuotas.find(c => c.fraction === 3)!

    expect(primera).toMatchObject({ amount: 100_001, hasRemainder: true })
    expect(tercera).toMatchObject({ amount: 100_000, hasRemainder: false })
    expect(ingresosPorRenta([linea({ shareId: 'r', kind: 'income', fraction: 1, amount: primera.amount, hasRemainder: true })]).prorated).toBe(100_001)
  })

  it('RF-18.2 · D-39 · lo prorrateado y lo atribuido se distinguen, y lo atribuido ya es neto de comisión', () => {
    expect(ingresosPorRenta(lineas)).toEqual({ prorated: 100_000, attributed: 660_000, total: 760_000 })
  })
})

describe('RF-19.3 · cada línea enlaza al detalle de HU-24', () => {
  it('la línea se convierte en la cuota con movimiento que `detalleDeCuota` explica, sin recalcular nada', () => {
    const atribuida = detalleDeCuota(cuotaConMovimientoDe(septiembre[1]!))
    const prorrateada = detalleDeCuota(cuotaConMovimientoDe(septiembre[2]!))

    expect(atribuida.naturaleza).toBe('attributed')
    expect(atribuida.naturaleza === 'attributed' && atribuida.neto).toBe(660_000)
    expect(atribuida.naturaleza === 'attributed' && atribuida.semana).toEqual({ indice: 17, empiezaEl: '2026-05-02' })
    expect(prorrateada).toMatchObject({ naturaleza: 'prorated', cuota: 10_000, montoOriginal: 80_000, propertyName: 'Casa Arena' })
  })
})
