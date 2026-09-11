import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import { crearLimitador } from '#shared/contact/limite'
import { rutaDePropiedad } from '#shared/content/rutas'
import { POLITICA_DE_REINTENTO, siguienteIntento } from '#shared/notifications/despacho'
import type { ResumenDeDespacho } from '#shared/notifications/despacho'
import { htmlDe, idiomaDe } from '#shared/notifications/plantillas'
import type { Database } from '#shared/types/database.types'
import { plantillaDeListaDeEspera } from '#shared/waitlist/correos'
import { fechaDeAnonimizacion, VERSION_DE_CONSENTIMIENTO } from '#shared/waitlist/esquema'
import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'
import { POLITICA_DE_LISTA_DE_ESPERA } from '#shared/waitlist/procesar'
import type { PuertosDeListaDeEspera } from '#shared/waitlist/procesar'
// Importación explícita: las utilidades de Nitro se autoimportan en tiempo de
// ejecución, pero `tsc` no las ve de un archivo de utils a otro.
import { correoConfigurado, enviarCorreo } from './correo'

/**
 * HU-47 · RF-47.2…RF-47.4 · D-24 — los puertos reales de `procesarInscripcion` y
 * el despacho de los avisos de liberación.
 *
 * El límite de tasa vive en memoria del proceso (D-24), la persistencia usa la
 * llave de servicio y los correos salen por Resend. La orquestación es la función
 * pura de `shared/`, probada sin nada de esto.
 */

const limitador = crearLimitador(POLITICA_DE_LISTA_DE_ESPERA)

/** Cuántos avisos se intentan por pasada; el resto espera a la siguiente. */
const LOTE = 50

/** Código de Postgres para una violación de unicidad: el correo ya estaba en la lista. */
const UNICIDAD_VIOLADA = '23505'

function huellaDeIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

export function puertosDeListaDeEspera(event: H3Event, origen: { ip: string, locale: 'es' | 'en' }): PuertosDeListaDeEspera {
  const admin = serverSupabaseServiceRole<Database>(event)

  return {
    admite: claves => claves.every(clave => limitador.admite(clave)),

    async persistir(inscripcion: InscripcionEnListaDeEspera) {
      // D-25 · el consentimiento es ahora, y la retención sale de la misma
      // función pura que prueba `shared/waitlist`: cinco años desde ese instante.
      const consentimientoEn = new Date().toISOString()
      const { data, error } = await admin
        .from('waitlist_entries')
        .insert({
          property_id: inscripcion.propertyId,
          full_name: inscripcion.fullName,
          email: inscripcion.email,
          phone: inscripcion.phone,
          locale: origen.locale,
          consent_at: consentimientoEn,
          consent_version: VERSION_DE_CONSENTIMIENTO,
          retain_until: fechaDeAnonimizacion(consentimientoEn),
          ip_hash: huellaDeIp(origen.ip),
        })
        .select('id')
        .single()

      if (error?.code === UNICIDAD_VIOLADA) {
        return 'duplicada'
      }
      if (error || !data) {
        throw createError({ statusCode: 500, statusMessage: 'waitlist.errors.save_failed' })
      }
      return { id: data.id }
    },

    async enviarConfirmacion(inscripcion, registro) {
      if (!correoConfigurado()) {
        // Sin proveedor no hay envío; la inscripción queda y se avisa (RF-N.6).
        throw new Error('Correo no configurado.')
      }
      const propiedad = await admin.from('properties').select('name').eq('id', inscripcion.propertyId).maybeSingle()
      const plantilla = plantillaDeListaDeEspera('confirmation', origen.locale, {
        full_name: inscripcion.fullName,
        property_name: propiedad.data?.name ?? '',
      })
      await enviarCorreo({ to: inscripcion.email, subject: plantilla.asunto, text: plantilla.texto, html: htmlDe(plantilla.texto) })
      await admin.from('waitlist_entries').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', registro.id)
    },
  }
}

/**
 * RF-47.4 · CA-47.4 — entrega los avisos que el disparador dejó pedidos, en
 * orden de inscripción. Un fallo del proveedor no lanza: se anota con su
 * siguiente intento, como en TR-03, y la fila sigue pendiente.
 */
export async function despacharAvisosDeListaDeEspera(event: H3Event): Promise<ResumenDeDespacho & { omitido?: true }> {
  if (!correoConfigurado()) {
    return { enviados: 0, fallidos: 0, agotados: 0, omitido: true }
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const config = useRuntimeConfig()
  const base = (config.public as { site?: { url?: string } }).site?.url ?? ''
  const ahora = new Date().toISOString()

  const { data } = await admin
    .from('waitlist_entries')
    .select('id, full_name, email, locale, email_attempts, properties!inner(name, slug)')
    .not('notify_requested_at', 'is', null)
    .is('notified_at', null)
    .is('anonymized_at', null)
    .lt('email_attempts', POLITICA_DE_REINTENTO.maximo)
    .or(`email_next_attempt_at.is.null,email_next_attempt_at.lte.${ahora}`)
    .order('created_at', { ascending: true })
    .limit(LOTE)

  const resumen: ResumenDeDespacho = { enviados: 0, fallidos: 0, agotados: 0 }

  for (const fila of data ?? []) {
    const propiedad = fila.properties as unknown as { name: string, slug: string } | null
    const plantilla = plantillaDeListaDeEspera('release', idiomaDe(fila.locale), {
      full_name: fila.full_name,
      property_name: propiedad?.name ?? '',
      property_url: propiedad ? `${base}${rutaDePropiedad(propiedad.slug)}` : base,
    })
    try {
      await enviarCorreo({ to: fila.email, subject: plantilla.asunto, text: plantilla.texto, html: htmlDe(plantilla.texto) })
      await admin.from('waitlist_entries').update({ notified_at: new Date().toISOString(), email_last_error: null, email_next_attempt_at: null }).eq('id', fila.id)
      resumen.enviados += 1
    }
    catch (error) {
      const intento = fila.email_attempts + 1
      const siguiente = siguienteIntento(intento, new Date())
      await admin.from('waitlist_entries').update({
        email_attempts: intento,
        email_last_error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
        email_next_attempt_at: siguiente?.toISOString() ?? null,
      }).eq('id', fila.id)
      if (siguiente) {
        resumen.fallidos += 1
      }
      else {
        resumen.agotados += 1
      }
    }
  }

  return resumen
}
