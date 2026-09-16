import { describe, expect, it } from 'vitest'
import { claveDeEvento, crearRegistroDeEmisiones } from '#shared/notifications/emision'
import { REQUIERE_CORREO } from '#shared/notifications/tipos'

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

describe('CA-16.3 · HU-16 · RF-16.4 · una reserva confirmada se emite una sola vez por los dos canales', () => {
  const confirmada = { kind: 'stay_confirmed' as const, entityType: 'week_confirmation', entityId: 'alloc-1', propertyId: 'x', payload: { week_index: 24 } }

  it('CA-16.3 · el tipo exige correo además de la bandeja', () => {
    expect(REQUIERE_CORREO.stay_confirmed).toBe(true)
  })

  it('CA-16.3 · reprocesar la confirmación no produce una segunda notificación al titular', () => {
    const registro = crearRegistroDeEmisiones()

    expect(registro.emitir(confirmada, ['luis'])).toEqual(['luis'])
    expect(registro.emitir(confirmada, ['luis'])).toEqual([])
    expect(registro.destinatariosDe(confirmada)).toEqual(['luis'])
  })
})
