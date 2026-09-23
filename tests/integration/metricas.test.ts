import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import KpiCards from '~/components/KpiCards.vue'
import MetricsChart from '~/components/MetricsChart.vue'
import PeriodSelector from '~/components/PeriodSelector.vue'
import { calcularKpis } from '#shared/metrics/kpis'
import { agregarSerie } from '#shared/metrics/series'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'

/**
 * HU-32 · RF-32.1, RF-32.2, RF-32.4 · RT-06 · principio 10 · las tarjetas y el
 * gráfico reciben los KPI y las series ya calculadas por `shared/metrics`;
 * ninguno cuenta, suma ni decide el color de una cifra. La librería de gráficos
 * se dobla entera en la prueba —en jsdom no hay lienzo que medir— y lo que se
 * comprueba es qué recibe el gráfico, qué pone en su tooltip y el resumen en
 * texto que lo acompaña.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

vi.mock('vue-chrts', () => {
  const BarChart = defineComponent({
    name: 'BarChart',
    props: {
      data: { type: Array as () => Record<string, unknown>[], default: () => [] },
      categories: { type: Object as () => Record<string, { name: string, color: string }>, default: () => ({}) },
    },
    setup: (props, { slots }) => () => h('div', {
      'data-test': 'vis-contenedor',
      'data-puntos': String(props.data.length),
      'data-categoria': Object.values(props.categories)[0]?.name,
      'data-color': Object.values(props.categories)[0]?.color,
      // El tooltip de Unovis solo existe al pasar el cursor; aquí se pinta el del
      // primer cubo para poder leer lo que el componente pone dentro.
    }, slots.tooltip?.({ values: props.data[0] })),
  })
  return { BarChart }
})

const kpis = calcularKpis({
  properties: 3,
  fractionsTotal: 24,
  fractionsSold: 9,
  activeAdmins: 2,
  owners: 7,
  activeAmbassadors: 4,
  commissions: { pending: pesos(1_500_000), inGrace: pesos(3_000_000), available: pesos(2_400_000), withdrawn: pesos(900_000) },
})

/** El texto que TR-02 produce para un importe, para no reescribir el formato en la prueba. */
const cop = (monto: number) => formatearImporte(pesos(monto), 'es')

describe('KpiCards', () => {
  it('CA-32.1 · RF-32.4 · pinta cada KPI con su formato: conteos, porcentaje de RF-D.5 y comisiones con condición', async () => {
    const tarjetas = await mountSuspended(KpiCards, { props: { kpis } })

    expect(tarjetas.find('[data-test="kpi-propiedades"]').text()).toContain('3')
    expect(tarjetas.find('[data-test="kpi-fracciones"]').text()).toContain('9 / 24')
    expect(tarjetas.find('[data-test="kpi-porcentaje"]').text()).toContain('37,5 %')
    expect(tarjetas.find('[data-test="kpi-administradores"]').text()).toContain('2')
    expect(tarjetas.find('[data-test="kpi-propietarios"]').text()).toContain('7')
    expect(tarjetas.find('[data-test="kpi-embajadores"]').text()).toContain('4')

    const comisiones = tarjetas.find('[data-test="kpi-comisiones"]')
    expect(comisiones.text()).toContain(cop(7_800_000))
    expect(comisiones.find('[data-condicion]').attributes('data-condicion')).toBe('confirmado')
    expect(comisiones.text()).toContain(cop(4_500_000))
    expect(comisiones.text()).toContain(cop(2_400_000))
    expect(comisiones.text()).toContain(cop(900_000))
  })
})

