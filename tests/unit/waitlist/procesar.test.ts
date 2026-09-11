import { describe, expect, it, vi } from 'vitest'
import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'
import { POLITICA_DE_LISTA_DE_ESPERA, procesarInscripcion } from '#shared/waitlist/procesar'
import type { PuertosDeListaDeEspera } from '#shared/waitlist/procesar'

/**
 * HU-47 · RF-47.2, RF-47.3 · D-24 — qué pasa con una inscripción: se valida, se
 * limita la tasa, se persiste una sola vez por correo y propiedad y se manda
 * exactamente un correo de confirmación. Los puertos se inyectan.
 */

function inscripcion(cambios: Partial<InscripcionEnListaDeEspera> = {}): InscripcionEnListaDeEspera {
  return {
    propertyId: 'a4700000-0000-4000-8000-000000000001',
    fullName: 'Ana Gómez',
    email: 'ana@ejemplo.com',
    phone: '+57 310 000 0000',
    consent: true,
    ...cambios,
  }
}

function puertos(cambios: Partial<PuertosDeListaDeEspera> = {}): PuertosDeListaDeEspera {
  return {
    admite: vi.fn(() => true),
    persistir: vi.fn(async () => ({ id: 'w-1' })),
    enviarConfirmacion: vi.fn(async () => {}),
    ...cambios,
  }
}

describe('CA-47.3 · una inscripción válida se persiste y dispara un solo correo', () => {
  it('CA-47.3 · persiste una vez y confirma exactamente una vez', async () => {
    const p = puertos()

    const resultado = await procesarInscripcion(inscripcion(), { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: true, id: 'w-1' })
    expect(p.persistir).toHaveBeenCalledTimes(1)
    expect(p.enviarConfirmacion).toHaveBeenCalledTimes(1)
    expect(p.enviarConfirmacion).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@ejemplo.com' }), { id: 'w-1' })
  })

  it('RF-N.6 · si el correo falla, la inscripción ya quedó y se informa sin error', async () => {
    const p = puertos({
      enviarConfirmacion: vi.fn(async () => {
        throw new Error('proveedor caído')
      }),
    })

    const resultado = await procesarInscripcion(inscripcion(), { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: true, id: 'w-1', correoEnviado: false })
  })
})

describe('CA-47.2 · un correo no se inscribe dos veces en la misma propiedad', () => {
  it('CA-47.2 · el duplicado se rechaza con su clave traducible y no manda correo', async () => {
    const p = puertos({ persistir: vi.fn(async () => 'duplicada' as const) })

    const resultado = await procesarInscripcion(inscripcion(), { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: false, clave: 'waitlist.errors.already_enrolled' })
    expect(p.enviarConfirmacion).not.toHaveBeenCalled()
  })
})

describe('D-24 · límite de tasa y validación antes de tocar la base', () => {
  it('D-24 · con el cupo agotado no persiste ni envía', async () => {
    const p = puertos({ admite: vi.fn(() => false) })

    const resultado = await procesarInscripcion(inscripcion(), { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: false, clave: 'waitlist.errors.rate_limited' })
    expect(p.persistir).not.toHaveBeenCalled()
    expect(POLITICA_DE_LISTA_DE_ESPERA.maximo).toBeGreaterThan(0)
  })

  it('D-24 · el cupo se consume por IP y por correo a la vez', async () => {
    const p = puertos()
    await procesarInscripcion(inscripcion(), { ip: '9.9.9.9' }, p)
    expect(p.admite).toHaveBeenCalledWith(['ip:9.9.9.9', 'email:ana@ejemplo.com'])
  })

  it('RF-47.1 · una inscripción inválida devuelve la primera clave y no toca los puertos', async () => {
    const p = puertos()

    const resultado = await procesarInscripcion(inscripcion({ email: 'nada' }), { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: false, clave: 'waitlist.validation.email_invalid' })
    expect(p.persistir).not.toHaveBeenCalled()
  })
})
