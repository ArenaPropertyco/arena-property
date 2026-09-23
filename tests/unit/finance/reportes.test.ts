import { describe, expect, it } from 'vitest'
import {
  agregarReporte,
  CABECERA_DE_REPORTE,
  csvDelReporte,
  filasDelReporte,
  filtrarEntradas,
  filtroDeReporteVacio,
  hayFiltroDeReporteActivo,
  rutaDeExportacion,
} from '#shared/finance/reportes'
import type { EntradaDeReporte, FiltroDeReporte } from '#shared/finance/reportes'
import { parsearCsv } from '#shared/finance/csv'
import { pesos } from '#shared/money/importe'

/**
 * HU-25 · RF-25.1, RF-25.3, RF-25.4 · D-01, D-09 — el reporte financiero
 * consolidado del Superadmin es una agregación pura sobre entradas tipadas.
 *
 * Dos propiedades (Palomino y Salento), dos administradores, un periodo de dos
 * meses. En el libro de propiedad hay gastos de mantenimiento y servicios y un
 * ingreso de renta; en el libro de plataforma, una comisión de Embajador
 * devengada en septiembre y una comisión de gestión de renta. Los totales se
 * comprueban a mano en cada aserción.
 */

const ADMIN_A = 'admin-a'
const ADMIN_B = 'admin-b'

function entrada(cambios: Partial<EntradaDeReporte> & { id: string }): EntradaDeReporte {
  return {
    libro: 'property',
    propertyId: 'palomino',
    propertyName: 'Casa Palomino',
    adminIds: [ADMIN_A],
    kind: 'expense',
    amount: pesos(0),
    categoryName: 'Mantenimiento',
    paymentMethodName: 'Transferencia',
    incurredOn: '2026-09-15',
    ...cambios,
  }
}

const ENTRADAS: EntradaDeReporte[] = [
  entrada({ id: 'm1', amount: pesos(800_000), categoryName: 'Mantenimiento', incurredOn: '2026-09-03' }),
  entrada({ id: 'm2', amount: pesos(200_000), categoryName: 'Servicios públicos', paymentMethodName: 'Efectivo', incurredOn: '2026-09-20' }),
  entrada({ id: 'm3', amount: pesos(1_500_000), kind: 'income', categoryName: 'Renta a terceros', incurredOn: '2026-09-25' }),
  entrada({ id: 'm4', amount: pesos(300_000), categoryName: 'Mantenimiento', incurredOn: '2026-10-02' }),
  entrada({ id: 'm5', propertyId: 'salento', propertyName: 'Refugio Salento', adminIds: [ADMIN_B], amount: pesos(450_000), categoryName: 'Mantenimiento', incurredOn: '2026-09-10' }),
  // D-01 · la comisión del Embajador vive en el libro de plataforma; la propiedad es informativa.
  entrada({ id: 'c1', libro: 'platform', propertyId: 'palomino', propertyName: 'Casa Palomino', adminIds: [ADMIN_A], amount: pesos(3_000_000), categoryName: 'Comisión de Embajador', paymentMethodName: null, incurredOn: '2026-09-12' }),
  entrada({ id: 'c2', libro: 'platform', propertyId: 'salento', propertyName: 'Refugio Salento', adminIds: [ADMIN_B], kind: 'income', amount: pesos(150_000), categoryName: 'Comisión de gestión de renta', paymentMethodName: null, incurredOn: '2026-10-05' }),
]

const SEPTIEMBRE: FiltroDeReporte = { ...filtroDeReporteVacio(), desde: '2026-09-01', hasta: '2026-09-30' }

describe('RF-25.1 · el reporte se filtra por propiedad, administrador y periodo', () => {
  it('sin criterio no filtra nada, y el filtro vacío se reconoce como tal', () => {
    expect(filtrarEntradas(ENTRADAS, filtroDeReporteVacio())).toHaveLength(ENTRADAS.length)
    expect(hayFiltroDeReporteActivo(filtroDeReporteVacio())).toBe(false)
    expect(hayFiltroDeReporteActivo(SEPTIEMBRE)).toBe(true)
  })

  it('CA-25.1 · por propiedad y periodo quedan exactamente las entradas causadas en él', () => {
    const filtradas = filtrarEntradas(ENTRADAS, { ...SEPTIEMBRE, propertyId: 'palomino' })
    expect(filtradas.map(e => e.id)).toEqual(['m1', 'm2', 'm3', 'c1'])
  })

  it('por administrador se quedan las entradas de sus propiedades, de los dos libros', () => {
    expect(filtrarEntradas(ENTRADAS, { ...filtroDeReporteVacio(), adminId: ADMIN_B }).map(e => e.id)).toEqual(['m5', 'c2'])
  })

  it('el periodo es inclusivo en los dos extremos y se lee sobre la fecha de causación (D-09)', () => {
    const solo = filtrarEntradas(ENTRADAS, { ...filtroDeReporteVacio(), desde: '2026-09-03', hasta: '2026-09-03' })
    expect(solo.map(e => e.id)).toEqual(['m1'])
  })
})

