import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  admiteListaDeEspera,
  filtrarCatalogo,
  filtroDeCatalogoVacio,
  rangoDePrecios,
} from '#shared/properties/catalogo-publico'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'

/**
 * HU-01 · RF-01.1, RF-01.3 · D-18 — qué muestra el catálogo público y cómo filtra.
 * Lógica pura: la RLS ya recortó lo que llega; aquí se decide qué se pinta.
 */

function propiedad(cambios: Partial<PropiedadPublica> & { id: string }): PropiedadPublica {
  return {
    slug: cambios.id,
    name: `Casa ${cambios.id}`,
    region: 'La Guajira',
    city: 'Palomino',
    country: 'CO',
    visibility: 'published',
    commercial: 'fractions_available',
    lowestPrice: pesos(180_000_000),
    availableFractions: 5,
    fractionCount: 8,
    photoUrl: null,
    areaM2: 120,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpots: 1,
    ...cambios,
  }
}

const publicada = propiedad({ id: 'p1' })
const borrador = propiedad({ id: 'p2', visibility: 'draft' })
const inactiva = propiedad({ id: 'p3', visibility: 'inactive' })
const bolivar = propiedad({ id: 'p4', region: 'Bolívar', city: 'Cartagena', lowestPrice: pesos(173_000_000) })
const proximamente = propiedad({ id: 'p5', region: 'Bolívar', commercial: 'coming_soon', lowestPrice: null, availableFractions: 0 })
const vendida = propiedad({ id: 'p6', commercial: 'sold_out', lowestPrice: null, availableFractions: 0 })

describe('CA-01.1 · el catálogo solo lista propiedades publicadas', () => {
  it('CA-01.1 · dadas propiedades en distintos estados de visibilidad, solo aparecen las publicadas', () => {
    const resultado = filtrarCatalogo([publicada, borrador, inactiva, bolivar], filtroDeCatalogoVacio())

    expect(resultado.map(p => p.id)).toEqual(['p1', 'p4'])
  })
})

describe('CA-01.2 · filtros combinables por región, precio y estado comercial', () => {
  const todas = [publicada, bolivar, proximamente, vendida]

  it('CA-01.2 · región + rango de precio + estado se cumplen a la vez', () => {
    const resultado = filtrarCatalogo(todas, {
      ...filtroDeCatalogoVacio(),
      region: 'Bolívar',
      precioMin: pesos(150_000_000),
      precioMax: pesos(175_000_000),
      comercial: 'fractions_available',
    })

    expect(resultado.map(p => p.id)).toEqual(['p4'])
  })

  it('el rango de precio deja fuera lo que no tiene precio publicado', () => {
    const resultado = filtrarCatalogo(todas, { ...filtroDeCatalogoVacio(), precioMax: pesos(200_000_000) })

    expect(resultado.map(p => p.id)).toEqual(['p1', 'p4'])
  })

  it('RF-01.3 · el vocabulario del estado comercial es el de D-18', () => {
    expect(filtrarCatalogo(todas, { ...filtroDeCatalogoVacio(), comercial: 'coming_soon' }).map(p => p.id)).toEqual(['p5'])
    expect(filtrarCatalogo(todas, { ...filtroDeCatalogoVacio(), comercial: 'sold_out' }).map(p => p.id)).toEqual(['p6'])
  })

  it('RF-01.3 · «admite lista de espera» es derivado: sin fracciones disponibles y ya a la venta', () => {
    expect(admiteListaDeEspera(vendida)).toBe(true)
    expect(admiteListaDeEspera(proximamente)).toBe(false)
    expect(admiteListaDeEspera(publicada)).toBe(false)
    expect(filtrarCatalogo(todas, { ...filtroDeCatalogoVacio(), listaDeEspera: true }).map(p => p.id)).toEqual(['p6'])
  })

  it('el rango de precios sale de los datos, no de una lista escrita a mano', () => {
    expect(rangoDePrecios(todas)).toEqual({ min: pesos(173_000_000), max: pesos(180_000_000) })
    expect(rangoDePrecios([proximamente])).toBeNull()
  })
})

describe('CA-01.3 · un filtro sin coincidencias devuelve lista vacía', () => {
  it('CA-01.3 · región inexistente → lista vacía', () => {
    expect(filtrarCatalogo([publicada, bolivar], { ...filtroDeCatalogoVacio(), region: 'Antioquia' })).toEqual([])
  })
})