describe('MetricsChart', () => {
  const eventos = [{ on: '2026-09-02', value: 1 }, { on: '2026-09-20', value: 1 }, { on: '2026-11-03', value: 1 }]
  const serie = agregarSerie(eventos, 'monthly')

  it('CA-32.2 · RF-32.2 · recibe la serie ya agregada, la pasa al gráfico y la resume en texto con su total', async () => {
    const grafico = await mountSuspended(MetricsChart, {
      props: { titulo: 'Fracciones vendidas', serie, formato: 'count' },
    })

    const contenedor = grafico.find('[data-test="vis-contenedor"]')
    expect(contenedor.attributes('data-puntos')).toBe('3')
    expect(contenedor.attributes('data-categoria')).toBe('Fracciones vendidas')
    expect(contenedor.attributes('data-color')).toBe('var(--color-arena-500)')
    expect(grafico.find('[data-test="serie-total"]').text()).toBe('3')
    const etiquetas = grafico.findAll('[data-test^="bucket-"]')
    expect(etiquetas.map(li => li.attributes('data-test'))).toEqual(['bucket-2026-09', 'bucket-2026-10', 'bucket-2026-11'])
    expect(etiquetas[0]!.text()).toContain('sep 2026')
    expect(etiquetas[0]!.text()).toContain('2')
    expect(etiquetas[1]!.text()).toContain('0')
  })

  it('RF-32.2 · RT-12 · el tooltip nombra el periodo de la barra y su cifra formateada', async () => {
    const grafico = await mountSuspended(MetricsChart, {
      props: { titulo: 'Fracciones vendidas', serie, formato: 'count' },
    })

    const tooltip = grafico.find('[data-test="tooltip-bucket"]')
    expect(tooltip.text()).toContain('sep 2026')
    expect(tooltip.text()).toContain('2')
  })

  it('RF-32.2 · cambiar de periodo vuelve a montar el gráfico en vez de parchearlo', async () => {
    const grafico = await mountSuspended(MetricsChart, {
      props: { titulo: 'Fracciones vendidas', serie, formato: 'count' },
    })
    const antes = grafico.findComponent({ name: 'BarChart' }).vm.$.uid

    await grafico.setProps({ serie: agregarSerie(eventos, 'yearly') })

    const despues = grafico.findComponent({ name: 'BarChart' })
    expect(despues.vm.$.uid).not.toBe(antes)
    expect(despues.attributes('data-puntos')).toBe('1')
  })

  it('RF-32.4 · con formato de dinero, el total y cada bucket llevan el formato de TR-02', async () => {
    const importes = agregarSerie([{ on: '2026-09-12', value: 3_000_000 }, { on: '2026-10-05', value: 900_000 }], 'monthly')
    const grafico = await mountSuspended(MetricsChart, {
      props: { titulo: 'Comisiones', serie: importes, formato: 'money' },
    })
    expect(grafico.find('[data-test="serie-total"]').text()).toBe(cop(3_900_000))
    expect(grafico.find('[data-test="bucket-2026-09"]').text()).toContain(cop(3_000_000))
    expect(grafico.find('[data-test="tooltip-bucket"]').text()).toContain(cop(3_000_000))
  })

  it('sin datos lo dice en vez de dibujar un gráfico vacío', async () => {
    const grafico = await mountSuspended(MetricsChart, { props: { titulo: 'Nada', serie: [], formato: 'count' } })
    expect(grafico.find('[data-test="vis-contenedor"]').exists()).toBe(false)
    expect(grafico.find('[data-test="serie-vacia"]').exists()).toBe(true)
    expect(grafico.find('[data-test="serie-etiquetas"]').exists()).toBe(false)
  })
})

describe('PeriodSelector', () => {
  it('RF-32.2 · ofrece mensual, trimestral y anual como control segmentado y emite el elegido', async () => {
    const selector = await mountSuspended(PeriodSelector, { props: { periodo: 'monthly' } })
    const tabs = selector.findComponent({ name: 'UTabs' })
    expect(tabs.props('items')).toHaveLength(3)
    expect(tabs.props('modelValue')).toBe('monthly')
    tabs.vm.$emit('update:modelValue', 'quarterly')
    expect(selector.emitted('update:periodo')).toEqual([['quarterly']])
  })
})
