import { describe, expect, it, vi } from 'vitest'
import { procesarContacto } from '#shared/contact/procesar'
import type { PuertosDeContacto } from '#shared/contact/procesar'
import type { SolicitudDeContacto } from '#shared/contact/esquema'

/**
 * HU-46 · RF-46.5 y HU-03 · RF-03.4 — qué pasa con un envío: se valida, se limita,
 * se persiste y se envía el correo interno una sola vez. Los puertos se inyectan:
 * la ruta Nitro pone Supabase y Resend; aquí, dobles.
 */

function solicitud(cambios: Partial<SolicitudDeContacto> = {}): SolicitudDeContacto {
  return {
    firstName: 'Ana',
    lastName: 'Gómez',
    email: 'ana@ejemplo.com',
    phone: '+57 310 000 0000',
    message: 'Quiero conocer el modelo.',
    intent: 'investment',
    propertyType: 'vacation',
    incomeRange: 'over_7m',
    referralCode: null,
    propertyId: null,
    ...cambios,
  }
}

function puertos(cambios: Partial<PuertosDeContacto> = {}): PuertosDeContacto {
  return {
    admite: vi.fn(() => true),
    persistir: vi.fn(async () => ({ id: 'req-1' })),
    enviarCorreo: vi.fn(async () => {}),
    ...cambios,
  }
}

describe('CA-46.2 · un envío válido se persiste y dispara el correo interno una vez', () => {
  it('CA-46.2 · persiste el registro y llama al correo exactamente una vez', async () => {
    const p = puertos()

    const resultado = await procesarContacto(solicitud(), 'general', { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: true, id: 'req-1' })
    expect(p.persistir).toHaveBeenCalledTimes(1)
    expect(p.enviarCorreo).toHaveBeenCalledTimes(1)
    expect(p.enviarCorreo).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@ejemplo.com' }), { id: 'req-1' })
  })

  it('RF-N.6 · si el correo falla, la solicitud ya quedó persistida y el envío no se pierde como error', async () => {
    const p = puertos({
      enviarCorreo: vi.fn(async () => {
        throw new Error('proveedor caído')
      }),
    })

    const resultado = await procesarContacto(solicitud(), 'general', { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: true, id: 'req-1', correoEnviado: false })
    expect(p.persistir).toHaveBeenCalledTimes(1)
  })

  it('D-24 · con el cupo agotado no persiste ni envía', async () => {
    const p = puertos({ admite: vi.fn(() => false) })

    const resultado = await procesarContacto(solicitud(), 'general', { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: false, clave: 'contact.errors.rate_limited' })
    expect(p.persistir).not.toHaveBeenCalled()
    expect(p.enviarCorreo).not.toHaveBeenCalled()
  })

  it('CA-46.1 · un envío inválido devuelve la primera clave de validación y no toca los puertos', async () => {
    const p = puertos()

    const resultado = await procesarContacto(solicitud({ email: 'nada' }), 'general', { ip: '1.1.1.1' }, p)

    expect(resultado).toEqual({ ok: false, clave: 'contact.validation.email_invalid' })
    expect(p.persistir).not.toHaveBeenCalled()
  })
})

describe('CA-03.2 · el contacto desde la ficha queda vinculado a la propiedad', () => {
  it('CA-03.2 · dado un envío válido desde la propiedad P, el registro persistido apunta a P con la intención elegida', async () => {
    const p = puertos()

    await procesarContacto(
      solicitud({ propertyId: 'p-9', intent: 'truly_mine', propertyType: null, incomeRange: null }),
      'property',
      { ip: '1.1.1.1' },
      p,
    )

    expect(p.persistir).toHaveBeenCalledWith(expect.objectContaining({ propertyId: 'p-9', intent: 'truly_mine' }), 'property')
  })
})
