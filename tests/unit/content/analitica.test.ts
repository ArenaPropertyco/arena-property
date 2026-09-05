import { describe, expect, it, vi } from 'vitest'
import { crearRegistroDeCtas, eventoDeCta } from '#shared/content/analitica'
import { SECCIONES_DE_LA_HOME } from '#shared/content/home'

/**
 * HU-00 · RF-00.8 · RT-12 — `nuxt-gtag` recibe un evento por activación de CTA,
 * con el identificador de la sección de origen tomado del manifiesto.
 */

const modelo = SECCIONES_DE_LA_HOME.find(seccion => seccion.id === 'business_model')!
const navbar = SECCIONES_DE_LA_HOME.find(seccion => seccion.id === 'navbar')!

describe('RF-00.8 · analítica de CTA', () => {
  it('CA-00.5 · la activación de un CTA produce un evento con el identificador de sección correcto, una sola vez', () => {
    const enviar = vi.fn()
    const registrar = crearRegistroDeCtas(enviar)

    registrar(modelo)

    expect(enviar).toHaveBeenCalledTimes(1)
    expect(enviar).toHaveBeenCalledWith('cta_click', { section: 'business_model', destination: modelo.cta!.destino })
  })

  it('CA-00.5 · dos activaciones son dos eventos, cada uno con su sección', () => {
    const enviar = vi.fn()
    const registrar = crearRegistroDeCtas(enviar)
    const beneficios = SECCIONES_DE_LA_HOME.find(seccion => seccion.id === 'benefits')!

    registrar(modelo)
    registrar(beneficios)

    expect(enviar.mock.calls.map(([, parametros]) => (parametros as { section: string }).section))
      .toEqual(['business_model', 'benefits'])
  })

  it('una sección sin CTA no produce evento', () => {
    const enviar = vi.fn()
    expect(eventoDeCta(navbar)).toBeNull()
    expect(crearRegistroDeCtas(enviar)(navbar)).toBe(false)
    expect(enviar).not.toHaveBeenCalled()
  })
})
