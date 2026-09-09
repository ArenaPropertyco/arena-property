import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { despacharPendientes, POLITICA_DE_REINTENTO } from '#shared/notifications/despacho'
import type { CorreoPendiente, ResumenDeDespacho } from '#shared/notifications/despacho'
import { idiomaDe } from '#shared/notifications/plantillas'
import { esTipoDeNotificacion } from '#shared/notifications/tipos'
import type { CargaDeNotificacion, EventoDeNotificacion } from '#shared/notifications/tipos'
import type { Database } from '#shared/types/database.types'
// Importación explícita: las utilidades de Nitro se autoimportan en tiempo de ejecución,
// pero `tsc` no las ve de un archivo de utils a otro.
import { correoConfigurado, enviarCorreo } from './correo'

/**
 * TR-03 · RF-N.2, RF-N.4, RF-N.6 — lado servidor del canal.
 *
 * `emitirNotificacion` es la puerta para cualquier ruta Nitro que emita: llama a la
 * función idempotente de la base con la llave de servicio. `despacharCorreos` toma
 * los destinatarios con correo pendiente y los entrega a la orquestación pura de
 * `shared/`, que reintenta con espera creciente y nunca lanza hacia el negocio.
 */

/** Cuántos correos se intentan por pasada; el resto espera a la siguiente. */
const LOTE = 50

export async function emitirNotificacion(event: H3Event, evento: EventoDeNotificacion, destinatarios: string[]): Promise<string | null> {
  if (destinatarios.length === 0) {
    return null
  }
  const admin = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await admin.rpc('emitir_notificacion', {
    tipo: evento.kind,
    entidad: evento.entityType,
    entidad_id: evento.entityId,
    // La función admite null; el tipo generado no lo expresa porque el parámetro no lleva valor por omisión.
    propiedad: evento.propertyId as unknown as string,
    carga: evento.payload as never,
    destinatarios,
  })
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'notifications.errors.emit_failed' })
  }
  return data
}

export async function despacharCorreos(event: H3Event): Promise<ResumenDeDespacho & { omitido?: true }> {
  if (!correoConfigurado()) {
    return { enviados: 0, fallidos: 0, agotados: 0, omitido: true }
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const ahora = new Date().toISOString()

  const { data } = await admin
    .from('notification_recipients')
    .select('id, email_attempts, recipient_id, notifications!inner(kind, payload, requires_email), profiles:recipient_id(email, locale)')
    .is('email_sent_at', null)
    .lt('email_attempts', POLITICA_DE_REINTENTO.maximo)
    .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${ahora}`)
    .eq('notifications.requires_email', true)
    .order('created_at', { ascending: true })
    .limit(LOTE)

  const pendientes: CorreoPendiente[] = []
  for (const fila of data ?? []) {
    const notificacion = fila.notifications as unknown as { kind: string, payload: CargaDeNotificacion } | null
    const perfil = fila.profiles as unknown as { email: string | null, locale: string | null } | null
    if (!notificacion || !perfil?.email || !esTipoDeNotificacion(notificacion.kind)) {
      continue
    }
    pendientes.push({
      id: fila.id,
      email: perfil.email,
      locale: idiomaDe(perfil.locale),
      kind: notificacion.kind,
      payload: notificacion.payload ?? {},
      attempts: fila.email_attempts,
    })
  }

  return despacharPendientes(pendientes, {
    enviar: correo => enviarCorreo(correo),
    async marcarEnviado(id) {
      await admin.from('notification_recipients').update({ email_sent_at: new Date().toISOString(), email_last_error: null, email_next_attempt_at: null }).eq('id', id)
    },
    async registrarFallo(id, intento, error, siguiente) {
      await admin.from('notification_recipients').update({ email_attempts: intento, email_last_error: error.slice(0, 500), email_next_attempt_at: siguiente }).eq('id', id)
    },
  })
}
