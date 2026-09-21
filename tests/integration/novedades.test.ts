import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import AnnouncementFilters from '~/components/AnnouncementFilters.vue'
import AnnouncementForm from '~/components/AnnouncementForm.vue'
import AnnouncementsList from '~/components/AnnouncementsList.vue'
import AnnouncementUrgencyBadge from '~/components/AnnouncementUrgencyBadge.vue'
import BroadcastForm from '~/components/BroadcastForm.vue'
import BroadcastsTable from '~/components/BroadcastsTable.vue'
import PropertySummaryCard from '~/components/PropertySummaryCard.vue'
import type { Comunicado, NuevoComunicado } from '#shared/notifications/comunicados'
import { filtroDeNovedadesVacio } from '#shared/notifications/novedades'
import type { FraccionDestinataria, Novedad, NuevaNovedad } from '#shared/notifications/novedades'
import type { ResumenDePropiedad } from '#shared/properties/tablero'

/**
 * HU-29 · RF-29.1, RF-29.3, RF-29.4 · HU-30 · RF-30.1, RF-30.3 · HU-31 · RF-31.1 ·
 * principio 10 — los componentes de novedades y comunicados reciben lo ya
 * resuelto y emiten lo que quien mira decide. Ninguno consulta ni resuelve
 * destinatarios.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const PROPIEDADES = [{ id: 'p1', name: 'Casa Arena' }, { id: 'p2', name: 'Invictvs' }]
const FRACCIONES: FraccionDestinataria[] = [
  { id: 'f1', propertyId: 'p1', number: 1, ownerId: 'ana', ownerLabel: 'Ana' },
  { id: 'f3', propertyId: 'p1', number: 3, ownerId: 'luis', ownerLabel: 'Luis' },
  { id: 'g1', propertyId: 'p2', number: 1, ownerId: 'marta', ownerLabel: 'Marta' },
]

function novedad(cambios: Partial<Novedad> & { id: string }): Novedad {
  return {
    propertyId: 'p1', propertyName: 'Casa Arena', fractionId: null, fractionNumber: null, active: true,
    title: 'Corte de agua', body: 'El martes de 8 a 12.', urgency: 'important',
    createdAt: '2026-09-20T10:00:00Z', createdByLabel: 'Ana', resolvedAt: null, status: 'open',
    ...cambios,
  }
}

function comunicado(cambios: Partial<Comunicado> & { id: string }): Comunicado {
  return {
    title: 'Cierre de fin de año', body: 'Las oficinas cierran del 24 al 2.', segment: { kind: 'all' }, propertyName: null,
    recipientCount: 42, createdAt: '2026-09-20T10:00:00Z', createdByLabel: 'Root',
    ...cambios,
  }
}

describe('AnnouncementForm', () => {
  it('RF-29.1 · emite el aviso con propiedad, título, descripción y urgencia', async () => {
    const formulario = await mountSuspended(AnnouncementForm, { props: { propiedades: PROPIEDADES, enviando: false } })

    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'p2')
    await formulario.find('[data-test="campo-titulo"] input').setValue('  Poda de jardín ')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('El jueves por la mañana.')
    formulario.findComponent({ name: 'URadioGroup' }).vm.$emit('update:modelValue', 'urgent')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as NuevaNovedad).toEqual({
      propertyId: 'p2', fractionId: null, title: 'Poda de jardín', body: 'El jueves por la mañana.', urgency: 'urgent', active: true,
    })
  })

  it('RF-29.5 · CA-29.4 · dirigida a una fracción, emite la fracción elegida entre las vendidas de esa propiedad', async () => {
    const formulario = await mountSuspended(AnnouncementForm, { props: { propiedades: PROPIEDADES, fracciones: FRACCIONES, enviando: false } })

    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'p1')
    await formulario.find('[data-test="campo-titulo"] input').setValue('Revisión de su unidad')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('Pasaremos el lunes.')
    formulario.findAllComponents({ name: 'URadioGroup' })[1]!.vm.$emit('update:modelValue', 'fraction')
    await flushPromises()
    // Sin fracción elegida no se emite y lo dice.
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-destinatario"]').text()).toContain('fracción')

    const fracciones = formulario.findAllComponents({ name: 'USelect' })[1]!
    expect(fracciones.props('items')).toHaveLength(2)
    fracciones.vm.$emit('update:modelValue', 'f3')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ propertyId: 'p1', fractionId: 'f3' })
  })

  it('RF-29.6 · el interruptor de visibilidad solo se ofrece a quien puede fijar el estado, y por omisión publica activa', async () => {
    const administrador = await mountSuspended(AnnouncementForm, { props: { propiedades: PROPIEDADES, enviando: false } })
    expect(administrador.find('[data-test="campo-visible"]').exists()).toBe(false)

    const superadmin = await mountSuspended(AnnouncementForm, { props: { propiedades: [PROPIEDADES[0]!], puedeCambiarVisibilidad: true, enviando: false } })
    expect(superadmin.find('[data-test="campo-visible"]').exists()).toBe(true)
    superadmin.findComponent({ name: 'UCheckbox' }).vm.$emit('update:modelValue', false)
    await superadmin.find('[data-test="campo-titulo"] input').setValue('Obra en la fachada')
    await superadmin.find('[data-test="campo-cuerpo"] textarea').setValue('Desde el 1 de octubre.')
    await superadmin.find('form').trigger('submit')
    await flushPromises()
    expect(superadmin.emitted('submit')?.[0]?.[0]).toMatchObject({ active: false })
  })

  it('CA-29.2 · sin título no se emite y lo dice en su campo', async () => {
    const formulario = await mountSuspended(AnnouncementForm, { props: { propiedades: PROPIEDADES, enviando: false } })

    formulario.findAllComponents({ name: 'USelect' })[0]!.vm.$emit('update:modelValue', 'p1')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('Algo pasa.')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-titulo"]').text()).toContain('título')
  })

  it('RF-29.1 · con una sola propiedad gestionada la deja elegida', async () => {
    const formulario = await mountSuspended(AnnouncementForm, { props: { propiedades: [PROPIEDADES[0]!], enviando: false } })

    await formulario.find('[data-test="campo-titulo"] input').setValue('Fumigación')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('El lunes.')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ propertyId: 'p1', fractionId: null, urgency: 'informative', active: true })
  })
})

describe('AnnouncementUrgencyBadge', () => {
  it('RF-29.4 · RT-07 · el rojo (error) se usa solo para urgente', async () => {
    const urgente = await mountSuspended(AnnouncementUrgencyBadge, { props: { urgencia: 'urgent' } })
    const importante = await mountSuspended(AnnouncementUrgencyBadge, { props: { urgencia: 'important' } })
    const informativa = await mountSuspended(AnnouncementUrgencyBadge, { props: { urgencia: 'informative' } })

    expect(urgente.findComponent({ name: 'UBadge' }).props('color')).toBe('error')
    expect(importante.findComponent({ name: 'UBadge' }).props('color')).not.toBe('error')
    expect(informativa.findComponent({ name: 'UBadge' }).props('color')).not.toBe('error')
    expect(urgente.text()).toBe('Urgente')
  })
})

describe('AnnouncementsList', () => {
  const novedades = [
    novedad({ id: 'n1', urgency: 'urgent' }),
    novedad({ id: 'n2', propertyId: 'p2', propertyName: 'Invictvs', title: 'Poda', resolvedAt: '2026-09-21T10:00:00Z', status: 'resolved' }),
  ]

  it('RF-29.3 · RF-30.1 · pinta cada novedad con su propiedad, su urgencia y su estado', async () => {
    const lista = await mountSuspended(AnnouncementsList, { props: { novedades, puedeResolver: false, pendiente: false } })

    expect(lista.find('[data-test="novedad-n1"]').text()).toContain('Corte de agua')
    expect(lista.find('[data-test="novedad-n1"]').text()).toContain('Casa Arena')
    expect(lista.find('[data-test="estado-n1"]').text()).toContain('Abierta')
    expect(lista.find('[data-test="estado-n2"]').text()).toContain('Resuelta')
    expect(lista.find('[data-test="urgencia-n1"]').text()).toContain('Urgente')
  })

  it('RF-29.3 · resolver solo se ofrece a quien puede y sobre las abiertas, y emite el identificador', async () => {
    const lectura = await mountSuspended(AnnouncementsList, { props: { novedades, puedeResolver: false, pendiente: false } })
    expect(lectura.find('[data-test="resolver-n1"]').exists()).toBe(false)

    const gestion = await mountSuspended(AnnouncementsList, { props: { novedades, puedeResolver: true, pendiente: false } })
    expect(gestion.find('[data-test="resolver-n2"]').exists()).toBe(false)
    await gestion.find('[data-test="resolver-n1"]').trigger('click')
    expect(gestion.emitted('resolver')).toEqual([['n1']])
  })

  it('RF-29.5 · RF-29.6 · señala la fracción destinataria y la inactiva, y el interruptor solo lo ofrece a quien fija el estado', async () => {
    const conMarcas = [
      novedad({ id: 'n1', fractionId: 'f3', fractionNumber: 3 }),
      novedad({ id: 'n2', title: 'Obra', active: false }),
    ]
    const administrador = await mountSuspended(AnnouncementsList, { props: { novedades: conMarcas, puedeResolver: true, pendiente: false } })
    expect(administrador.find('[data-test="fraccion-n1"]').text()).toContain('3/8')
    expect(administrador.find('[data-test="inactiva-n2"]').text()).toContain('Inactiva')
    expect(administrador.find('[data-test="inactiva-n1"]').exists()).toBe(false)
    expect(administrador.find('[data-test="visibilidad-n1"]').exists()).toBe(false)

    const superadmin = await mountSuspended(AnnouncementsList, { props: { novedades: conMarcas, puedeResolver: true, puedeCambiarVisibilidad: true, pendiente: false } })
    expect(superadmin.find('[data-test="visibilidad-n1"]').text()).toContain('Desactivar')
    expect(superadmin.find('[data-test="visibilidad-n2"]').text()).toContain('Activar')
    await superadmin.find('[data-test="visibilidad-n1"]').trigger('click')
    await superadmin.find('[data-test="visibilidad-n2"]').trigger('click')
    expect(superadmin.emitted('cambiarVisibilidad')).toEqual([['n1', false], ['n2', true]])
  })

  it('RF-30.1 · sin novedades lo dice con su texto', async () => {
    const lista = await mountSuspended(AnnouncementsList, { props: { novedades: [], puedeResolver: false, pendiente: false } })
    expect(lista.find('[data-test="sin-novedades"]').exists()).toBe(true)
  })
})

describe('AnnouncementFilters', () => {
  it('RF-30.3 · CA-30.2 · el filtro por propiedad y por estado emite el filtro completo', async () => {
    const filtros = await mountSuspended(AnnouncementFilters, {
      props: { filtro: { ...filtroDeNovedadesVacio(), propertyId: 'p1' }, propiedades: PROPIEDADES },
    })

    filtros.findAllComponents({ name: 'USelect' })[1]!.vm.$emit('update:modelValue', 'open')
    expect(filtros.emitted('update:filtro')?.[0]?.[0]).toEqual({ propertyId: 'p1', status: 'open' })

    await filtros.find('[data-test="limpiar-filtros"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[1]?.[0]).toEqual(filtroDeNovedadesVacio())
  })
})

describe('PropertySummaryCard · HU-21 · RF-21.2', () => {
  function resumen(openAnnouncements: number): ResumenDePropiedad {
    return {
      id: 'p1', name: 'Invictvs 1201', fractionCount: 8, soldFractions: 3, soldShare: 3750, upcoming: [],
      alerts: { conflicts: 0, swapRequests: 0, weeksToPlace: 0, openAnnouncements },
      alertCount: openAnnouncements,
    }
  }

  it('RF-29.3 · una novedad abierta aparece como alerta y enlaza al historial; resuelta, desaparece', async () => {
    const conAbierta = await mountSuspended(PropertySummaryCard, { props: { resumen: resumen(2) } })
    expect(conAbierta.find('[data-test="alerta-novedades-p1"]').text()).toContain('2')
    expect(conAbierta.find('[data-test="abrir-novedades-p1"]').attributes('href')).toContain('/panel/novedades')

    const sinAbiertas = await mountSuspended(PropertySummaryCard, { props: { resumen: resumen(0) } })
    expect(sinAbiertas.find('[data-test="alerta-novedades-p1"]').exists()).toBe(false)
    expect(sinAbiertas.find('[data-test="sin-alertas-p1"]').exists()).toBe(true)
  })
})

describe('BroadcastForm', () => {
  it('RF-31.1 · emite el comunicado con su segmento por roles', async () => {
    const formulario = await mountSuspended(BroadcastForm, { props: { propiedades: PROPIEDADES, enviando: false } })

    await formulario.find('[data-test="campo-titulo"] input').setValue('Nuevo programa')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('Desde octubre.')
    formulario.findComponent({ name: 'URadioGroup' }).vm.$emit('update:modelValue', 'roles')
    await flushPromises()
    formulario.findComponent({ name: 'UCheckboxGroup' }).vm.$emit('update:modelValue', ['owner', 'ambassador'])
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0] as NuevoComunicado).toEqual({
      title: 'Nuevo programa', body: 'Desde octubre.', segment: { kind: 'roles', roles: ['owner', 'ambassador'] },
    })
  })

  it('RF-31.1 · por propiedad exige elegirla, y elegida la emite', async () => {
    const formulario = await mountSuspended(BroadcastForm, { props: { propiedades: PROPIEDADES, enviando: false } })

    await formulario.find('[data-test="campo-titulo"] input').setValue('Piscina')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('Cerrada el lunes.')
    formulario.findComponent({ name: 'URadioGroup' }).vm.$emit('update:modelValue', 'property')
    await flushPromises()
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')).toBeUndefined()
    expect(formulario.find('[data-test="campo-segmento"]').text()).toContain('propiedad')

    formulario.findComponent({ name: 'USelect' }).vm.$emit('update:modelValue', 'p2')
    await formulario.find('form').trigger('submit')
    await flushPromises()
    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ segment: { kind: 'property', propertyId: 'p2' } })
  })

  it('RF-31.1 · por omisión va a todos', async () => {
    const formulario = await mountSuspended(BroadcastForm, { props: { propiedades: PROPIEDADES, enviando: false } })

    await formulario.find('[data-test="campo-titulo"] input').setValue('Hola')
    await formulario.find('[data-test="campo-cuerpo"] textarea').setValue('A todos.')
    await formulario.find('form').trigger('submit')
    await flushPromises()

    expect(formulario.emitted('submit')?.[0]?.[0]).toMatchObject({ segment: { kind: 'all' } })
  })
})

describe('BroadcastsTable', () => {
  it('RF-31.3 · lista cada comunicado con su fecha, su segmento legible y cuántos lo recibieron', async () => {
    const tabla = await mountSuspended(BroadcastsTable, {
      props: {
        comunicados: [
          comunicado({ id: 'b1' }),
          comunicado({ id: 'b2', title: 'Para la casa', segment: { kind: 'property', propertyId: 'p1' }, propertyName: 'Casa Arena', recipientCount: 6 }),
          comunicado({ id: 'b3', title: 'Para dueños', segment: { kind: 'roles', roles: ['owner', 'ambassador'] }, recipientCount: 9 }),
        ],
        pendiente: false,
      },
    })

    expect(tabla.find('[data-test="comunicado-b1"]').text()).toContain('Todos')
    expect(tabla.find('[data-test="destinatarios-b1"]').text()).toContain('42')
    expect(tabla.find('[data-test="comunicado-b2"]').text()).toContain('Casa Arena')
    expect(tabla.find('[data-test="comunicado-b3"]').text()).toContain('Propietarios')
    expect(tabla.find('[data-test="comunicado-b3"]').text()).toContain('Embajadores')
  })

  it('RF-31.3 · sin comunicados lo dice', async () => {
    const tabla = await mountSuspended(BroadcastsTable, { props: { comunicados: [], pendiente: false } })
    expect(tabla.find('[data-test="sin-comunicados"]').exists()).toBe(true)
  })
})
