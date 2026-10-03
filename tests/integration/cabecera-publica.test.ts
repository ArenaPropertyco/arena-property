import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import type { NavigationMenuItem } from '@nuxt/ui'
import LayoutPublico from '~/layouts/default.vue'
import PublicHeader from '~/components/PublicHeader.vue'
import LayoutPanel from '~/layouts/dashboard.vue'

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
  it('ordena el menú como Inicio, Propiedades, Modelo de negocio, Nosotros y Contáctenos', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)
    const items = envoltorio.findComponent(PublicHeader).props('items') as NavigationMenuItem[]

    expect(items.map(item => item.label)).toEqual(['Inicio', 'Propiedades', 'Modelo de negocio', 'Nosotros', 'Contáctenos'])
    expect(items.map(item => item.to)).toEqual(['/', '/propiedades', undefined, '/nosotros', '/contacto'])
  })

  it('el modelo de negocio despliega modelo, beneficios, agendamiento y referidos', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)
    const items = envoltorio.findComponent(PublicHeader).props('items') as NavigationMenuItem[]
    const modelo = items[2]!

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

describe('botón flotante de WhatsApp', () => {
  it('RT-06 · el layout público lo lleva en oro Arena, solo con el icono y el mensaje ya escrito', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)
    const boton = envoltorio.find('[data-test="whatsapp-flotante"]')

    expect(boton.exists()).toBe(true)
    expect(boton.classes()).toContain('bg-arena-500')
    expect(boton.classes()).toContain('fixed')
    // Solo el icono: el texto viaja como mensaje ya escrito y se anuncia por aria-label.
    expect(boton.text()).toBe('')
    expect(boton.find('[data-test="whatsapp-flotante-texto"]').exists()).toBe(false)
    expect(boton.attributes('aria-label')).toBe('Escribir por WhatsApp')
    expect(boton.attributes('href')).toBe('https://wa.me/573106854769?text=Quiero%20saber%20m%C3%A1s%20sobre%20las%20propiedades%20fraccionadas')
    expect(boton.attributes('target')).toBe('_blank')
  })

  it('los paneles de los usuarios no lo llevan', async () => {
    const envoltorio = await mountSuspended(LayoutPanel)

    expect(envoltorio.find('[data-test="whatsapp-flotante"]').exists()).toBe(false)
  })
})
