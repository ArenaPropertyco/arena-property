import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import PropertySummaryCard from '~/components/PropertySummaryCard.vue'
import PropertySummaryList from '~/components/PropertySummaryList.vue'
import type { ResumenDePropiedad } from '#shared/properties/tablero'

/**
 * HU-21 · RF-21.1, RF-21.2 · RT-12 · principio 10 · el tablero del Administrador
 * pinta resúmenes ya armados por `shared/properties/tablero`: porcentaje vendido
 * con el formato de TR-02, próximas reservas y alertas con su enlace. Ningún
 * componente consulta ni divide nada.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function resumen(cambios: Partial<ResumenDePropiedad> & { id: string }): ResumenDePropiedad {
  return {
    name: 'Invictvs 1201',
    fractionCount: 8,
    soldFractions: 3,
    soldShare: 3750,
    upcoming: [
      { propertyId: cambios.id, fraction: 2, week: 17, startsOn: '2027-05-01', endsOn: '2027-05-08' },
      { propertyId: cambios.id, fraction: 5, week: 22, startsOn: '2027-06-05', endsOn: '2027-06-12' },
    ],
    alerts: { conflicts: 2, swapRequests: 1, weeksToPlace: 0, openAnnouncements: 0 },
    alertCount: 3,
    ...cambios,
  }
}

describe('PropertySummaryCard', () => {
  it('CA-21.1 · 3 de 8 vendidas se muestra como «37,5 %» con el formato de TR-02', async () => {
    const tarjeta = await mountSuspended(PropertySummaryCard, { props: { resumen: resumen({ id: 'p1' }) } })

    expect(tarjeta.find('[data-test="vendidas-p1"]').text()).toContain('37,5 %')
    expect(tarjeta.find('[data-test="vendidas-p1"]').text()).toContain('3')
    expect(tarjeta.text()).toContain('Invictvs 1201')
  })

  it('CA-21.2 · lista las próximas reservas en el orden en que llegan, con fracción y fecha', async () => {
    const tarjeta = await mountSuspended(PropertySummaryCard, { props: { resumen: resumen({ id: 'p1' }) } })
    const proximas = tarjeta.findAll('[data-test^="proxima-p1-"]')

    expect(proximas).toHaveLength(2)
    expect(proximas[0]?.text()).toContain('2/8')
    expect(proximas[0]?.text()).toContain('2027')
    expect(tarjeta.find('[data-test="sin-proximas-p1"]').exists()).toBe(false)
  })

  it('RF-21.1 · las alertas se cuentan por tipo y enlazan al calendario de la propiedad', async () => {
    const tarjeta = await mountSuspended(PropertySummaryCard, { props: { resumen: resumen({ id: 'p1' }) } })

    expect(tarjeta.find('[data-test="alerta-conflictos-p1"]').text()).toContain('2')
    expect(tarjeta.find('[data-test="alerta-solicitudes-p1"]').text()).toContain('1')
    expect(tarjeta.find('[data-test="alerta-por-colocar-p1"]').exists()).toBe(false)
    expect(tarjeta.find('[data-test="abrir-calendario-p1"]').attributes('href')).toContain('/panel/calendario')
  })

  it('RF-21.1 · sin reservas ni alertas lo dice en vez de dejar huecos', async () => {
    const tarjeta = await mountSuspended(PropertySummaryCard, {
      props: { resumen: resumen({ id: 'p2', upcoming: [], alerts: { conflicts: 0, swapRequests: 0, weeksToPlace: 0 }, alertCount: 0 }) },
    })

    expect(tarjeta.find('[data-test="sin-proximas-p2"]').exists()).toBe(true)
    expect(tarjeta.find('[data-test="sin-alertas-p2"]').exists()).toBe(true)
  })
})

describe('PropertySummaryList', () => {
  it('CA-21.3 · pinta exactamente un resumen por propiedad recibida', async () => {
    const lista = await mountSuspended(PropertySummaryList, {
      props: { resumenes: [resumen({ id: 'p1' }), resumen({ id: 'p3', name: 'Casa Arena' })], pendiente: false },
    })

    expect(lista.findAll('[data-test^="resumen-"]')).toHaveLength(2)
    expect(lista.find('[data-test="resumen-p3"]').text()).toContain('Casa Arena')
  })

  it('RF-21.3 · sin propiedades administradas lo dice con su texto', async () => {
    const lista = await mountSuspended(PropertySummaryList, { props: { resumenes: [], pendiente: false } })

    expect(lista.find('[data-test="tablero-vacio"]').exists()).toBe(true)
    expect(lista.findAll('[data-test^="resumen-"]')).toHaveLength(0)
  })
})
