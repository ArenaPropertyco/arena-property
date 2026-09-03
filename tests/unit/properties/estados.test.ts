import { describe, expect, it } from 'vitest'
import {
  COMERCIALES,
  ErrorDeTransicion,
  TRANSICIONES_COMERCIALES,
  TRANSICIONES_DE_VISIBILIDAD,
  VISIBILIDADES,
  apareceEnCatalogo,
  estadoComercial,
  estadoComercialDerivado,
  hayFraccionesDisponibles,
  puedeTransicionarComercial,
  puedeTransicionarVisibilidad,
  transicionarComercial,
  transicionarVisibilidad,
} from '#shared/properties/estados'
import type { EstadoDeFraccion } from '#shared/properties/fracciones'

/**
 * HU-08 · RF-08.2, RF-08.3, RF-08.4 — las dos máquinas de estado de la propiedad.
 *
 * CA-08.1 pide el recorrido **exhaustivo** de ambas tablas: no basta con probar las
 * transiciones que el producto usa hoy, porque lo que rompe el invariante es la
 * transición que nadie pensó. Aquí se generan todos los pares posibles y se decide
 * cada uno contra la tabla, de modo que añadir un estado obliga a decidirlo.
 */

/** Las 8 fracciones de una propiedad, todas en el mismo estado. */
function todas(estado: EstadoDeFraccion): EstadoDeFraccion[] {
  return Array.from({ length: 8 }, () => estado)
}

describe('CA-08.1 · máquina de visibilidad', () => {
  const pares = VISIBILIDADES.flatMap(desde => VISIBILIDADES.map(hacia => ({ desde, hacia })))

  it('la tabla cubre los tres estados del vocabulario D-18', () => {
    expect(VISIBILIDADES).toEqual(['draft', 'published', 'inactive'])
    expect(Object.keys(TRANSICIONES_DE_VISIBILIDAD).sort()).toEqual([...VISIBILIDADES].sort())
  })

  it('los 9 pares posibles quedan decididos por la tabla, sin casos sueltos', () => {
    expect(pares).toHaveLength(9)
  })

  it.each(pares)('CA-08.1 · $desde → $hacia se resuelve según la tabla', ({ desde, hacia }) => {
    const valida = TRANSICIONES_DE_VISIBILIDAD[desde].includes(hacia)

    expect(puedeTransicionarVisibilidad(desde, hacia)).toBe(valida)

    if (valida) {
      expect(transicionarVisibilidad(desde, hacia)).toBe(hacia)
    }
    else {
      expect(() => transicionarVisibilidad(desde, hacia)).toThrow(ErrorDeTransicion)
    }
  })

  it('CA-08.1 · el error de transición es tipado y dice qué se intentó', () => {
    try {
      transicionarVisibilidad('draft', 'inactive')
      expect.unreachable('una transición inválida debe lanzar')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ErrorDeTransicion)
      const tipado = error as ErrorDeTransicion
      expect(tipado.maquina).toBe('visibility')
      expect(tipado.desde).toBe('draft')
      expect(tipado.hacia).toBe('inactive')
      expect(tipado.clave).toBe('properties.errors.invalid_transition')
    }
  })

  it('RF-08.2 · una propiedad publicada puede inactivarse y volver a publicarse', () => {
    expect(transicionarVisibilidad('published', 'inactive')).toBe('inactive')
    expect(transicionarVisibilidad('inactive', 'published')).toBe('published')
  })

  it('RF-08.2 · nada vuelve a borrador: lo publicado ya se mostró al público', () => {
    expect(puedeTransicionarVisibilidad('published', 'draft')).toBe(false)
    expect(puedeTransicionarVisibilidad('inactive', 'draft')).toBe(false)
  })

  it('RF-08.2 · solo `published` aparece en el catálogo', () => {
    expect(VISIBILIDADES.filter(apareceEnCatalogo)).toEqual(['published'])
  })
})

