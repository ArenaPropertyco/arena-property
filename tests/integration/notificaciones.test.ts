import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import NotificationFilters from '~/components/NotificationFilters.vue'
import NotificationsList from '~/components/NotificationsList.vue'
import { filtroDeBandejaVacio } from '#shared/notifications/bandeja'
import type { ItemDeBandeja } from '#shared/notifications/bandeja'

/**
 * TR-03 · RF-N.5 · principio 10 · la bandeja presenta lo que recibe y emite lo que
 * el destinatario hace: marcar una, marcar todas, filtrar. No consulta nada.
 */

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

function item(cambios: Partial<ItemDeBandeja> & { id: string }): ItemDeBandeja {
  return {
    notificationId: `n-${cambios.id}`,
    kind: 'announcement_published',
    propertyId: 'p1',
    propertyName: 'Casa Arena',
    payload: { title: 'Corte de agua', body: 'El martes de 8 a 12.' },
    createdAt: '2026-09-08T10:00:00Z',
    readAt: null,
    ...cambios,
  }
}

describe('NotificationsList', () => {
  it('RF-N.5 · pinta cada notificación con su título traducido, la propiedad y el estado de lectura', async () => {
    const lista = await mountSuspended(NotificationsList, {
      props: {
        items: [
          item({ id: '1' }),
          item({ id: '2', kind: 'calendar_activated', propertyName: 'Invictvs', payload: { property_name: 'Invictvs', fraction_number: 3 }, readAt: '2026-09-08T11:00:00Z' }),
        ],
        pendiente: false,
      },
    })

    expect(lista.find('[data-test="notificacion-1"]').text()).toContain('Corte de agua')
    expect(lista.find('[data-test="notificacion-1"]').text()).toContain('Casa Arena')
    expect(lista.find('[data-test="notificacion-2"]').text()).toContain('Tu calendario está activo')
    expect(lista.find('[data-test="no-leida-1"]').exists()).toBe(true)
    expect(lista.find('[data-test="no-leida-2"]').exists()).toBe(false)
  })

  it('CA-N.4 · marcar una emite su identificador; marcar todas emite sin argumentos', async () => {
    const lista = await mountSuspended(NotificationsList, {
      props: { items: [item({ id: '1' }), item({ id: '2' })], pendiente: false },
    })

    await lista.find('[data-test="marcar-1"]').trigger('click')
    expect(lista.emitted('leer')).toEqual([['1']])

    await lista.find('[data-test="marcar-todas"]').trigger('click')
    expect(lista.emitted('leerTodas')).toHaveLength(1)
  })

  it('sin notificaciones lo dice con su texto', async () => {
    const lista = await mountSuspended(NotificationsList, { props: { items: [], pendiente: false } })

    expect(lista.find('[data-test="bandeja-vacia"]').text()).toBe('No tienes notificaciones.')
  })
})

describe('NotificationFilters', () => {
  it('RF-N.5 · el filtro de no leídas y el de limpiar emiten el filtro completo', async () => {
    const filtros = await mountSuspended(NotificationFilters, {
      props: {
        filtro: { ...filtroDeBandejaVacio(), propertyId: 'p1' },
        propiedades: [{ id: 'p1', name: 'Casa Arena' }],
        noLeidas: 2,
      },
    })

    expect(filtros.find('[data-test="contador-no-leidas"]').text()).toContain('2')

    await filtros.find('[data-test="filtro-no-leidas"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[0]?.[0]).toMatchObject({ propertyId: 'p1', soloNoLeidas: true })

    await filtros.find('[data-test="limpiar-filtros"]').trigger('click')
    expect(filtros.emitted('update:filtro')?.[1]?.[0]).toEqual(filtroDeBandejaVacio())
  })
})
