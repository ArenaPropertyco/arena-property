import { describe, expect, it, vi } from 'vitest'
import { despacharPendientes, POLITICA_DE_REINTENTO, siguienteIntento } from '#shared/notifications/despacho'
import type { CorreoPendiente, PuertosDeDespacho } from '#shared/notifications/despacho'

/**
 * TR-03 · RF-N.2 y RF-N.6 — el correo sale aparte de la operación de negocio.
 * Un fallo del proveedor no revierte nada: queda registrado y se reintenta con
 * espera creciente hasta agotar la política.
 */

function pendiente(cambios: Partial<CorreoPendiente> = {}): CorreoPendiente {
  return {
    id: 'r1',
    email: 'ana@ejemplo.com',
    locale: 'es',
    kind: 'calendar_activated',
    payload: { property_name: 'Invictvs', fraction_number: 3 },
    attempts: 0,
    ...cambios,
  }
}

function puertos(cambios: Partial<PuertosDeDespacho> = {}): PuertosDeDespacho {
  return {
    enviar: vi.fn(async () => {}),
    marcarEnviado: vi.fn(async () => {}),
    registrarFallo: vi.fn(async () => {}),
    ...cambios,
  }
}

const AHORA = new Date('2026-09-08T10:00:00Z')

describe('RF-N.2 · envío con plantilla en el idioma del destinatario', () => {
  it('envía un correo por pendiente y lo marca enviado', async () => {
    const p = puertos()

    const resultado = await despacharPendientes([pendiente(), pendiente({ id: 'r2', locale: 'en', email: 'luis@ejemplo.com' })], p, () => AHORA)

    expect(resultado).toEqual({ enviados: 2, fallidos: 0, agotados: 0 })
    expect(p.enviar).toHaveBeenCalledTimes(2)
    const [primero, segundo] = (p.enviar as ReturnType<typeof vi.fn>).mock.calls.map(llamada => llamada[0] as { to: string, subject: string, text: string })
    expect(primero!.to).toBe('ana@ejemplo.com')
    expect(primero!.subject).not.toBe(segundo!.subject)
    expect(primero!.text).toContain('Invictvs')
    expect(p.marcarEnviado).toHaveBeenCalledWith('r1')
  })
})

describe('CA-N.6 · fallo del proveedor de correo', () => {
  it('CA-N.6 · el fallo queda registrado con su siguiente intento y no se lanza nada hacia el negocio', async () => {
    const p = puertos({
      enviar: vi.fn(async () => {
        throw new Error('502 del proveedor')
      }),
    })

    const resultado = await despacharPendientes([pendiente()], p, () => AHORA)

    expect(resultado).toEqual({ enviados: 0, fallidos: 1, agotados: 0 })
    expect(p.marcarEnviado).not.toHaveBeenCalled()
    expect(p.registrarFallo).toHaveBeenCalledWith('r1', 1, '502 del proveedor', siguienteIntento(1, AHORA)?.toISOString() ?? null)
  })

  it('RF-N.6 · un fallo en un pendiente no impide despachar los demás', async () => {
    const enviar = vi.fn(async (correo: { to: string }) => {
      if (correo.to === 'ana@ejemplo.com') {
        throw new Error('rebote')
      }
    })
    const p = puertos({ enviar })

    const resultado = await despacharPendientes([pendiente(), pendiente({ id: 'r2', email: 'luis@ejemplo.com' })], p, () => AHORA)

    expect(resultado).toEqual({ enviados: 1, fallidos: 1, agotados: 0 })
  })

  it('la espera entre intentos crece y se agota al máximo de la política', () => {
    const primero = siguienteIntento(1, AHORA)!
    const segundo = siguienteIntento(2, AHORA)!
    expect(segundo.getTime() - AHORA.getTime()).toBe(2 * (primero.getTime() - AHORA.getTime()))
    expect(siguienteIntento(POLITICA_DE_REINTENTO.maximo, AHORA)).toBeNull()
  })

  it('al agotar los intentos se registra como agotado y deja de reintentarse', async () => {
    const p = puertos({
      enviar: vi.fn(async () => {
        throw new Error('caído')
      }),
    })

    const resultado = await despacharPendientes([pendiente({ attempts: POLITICA_DE_REINTENTO.maximo - 1 })], p, () => AHORA)

    expect(resultado).toEqual({ enviados: 0, fallidos: 0, agotados: 1 })
    expect(p.registrarFallo).toHaveBeenCalledWith('r1', POLITICA_DE_REINTENTO.maximo, 'caído', null)
  })
})
