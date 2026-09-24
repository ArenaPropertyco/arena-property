import { describe, expect, it } from 'vitest'
import { formatearMes } from '#shared/dates/formato'
import { formatearImporte } from '#shared/money/formato'
import { pesos } from '#shared/money/importe'
import { resolverDestinatarios } from '#shared/notifications/destinatarios'
import { crearRegistroDeEmisiones } from '#shared/notifications/emision'
import { cargaLegible } from '#shared/notifications/legible'
import { IDIOMAS, plantillaDe } from '#shared/notifications/plantillas'
import {
  EVENTOS_DEL_PROPIETARIO,
  eventoDeCorte,
  eventoDePagoDePropietario,
  eventoDeRetiroDePropietario,
  notificarALaAdministracion,
  notificarAlPropietario,
} from '#shared/notifications/propietario'
import { ALCANCE, REQUIERE_CORREO, TIPOS_DE_NOTIFICACION } from '#shared/notifications/tipos'

/**
 * HU-62 · RF-62.13 · TR-03 · D-19 — lo que se le avisa al Propietario y a la
 * administración de la propiedad.
 *
 * Pedro recibe su corte (con si debe pagar o puede retirar), la confirmación o
 * el rechazo de su pago y el pago o el rechazo de su retiro. El Administrador
 * recibe aviso cuando Pedro reporta un pago. Cada evento avisa una sola vez.
 */

const PEDRO = { userId: 'user-pedro', locale: 'es' }
const CASA = { propertyId: 'prop-1', propertyName: 'Casa P1' }

describe('RF-62.13 · los eventos del Propietario', () => {
  it('son exactamente cinco para el Propietario y uno para la administración, todos en el catálogo y con correo', () => {
    expect(EVENTOS_DEL_PROPIETARIO).toEqual(['owner_statement_closed', 'owner_payment_confirmed', 'owner_payment_rejected', 'owner_withdrawal_paid', 'owner_withdrawal_rejected'])
    for (const evento of [...EVENTOS_DEL_PROPIETARIO, 'owner_payment_reported'] as const) {
      expect(TIPOS_DE_NOTIFICACION).toContain(evento)
      expect(REQUIERE_CORREO[evento], evento).toBe(true)
    }
    expect(ALCANCE.owner_statement_closed).toBe('owner')
    expect(ALCANCE.owner_payment_reported).toBe('property_admins')
  })

  it('el corte dice cuánto quedó y si toca pagar o se puede retirar', () => {
    const cobro = eventoDeCorte({ ...CASA, ownerId: PEDRO.userId, period: '2026-09', net: pesos(-50_000), balance: pesos(-50_000) })
    expect(cobro).toMatchObject({ kind: 'owner_statement_closed', entityType: 'owner_statement', entityId: 'prop-1:user-pedro:2026-09', propertyId: 'prop-1' })
    expect(cobro.payload).toEqual({ property_name: 'Casa P1', period: '2026-09', amount: pesos(-50_000), balance: pesos(-50_000), action: 'pay' })

    expect(eventoDeCorte({ ...CASA, ownerId: PEDRO.userId, period: '2026-09', net: pesos(630_000), balance: pesos(630_000) }).payload.action).toBe('withdraw')
    expect(eventoDeCorte({ ...CASA, ownerId: PEDRO.userId, period: '2026-09', net: pesos(0), balance: pesos(0) }).payload.action).toBe('none')
  })

  it('el pago avisa al reportarse (a la administración), al confirmarse y al rechazarse (al Propietario)', () => {
    const base = { id: 'pay-1', amount: pesos(50_000), ...CASA, rejectionReason: null }

    expect(eventoDePagoDePropietario({ ...base, status: 'reported' })).toMatchObject({ kind: 'owner_payment_reported', entityType: 'owner_payment', entityId: 'pay-1', payload: { amount: pesos(50_000), property_name: 'Casa P1' } })
    expect(eventoDePagoDePropietario({ ...base, status: 'confirmed' })).toMatchObject({ kind: 'owner_payment_confirmed' })
    expect(eventoDePagoDePropietario({ ...base, status: 'rejected', rejectionReason: 'Ilegible.' })).toMatchObject({ kind: 'owner_payment_rejected', payload: { reason: 'Ilegible.' } })
  })

  it('el retiro avisa al pagarse y al rechazarse; la mera solicitud no', () => {
    const base = { id: 'w-1', amount: pesos(300_000), ...CASA, rejectionReason: null }

    expect(eventoDeRetiroDePropietario({ ...base, status: 'requested' })).toBeNull()
    expect(eventoDeRetiroDePropietario({ ...base, status: 'paid' })).toMatchObject({ kind: 'owner_withdrawal_paid', entityType: 'owner_withdrawal', entityId: 'w-1' })
    expect(eventoDeRetiroDePropietario({ ...base, status: 'rejected', rejectionReason: 'Cuenta inválida.' })).toMatchObject({ kind: 'owner_withdrawal_rejected', payload: { reason: 'Cuenta inválida.' } })
  })
})

