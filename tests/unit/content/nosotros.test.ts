import { describe, expect, it } from 'vitest'
import { problemasDeEntradas, problemasDelManifiesto } from '#shared/content/manifiesto'
import {
  IDS_DE_NOSOTROS,
  INFORMACION_DE_INTERES,
  PREGUNTAS_FRECUENTES,
  SECCIONES_DE_NOSOTROS,
  TESTIMONIOS,
} from '#shared/content/nosotros'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * HU-44 · RF-44.1…RF-44.4 — Sobre Nosotros se prueba contra su manifiesto y
 * contra las estructuras de preguntas frecuentes y testimonios (RT-03).
 */

describe('CA-44.1 · exactamente las 4 secciones de RF-44.1', () => {
  it('CA-44.1 · quiénes somos, preguntas frecuentes, testimonios e información de interés, en orden y sin duplicados', () => {
    expect(SECCIONES_DE_NOSOTROS.map(s => s.id)).toEqual(['who_we_are', 'faq', 'testimonials', 'info'])
    expect([...IDS_DE_NOSOTROS]).toEqual(SECCIONES_DE_NOSOTROS.map(s => s.id))
    expect(problemasDelManifiesto(SECCIONES_DE_NOSOTROS)).toEqual([])
  })
})

describe('CA-44.2 · preguntas frecuentes y testimonios como estructuras iterables', () => {
  it('CA-44.2 · cada pregunta tiene pregunta y respuesta y un identificador único', () => {
    expect(PREGUNTAS_FRECUENTES.length).toBeGreaterThanOrEqual(6)
    expect(problemasDeEntradas(PREGUNTAS_FRECUENTES, ['preguntaKey', 'respuestaKey'])).toEqual([])
  })

  it('CA-44.2 · cada testimonio tiene autor y cita y un identificador único', () => {
    expect(TESTIMONIOS.length).toBeGreaterThanOrEqual(2)
    expect(problemasDeEntradas(TESTIMONIOS, ['autorKey', 'citaKey'])).toEqual([])
  })

  it('CA-44.2 · una entrada repetida o con una clave vacía se detecta', () => {
    const rotas = [
      { id: 'a', preguntaKey: 'q.a', respuestaKey: 'r.a' },
      { id: 'a', preguntaKey: 'q.a2', respuestaKey: '' },
    ]
    expect(problemasDeEntradas(rotas, ['preguntaKey', 'respuestaKey'])).toEqual(['duplicated:a', 'empty:a:respuestaKey'])
  })

  it('RF-44.1 · la información de interés trae al menos cuatro datos', () => {
    expect(INFORMACION_DE_INTERES.length).toBeGreaterThanOrEqual(4)
  })
})

describe('CA-44.3 · el CTA lleva al registro', () => {
  it('CA-44.3 · la sección que cierra la página lleva el CTA al registro', () => {
    const conCta = SECCIONES_DE_NOSOTROS.filter(s => s.cta)
    expect(conCta).toHaveLength(1)
    expect(conCta[0]!.cta!.destino).toBe(RUTAS_PUBLICAS.registro)
  })
})
