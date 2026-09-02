import { describe, expect, it } from 'vitest'
import { aplanarClaves, clavesFaltantes } from '#shared/i18n/keys'

/**
 * RT-05 · pruebas de la lógica pura que sostiene la paridad de locales.
 * Nivel N1 del plan: sin Nuxt, sin base de datos.
 */

describe('aplanarClaves', () => {
  it('convierte un diccionario anidado en rutas separadas por punto', () => {
    expect(aplanarClaves({ nav: { home: 'Inicio', about: 'Nosotros' } })).toEqual({
      'nav.home': 'Inicio',
      'nav.about': 'Nosotros',
    })
  })

  it('conserva las claves de primer nivel', () => {
    expect(aplanarClaves({ titulo: 'Arena Property' })).toEqual({ titulo: 'Arena Property' })
  })

  it('desciende por varios niveles de anidamiento', () => {
    expect(aplanarClaves({ a: { b: { c: 'hondo' } } })).toEqual({ 'a.b.c': 'hondo' })
  })

  it('devuelve un mapa vacío para un diccionario vacío', () => {
    expect(aplanarClaves({})).toEqual({})
  })
})

describe('clavesFaltantes', () => {
  it('lista las claves de la referencia que no están en el comparado', () => {
    const referencia = { 'nav.home': 'Inicio', 'nav.about': 'Nosotros' }
    const comparado = { 'nav.home': 'Home' }

    expect(clavesFaltantes(referencia, comparado)).toEqual(['nav.about'])
  })

  it('no reporta nada cuando ambos tienen las mismas claves', () => {
    const referencia = { 'nav.home': 'Inicio' }
    const comparado = { 'nav.home': 'Home' }

    expect(clavesFaltantes(referencia, comparado)).toEqual([])
  })
})
