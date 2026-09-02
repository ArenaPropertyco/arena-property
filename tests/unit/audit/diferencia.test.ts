import { describe, expect, it } from 'vitest'
import { armarEntrada, diferenciaDeEstados } from '#shared/audit/diferencia'

/**
 * TR-01 · RF-A.7 — el armado de la entrada de auditoría es una función pura sobre
 * el par (estado anterior, estado posterior). Nivel N1: sin base de datos.
 */

describe('diferenciaDeEstados', () => {
  it('CA-A.6 · produce solo los campos modificados, sin incluir los que no cambiaron', () => {
    const anterior = { estado: 'borrador', precio: 115_500_000, titulo: 'Casa del Mar' }
    const posterior = { estado: 'publicada', precio: 115_500_000, titulo: 'Casa del Mar' }

    expect(diferenciaDeEstados(anterior, posterior)).toEqual({
      estado: { antes: 'borrador', despues: 'publicada' },
    })
  })

  it('reporta un campo nuevo como aparición desde indefinido', () => {
    expect(diferenciaDeEstados({ a: 1 }, { a: 1, b: 2 })).toEqual({
      b: { antes: undefined, despues: 2 },
    })
  })

  it('reporta un campo que desaparece', () => {
    expect(diferenciaDeEstados({ a: 1, b: 2 }, { a: 1 })).toEqual({
      b: { antes: 2, despues: undefined },
    })
  })

  it('no reporta nada cuando los dos estados son iguales', () => {
    expect(diferenciaDeEstados({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({})
  })

  it('compara en profundidad: un objeto anidado igual no es un cambio', () => {
    const anterior = { ficha: { habitaciones: 3, piscina: true } }
    const posterior = { ficha: { habitaciones: 3, piscina: true } }

    expect(diferenciaDeEstados(anterior, posterior)).toEqual({})
  })

  it('detecta el cambio dentro de un objeto anidado y lo reporta entero', () => {
    const anterior = { ficha: { habitaciones: 3, piscina: true } }
    const posterior = { ficha: { habitaciones: 4, piscina: true } }

    expect(diferenciaDeEstados(anterior, posterior)).toEqual({
      ficha: {
        antes: { habitaciones: 3, piscina: true },
        despues: { habitaciones: 4, piscina: true },
      },
    })
  })

  it('distingue null de ausente: son hechos distintos en una auditoría', () => {
    expect(diferenciaDeEstados({ motivo: null }, { motivo: 'cierre de temporada' })).toEqual({
      motivo: { antes: null, despues: 'cierre de temporada' },
    })
  })

  it('trata un alta como todos los campos apareciendo', () => {
    expect(diferenciaDeEstados(null, { estado: 'borrador' })).toEqual({
      estado: { antes: undefined, despues: 'borrador' },
    })
  })

  it('trata una baja como todos los campos desapareciendo', () => {
    expect(diferenciaDeEstados({ estado: 'activa' }, null)).toEqual({
      estado: { antes: 'activa', despues: undefined },
    })
  })
})

describe('armarEntrada', () => {
  it('CA-A.6 · arma la entrada con acción, entidad y solo los campos modificados', () => {
    const entrada = armarEntrada({
      accion: 'propiedad.publicada',
      entidad: { tipo: 'property', id: '11111111-1111-4111-8111-111111111111' },
      propiedadId: '11111111-1111-4111-8111-111111111111',
      anterior: { estado: 'borrador', precio: 100 },
      posterior: { estado: 'publicada', precio: 100 },
    })

    expect(entrada).toEqual({
      accion: 'propiedad.publicada',
      entidad: { tipo: 'property', id: '11111111-1111-4111-8111-111111111111' },
      propiedadId: '11111111-1111-4111-8111-111111111111',
      motivo: undefined,
      cambios: { estado: { antes: 'borrador', despues: 'publicada' } },
      anterior: { estado: 'borrador', precio: 100 },
      posterior: { estado: 'publicada', precio: 100 },
    })
  })

  it('conserva el motivo cuando la operación lo trae', () => {
    const entrada = armarEntrada({
      accion: 'estadia.bloqueada',
      entidad: { tipo: 'stay', id: '22222222-2222-4222-8222-222222222222' },
      motivo: 'mantenimiento correctivo',
      anterior: { estado: 'confirmada' },
      posterior: { estado: 'bloqueada' },
    })

    expect(entrada.motivo).toBe('mantenimiento correctivo')
  })

  it('una operación sin cambios reales produce una entrada sin cambios', () => {
    const entrada = armarEntrada({
      accion: 'propiedad.guardada',
      entidad: { tipo: 'property', id: '33333333-3333-4333-8333-333333333333' },
      anterior: { estado: 'activa' },
      posterior: { estado: 'activa' },
    })

    expect(entrada.cambios).toEqual({})
  })
})
