/**
 * TR-03 · RF-N.5 — la bandeja como funciones puras: contador de no leídas, marcar
 * una o todas, y filtro por propiedad y tipo. La bandeja es siempre la de una sola
 * cuenta: el estado leído es por destinatario (RF-N.1), así que marcar aquí nunca
 * toca a nadie más.
 */

import type { CargaDeNotificacion, TipoDeNotificacion } from './tipos'

export interface ItemDeBandeja {
  /** Identificador de la fila del destinatario: es lo que se marca como leído. */
  id: string
  notificationId: string
  kind: TipoDeNotificacion
  propertyId: string | null
  propertyName: string | null
  payload: CargaDeNotificacion
  createdAt: string
  readAt: string | null
}

export function noLeidas(items: readonly ItemDeBandeja[]): number {
  return items.filter(item => item.readAt === null).length
}

/** CA-N.4 · marca una sola; si ya estaba leída conserva su fecha original. */
export function marcarLeida(items: readonly ItemDeBandeja[], id: string, ahora: string): ItemDeBandeja[] {
  return items.map(item => item.id === id && item.readAt === null ? { ...item, readAt: ahora } : item)
}

/** RF-30.2 · marca todas las pendientes de esta bandeja. */
export function marcarTodasLeidas(items: readonly ItemDeBandeja[], ahora: string): ItemDeBandeja[] {
  return items.map(item => item.readAt === null ? { ...item, readAt: ahora } : item)
}

export interface FiltroDeBandeja {
  propertyId: string | null
  kind: TipoDeNotificacion | null
  soloNoLeidas: boolean
}

export function filtroDeBandejaVacio(): FiltroDeBandeja {
  return { propertyId: null, kind: null, soloNoLeidas: false }
}

export function hayFiltroDeBandejaActivo(filtro: FiltroDeBandeja): boolean {
  return filtro.propertyId !== null || filtro.kind !== null || filtro.soloNoLeidas
}

/** RF-N.5 · CA-30.2 · los criterios se combinan. */
export function filtrarBandeja(items: readonly ItemDeBandeja[], filtro: FiltroDeBandeja): ItemDeBandeja[] {
  return items.filter(item =>
    (filtro.propertyId === null || item.propertyId === filtro.propertyId)
    && (filtro.kind === null || item.kind === filtro.kind)
    && (!filtro.soloNoLeidas || item.readAt === null))
}

/** Las propiedades presentes en la bandeja, para el selector, sin repetir. */
export function propiedadesDe(items: readonly ItemDeBandeja[]): { id: string, name: string }[] {
  const vistas = new Map<string, string>()
  for (const item of items) {
    if (item.propertyId && !vistas.has(item.propertyId)) {
      vistas.set(item.propertyId, item.propertyName ?? item.propertyId)
    }
  }
  return [...vistas].map(([id, name]) => ({ id, name }))
}