describe('RF-62.13 · destinatarios y plantillas', () => {
  const corte = eventoDeCorte({ ...CASA, ownerId: PEDRO.userId, period: '2026-09', net: pesos(-50_000), balance: pesos(-50_000) })

  it('el corte va solo al Propietario, en su idioma, con el importe y el mes legibles', () => {
    const aviso = notificarAlPropietario(corte, PEDRO)

    expect(aviso.destinatarios).toEqual([PEDRO.userId])
    expect(aviso.idioma).toBe('es')
    expect(aviso.plantilla.asunto).toContain(formatearMes('2026-09', 'es'))
    expect(aviso.plantilla.texto).toContain(formatearImporte(pesos(-50_000), 'es'))
    expect(resolverDestinatarios(corte, { propietario: { ownerId: PEDRO.userId } })).toEqual([PEDRO.userId])
    expect(resolverDestinatarios(corte, {})).toEqual([])
  })

  it('el pago reportado va a los administradores vigentes de la propiedad, una vez cada uno', () => {
    const reportado = eventoDePagoDePropietario({ id: 'pay-1', amount: pesos(50_000), ...CASA, status: 'reported', rejectionReason: null })
    const aviso = notificarALaAdministracion(reportado, { ownerIds: [PEDRO.userId], adminIds: ['admin-1', 'admin-1', 'admin-2'] })

    expect(aviso.destinatarios).toEqual(['admin-1', 'admin-2'])
    expect(resolverDestinatarios(reportado, { vinculos: { ownerIds: [PEDRO.userId], adminIds: ['admin-1'] } })).toEqual(['admin-1'])
    expect(resolverDestinatarios(reportado, {})).toEqual([])
  })

  it.each(IDIOMAS)('cada evento tiene plantilla en %s y ningún marcador queda suelto', (idioma) => {
    for (const tipo of [...EVENTOS_DEL_PROPIETARIO, 'owner_payment_reported'] as const) {
      const plantilla = plantillaDe(tipo, idioma, { property_name: 'Casa P1', period: '2026-09', amount: pesos(50_000), balance: pesos(-50_000), action: 'pay', reason: 'x' })
      expect(plantilla.asunto, `${tipo} ${idioma}`).not.toMatch(/\{[a-z_]+\}/)
      expect(plantilla.texto, `${tipo} ${idioma}`).not.toMatch(/\{[a-z_]+\}/)
    }
  })

  it('TR-02 · el saldo y el mes de la carga se leen con el formato de la casa', () => {
    const legible = cargaLegible({ balance: pesos(-50_000), period: '2026-09', paid_on: '2026-10-05' }, 'en')

    expect(legible.balance).toBe(formatearImporte(pesos(-50_000), 'en'))
    expect(legible.period).toBe(formatearMes('2026-09', 'en'))
    expect(legible.paid_on).toContain('2026')
  })

  it('CA-62.15 · el mismo evento avisa una sola vez', () => {
    const registro = crearRegistroDeEmisiones()

    expect(registro.emitir(corte, [PEDRO.userId])).toEqual([PEDRO.userId])
    expect(registro.emitir(corte, [PEDRO.userId])).toEqual([])
  })
})