describe('CA-25.1 · CA-25.2 · RF-25.4 · la agregación cuadra con el cálculo manual', () => {
  const reporte = agregarReporte(ENTRADAS, SEPTIEMBRE)

  it('CA-25.1 · el libro de propiedad de septiembre suma $1.450.000 de egresos y $1.500.000 de ingresos', () => {
    expect(reporte.propiedad.egresos).toBe(pesos(1_450_000))
    expect(reporte.propiedad.ingresos).toBe(pesos(1_500_000))
    expect(reporte.propiedad.neto).toBe(pesos(50_000))
  })

  it('CA-25.2 · el desglose por categoría suma exactamente el total de cada clase', () => {
    const egresos = reporte.propiedad.porCategoria.filter(d => d.kind === 'expense')
    expect(egresos).toEqual([
      { name: 'Mantenimiento', kind: 'expense', total: pesos(1_250_000) },
      { name: 'Servicios públicos', kind: 'expense', total: pesos(200_000) },
    ])
    expect(egresos.reduce((suma, d) => suma + d.total, 0)).toBe(reporte.propiedad.egresos)
    expect(reporte.propiedad.porCategoria.filter(d => d.kind === 'income').reduce((suma, d) => suma + d.total, 0)).toBe(reporte.propiedad.ingresos)
  })

  it('CA-25.2 · el desglose por medio de pago también cuadra', () => {
    const porMedio = reporte.propiedad.porMedioDePago
    expect(porMedio.map(d => [d.name, d.kind, d.total])).toEqual([
      ['Transferencia', 'expense', pesos(1_250_000)],
      ['Efectivo', 'expense', pesos(200_000)],
      ['Transferencia', 'income', pesos(1_500_000)],
    ])
  })

  it('CA-25.1 · por propiedad, cada celda es la suma de sus entradas', () => {
    expect(reporte.propiedad.porPropiedad).toEqual([
      { propertyId: 'palomino', propertyName: 'Casa Palomino', ingresos: pesos(1_500_000), egresos: pesos(1_000_000), neto: pesos(500_000) },
      { propertyId: 'salento', propertyName: 'Refugio Salento', ingresos: pesos(0), egresos: pesos(450_000), neto: pesos(-450_000) },
    ])
  })

  it('RF-25.3 · el consolidado suma los dos libros y solo existe a nivel de negocio', () => {
    expect(reporte.plataforma.egresos).toBe(pesos(3_000_000))
    expect(reporte.consolidado).toEqual({
      ingresos: pesos(1_500_000),
      egresos: pesos(4_450_000),
      neto: pesos(-2_950_000),
    })
  })
})

describe('CA-25.3 · RF-25.3 · D-01 · la comisión aparece una sola vez, en plataforma y en su devengo', () => {
  it('CA-25.3 · con el filtro de la propiedad, la comisión está en el libro de plataforma y no en el de la propiedad', () => {
    const reporte = agregarReporte(ENTRADAS, { ...SEPTIEMBRE, propertyId: 'palomino' })
    expect(reporte.propiedad.porCategoria.some(d => d.name === 'Comisión de Embajador')).toBe(false)
    expect(reporte.plataforma.porCategoria).toEqual([{ name: 'Comisión de Embajador', kind: 'expense', total: pesos(3_000_000) }])
  })

  it('CA-25.3 · fuera del periodo de devengo la comisión no figura; el pago del retiro no la duplica', () => {
    const octubre = agregarReporte(ENTRADAS, { ...filtroDeReporteVacio(), desde: '2026-10-01', hasta: '2026-10-31' })
    expect(octubre.plataforma.egresos).toBe(pesos(0))
    expect(octubre.plataforma.ingresos).toBe(pesos(150_000))
    // La misma comisión, contada en todo el rango, sigue siendo una.
    const todo = agregarReporte(ENTRADAS, filtroDeReporteVacio())
    expect(todo.plataforma.porCategoria.find(d => d.name === 'Comisión de Embajador')?.total).toBe(pesos(3_000_000))
  })
})

describe('CA-25.4 · las filas de la vista y del archivo son las mismas', () => {
  const reporte = agregarReporte(ENTRADAS, SEPTIEMBRE)

  it('las filas salen agrupadas y ordenadas de forma determinista, y suman lo que dice el reporte', () => {
    const filas = filasDelReporte(reporte)
    expect(filas[0]).toEqual({ libro: 'property', propertyName: 'Casa Palomino', kind: 'expense', categoryName: 'Mantenimiento', paymentMethodName: 'Transferencia', total: pesos(800_000) })
    const totalDeFilas = filas.filter(f => f.libro === 'property' && f.kind === 'expense').reduce((suma, f) => suma + f.total, 0)
    expect(totalDeFilas).toBe(reporte.propiedad.egresos)
  })

  it('CA-25.4 · el CSV tiene la misma cabecera y exactamente las filas de la vista, en el mismo orden', () => {
    const csv = csvDelReporte(reporte)
    const parseado = parsearCsv(csv)
    expect(parseado[0]).toEqual([...CABECERA_DE_REPORTE])
    const filas = filasDelReporte(reporte)
    expect(parseado).toHaveLength(filas.length + 1)
    expect(parseado[1]).toEqual(['property', 'Casa Palomino', 'expense', 'Mantenimiento', 'Transferencia', '800000'])
    expect(parseado.at(-1)?.[3]).toBe(filas.at(-1)?.categoryName)
  })

  it('la ruta de exportación lleva los mismos filtros que la vista', () => {
    expect(rutaDeExportacion({ ...SEPTIEMBRE, propertyId: 'palomino' }))
      .toBe('/api/reportes/finanzas.csv?propiedad=palomino&desde=2026-09-01&hasta=2026-09-30')
    expect(rutaDeExportacion(filtroDeReporteVacio())).toBe('/api/reportes/finanzas.csv')
  })
})
