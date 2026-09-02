import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import LayoutPublico from '~/layouts/default.vue'
import LayoutPanel from '~/layouts/dashboard.vue'
import LocaleSwitcher from '~/components/LocaleSwitcher.vue'

/**
 * RT-06 · los dos layouts existen, envuelven su contenido y traen los controles
 * de idioma y de tema. La apariencia no se prueba (principio 4): esto verifica
 * estructura, no diseño.
 *
 * Se sustituyen solo las utilidades de enrutado por idioma, que dependen del ciclo
 * de petición de @nuxtjs/i18n. Las traducciones son las reales del proyecto.
 */
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)
mockNuxtImport('useSwitchLocalePath', () => () => (codigo: string) => `/${codigo}`)
mockNuxtImport('useColorMode', () => () => reactive({ value: 'light', preference: 'system' }))

describe('RT-06 · layout público', () => {
  it('renderiza el contenido de la página que envuelve', async () => {
    const envoltorio = await mountSuspended(LayoutPublico, {
      slots: { default: () => 'contenido de la página' },
    })

    expect(envoltorio.text()).toContain('contenido de la página')
  })

  it('trae cabecera, contenido principal y pie', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)

    expect(envoltorio.find('header').exists()).toBe(true)
    expect(envoltorio.find('main').exists()).toBe(true)
    expect(envoltorio.find('footer').exists()).toBe(true)
  })

  it('expone los controles de idioma y de tema (RF-00.6)', async () => {
    const envoltorio = await mountSuspended(LayoutPublico)

    expect(envoltorio.find('[data-test="selector-idioma"]').exists()).toBe(true)
    expect(envoltorio.find('[data-test="selector-tema"]').exists()).toBe(true)
  })
})

describe('RT-06 · layout de panel', () => {
  it('renderiza el contenido de la página que envuelve', async () => {
    const envoltorio = await mountSuspended(LayoutPanel, {
      slots: { default: () => 'contenido del panel' },
    })

    expect(envoltorio.text()).toContain('contenido del panel')
  })

  it('trae navegación lateral y contenido principal', async () => {
    const envoltorio = await mountSuspended(LayoutPanel)

    expect(envoltorio.find('nav').exists()).toBe(true)
    expect(envoltorio.find('main').exists()).toBe(true)
  })

  it('expone los controles de idioma y de tema', async () => {
    const envoltorio = await mountSuspended(LayoutPanel)

    expect(envoltorio.find('[data-test="selector-idioma"]').exists()).toBe(true)
    expect(envoltorio.find('[data-test="selector-tema"]').exists()).toBe(true)
  })
})

/**
 * Regresión · el selector de idioma no cambiaba de inglés a español.
 * `UButton` localiza el `to` por su cuenta y su guarda solo reconoce rutas con
 * prefijo; como el idioma por defecto no lo lleva, `/panel` se volvía `/en/panel`
 * y el botón devolvía a la misma página. `switchLocalePath` ya entrega la ruta
 * resuelta, así que el enlace debe renunciar a esa localización automática.
 *
 * El plugin de @nuxtjs/i18n no se instala dentro de `mountSuspended`, de modo que
 * aquí no se puede reproducir la doble localización: la prueba fija la renuncia
 * explícita para que nadie la retire sin darse cuenta.
 */
describe('RT-05 · el selector de idioma no vuelve a localizar su destino', () => {
  it('cada enlace del selector renuncia a la localización automática', async () => {
    const codigo = readFileSync(resolve(process.cwd(), 'app/components/LocaleSwitcher.vue'), 'utf8')

    expect(codigo).toMatch(/:locale="false"/)
  })

  it('el enlace conserva intacta la ruta que entrega switchLocalePath', async () => {
    const envoltorio = await mountSuspended(LocaleSwitcher)
    const destinos = envoltorio.findAll('a').map(enlace => enlace.attributes('href'))

    expect(destinos).toEqual(['/en', '/es'])
  })
})
