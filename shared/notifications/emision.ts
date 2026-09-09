/**
 * TR-03 · RF-N.4 — idempotencia de emisión.
 *
 * La clave de un evento es su tipo más su entidad de origen. Reprocesar el mismo
 * evento no puede duplicar notificaciones: la base lo garantiza con claves únicas
 * (`notifications` por evento, `notification_recipients` por destinatario) y
 * `on conflict do nothing`; aquí vive la misma regla en memoria para probarla y
 * para que cualquier emisor pueda razonar con ella.
 */

import type { EventoDeNotificacion } from './tipos'

export function claveDeEvento(evento: Pick<EventoDeNotificacion, 'kind' | 'entityType' | 'entityId'>): string {
  return `${evento.kind}:${evento.entityType}:${evento.entityId}`
}

export interface RegistroDeEmisiones {
  /** Registra el evento y devuelve solo los destinatarios que aún no lo tenían. */
  emitir: (evento: EventoDeNotificacion, destinatarios: readonly string[]) => string[]
  destinatariosDe: (evento: EventoDeNotificacion) => string[]
}

export function crearRegistroDeEmisiones(): RegistroDeEmisiones {
  const emitidas = new Map<string, Set<string>>()

  return {
    emitir(evento, destinatarios) {
      const clave = claveDeEvento(evento)
      const existentes = emitidas.get(clave) ?? new Set<string>()
      const nuevos: string[] = []

      for (const destinatario of destinatarios) {
        if (!existentes.has(destinatario)) {
          existentes.add(destinatario)
          nuevos.push(destinatario)
        }
      }

      emitidas.set(clave, existentes)
      return nuevos
    },
    destinatariosDe(evento) {
      return [...(emitidas.get(claveDeEvento(evento)) ?? [])]
    },
  }
}
