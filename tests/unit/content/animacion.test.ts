import { describe, expect, it } from 'vitest'
import { animacionDeSeccion, animacionesDeLaHome, SIN_ANIMACION, tieneAnimacion } from '#shared/content/animacion'
import { SECCIONES_DE_LA_HOME, seccionesDeContenido } from '#shared/content/home'

/**
 * HU-00 · RF-00.7 · RT-12 — la configuración de `nuxt-aos` sale de una función
 * pura: con `prefers-reduced-motion` no hay movimiento para ninguna sección.
 */

describe('RF-00.7 · animación de entrada de las secciones', () => {
  it('sin preferencia de movimiento reducido, cada sección de contenido entra animada', () => {
    for (const seccion of seccionesDeContenido()) {
      const animacion = animacionDeSeccion(seccion, { reducirMovimiento: false })
      expect(tieneAnimacion(animacion)).toBe(true)
      expect(animacion['data-aos']).toBe('fade-up')
    }
  })

  it('el retraso crece con el orden para que las secciones entren escalonadas', () => {
    const [primera, segunda] = seccionesDeContenido()
    const a = animacionDeSeccion(primera!, { reducirMovimiento: false })
    const b = animacionDeSeccion(segunda!, { reducirMovimiento: false })
    expect(Number(b['data-aos-delay'])).toBeGreaterThan(Number(a['data-aos-delay']))
  })

  it('CA-00.4 · con prefers-reduced-motion la configuración es «sin animación» para todas las secciones', () => {
    const animaciones = animacionesDeLaHome(SECCIONES_DE_LA_HOME, { reducirMovimiento: true })

    for (const seccion of SECCIONES_DE_LA_HOME) {
      expect(animaciones[seccion.id]).toEqual(SIN_ANIMACION)
      expect(tieneAnimacion(animaciones[seccion.id]!)).toBe(false)
    }
  })

  it('navbar y footer nunca se animan: son estructura, no contenido', () => {
    const animaciones = animacionesDeLaHome(SECCIONES_DE_LA_HOME, { reducirMovimiento: false })
    expect(animaciones.navbar).toEqual(SIN_ANIMACION)
    expect(animaciones.footer).toEqual(SIN_ANIMACION)
  })
})
