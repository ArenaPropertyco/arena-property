import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  CLAVES_DE_VALIDACION_DE_INVITACION,
  ESTADOS_DE_INVITACION,
  ESTADOS_INVITABLES,
  puedeInvitarse,
  validarInvitacion,
} from '#shared/purchases/invitaciones'
import type { SolicitudDeInvitacion } from '#shared/purchases/invitaciones'

/**
 * HU-06 · RF-06.1 y RF-06.5 — a quién y sobre qué fracción se puede invitar.
 *
 * La regla vive aquí para dar el mensaje al formulario; la base la repite en su
 * disparador para que ninguna ruta la esquive. Las dos leen la misma tabla.
 */

const FRACCION = 'f1000000-0000-4000-8000-000000000001'
const PROPIEDAD = 'a1000000-0000-4000-8000-000000000001'

function solicitud(cambios: Partial<SolicitudDeInvitacion> = {}): SolicitudDeInvitacion {
  return {
    fractionId: FRACCION,
    propertyId: PROPIEDAD,
    fractionStatus: 'available',
    email: 'comprador@ejemplo.com',
    agreedPrice: pesos(180_000_000),
    ...cambios,
  }
}

describe('RF-06.1 · estados sobre los que cabe una invitación', () => {
  it('solo se invita sobre una fracción disponible o reservada', () => {
    expect(ESTADOS_INVITABLES).toEqual(['available', 'reserved'])
    expect(puedeInvitarse('available')).toBe(true)
    expect(puedeInvitarse('reserved')).toBe(true)
  })

  it('CA-06.4 · RF-06.5 · una fracción vendida no admite nueva invitación', () => {
    expect(puedeInvitarse('sold')).toBe(false)
  })

  it('el ciclo de la invitación es cerrado: pendiente, aceptada o cancelada', () => {
    expect(ESTADOS_DE_INVITACION).toEqual(['pending', 'accepted', 'cancelled'])
  })
})

describe('CA-06.1 · validación de la invitación', () => {
  it('una invitación completa, del Administrador asignado, no produce errores', () => {
    expect(validarInvitacion(solicitud(), { administraLaPropiedad: true })).toEqual([])
  })

  it('CA-06.1 · un Administrador sin la propiedad asignada no invita sobre ella', () => {
    expect(validarInvitacion(solicitud(), { administraLaPropiedad: false }).map(e => e.name))
      .toEqual(['actor'])
  })

  it('CA-06.4 · sobre una fracción vendida se rechaza aunque quien invita sí administre', () => {
    const errores = validarInvitacion(solicitud({ fractionStatus: 'sold' }), { administraLaPropiedad: true })

    expect(errores.map(e => e.message)).toEqual(['purchases.validation.fraction_not_invitable'])
  })

  it('un correo inválido se rechaza con su clave', () => {
    expect(validarInvitacion(solicitud({ email: 'sin-arroba' }), { administraLaPropiedad: true }).map(e => e.name))
      .toEqual(['email'])
  })

  it('RF-58.1 · el precio pactado es dinero positivo', () => {
    expect(validarInvitacion(solicitud({ agreedPrice: pesos(0) }), { administraLaPropiedad: true }).map(e => e.name))
      .toEqual(['agreedPrice'])
  })

  it('RF-06.4 · un código de referido con formato plausible se acepta y no produce errores', () => {
    expect(validarInvitacion(solicitud({ referralCode: ' luis-2026 ' }), { administraLaPropiedad: true })).toEqual([])
  })

  it('RF-06.4 · sin código, o vacío, no hay atribución ni error', () => {
    expect(validarInvitacion(solicitud({ referralCode: null }), { administraLaPropiedad: true })).toEqual([])
    expect(validarInvitacion(solicitud({ referralCode: '   ' }), { administraLaPropiedad: true })).toEqual([])
  })

  it('RF-06.4 · un código con formato inválido se rechaza: quien invita lo escribe a propósito', () => {
    const errores = validarInvitacion(solicitud({ referralCode: 'x' }), { administraLaPropiedad: true })

    expect(errores).toEqual([{ name: 'referralCode', message: 'purchases.validation.referral_code_format' }])
  })

  it('toda clave de validación pertenece al catálogo cerrado', () => {
    const errores = validarInvitacion(
      solicitud({ fractionStatus: 'sold', email: '', agreedPrice: pesos(-1), referralCode: '??' }),
      { administraLaPropiedad: false },
    )

    expect(errores.length).toBe(5)
    expect(errores.every(error => CLAVES_DE_VALIDACION_DE_INVITACION.includes(error.message))).toBe(true)
  })
})
