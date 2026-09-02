import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LayoutPanel from '~/layouts/dashboard.vue'
import PanelPage from '~/components/PanelPage.vue'

/**
 * El menú de cuenta aparece en las dos zonas del panel —pie de la barra lateral y
 * barra superior— y cerrar sesión llega hasta el proveedor.
 *
 * Comprueba además la disciplina del principio 10: el layout es el único que consulta
 * la cuenta, y la barra superior la recibe por el puente sin consultar nada.
 */

const usuario = ref<{ sub: string, email: string } | null>(null)
const sesion = ref<{ access_token: string } | null>(null)
const perfil = {
  id: 'u1',
  email: 'alascarbonycerdo@gmail.com',
  full_name: null,
  status: 'active',
  email_verified: true,
}

const signOut = vi.fn()
const navegaciones: string[] = []

mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useSwitchLocalePath', () => () => (codigo: string) => `/${codigo}`)
mockNuxtImport('useColorMode', () => () => reactive({ value: 'light', preference: 'system' }))
mockNuxtImport('useSupabaseUser', () => () => usuario)
mockNuxtImport('useSupabaseSession', () => () => sesion)
mockNuxtImport('navigateTo', () => (ruta: string) => {
  navegaciones.push(ruta)
  return undefined
})
mockNuxtImport('useSupabaseClient', () => () => ({
  auth: { signOut },
  from: (tabla: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: tabla === 'profiles' ? perfil : null }),
        then: (resolver: (r: unknown) => void) => resolver({ data: [{ role: 'user' }] }),
      }),
    }),
  }),
}))

function conSesion() {
  usuario.value = { sub: 'u1', email: perfil.email }
  sesion.value = { access_token: 't' }
  navegaciones.length = 0
  signOut.mockReset().mockResolvedValue({ error: null })
}

describe('el menú de cuenta en el pie de la barra lateral', () => {
  it('muestra la identidad de quien entró', async () => {
    conSesion()
    const panel = await mountSuspended(LayoutPanel)
    await flushPromises()

    expect(panel.find('[data-test="menu-cuenta"]').exists()).toBe(true)
    // Sin `full_name` todavía (HU-61 · RF-61.7), el nombre sale de la parte local del correo.
    expect(panel.text()).toContain('alascarbonycerdo')
  })

  it('cerrar sesión llega al proveedor y devuelve al inicio', async () => {
    conSesion()
    const panel = await mountSuspended(LayoutPanel)
    await flushPromises()

    const menu = panel.findComponent({ name: 'UserMenu' })
    menu.vm.$emit('salir')
    await flushPromises()

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(navegaciones).toEqual(['/'])
  })

  it('sin cuenta cargada no se pinta un menú vacío', async () => {
    usuario.value = null
    sesion.value = null
    const panel = await mountSuspended(LayoutPanel)
    await flushPromises()

    expect(panel.find('[data-test="menu-cuenta"]').exists()).toBe(false)
  })
})

describe('el menú de cuenta en la barra superior', () => {
  it('aparece en toda página del panel, que lo recibe del layout sin consultarlo', async () => {
    conSesion()
    const panel = await mountSuspended(LayoutPanel, {
      slots: { default: () => h(PanelPage, { titulo: 'Panel' }) },
    })
    await flushPromises()

    // Uno en el pie de la barra lateral y otro en la barra superior.
    expect(panel.findAllComponents({ name: 'UserMenu' })).toHaveLength(2)
  })

  it('montada fuera del panel, la página no muestra menú en vez de romperse', async () => {
    const suelta = await mountSuspended(PanelPage, { props: { titulo: 'Panel' } })
    await flushPromises()

    expect(suelta.find('[data-test="menu-cuenta"]').exists()).toBe(false)
  })
})
