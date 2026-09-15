import { describe, expect, it } from 'vitest'
import {
  documentoNormalizado,
  esMismoTercero,
  origenDeSemanaRentada,
  puedeRentarseAUnTercero,
  validarTercero,
} from '#shared/scheduling/terceros'
import type { EstadoDeSemanaParaRenta, NuevoTercero } from '#shared/scheduling/terceros'

/**
 * HU-39 · RF-39.1, RF-39.2, RF-39.2b, RF-39.5 · D-25, D-39 — el tercero y la
 * semana que se le renta.
 *
 * Dos reglas de negocio que no son de la interfaz: qué semana entra en la bolsa de
 * renta, y con qué origen entró, porque ese par decide después de quién es el
 * dinero (HU-40).
 */

function tercero(cambios: Partial<NuevoTercero> = {}): NuevoTercero {
  return {
    fullName: 'Marta Restrepo',
    documentKind: 'cc',
    documentNumber: '1.020.304-5',
    email: 'marta@ejemplo.com',
    phone: '+57 300 123 4567',
    consentAccepted: true,
    ...cambios,
  }
}

function semana(cambios: Partial<EstadoDeSemanaParaRenta> = {}): EstadoDeSemanaParaRenta {
  return {
    week: 27,
    startsOn: '2027-07-10',
    fraction: null,
    confirmedAt: null,
    releasedAt: null,
    releaseReason: null,
    blocked: false,
    alreadyRented: false,
    selectionComplete: true,
    ...cambios,
  }
}

describe('CA-39.1 · solo se renta lo que está en la bolsa de renta (RF-39.2)', () => {
  it('CA-39.1 · una semana con estadía declarada por su Propietario no se renta', () => {
    const confirmada = semana({ fraction: 3, confirmedAt: '2026-09-01T10:00:00Z' })

    expect(puedeRentarseAUnTercero(confirmada)).toEqual({ ok: false, clave: 'rentals.validation.week_confirmed' })
  })

  it('CA-39.1 · una semana elegida y aún sin confirmar tampoco: sigue siendo de su fracción', () => {
    const elegida = semana({ fraction: 3 })

    expect(puedeRentarseAUnTercero(elegida)).toEqual({ ok: false, clave: 'rentals.validation.week_owned' })
  })

  it('CA-39.1 · una semana liberada voluntariamente sí se renta', () => {
    const liberada = semana({ fraction: 3, releasedAt: '2026-09-10T10:00:00Z', releaseReason: 'voluntary' })

    expect(puedeRentarseAUnTercero(liberada)).toEqual({ ok: true })
  })

  it('CA-39.1 · una cancelada y una caducada también', () => {
    for (const motivo of ['cancelled', 'expired'] as const) {
      const libre = semana({ fraction: 2, releasedAt: '2026-09-10T10:00:00Z', releaseReason: motivo })

      expect(puedeRentarseAUnTercero(libre), motivo).toEqual({ ok: true })
    }
  })

  it('CA-39.1 · una semana sobrante de la rejilla se renta una vez cerrados los turnos', () => {
    expect(puedeRentarseAUnTercero(semana())).toEqual({ ok: true })
    expect(puedeRentarseAUnTercero(semana({ selectionComplete: false })))
      .toEqual({ ok: false, clave: 'rentals.validation.selection_open' })
  })

  it('RF-15.2 · una semana bloqueada por el Administrador no se renta', () => {
    expect(puedeRentarseAUnTercero(semana({ blocked: true })))
      .toEqual({ ok: false, clave: 'rentals.validation.week_blocked' })
  })

  it('RF-39.2 · una semana ya rentada no se renta dos veces', () => {
    expect(puedeRentarseAUnTercero(semana({ alreadyRented: true })))
      .toEqual({ ok: false, clave: 'rentals.validation.week_rented' })
  })
})

