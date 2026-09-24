import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import { PROVEEDORES_DE_PAGO, proveedorDe, proveedorManual } from '#shared/payments/pasarela'
import type { PagoPorResolver } from '#shared/payments/pasarela'

/**
 * HU-62 · RF-62.11 · D-10 · RT-01 — el puerto `PaymentProvider`.
 *
 * Toda confirmación de un pago del Propietario pasa por un proveedor que
 * implementa el puerto. Hoy solo existe el manual: la decisión la toma una
 * persona y el proveedor la traduce a la resolución que la base entiende.
 * Integrar una pasarela será añadir otra implementación, no tocar el cobro.
 */

const PAGO: PagoPorResolver = { id: 'pay-1', amount: pesos(50_000), channel: 'manual', provider: null, externalReference: null }

describe('RF-62.11 · el proveedor manual', () => {
  it('declara el canal manual y no tiene nombre de proveedor', () => {
    expect(proveedorManual.channel).toBe('manual')
    expect(proveedorManual.provider).toBeNull()
  })

  it('traduce la aprobación de una persona a un pago confirmado, sin referencia externa', () => {
    expect(proveedorManual.resolve(PAGO, { approved: true })).toEqual({ status: 'confirmed', reason: null, provider: null, externalReference: null })
  })

  it('traduce el rechazo con su motivo; sin motivo no resuelve', () => {
    expect(proveedorManual.resolve(PAGO, { approved: false, reason: 'Comprobante ilegible.' })).toEqual({ status: 'rejected', reason: 'Comprobante ilegible.', provider: null, externalReference: null })
    expect(() => proveedorManual.resolve(PAGO, { approved: false, reason: ' ' })).toThrow(RangeError)
  })

  it('no resuelve un pago de otro canal', () => {
    expect(() => proveedorManual.resolve({ ...PAGO, channel: 'gateway', provider: 'wompi', externalReference: 'TX-1' }, { approved: true })).toThrow(RangeError)
  })
})

describe('RF-62.11 · D-10 · el registro de proveedores', () => {
  it('hoy solo hay un canal servido: el manual', () => {
    expect(Object.keys(PROVEEDORES_DE_PAGO)).toEqual(['manual'])
    expect(proveedorDe('manual')).toBe(proveedorManual)
  })

  it('pedir la pasarela falla con un mensaje claro, en vez de inventar una confirmación', () => {
    expect(() => proveedorDe('gateway')).toThrow(/D-10/)
  })

  it('RT-01 · package.json no gana ninguna dependencia de pasarela', () => {
    const paquete = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { dependencies?: Record<string, string>, devDependencies?: Record<string, string> }
    const nombres = Object.keys({ ...paquete.dependencies, ...paquete.devDependencies })

    expect(nombres.filter(nombre => /wompi|stripe|payu|mercadopago|epayco|paypal/i.test(nombre))).toEqual([])
  })
})
