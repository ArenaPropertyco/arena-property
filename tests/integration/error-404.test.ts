import { describe, expect, it } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import NotFoundHero from '~/components/NotFoundHero.vue'

/**
 * Página de error: el 404 dice que la página no existe, cualquier otro código lo
 * dice sin tecnicismos, y siempre hay un botón de vuelta al inicio. El movimiento
 * es decorativo: con menos movimiento el contenido es el mismo, quieto.
 */
mockNuxtImport('useLocalePath', () => () => (ruta: string) => ruta)

const props = { codigo: 404, modelo: '/modelo' }

describe('página de error · 404', () => {
  it('muestra el código, el título y la explicación del 404', async () => {
    const envoltorio = await mountSuspended(NotFoundHero, { props })

    expect(envoltorio.find('[data-test="error-codigo"]').text()).toBe('404')
    expect(envoltorio.find('h1').text()).toBe('Esta semana no está en el calendario')
    expect(envoltorio.text()).toContain('La página que buscas no existe o cambió de lugar.')
  })

  it('el botón de volver al inicio avisa a quien orquesta, que limpia el error', async () => {
    const envoltorio = await mountSuspended(NotFoundHero, { props })

    const botones = envoltorio.findAll('[data-test="volver-al-inicio"]')
    expect(botones.length).toBeGreaterThan(0)
    expect(botones[0]!.text()).toContain('Volver al inicio')

    await botones[0]!.trigger('click')

    expect(envoltorio.emitted('inicio')).toHaveLength(1)
  })

  it('ofrece también el modelo fraccionado como salida', async () => {
    const envoltorio = await mountSuspended(NotFoundHero, { props })

    expect(envoltorio.find('[data-test="ir-al-modelo"]').attributes('href')).toBe('/modelo')
  })
})

describe('página de error · otros códigos', () => {
  it('un 500 no habla de páginas inexistentes, pero conserva la vuelta al inicio', async () => {
    const envoltorio = await mountSuspended(NotFoundHero, { props: { ...props, codigo: 500 } })

    expect(envoltorio.find('[data-test="error-codigo"]').text()).toBe('500')
    expect(envoltorio.find('h1').text()).toBe('Algo no salió como esperábamos')
    expect(envoltorio.find('[data-test="volver-al-inicio"]').exists()).toBe(true)
  })
})

describe('página de error · movimiento', () => {
  it('anima por defecto y, con menos movimiento, muestra lo mismo quieto', async () => {
    const animada = await mountSuspended(NotFoundHero, { props })
    const quieta = await mountSuspended(NotFoundHero, { props: { ...props, reducirMovimiento: true } })

    expect(animada.find('[data-test="error-animado"]').exists()).toBe(true)
    expect(quieta.find('[data-test="error-estatico"]').exists()).toBe(true)
    expect(quieta.find('h1').text()).toBe(animada.find('h1').text())
  })
})
