import { describe, expect, it } from 'vitest'
import {
  BUCKET_DE_COMPROBANTES,
  MIMES_DE_COMPROBANTE,
  TAMANO_MAXIMO_DE_COMPROBANTE,
  rutaDeComprobante,
  validarComprobante,
} from '#shared/payments/comprobantes'

/**
 * HU-58 · RF-58.2 — el comprobante adjunto en Supabase Storage.
 *
 * La ruta lleva la propiedad como primera carpeta y el plan como segunda: de ahí
 * deciden las políticas del bucket quién puede leerlo, igual que en los medios.
 */

const PROPIEDAD = 'a1000000-0000-4000-8000-000000000001'
const PLAN = 'c1000000-0000-4000-8000-000000000001'

describe('RF-58.2 · el bucket de comprobantes', () => {
  it('tiene nombre propio y no reutiliza el de los medios de la propiedad', () => {
    expect(BUCKET_DE_COMPROBANTES).toBe('payment-receipts')
  })

  it('admite imágenes y PDF, y pesa como máximo 10 MiB', () => {
    expect(MIMES_DE_COMPROBANTE).toEqual(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    expect(TAMANO_MAXIMO_DE_COMPROBANTE).toBe(10 * 1024 * 1024)
  })

  it('un comprobante válido no produce error', () => {
    expect(validarComprobante({ mime: 'application/pdf', size: 1024 })).toBeNull()
  })

  it('CA-58.6 · un archivo con formato ajeno, vacío o demasiado pesado se rechaza', () => {
    expect(validarComprobante({ mime: 'video/mp4', size: 1024 })).toBe('payments.validation.receipt_format')
    expect(validarComprobante({ mime: 'image/png', size: 0 })).toBe('payments.validation.receipt_empty')
    expect(validarComprobante({ mime: 'image/png', size: TAMANO_MAXIMO_DE_COMPROBANTE + 1 }))
      .toBe('payments.validation.receipt_too_large')
  })
})

describe('RF-58.2 · la ruta del comprobante en Storage', () => {
  it('lleva propiedad y plan como carpetas, y un identificador que evita colisiones', () => {
    const ruta = rutaDeComprobante(PROPIEDAD, PLAN, 'Comprobante Banco.PDF', 'x1')

    expect(ruta).toBe(`${PROPIEDAD}/${PLAN}/x1-comprobante-banco.pdf`)
  })

  it('sanea el nombre: sin espacios, acentos ni mayúsculas', () => {
    expect(rutaDeComprobante(PROPIEDAD, PLAN, 'Pago Jesús #2.png', 'x2'))
      .toBe(`${PROPIEDAD}/${PLAN}/x2-pago-jesus-2.png`)
  })
})
