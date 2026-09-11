import { describe, expect, it } from 'vitest'
import {
  CLAVES_DE_VALIDACION_DE_LISTA_DE_ESPERA,
  fechaDeAnonimizacion,
  normalizarInscripcion,
  RETENCION_EN_ANIOS,
  validarInscripcion,
  VERSION_DE_CONSENTIMIENTO,
} from '#shared/waitlist/esquema'
import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'

/**
 * HU-47 · RF-47.1, RF-47.5 · D-25 — lo que se pide para anotarse en la lista de
 * espera y cómo se guarda: con consentimiento explícito y fecha de anonimización.
 */

function inscripcion(cambios: Partial<InscripcionEnListaDeEspera> = {}): InscripcionEnListaDeEspera {
  return {
    propertyId: 'a4700000-0000-4000-8000-000000000001',
    fullName: '  Ana Gómez ',
    email: 'Ana@Ejemplo.com',
    phone: ' +57 310 000 0000 ',
    consent: true,
    ...cambios,
  }
}

describe('RF-47.1 · el formulario pide nombre, correo y teléfono', () => {
  it('una inscripción completa no tiene reparos', () => {
    expect(validarInscripcion(inscripcion())).toEqual([])
  })

  it('devuelve todos los errores, no solo el primero', () => {
    expect(validarInscripcion(inscripcion({ fullName: ' ', email: 'nada', phone: '', consent: false })).map(e => e.message))
      .toEqual([...CLAVES_DE_VALIDACION_DE_LISTA_DE_ESPERA])
  })

  it('RF-47.5 · D-25 · sin consentimiento explícito no hay inscripción', () => {
    expect(validarInscripcion(inscripcion({ consent: false })))
      .toEqual([{ name: 'consent', message: 'waitlist.validation.consent_required' }])
  })
})

describe('RF-47.2 · lo que se persiste', () => {
  it('recorta y pone el correo en minúsculas: así la unicidad por correo y propiedad no se burla con mayúsculas', () => {
    expect(normalizarInscripcion(inscripcion())).toEqual({
      propertyId: 'a4700000-0000-4000-8000-000000000001',
      fullName: 'Ana Gómez',
      email: 'ana@ejemplo.com',
      phone: '+57 310 000 0000',
      consent: true,
    })
  })

  it('D-25 · los datos se conservan 5 años desde el consentimiento y después se anonimizan', () => {
    expect(RETENCION_EN_ANIOS).toBe(5)
    expect(fechaDeAnonimizacion('2026-09-10T15:00:00.000Z')).toBe('2031-09-10T15:00:00.000Z')
    expect(VERSION_DE_CONSENTIMIENTO).toMatch(/^\d{4}-\d{2}-v\d+$/)
  })
})
