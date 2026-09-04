/**
 * HU-58 · RF-58.2 — el comprobante de cada abono, en Supabase Storage.
 *
 * Bucket privado y aparte del de medios: un comprobante es un documento del
 * comprador, no una foto del catálogo. La ruta lleva la propiedad como primera
 * carpeta y el plan como segunda, que es de donde las políticas del bucket deciden
 * quién lo lee: el Administrador de la propiedad y el titular del plan.
 */

import { sanearNombreDeArchivo } from '../properties/medios'

export const BUCKET_DE_COMPROBANTES = 'payment-receipts'

export const MIMES_DE_COMPROBANTE: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

/** 10 MiB: una foto de un recibo o un PDF del banco caben de sobra. */
export const TAMANO_MAXIMO_DE_COMPROBANTE = 10 * 1024 * 1024

export const CLAVES_DE_VALIDACION_DE_COMPROBANTE = [
  'payments.validation.receipt_format',
  'payments.validation.receipt_too_large',
  'payments.validation.receipt_empty',
] as const

export type ClaveDeValidacionDeComprobante = typeof CLAVES_DE_VALIDACION_DE_COMPROBANTE[number]

export function validarComprobante(archivo: { mime: string, size: number }): ClaveDeValidacionDeComprobante | null {
  if (!MIMES_DE_COMPROBANTE.includes(archivo.mime)) {
    return 'payments.validation.receipt_format'
  }
  if (archivo.size <= 0) {
    return 'payments.validation.receipt_empty'
  }
  if (archivo.size > TAMANO_MAXIMO_DE_COMPROBANTE) {
    return 'payments.validation.receipt_too_large'
  }
  return null
}

export function rutaDeComprobante(
  propertyId: string,
  planId: string,
  nombre: string,
  identificador: string,
): string {
  const saneado = sanearNombreDeArchivo(nombre)
  const archivo = saneado === '' ? identificador : `${identificador}-${saneado}`

  return `${propertyId}/${planId}/${archivo}`
}