describe('CA-08.1 · máquina comercial', () => {
  const pares = COMERCIALES.flatMap(desde => COMERCIALES.map(hacia => ({ desde, hacia })))

  it('la tabla cubre los tres estados comerciales de D-18', () => {
    expect(COMERCIALES).toEqual(['coming_soon', 'fractions_available', 'sold_out'])
    expect(Object.keys(TRANSICIONES_COMERCIALES).sort()).toEqual([...COMERCIALES].sort())
  })

  it.each(pares)('CA-08.1 · $desde → $hacia se resuelve según la tabla', ({ desde, hacia }) => {
    const valida = TRANSICIONES_COMERCIALES[desde].includes(hacia)

    expect(puedeTransicionarComercial(desde, hacia)).toBe(valida)

    if (valida) {
      expect(transicionarComercial(desde, hacia)).toBe(hacia)
    }
    else {
      expect(() => transicionarComercial(desde, hacia)).toThrow(ErrorDeTransicion)
    }
  })

  it('RF-08.3 · una vez a la venta no se vuelve a «Próximamente»', () => {
    expect(puedeTransicionarComercial('fractions_available', 'coming_soon')).toBe(false)
    expect(puedeTransicionarComercial('sold_out', 'coming_soon')).toBe(false)
  })

  it('RF-08.3 · vendido y con fracciones disponibles se alternan (anulación, traspaso)', () => {
    expect(transicionarComercial('fractions_available', 'sold_out')).toBe('sold_out')
    expect(transicionarComercial('sold_out', 'fractions_available')).toBe('fractions_available')
  })

  it('CA-08.1 · el error comercial identifica su máquina', () => {
    try {
      transicionarComercial('sold_out', 'coming_soon')
      expect.unreachable('una transición inválida debe lanzar')
    }
    catch (error) {
      expect((error as ErrorDeTransicion).maquina).toBe('commercial')
    }
  })
})

describe('CA-08.2 · estado comercial derivado de las 8 fracciones', () => {
  it('CA-08.2 · con las 8 fracciones vendidas el estado derivado es `sold_out`', () => {
    expect(estadoComercialDerivado(todas('sold'))).toBe('sold_out')
  })

  it('CA-08.2 · con al menos una disponible el estado derivado es `fractions_available`', () => {
    const siete = [...todas('sold').slice(0, 7), 'available' as const]

    expect(estadoComercialDerivado(siete)).toBe('fractions_available')
    expect(estadoComercialDerivado(todas('available'))).toBe('fractions_available')
  })

  /**
   * D-18 · «Lista de espera» no es un estado: es la condición derivada de no tener
   * fracciones disponibles. Por eso una propiedad con todo reservado sigue estando
   * a la venta —una reserva puede caerse— y solo `Vendido` cierra el ciclo.
   */
  it('CA-08.2 · sin disponibles pero sin vender las 8, sigue `fractions_available`', () => {
    const reservadas = [...todas('sold').slice(0, 7), 'reserved' as const]

    expect(estadoComercialDerivado(reservadas)).toBe('fractions_available')
    expect(estadoComercialDerivado(todas('reserved'))).toBe('fractions_available')
  })

  it('RF-08.3 · la condición de lista de espera (HU-47) es aparte del estado', () => {
    expect(hayFraccionesDisponibles(todas('available'))).toBe(true)
    expect(hayFraccionesDisponibles(todas('reserved'))).toBe(false)
    expect(hayFraccionesDisponibles(todas('sold'))).toBe(false)
  })

  it('RF-09.1 · derivar sobre un número de fracciones distinto de 8 es un error', () => {
    expect(() => estadoComercialDerivado(todas('sold').slice(0, 7))).toThrow(RangeError)
    expect(() => estadoComercialDerivado([...todas('sold'), 'available'])).toThrow(RangeError)
    expect(() => estadoComercialDerivado([])).toThrow(RangeError)
  })
})

describe('RF-08.3 · el estado comercial que ve la interfaz', () => {
  it('mientras el Administrador lo marca «Próximamente», nada se deriva', () => {
    expect(estadoComercial(true, todas('sold'))).toBe('coming_soon')
    expect(estadoComercial(true, [])).toBe('coming_soon')
  })

  it('CA-08.2 · al salir de «Próximamente» manda la derivación', () => {
    expect(estadoComercial(false, todas('sold'))).toBe('sold_out')
    expect(estadoComercial(false, todas('available'))).toBe('fractions_available')
  })
})
