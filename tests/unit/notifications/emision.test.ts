import { describe, expect, it } from 'vitest'
import { claveDeEvento, crearRegistroDeEmisiones } from '#shared/notifications/emision'

/**
 * TR-03 · RF-N.4 — cada evento de negocio genera como máximo una notificación por
 * destinatario aunque se reprocese. La base lo garantiza con claves únicas; aquí se
 * prueba la misma regla como función pura.
 */

const evento = { kind: 'announcement_published' as const, entityType: 'announcement', entityId: 'n1', propertyId: 'x', payload: { title: 'Corte de agua' } }

describe('CA-N.3 · idempotencia de emisión', () => {
  it('la clave del evento es estable y distingue tipo, entidad e identificador', () => {
    expect(claveDeEvento(evento)).toBe('announcement_published:announcement:n1')
    expect(claveDeEvento({ ...evento, entityId: 'n2' })).not.toBe(claveDeEvento(evento))
  })

  it('CA-N.3 · el mismo evento procesado dos veces deja una sola notificación por destinatario', () => {
    const registro = crearRegistroDeEmisiones()

    const primera = registro.emitir(evento, ['ana', 'luis'])
    const segunda = registro.emitir(evento, ['ana', 'luis'])

    expect(primera).toEqual(['ana', 'luis'])
    expect(segunda).toEqual([])
    expect(registro.destinatariosDe(evento)).toEqual(['ana', 'luis'])
  })

  it('un reproceso con un destinatario nuevo solo notifica al nuevo', () => {
    const registro = crearRegistroDeEmisiones()
    registro.emitir(evento, ['ana'])

    expect(registro.emitir(evento, ['ana', 'luis'])).toEqual(['luis'])
  })

  it('el mismo destinatario repetido en la lista cuenta una sola vez', () => {
    const registro = crearRegistroDeEmisiones()

    expect(registro.emitir(evento, ['ana', 'ana'])).toEqual(['ana'])
  })
})
