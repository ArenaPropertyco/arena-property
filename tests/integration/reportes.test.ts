import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LedgerSummaryCards from '~/components/LedgerSummaryCards.vue'
import ReportFilters from '~/components/ReportFilters.vue'
import ReportTable from '~/components/ReportTable.vue'
import { agregarReporte, filasDelReporte, filtroDeReporteVacio } from '#shared/finance/reportes'
import type { EntradaDeReporte } from '#shared/finance/reportes'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-25 · RF-25.1, RF-25.3 · RT-06 · principio 10 · los componentes del reporte
 * reciben el filtro, el reporte agregado y sus filas ya hechas por
 * `shared/finance/reportes`, y emiten lo que el Superadmin decide. Ninguno
 * suma ni formatea por su cuenta.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function entrada(cambios: Partial<EntradaDeReporte> & { id: string }): EntradaDeReporte {
  return {
    libro: 'property',
    propertyId: 'palomino',
    propertyName: 'Casa Palomino',
    adminIds: ['admin-a'],
    kind: 'expense',
    amount: pesos(0),
    categoryName: 'Mantenimiento',
    paymentMethodName: 'Transferencia',
    incurredOn: '2026-09-15',
    ...cambios,
  }
}

const ENTRADAS: EntradaDeReporte[] = [
  entrada({ id: 'm1', amount: pesos(800_000) }),
  entrada({ id: 'm2', amount: pesos(1_500_000), kind: 'income', categoryName: 'Renta a terceros' }),
  entrada({ id: 'c1', libro: 'platform', amount: pesos(3_000_000), categoryName: 'Comisión de Embajador', paymentMethodName: null }),
]

const reporte = agregarReporte(ENTRADAS, filtroDeReporteVacio())

/** El texto que TR-02 produce para un importe, para no reescribir el formato en la prueba. */
const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

describe('ReportFilters', () => {
  it('RF-25.1 · ofrece propiedad, administrador y periodo, y emite el filtro combinado', async () => {
    const filtros = await mountSuspended(ReportFilters, {
      props: {
        filtro: filtroDeReporteVacio(),
        propiedades: [{ id: 'palomino', name: 'Casa Palomino' }],
        administradores: [{ id: 'admin-a', label: 'Ana Pérez' }],
      },
    })

    expect(filtros.find('[data-test="limpiar-filtros-reporte"]').exists()).toBe(false)

    filtros.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'palomino')
    expect(filtros.emitted('update:filtro')?.[0]).toEqual([{ propertyId: 'palomino', adminId: null, desde: null, hasta: null }])

    await filtros.find('[data-test="reporte-desde"]').setValue('2026-09-01')
    expect(filtros.emitted('update:filtro')?.[1]).toEqual([{ propertyId: null, adminId: null, desde: '2026-09-01', hasta: null }])
  })

  it('RF-25.1 · con filtro activo ofrece limpiar, y limpiar emite el filtro vacío', async () => {
    const filtros = await mountSuspended(ReportFilters, {
      props: { filtro: { ...filtroDeReporteVacio(), propertyId: 'palomino' }, propiedades: [], administradores: [] },
    })
    await filtros.find('[data-test="limpiar-filtros-reporte"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[0]).toEqual([filtroDeReporteVacio()])
  })
})

describe('LedgerSummaryCards', () => {
  it('RF-25.3 · D-01 · pinta los dos libros por separado y el consolidado con el formato de TR-02', async () => {
    const tarjetas = await mountSuspended(LedgerSummaryCards, { props: { reporte } })

    const propiedad = tarjetas.find('[data-test="libro-propiedad"]')
    expect(propiedad.find('[data-test="egresos"]').text()).toBe(cop(800_000))
    expect(propiedad.find('[data-test="ingresos"]').text()).toBe(cop(1_500_000))
    expect(propiedad.find('[data-test="neto"]').text()).toBe(cop(700_000))

    const plataforma = tarjetas.find('[data-test="libro-plataforma"]')
    expect(plataforma.find('[data-test="egresos"]').text()).toBe(cop(3_000_000))

    const consolidado = tarjetas.find('[data-test="consolidado"]')
    expect(consolidado.find('[data-test="egresos"]').text()).toBe(cop(3_800_000))
    expect(consolidado.find('[data-test="neto"]').text()).toBe(cop(-2_300_000))
  })
})

describe('ReportTable', () => {
  it('CA-25.4 · muestra exactamente las filas del reporte, en su orden, con libro, clase y total', async () => {
    const filas = filasDelReporte(reporte)
    const tabla = await mountSuspended(ReportTable, { props: { filas } })

    const cuerpo = tabla.findAll('tbody tr')
    expect(cuerpo).toHaveLength(filas.length)
    expect(cuerpo[0]!.text()).toContain('Mantenimiento')
    expect(cuerpo[0]!.text()).toContain(cop(800_000))
    expect(cuerpo.at(-1)!.text()).toContain('Arena')
    expect(cuerpo.at(-1)!.text()).toContain('Comisión de Embajador')
  })

  it('sin filas lo dice', async () => {
    const tabla = await mountSuspended(ReportTable, { props: { filas: [] } })
    expect(tabla.text()).toContain('No hay movimientos')
  })
})