describe('CA-39.5 · la semana rentada conserva su origen (RF-39.2b, D-39)', () => {
  it('CA-39.5 · una semana que la fracción 3/8 liberó queda con esa fracción y el motivo «liberada»', () => {
    const liberada = semana({ fraction: 3, releasedAt: '2026-09-10T10:00:00Z', releaseReason: 'voluntary' })

    expect(origenDeSemanaRentada(liberada)).toEqual({ reason: 'voluntary', fraction: 3 })
  })

  it('CA-39.5 · una semana sobrante de la rejilla queda sin fracción de origen', () => {
    expect(origenDeSemanaRentada(semana())).toEqual({ reason: 'pool', fraction: null })
  })

  it('RF-39.2b · una cancelada y una caducada conservan su fracción, pero su motivo no atribuye', () => {
    expect(origenDeSemanaRentada(semana({ fraction: 5, releasedAt: '2026-09-10T10:00:00Z', releaseReason: 'cancelled' })))
      .toEqual({ reason: 'cancelled', fraction: 5 })
    expect(origenDeSemanaRentada(semana({ fraction: 7, releasedAt: '2026-09-10T10:00:00Z', releaseReason: 'expired' })))
      .toEqual({ reason: 'expired', fraction: 7 })
  })

  it('RF-39.2b · el origen se fija al crear la reserva: la misma semana da siempre el mismo par', () => {
    const liberada = semana({ fraction: 3, releasedAt: '2026-09-10T10:00:00Z', releaseReason: 'voluntary' })

    expect(origenDeSemanaRentada(liberada)).toEqual(origenDeSemanaRentada(liberada))
  })
})

describe('RF-39.1 · RF-39.5 · el registro del tercero (D-25)', () => {
  it('un tercero completo y con consentimiento entra', () => {
    expect(validarTercero(tercero())).toEqual([])
  })

  it('RF-39.5 · D-25 · sin consentimiento explícito no se guardan sus datos', () => {
    expect(validarTercero(tercero({ consentAccepted: false })).map(error => error.message))
      .toEqual(['rentals.validation.consent_required'])
  })

  it('RF-39.1 · nombre y documento son obligatorios', () => {
    expect(validarTercero(tercero({ fullName: '  ' })).map(error => error.name)).toEqual(['fullName'])
    expect(validarTercero(tercero({ documentNumber: '' })).map(error => error.name)).toEqual(['documentNumber'])
  })

  it('RF-39.1 · hace falta al menos una vía de contacto', () => {
    expect(validarTercero(tercero({ email: null, phone: null })).map(error => error.message))
      .toEqual(['rentals.validation.contact_required'])
    expect(validarTercero(tercero({ email: null }))).toEqual([])
    expect(validarTercero(tercero({ phone: null }))).toEqual([])
  })

  it('un correo con formato imposible se rechaza', () => {
    expect(validarTercero(tercero({ email: 'marta arroba ejemplo' })).map(error => error.name)).toEqual(['email'])
  })
})

describe('CA-39.3 · el tercero ya registrado se reutiliza, no se duplica', () => {
  it('CA-39.3 · el documento se compara sin puntos, guiones, espacios ni mayúsculas', () => {
    expect(documentoNormalizado('1.020.304-5')).toBe('10203045')
    expect(documentoNormalizado(' 10 203 045 ')).toBe('10203045')
    expect(documentoNormalizado('AB-123.c')).toBe('AB123C')
  })

  it('CA-39.3 · dos altas del mismo documento y tipo son el mismo tercero', () => {
    const registrado = { documentKind: 'cc' as const, documentNumber: '10203045' }

    expect(esMismoTercero(registrado, tercero())).toBe(true)
    expect(esMismoTercero(registrado, tercero({ documentNumber: '1-020-304-5' }))).toBe(true)
  })

  it('CA-39.3 · el mismo número con otro tipo de documento es otra persona', () => {
    const registrado = { documentKind: 'passport' as const, documentNumber: '10203045' }

    expect(esMismoTercero(registrado, tercero())).toBe(false)
  })
})
