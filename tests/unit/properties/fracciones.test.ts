import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  ESTADOS_DE_FRACCION,
  ErrorDeFraccionamiento,
  ErrorDeTransicionDeFraccion,
  FRACCIONES_POR_PROPIEDAD,
  NUMEROS_DE_FRACCION,
  TRANSICIONES_DE_FRACCION,
  TRANSICIONES_DE_SUPERADMIN,
  fraccionar,
  puedeTransicionarFraccion,
  recalcularEstadoComercial,
  transicionarFraccion,
  validarPrecioDeFraccion,
} from '#shared/properties/fracciones'
import type { EstadoDeFraccion } from '#shared/properties/fracciones'

/**
 * HU-09 · RF-09.1, RF-09.2, RF-09.3, RF-09.4 — las 8 fracciones de una propiedad.
 *
 * Toda la aritmética de precio pasa por `CopAmount` (TR-02 · RF-D.1): el precio de
 * una fracción es dinero, y aquí no entra ningún `number` suelto.
 */

const PROPIEDAD = 'c0000000-0000-4000-8000-00000000000a'
const PRECIO = pesos(180_000_000)

function todas(estado: EstadoDeFraccion): EstadoDeFraccion[] {
  return Array.from({ length: FRACCIONES_POR_PROPIEDAD }, () => estado)
}

