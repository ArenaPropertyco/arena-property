import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { NavigationMenuItem } from '@nuxt/ui'
import LayoutPublico from '~/layouts/default.vue'
import PublicHeader from '~/components/PublicHeader.vue'

/**
 * Cabecera del sitio institucional: el menú agrupa el modelo fraccionado y la
 * cuenta cambia según haya sesión. Sin sesión, ingresar y registrarse; con
 * sesión, el botón al panel y el avatar con las iniciales, que permite salir.
 */
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useSwitchLocalePath', () => () => (codigo: string) => `/${codigo}`)
mockNuxtImport('useColorMode', () => () => reactive({ value: 'light', preference: 'system' }))
mockNuxtImport('useSupabaseUser', () => () => ref(null))
mockNuxtImport('useSupabaseSession', () => () => ref(null))
mockNuxtImport('useSupabaseClient', () => () => ({}))

const props = {
  items: [{ label: 'Inicio', to: '/' }],
  inicio: '/',
  panel: '/panel',
  ingresar: '/ingresar',
  registro: '/registro',
}

describe('cabecera pública · menú', () => {
  it('ordena el menú como Inicio, Modelo fraccionado, Nosotros y Contáctenos', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)
    const items = envoltorio.findComponent(PublicHeader).props('items') as NavigationMenuItem[]

    expect(items.map(item => item.label)).toEqual(['Inicio', 'Modelo fraccionado', 'Nosotros', 'Contáctenos'])
    expect(items.map(item => item.to)).toEqual(['/', undefined, '/nosotros', '/contacto'])
  })

  it('el modelo fraccionado despliega modelo, beneficios, agendamiento y referidos', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)
    const items = envoltorio.findComponent(PublicHeader).props('items') as NavigationMenuItem[]
    const modelo = items[1]!

    expect(modelo.children?.map(hijo => [hijo.label, hijo.to])).toEqual([
      ['Modelo de negocio', '/modelo'],
      ['Beneficios', '/beneficios'],
      ['Sistema de agendamiento', '/agendamiento'],
      ['Programa de Referidos', '/embajadores'],
    ])
  })
})

describe('cabecera pública · cuenta', () => {
  it('sin sesión ofrece ingresar y registrarse', async () => {
    const envoltorio = await mountSuspended(PublicHeader, { props })

    expect(envoltorio.find('[data-test="ingresar"]').attributes('href')).toBe('/ingresar')
    expect(envoltorio.find('[data-test="registrarse"]').attributes('href')).toBe('/registro')
    expect(envoltorio.find('[data-test="ir-al-panel"]').exists()).toBe(false)
    expect(envoltorio.find('[data-test="menu-cuenta"]').exists()).toBe(false)
  })

  it('con sesión muestra el botón al panel y el avatar con las iniciales', async () => {
    const envoltorio = await mountSuspended(PublicHeader, {
      props: { ...props, cuenta: { nombre: 'Ana López', email: 'ana@arena.co', roles: ['owner'] } },
    })

    expect(envoltorio.find('[data-test="ir-al-panel"]').attributes('href')).toBe('/panel')
    expect(envoltorio.find('[data-test="menu-cuenta"]').text()).toContain('AL')
    expect(envoltorio.find('[data-test="ingresar"]').exists()).toBe(false)
    expect(envoltorio.find('[data-test="registrarse"]').exists()).toBe(false)
  })

  it('cerrar sesión desde el avatar se avisa hacia el layout', async () => {
    const envoltorio = await mountSuspended(PublicHeader, {
      props: { ...props, cuenta: { nombre: 'Ana López', email: 'ana@arena.co', roles: ['owner'] } },
    })

    envoltorio.findComponent({ name: 'UserMenu' }).vm.$emit('salir')

    expect(envoltorio.emitted('salir')).toHaveLength(1)
  })
})
