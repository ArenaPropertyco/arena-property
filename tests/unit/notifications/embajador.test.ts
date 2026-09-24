import { describe, expect, it } from 'vitest'
import { formatearDia } from '#shared/dates/formato'
import { pesos } from '#shared/money/importe'
import {
  EVENTOS_DEL_EMBAJADOR,
  eventoDeGracia,
  eventoDeReferido,
  eventoDeRetiro,
  notificarAlEmbajador,
} from '#shared/notifications/embajador'
import { crearRegistroDeEmisiones } from '#shared/notifications/emision'
import { IDIOMAS, plantillaDe } from '#shared/notifications/plantillas'
import { REQUIERE_CORREO } from '#shared/notifications/tipos'

/**
 * HU-57 · RF-57.1…RF-57.4 · D-19 · TR-03 — lo que se le avisa al Embajador.
 *
 * Ana (E) y Luis (F) son Embajadores. El mapeo evento → destinatario + plantilla
 * es una función pura sobre el canal de TR-03: qué eventos avisan, a quién, en
 * qué idioma y una sola vez. La base emite por los mismos cinco puntos.
 */

const ANA = { userId: 'user-ana', locale: 'es' }
const LUIS = { userId: 'user-luis', locale: 'en' }

const PAGO_DE_ANA = {
  commissionId: 'c-1', ambassadorUserId: ANA.userId, stage: 'paid' as const,
  referralLabel: 'p@correo.co', propertyName: 'Casa Palomino', propertyId: 'prop-1',
  amount: pesos(3_000_000), availableOn: '2026-10-10',
}

describe('RF-57.1 · exactamente cinco eventos avisan', () => {
  it('RF-57.1 · en proceso de pago, pago completado, disponible, retiro aprobado y retiro pagado', () => {
    expect(EVENTOS_DEL_EMBAJADOR).toEqual(['referral_in_progress', 'referral_paid', 'commission_available', 'withdrawal_approved', 'withdrawal_paid'])
  })

  it('RF-57.1 · todos van in-app y por correo', () => {
    for (const evento of EVENTOS_DEL_EMBAJADOR) {
      expect(REQUIERE_CORREO[evento], evento).toBe(true)
    }
  })

  it('RF-57.1 · un referido que solo se registró no avisa nada todavía', () => {
    expect(eventoDeReferido({ ...PAGO_DE_ANA, stage: 'registered' })).toBeNull()
  })
})

describe('CA-57.1 · el pago completado de un referido', () => {
  it('CA-57.1 · genera para E una notificación con el monto liberado y la fecha en que sale de gracia', () => {
    const evento = eventoDeReferido(PAGO_DE_ANA)
    expect(evento).toEqual({
      kind: 'referral_paid', entityType: 'commission', entityId: 'c-1', propertyId: 'prop-1',
      payload: { referral_label: 'p@correo.co', property_name: 'Casa Palomino', amount: pesos(3_000_000), available_on: '2026-10-10' },
    })

    const aviso = notificarAlEmbajador(evento!, ANA)
    expect(aviso.destinatarios).toEqual([ANA.userId])
    expect(aviso.plantilla.asunto).toContain('$ 3.000.000')
    expect(aviso.plantilla.texto).toContain(formatearDia('2026-10-10', 'es'))
  })

  it('RF-57.1 · el paso a «en proceso de pago» avisa con el referido y la propiedad', () => {
    const evento = eventoDeReferido({ ...PAGO_DE_ANA, stage: 'payment_in_progress', availableOn: null })
    expect(evento).toMatchObject({ kind: 'referral_in_progress', entityId: 'c-1', payload: { referral_label: 'p@correo.co', property_name: 'Casa Palomino' } })
    expect(notificarAlEmbajador(evento!, ANA).plantilla.texto).toContain('Casa Palomino')
  })

  it('RF-57.1 · el paso a disponible a los 30 días avisa con el monto', () => {
    const evento = eventoDeGracia({ id: 'c-1', propertyId: 'prop-1', amount: pesos(3_000_000) })
    expect(evento).toEqual({ kind: 'commission_available', entityType: 'commission', entityId: 'c-1', propertyId: 'prop-1', payload: { amount: pesos(3_000_000) } })
  })
})