describe('CA-09.1 · fraccionamiento en 8', () => {
  it('RF-09.1 · el vocabulario fija ocho fracciones, ni una más', () => {
    expect(FRACCIONES_POR_PROPIEDAD).toBe(8)
    expect(NUMEROS_DE_FRACCION).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('CA-09.1 · resultan exactamente 8 fracciones numeradas 1/8…8/8 sin duplicados', () => {
    const fracciones = fraccionar(PROPIEDAD, PRECIO)
    const numeros = fracciones.map(fraccion => fraccion.number)

    expect(fracciones).toHaveLength(8)
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(new Set(numeros).size).toBe(8)
  })

  it('CA-09.1 · todas nacen disponibles, de la misma propiedad y sin titular', () => {
    const fracciones = fraccionar(PROPIEDAD, PRECIO)

    expect(fracciones.every(fraccion => fraccion.status === 'available')).toBe(true)
    expect(fracciones.every(fraccion => fraccion.propertyId === PROPIEDAD)).toBe(true)
    expect(fracciones.every(fraccion => fraccion.ownerId === null)).toBe(true)
  })

  /**
   * D-31 · titularidad y derecho de uso son ejes independientes. Una fracción recién
   * creada no tiene titular y, aunque lo tuviera, el calendario lo abre el plan de
   * pagos (HU-58), nunca el fraccionamiento.
   */
  it('D-31 · ninguna fracción nace con el calendario activo', () => {
    expect(fraccionar(PROPIEDAD, PRECIO).every(fraccion => fraccion.calendarActive === false)).toBe(true)
  })

  it('RF-09.2 · acepta un precio distinto por fracción, en el orden 1/8…8/8', () => {
    const precios = [10, 20, 30, 40, 50, 60, 70, 80].map(millones => pesos(millones * 1_000_000))
    const fracciones = fraccionar(PROPIEDAD, precios)

    expect(fracciones.map(fraccion => fraccion.listPrice)).toEqual(precios)
  })

  it('RF-09.3 · una lista de precios que no trae 8 no fracciona nada', () => {
    const siete = Array.from({ length: 7 }, () => PRECIO)

    expect(() => fraccionar(PROPIEDAD, siete)).toThrow(ErrorDeFraccionamiento)
  })
})

describe('CA-09.2 · precio de la fracción', () => {
  it('CA-09.2 · un precio de cero o negativo se rechaza', () => {
    expect(validarPrecioDeFraccion(pesos(0))).toBe('properties.validation.price_not_positive')
    expect(validarPrecioDeFraccion(pesos(-1))).toBe('properties.validation.price_not_positive')
  })

  it('CA-09.2 · un precio positivo se acepta', () => {
    expect(validarPrecioDeFraccion(PRECIO)).toBeNull()
  })

  it('CA-09.2 · fraccionar con precio no positivo no crea ninguna fracción', () => {
    expect(() => fraccionar(PROPIEDAD, pesos(0))).toThrow(ErrorDeFraccionamiento)
    expect(() => fraccionar(PROPIEDAD, pesos(-5))).toThrow(ErrorDeFraccionamiento)
  })

  it('CA-09.2 · un decimal ni siquiera llega a ser importe (TR-02)', () => {
    expect(() => validarPrecioDeFraccion(1.5 as never)).toThrow(TypeError)
  })
})

describe('CA-09.3 · máquina de estados de la fracción', () => {
  const pares = ESTADOS_DE_FRACCION.flatMap(desde => ESTADOS_DE_FRACCION.map(hacia => ({ desde, hacia })))

  it('RF-09.2 · el vocabulario es disponible → reservada → vendida', () => {
    expect(ESTADOS_DE_FRACCION).toEqual(['available', 'reserved', 'sold'])
  })

  it.each(pares)('CA-09.3 · $desde → $hacia sin Superadmin se resuelve según la tabla', ({ desde, hacia }) => {
    const valida = TRANSICIONES_DE_FRACCION[desde].includes(hacia)

    expect(puedeTransicionarFraccion(desde, hacia, false)).toBe(valida)

    if (valida) {
      expect(transicionarFraccion(desde, hacia, false)).toBe(hacia)
    }
    else {
      expect(() => transicionarFraccion(desde, hacia, false)).toThrow(ErrorDeTransicionDeFraccion)
    }
  })

  it('CA-09.3 · `vendida` → `disponible` sin Superadmin se rechaza', () => {
    expect(puedeTransicionarFraccion('sold', 'available', false)).toBe(false)
    expect(() => transicionarFraccion('sold', 'available', false)).toThrow(ErrorDeTransicionDeFraccion)
  })

  it('RF-09.2 · el Superadmin sí puede devolver una vendida a disponible (D-17, D-31)', () => {
    expect(TRANSICIONES_DE_SUPERADMIN.sold).toEqual(['available'])
    expect(transicionarFraccion('sold', 'available', true)).toBe('available')
  })

  it('RF-09.2 · ni el Superadmin puede inventar transiciones fuera de las dos tablas', () => {
    expect(() => transicionarFraccion('available', 'sold', true)).toThrow(ErrorDeTransicionDeFraccion)
  })

  it('RF-09.2 · una reserva puede caerse y volver a disponible', () => {
    expect(transicionarFraccion('reserved', 'available', false)).toBe('available')
    expect(transicionarFraccion('reserved', 'sold', false)).toBe('sold')
  })

  it('CA-09.3 · el error dice qué transición se intentó y con qué privilegio', () => {
    try {
      transicionarFraccion('sold', 'available', false)
      expect.unreachable('una transición inválida debe lanzar')
    }
    catch (error) {
      const tipado = error as ErrorDeTransicionDeFraccion
      expect(tipado.desde).toBe('sold')
      expect(tipado.hacia).toBe('available')
      expect(tipado.comoSuperadmin).toBe(false)
      expect(tipado.clave).toBe('properties.errors.invalid_fraction_transition')
    }
  })
})

describe('CA-09.4 · el cambio de una fracción recalcula el estado comercial', () => {
  it('CA-09.4 · vender la última disponible deja la propiedad en `sold_out`', () => {
    const antes: EstadoDeFraccion[] = [...todas('sold').slice(0, 7), 'reserved']

    expect(recalcularEstadoComercial(antes, 8, 'sold')).toBe('sold_out')
  })

  it('CA-09.4 · anular la venta de una fracción devuelve `fractions_available`', () => {
    expect(recalcularEstadoComercial(todas('sold'), 3, 'available')).toBe('fractions_available')
  })

  it('CA-09.4 · un cambio que no altera el agregado deja el estado igual', () => {
    expect(recalcularEstadoComercial(todas('available'), 1, 'reserved')).toBe('fractions_available')
  })

  it('CA-09.4 · el recálculo no toca la lista original', () => {
    const original = todas('available')
    recalcularEstadoComercial(original, 1, 'sold')

    expect(original).toEqual(todas('available'))
  })

  it('RF-09.4 · un número de fracción fuera de 1..8 es un error, no un recálculo silencioso', () => {
    expect(() => recalcularEstadoComercial(todas('available'), 0, 'sold')).toThrow(RangeError)
    expect(() => recalcularEstadoComercial(todas('available'), 9, 'sold')).toThrow(RangeError)
  })
})
