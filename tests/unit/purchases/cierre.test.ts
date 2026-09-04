import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import { ErrorDeCierre, atribucionDeCompra, cerrarCompra } from '#shared/purchases/cierre'
import type { DatosDeCierre } from '#shared/purchases/cierre'

/**
 * HU-06 · RF-06.2, RF-06.3, RF-06.4 y D-31 — qué produce el cierre de una compra.
 *
 * Es una función pura: recibe los hechos y devuelve los efectos. Así los dos ejes de
 * D-31 se prueban sin base de datos: la titularidad se da aquí, el derecho de uso no.
 */

const FRACCION = 'f1000000-0000-4000-8000-000000000001'
const PROPIEDAD = 'a1000000-0000-4000-8000-000000000001'
const COMPRADOR = 'b1000000-0000-4000-8000-000000000001'

function datos(cambios: Partial<DatosDeCierre> = {}): DatosDeCierre {
  return {
    fractionId: FRACCION,
    propertyId: PROPIEDAD,
    fractionStatus: 'reserved',
    buyerId: COMPRADOR,
    buyerRoles: ['user'],
    agreedPrice: pesos(180_000_000),
    referralCode: null,
    ...cambios,
  }
}

describe('CA-06.2 · titularidad al cerrar la compra (D-31)', () => {
  it('CA-06.2 · la fracción queda vendida, vinculada al comprador y con el calendario inactivo', () => {
    const efectos = cerrarCompra(datos())

    expect(efectos.fraccion).toEqual({
      id: FRACCION,
      status: 'sold',
      ownerId: COMPRADOR,
      calendarActive: false,
    })
  })

  it('CA-06.2 · el comprador obtiene el rol Propietario de inmediato', () => {
    expect(cerrarCompra(datos()).rolesAOtorgar).toEqual(['owner'])
  })

  it('RF-07.1 · si ya era Propietario de otra fracción, no se le otorga dos veces', () => {
    expect(cerrarCompra(datos({ buyerRoles: ['user', 'owner'] })).rolesAOtorgar).toEqual([])
  })

  it('una fracción disponible pasa por reservada antes de venderse: la máquina no se salta', () => {
    expect(cerrarCompra(datos({ fractionStatus: 'available' })).transiciones).toEqual(['reserved', 'sold'])
    expect(cerrarCompra(datos({ fractionStatus: 'reserved' })).transiciones).toEqual(['sold'])
  })
})

describe('CA-06.3 · el plan de pagos nace con el cierre', () => {
  it('CA-06.3 · se crea con el precio pactado y sin abonos, así que deriva «Reservada»', () => {
    const { plan } = cerrarCompra(datos({ agreedPrice: pesos(175_000_000) }))

    expect(plan).toEqual({
      fractionId: FRACCION,
      propertyId: PROPIEDAD,
      ownerId: COMPRADOR,
      agreedPrice: 175_000_000,
      referralCode: null,
    })
  })

  it('RF-06.4 · la atribución de referido del comprador se arrastra a la compra', () => {
    expect(cerrarCompra(datos({ referralCode: 'ANA2026' })).plan.referralCode).toBe('ANA2026')
  })

  it('RF-06.4 · la atribución del perfil manda; la de la invitación suple cuando el perfil no tiene (D-03)', () => {
    expect(atribucionDeCompra('ANA2026', 'LUIS-2026')).toBe('ANA2026')
    expect(atribucionDeCompra(null, 'LUIS-2026')).toBe('LUIS-2026')
    expect(atribucionDeCompra(null, null)).toBeNull()
  })

  it('CA-06.3 · el cierre no activa el calendario: eso lo decide el plan al completarse', () => {
    expect(cerrarCompra(datos()).fraccion.calendarActive).toBe(false)
  })
})

describe('RF-06.5 · lo que el cierre rechaza', () => {
  it('CA-06.4 · una fracción ya vendida no se vuelve a cerrar', () => {
    expect(() => cerrarCompra(datos({ fractionStatus: 'sold' }))).toThrow(ErrorDeCierre)
  })

  it('un precio pactado que no es dinero positivo no crea plan', () => {
    expect(() => cerrarCompra(datos({ agreedPrice: pesos(0) }))).toThrow(ErrorDeCierre)
  })

  it('sin comprador identificado no hay a quién dar la titularidad', () => {
    expect(() => cerrarCompra(datos({ buyerId: '' }))).toThrow(ErrorDeCierre)
  })
})
