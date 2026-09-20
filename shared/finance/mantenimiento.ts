/**
 * HU-27 · RF-27.1…RF-27.3 — el gasto de mantenimiento.
 *
 * No es un segundo modelo: **es** un gasto de HU-23 (RF-27.2), con las mismas
 * cuotas, la misma anulación y el mismo lugar en el estado de cuenta. Lo único
 * que añade es a qué ítem del inventario pertenece, si a alguno, y su factura
 * adjunta. Desde el ítem se consulta su historial (RF-27.3): los gastos que le
 * fueron asociados, y ninguno de los generales.
 *
 * La factura vive en un bucket privado propio, con la propiedad como primera
 * carpeta: de ahí deciden las políticas quién la lee (CA-27.3).
 */

import { sanearNombreDeArchivo } from '../properties/medios'
import type { MovimientoListado } from './vistas'

export const BUCKET_DE_ADJUNTOS = 'movement-attachments'

export const MIMES_DE_ADJUNTO: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

/** 10 MiB: la foto de una factura o el PDF del proveedor caben de sobra. */
export const TAMANO_MAXIMO_DE_ADJUNTO = 10 * 1024 * 1024

export const CLAVES_DE_VALIDACION_DE_ADJUNTO = [
  'finance.validation.attachment_format',
  'finance.validation.attachment_empty',
  'finance.validation.attachment_too_large',
] as const

export type ClaveDeValidacionDeAdjunto = typeof CLAVES_DE_VALIDACION_DE_ADJUNTO[number]

/** CA-27.3 · RF-27.1 · qué archivo se acepta como factura. */
export function validarAdjunto(archivo: { mime: string, size: number }): ClaveDeValidacionDeAdjunto | null {
  if (!MIMES_DE_ADJUNTO.includes(archivo.mime)) {
    return 'finance.validation.attachment_format'
  }
  if (archivo.size <= 0) {
    return 'finance.validation.attachment_empty'
  }
  if (archivo.size > TAMANO_MAXIMO_DE_ADJUNTO) {
    return 'finance.validation.attachment_too_large'
  }
  return null
}

/** CA-27.3 · la ruta en el bucket: propiedad primero, que es de donde la política lee. */
export function rutaDeAdjunto(propertyId: string, nombre: string, identificador: string): string {
  const saneado = sanearNombreDeArchivo(nombre)
  const archivo = saneado === '' ? identificador : `${identificador}-${saneado}`
  return `${propertyId}/${archivo}`
}

/** Lo mínimo de un ítem que el formulario de gasto necesita para asociarlo (RF-27.1). */
export interface ItemParaGasto {
  id: string
  name: string
  /** RF-26.2 · dado de baja; un mantenimiento tardío sobre él sigue siendo válido. */
  retired: boolean
}

/** RF-27.1 · RF-27.2 · un gasto es de mantenimiento si se marcó así o si cuelga de un ítem. */
export function esMantenimiento(movimiento: Pick<MovimientoListado, 'maintenance' | 'inventoryItemId'>): boolean {
  return movimiento.maintenance || movimiento.inventoryItemId !== null
}

function ordenarPorCausacion(movimientos: readonly MovimientoListado[]): MovimientoListado[] {
  return [...movimientos].sort((a, b) => b.incurredOn.localeCompare(a.incurredOn) || b.createdAt.localeCompare(a.createdAt))
}

/** CA-27.2 · RF-27.3 · el historial de un ítem: sus mantenimientos, del más reciente al más antiguo. */
export function mantenimientosDe(movimientos: readonly MovimientoListado[], itemId: string): MovimientoListado[] {
  return ordenarPorCausacion(movimientos.filter(movimiento => movimiento.inventoryItemId === itemId))
}

/** CA-27.2 · los mantenimientos de la propiedad en general, sin ítem. */
export function mantenimientosGenerales(movimientos: readonly MovimientoListado[]): MovimientoListado[] {
  return ordenarPorCausacion(movimientos.filter(movimiento => esMantenimiento(movimiento) && movimiento.inventoryItemId === null))
}

/** RF-28.1 · todos los mantenimientos de la propiedad, con o sin ítem. */
export function mantenimientosDeLaPropiedad(movimientos: readonly MovimientoListado[]): MovimientoListado[] {
  return ordenarPorCausacion(movimientos.filter(esMantenimiento))
}