describe('CA-57.2 · acotamiento estricto', () => {
  it('CA-57.2 · RF-57.2 · un cambio de un referido de F no le llega a E', () => {
    const evento = eventoDeReferido({ ...PAGO_DE_ANA, commissionId: 'c-2', ambassadorUserId: LUIS.userId })
    const aviso = notificarAlEmbajador(evento!, LUIS)

    expect(aviso.destinatarios).toEqual([LUIS.userId])
    expect(aviso.destinatarios).not.toContain(ANA.userId)
  })

  it('CA-57.2 · con el registro de emisiones, E no recibe nada por el evento de F', () => {
    const registro = crearRegistroDeEmisiones()
    const evento = eventoDeReferido({ ...PAGO_DE_ANA, commissionId: 'c-2', ambassadorUserId: LUIS.userId })!

    registro.emitir(evento, notificarAlEmbajador(evento, LUIS).destinatarios)

    expect(registro.destinatariosDe(evento)).toEqual([LUIS.userId])
  })
})

describe('CA-57.3 · los retiros', () => {
  const retiro = { id: 'w-1', amount: pesos(300_000) }

  it('RF-57.1 · aprobada y pagada avisan con el monto', () => {
    expect(eventoDeRetiro({ ...retiro, status: 'approved' })).toEqual({ kind: 'withdrawal_approved', entityType: 'withdrawal_request', entityId: 'w-1', propertyId: null, payload: { amount: pesos(300_000) } })
    expect(eventoDeRetiro({ ...retiro, status: 'paid' })).toMatchObject({ kind: 'withdrawal_paid', entityId: 'w-1' })
  })

  it('CA-57.3 · un rechazo no genera notificación de este módulo; tampoco la mera solicitud', () => {
    expect(eventoDeRetiro({ ...retiro, status: 'rejected' })).toBeNull()
    expect(eventoDeRetiro({ ...retiro, status: 'requested' })).toBeNull()
  })
})

describe('CA-57.4 · cada evento notifica una sola vez', () => {
  it('CA-57.4 · RF-57.4 · el mismo evento procesado dos veces deja una sola notificación', () => {
    const registro = crearRegistroDeEmisiones()
    const evento = eventoDeReferido(PAGO_DE_ANA)!
    const destinatarios = notificarAlEmbajador(evento, ANA).destinatarios

    expect(registro.emitir(evento, destinatarios)).toEqual([ANA.userId])
    expect(registro.emitir(evento, destinatarios)).toEqual([])
    expect(registro.destinatariosDe(evento)).toEqual([ANA.userId])
  })

  it('CA-57.4 · dos retiros distintos sí son dos eventos', () => {
    const registro = crearRegistroDeEmisiones()
    const primero = eventoDeRetiro({ id: 'w-1', amount: pesos(300_000), status: 'approved' })!
    const segundo = eventoDeRetiro({ id: 'w-2', amount: pesos(300_000), status: 'approved' })!

    expect(registro.emitir(primero, [ANA.userId])).toEqual([ANA.userId])
    expect(registro.emitir(segundo, [ANA.userId])).toEqual([ANA.userId])
  })
})

describe('RF-57.3 · plantillas e idioma del Embajador', () => {
  it.each(EVENTOS_DEL_EMBAJADOR)('RF-57.3 · %s tiene plantilla con asunto y texto en es y en', (tipo) => {
    for (const idioma of IDIOMAS) {
      const plantilla = plantillaDe(tipo, idioma, { amount: pesos(1_000), referral_label: 'x', property_name: 'y', available_on: '2026-10-10' })
      expect(plantilla.asunto.length, `${tipo} ${idioma} asunto`).toBeGreaterThan(0)
      expect(plantilla.texto.length, `${tipo} ${idioma} texto`).toBeGreaterThan(0)
      expect(plantilla.texto).not.toMatch(/\{[a-z_]+\}/)
    }
  })

  it('RF-57.3 · D-19 · la plantilla se elige por el idioma del destinatario; lo desconocido cae en español', () => {
    const evento = eventoDeRetiro({ id: 'w-1', amount: pesos(300_000), status: 'paid' })!

    expect(notificarAlEmbajador(evento, ANA)).toMatchObject({ idioma: 'es' })
    expect(notificarAlEmbajador(evento, ANA).plantilla.asunto).toBe('Tu retiro de $ 300.000 fue pagado')
    expect(notificarAlEmbajador(evento, LUIS)).toMatchObject({ idioma: 'en' })
    expect(notificarAlEmbajador(evento, LUIS).plantilla.asunto).toMatch(/^Your .* withdrawal was paid$/)
    expect(notificarAlEmbajador(evento, { userId: 'x', locale: null })).toMatchObject({ idioma: 'es' })
  })
})
