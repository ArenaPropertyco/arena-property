import { describe, expect, it } from 'vitest'
import { problemasDelManifiesto } from '#shared/content/manifiesto'
import { IDS_DEL_MODELO, LO_QUE_HACEMOS, LO_QUE_NO_SOMOS, PASOS_DE_COMPRA, PILARES_DE_LA_ESTRUCTURA, SECCIONES_DEL_MODELO } from '#shared/content/modelo'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * HU-41 · RF-41.1, RF-41.2, RF-41.4 — la página del modelo de negocio se prueba
 * contra su manifiesto tipado, nunca contra el marcado (RT-03).
 */

describe('CA-41.1 · el manifiesto declara las secciones de RF-41.1 y RF-41.2', () => {
  it('CA-41.1 · en orden y sin duplicados: hero, estructura, qué hacemos, qué no somos, camino de compra y CTA', () => {
    expect(SECCIONES_DEL_MODELO.map(s => s.id)).toEqual([...IDS_DEL_MODELO])
    expect(IDS_DEL_MODELO).toEqual(['hero', 'structure', 'what_we_do', 'what_we_are_not', 'path', 'cta'])
    expect(problemasDelManifiesto(SECCIONES_DEL_MODELO)).toEqual([])
  })

  it('RF-41.1 · la estructura explica las 8 fracciones, la titularidad, las temporadas y la operación centralizada', () => {
    expect([...PILARES_DE_LA_ESTRUCTURA]).toEqual(['fractions', 'ownership', 'seasons', 'operation'])
    expect([...LO_QUE_HACEMOS]).toEqual(['structure', 'commercialize', 'manage'])
    expect(LO_QUE_NO_SOMOS.length).toBe(3)
  })

  it('RF-41.2 · el camino de compra va de Visitante a Usuario y de Usuario a Propietario, sin volver atrás', () => {
    const roles = PASOS_DE_COMPRA.map(paso => paso.rol)
    expect(roles[0]).toBe('visitor')
    expect(roles[roles.length - 1]).toBe('owner')
    const posicion = { visitor: 0, user: 1, owner: 2 }
    for (let i = 1; i < roles.length; i++) {
      expect(posicion[roles[i]!]).toBeGreaterThanOrEqual(posicion[roles[i - 1]!])
    }
    expect(new Set(PASOS_DE_COMPRA.map(paso => paso.id)).size).toBe(PASOS_DE_COMPRA.length)
  })
})

describe('CA-41.2 · el CTA lleva al registro', () => {
  it('CA-41.2 · el destino del CTA es la ruta de registro declarada', () => {
    const cta = SECCIONES_DEL_MODELO.find(s => s.id === 'cta')!
    expect(cta.cta?.destino).toBe(RUTAS_PUBLICAS.registro)
  })
})
