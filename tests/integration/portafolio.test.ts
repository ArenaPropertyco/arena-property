import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import MonthlyHistoryTable from '~/components/MonthlyHistoryTable.vue'
import OwnerFractionCard from '~/components/OwnerFractionCard.vue'
import OwnerFractionsList from '~/components/OwnerFractionsList.vue'
import OwnerStatementBreakdown from '~/components/OwnerStatementBreakdown.vue'
import WeekHistoryFilters from '~/components/WeekHistoryFilters.vue'
import WeekHistoryTable from '~/components/WeekHistoryTable.vue'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import { puntosBasicos } from '#shared/money/comision'
import type { GrupoDeCategoria, LineaDelPropietario, MesAgregado } from '#shared/finance/estado-de-cuenta'
import { desglosePorCategoria } from '#shared/finance/estado-de-cuenta'
import type { TarjetaDeFraccion } from '#shared/finance/portafolio'
import { filtroDeHistorialVacio } from '#shared/scheduling/historial'
import type { SemanaHistorica } from '#shared/scheduling/historial'

/**
 * HU-18 · RF-18.1, RF-18.2, RF-18.5 · HU-19 · RF-19.1…RF-19.4 · HU-20 · RF-20.1,
 * RF-20.2, RF-20.4 · HU-58 · RF-58.9 · RT-06 · RT-12 · principio 10 · los
 * componentes del dashboard del Propietario reciben tarjetas, grupos, meses y
 * semanas ya armados por `shared/` y emiten lo que el Propietario decide. Ninguno
 * consulta ni divide un peso.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const HOY = '2027-01-01'

function semana(cambios: Partial<SemanaHistorica> & { week: number, startsOn: string, endsOn: string }): SemanaHistorica {
  return {
    propertyId: 'p1', propertyName: 'Casa Arena', fraction: 3, season: 'baja',
    confirmedAt: null, releasedAt: null, releaseReason: null, rented: false, income: null,
    ...cambios,
  }
}

function tarjeta(cambios: Partial<TarjetaDeFraccion> & { fractionId: string }): TarjetaDeFraccion {
  return {
    fraction: 3,
    propertyId: 'p1',
    propertyName: 'Casa Arena',
    calendarActive: true,
    nextStay: semana({ week: 5, startsOn: '2027-02-06', endsOn: '2027-02-13', confirmedAt: '2026-11-01T10:00:00Z' }),
    balance: pesos(750_000),
    periodo: '2026-09',
    rentalIncome: { prorated: pesos(100_000), attributed: pesos(660_000), total: pesos(760_000) },
    plan: null,
    coOwners: [{ fraction: 5, name: 'Luis Mora' }, { fraction: 8, name: 'Marta Díaz' }],
    ...cambios,
  }
}

function linea(cambios: Partial<LineaDelPropietario> & { shareId: string }): LineaDelPropietario {
  return {
    movementId: `m-${cambios.shareId}`, propertyId: 'p1', propertyName: 'Casa Arena', fraction: 3,
    kind: 'expense', allocation: 'prorated', amount: pesos(10_000), movementAmount: pesos(80_000),
    categoryName: 'Mantenimiento', incurredOn: '2026-09-14', description: 'Bomba de la piscina', hasRemainder: false,
    commissionBasisPoints: null, commissionAmount: null, weekIndex: null, weekStartsOn: null, reversedAt: null,
    ...cambios,
  }
}

describe('OwnerFractionCard', () => {
  it('CA-18.3 · muestra los $100.000 prorrateados y los $660.000 atribuidos de la fracción, cada uno con su rótulo', async () => {
    const carta = await mountSuspended(OwnerFractionCard, { props: { tarjeta: tarjeta({ fractionId: 'f1' }) } })

    expect(carta.find('[data-test="renta-prorrateada-f1"]').text()).toContain(formatearImporte(pesos(100_000), 'es'))
    expect(carta.find('[data-test="renta-atribuida-f1"]').text()).toContain(formatearImporte(pesos(660_000), 'es'))
    expect(carta.find('[data-test="saldo-f1"]').text()).toContain(formatearImporte(pesos(750_000), 'es'))
    expect(carta.find('[data-test="saldo-f1"]').classes()).toContain('font-mono')
  })

  it('CA-18.2 · la próxima estadía es la confirmada más cercana; sin ella, el vacío traducido', async () => {
    const con = await mountSuspended(OwnerFractionCard, { props: { tarjeta: tarjeta({ fractionId: 'f1' }) } })
    expect(con.find('[data-test="proxima-f1"]').text()).toContain('2027')
    expect(con.find('[data-test="sin-proxima-f1"]').exists()).toBe(false)

    const sin = await mountSuspended(OwnerFractionCard, { props: { tarjeta: tarjeta({ fractionId: 'f2', nextStay: null }) } })
    expect(sin.find('[data-test="sin-proxima-f2"]').text()).toBe('Sin estadías próximas.')
  })

  it('RF-18.5 · RF-58.9 · con el plan sin completar dice el saldo pendiente y qué falta para activar el calendario', async () => {
    const carta = await mountSuspended(OwnerFractionCard, {
      props: { tarjeta: tarjeta({ fractionId: 'f2', calendarActive: false, plan: { id: 'plan-2', status: 'in_progress', balance: pesos(70_000_000) } }) },
    })
    const saldo = formatearImporte(pesos(70_000_000), 'es')

    expect(carta.find('[data-test="plan-f2"]').text()).toContain(saldo)
    expect(carta.find('[data-test="calendario-f2"]').text()).toBe(`Faltan ${saldo} para activar el calendario.`)
    expect(carta.find('[data-test="abrir-plan-plan-2"]').attributes('href')).toBe('/panel/planes/plan-2')
  })

  it('RF-58.9 · D-31 · con el calendario activo no hay plan que mostrar y lo dice', async () => {
    const carta = await mountSuspended(OwnerFractionCard, { props: { tarjeta: tarjeta({ fractionId: 'f1' }) } })

    expect(carta.find('[data-test="plan-f1"]').exists()).toBe(false)
    expect(carta.find('[data-test="calendario-f1"]').text()).toContain('activo')
  })

  it('RF-18.5 · D-16 · lista a los copropietarios con nombre y fracción, y sin renta no muestra el bloque de ingresos', async () => {
    const carta = await mountSuspended(OwnerFractionCard, {
      props: { tarjeta: tarjeta({ fractionId: 'f3', rentalIncome: { prorated: pesos(0), attributed: pesos(0), total: pesos(0) } }) },
    })

    expect(carta.findAll('[data-test^="copropietario-f3-"]')).toHaveLength(2)
    expect(carta.find('[data-test="copropietario-f3-5"]').text()).toContain('Luis Mora')
    expect(carta.find('[data-test="copropietario-f3-5"]').text()).toContain('5/8')
    expect(carta.find('[data-test="renta-f3"]').exists()).toBe(false)
    expect(carta.find('[data-test="abrir-estado-f3"]').attributes('href')).toContain('/panel/finanzas')
  })
})

describe('OwnerFractionsList', () => {
  it('CA-18.1 · pinta exactamente una tarjeta por fracción', async () => {
    const lista = await mountSuspended(OwnerFractionsList, {
      props: { tarjetas: [tarjeta({ fractionId: 'f1' }), tarjeta({ fractionId: 'f2', propertyName: 'Refugio Salento', fraction: 1 })], pendiente: false },
    })

    expect(lista.findAll('[data-test^="tarjeta-"]')).toHaveLength(2)
    expect(lista.find('[data-test="tarjeta-f2"]').text()).toContain('Refugio Salento')
  })

  it('sin fracciones propias lo dice con su texto', async () => {
    const lista = await mountSuspended(OwnerFractionsList, { props: { tarjetas: [], pendiente: false } })

    expect(lista.find('[data-test="sin-fracciones"]').text()).toBe('Todavía no eres titular de ninguna fracción.')
  })
})

describe('OwnerStatementBreakdown', () => {
  const grupos: GrupoDeCategoria[] = desglosePorCategoria([
    linea({ shareId: 'gasto' }),
    linea({ shareId: 'atribuida', kind: 'income', allocation: 'single_fraction', categoryName: 'Renta a terceros', amount: pesos(660_000), movementAmount: pesos(800_000), commissionBasisPoints: puntosBasicos(1750), commissionAmount: pesos(140_000), incurredOn: '2026-09-05', description: 'Renta semana 17' }),
    linea({ shareId: 'imputado', allocation: 'single_fraction', categoryName: 'Reparaciones', amount: pesos(150_000), movementAmount: pesos(150_000), description: 'Vidrio roto' }),
  ])

  it('CA-19.2 · RF-19.1 · la línea del gasto de $80.000 muestra $10.000 rotulados como cuota prorrateada', async () => {
    const desglose = await mountSuspended(OwnerStatementBreakdown, { props: { grupos } })

    expect(desglose.find('[data-test="linea-gasto"]').text()).toContain(formatearImporte(pesos(10_000), 'es'))
    expect(desglose.find('[data-test="naturaleza-gasto"]').text()).toBe('Cuota prorrateada (1/8)')
    expect(desglose.find('[data-test="naturaleza-atribuida"]').text()).toBe('Ingreso atribuido')
    expect(desglose.find('[data-test="naturaleza-imputado"]').text()).toBe('Gasto imputado')
  })

  it('RF-19.3 · RF-19.4 · cada línea enlaza al detalle de su cuota y las cifras van en la tipografía de cifras', async () => {
    const desglose = await mountSuspended(OwnerStatementBreakdown, { props: { grupos } })

    await desglose.find('[data-test="detalle-atribuida"]').trigger('click')
    expect(desglose.emitted('detalle')).toEqual([['atribuida']])
    expect(desglose.find('[data-test="importe-gasto"]').classes()).toContain('font-mono')
  })

  it('sin movimientos en el periodo lo dice', async () => {
    const desglose = await mountSuspended(OwnerStatementBreakdown, { props: { grupos: [] } })

    expect(desglose.find('[data-test="sin-lineas"]').exists()).toBe(true)
  })
})

describe('MonthlyHistoryTable', () => {
  const meses: MesAgregado[] = [
    { mes: '2026-08', ingresos: pesos(0), gastos: pesos(0), neto: pesos(0), movimientos: 0 },
    { mes: '2026-09', ingresos: pesos(760_000), gastos: pesos(160_000), neto: pesos(600_000), movimientos: 4 },
  ]

  it('CA-19.3 · un mes sin movimientos se pinta con ceros, no con huecos', async () => {
    const tabla = await mountSuspended(MonthlyHistoryTable, { props: { meses, seleccionado: null } })

    expect(tabla.find('[data-test="neto-2026-08"]').text()).toContain(formatearImporte(pesos(0), 'es'))
    expect(tabla.find('[data-test="neto-2026-09"]').text()).toContain(formatearImporte(pesos(600_000), 'es'))
    expect(tabla.find('[data-test="neto-2026-09"]').classes()).toContain('font-mono')
  })

  it('RF-19.2 · elegir un mes lo emite para navegar su desglose', async () => {
    const tabla = await mountSuspended(MonthlyHistoryTable, { props: { meses, seleccionado: '2026-09' } })

    await tabla.find('[data-test="ver-mes-2026-08"]').trigger('click')
    await flushPromises()
    expect(tabla.emitted('seleccionar')).toEqual([['2026-08']])
  })
})

describe('WeekHistoryFilters', () => {
  const propiedades = [{ id: 'p1', name: 'Casa Arena' }, { id: 'p2', name: 'Refugio Salento' }]

  it('CA-20.1 · cambiar el rango emite el filtro completo con el otro criterio intacto', async () => {
    const filtros = await mountSuspended(WeekHistoryFilters, {
      props: { filtro: { ...filtroDeHistorialVacio(), propertyId: 'p1' }, propiedades },
    })

    await filtros.find('[data-test="filtro-desde"]').setValue('2027-02-01')
    expect(filtros.emitted('update:filtro')?.[0]?.[0]).toEqual({ propertyId: 'p1', desde: '2027-02-01', hasta: null })

    await filtros.find('[data-test="filtro-limpiar"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.at(-1)?.[0]).toEqual(filtroDeHistorialVacio())
  })
})

describe('WeekHistoryTable', () => {
  const semanas = [
    semana({ week: 5, startsOn: '2027-02-06', endsOn: '2027-02-13', confirmedAt: '2026-11-01T10:00:00Z' }),
    semana({ week: 30, startsOn: '2026-08-07', endsOn: '2026-08-14', releasedAt: '2026-05-01T10:00:00Z', releaseReason: 'voluntary', rented: true, income: pesos(660_000) }),
    semana({ week: 9, startsOn: '2027-03-06', endsOn: '2027-03-13', releasedAt: '2027-01-01T10:00:00Z', releaseReason: 'voluntary' }),
  ]

  it('RF-20.1 · cada semana lleva propiedad, fracción, número, fechas, temporada y estado', async () => {
    const tabla = await mountSuspended(WeekHistoryTable, { props: { semanas, today: HOY } })

    const fila = tabla.find('[data-test="semana-p1-5"]')
    expect(fila.text()).toContain('Casa Arena')
    expect(fila.text()).toContain('3/8')
    expect(fila.text()).toContain('2027')
    expect(tabla.find('[data-test="estado-p1-5"]').text()).toBe('Confirmada')
  })

  it('RF-20.4 · D-43 · la liberada y rentada dice «Rentada a un tercero» con su ingreso; la que sigue en bolsa no muestra importe', async () => {
    const tabla = await mountSuspended(WeekHistoryTable, { props: { semanas, today: HOY } })

    expect(tabla.find('[data-test="estado-p1-30"]').text()).toBe('Rentada a un tercero')
    expect(tabla.find('[data-test="ingreso-p1-30"]').text()).toContain(formatearImporte(pesos(660_000), 'es'))
    expect(tabla.find('[data-test="estado-p1-9"]').text()).toBe('Liberada, en bolsa de renta')
    expect(tabla.find('[data-test="ingreso-p1-9"]').exists()).toBe(false)
  })

  it('sin semanas lo dice', async () => {
    const tabla = await mountSuspended(WeekHistoryTable, { props: { semanas: [], today: HOY } })

    expect(tabla.find('[data-test="sin-semanas"]').exists()).toBe(true)
  })
})
