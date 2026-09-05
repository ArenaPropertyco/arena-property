import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { ContextoDeContacto, SolicitudDeContacto } from '#shared/contact/esquema'
import { crearLimitador, POLITICA_DE_CONTACTO } from '#shared/contact/limite'
import type { PuertosDeContacto } from '#shared/contact/procesar'
import type { Database } from '#shared/types/database.types'

/**
 * HU-46 · RF-46.5 y HU-03 · RF-03.4 — los puertos reales de `procesarContacto`:
 * el límite de tasa vive en memoria del proceso (D-24), la persistencia usa la
 * llave de servicio y el correo sale por Resend. La orquestación es la función
 * pura de `shared/`, probada sin nada de esto.
 */

// Un limitador por proceso: en Netlify cada función lo arranca vacío, lo que
// basta para frenar ráfagas; un abuso sostenido lo verá la auditoría de `ip_hash`.
const limitador = crearLimitador(POLITICA_DE_CONTACTO)

function huellaDeIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 32)
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, caracter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[caracter] ?? caracter))
}

export function puertosDeContacto(event: H3Event, origen: { ip: string, locale: 'es' | 'en' }): PuertosDeContacto {
  const admin = serverSupabaseServiceRole<Database>(event)

  return {
    admite: claves => claves.every(clave => limitador.admite(clave)),

    async persistir(solicitud: SolicitudDeContacto, contexto: ContextoDeContacto) {
      const { data, error } = await admin
        .from('contact_requests')
        .insert({
          property_id: contexto === 'property' ? solicitud.propertyId ?? null : null,
          first_name: solicitud.firstName,
          last_name: solicitud.lastName,
          email: solicitud.email,
          phone: solicitud.phone,
          message: solicitud.message,
          intent: solicitud.intent ?? 'investment',
          property_type: solicitud.propertyType ?? null,
          income_range: solicitud.incomeRange ?? null,
          referral_code: solicitud.referralCode ?? null,
          locale: origen.locale,
          ip_hash: huellaDeIp(origen.ip),
        })
        .select('id')
        .single()

      if (error || !data) {
        throw createError({ statusCode: 500, statusMessage: 'contact.errors.send_failed' })
      }
      return { id: data.id }
    },

    async enviarCorreo(solicitud, registro) {
      const lineas = [
        `Nombre: ${solicitud.firstName} ${solicitud.lastName}`,
        `Correo: ${solicitud.email}`,
        `Teléfono: ${solicitud.phone}`,
        `Intención: ${solicitud.intent ?? ''}`,
        solicitud.propertyType ? `Tipo de propiedad: ${solicitud.propertyType}` : null,
        solicitud.incomeRange ? `Renta familiar: ${solicitud.incomeRange}` : null,
        solicitud.propertyId ? `Propiedad: ${solicitud.propertyId}` : null,
        solicitud.referralCode ? `Código de referido: ${solicitud.referralCode}` : null,
        '',
        solicitud.message,
        '',
        `Solicitud ${registro.id}`,
      ].filter((linea): linea is string => linea !== null)

      const { enviado } = await enviarCorreoInterno({
        asunto: `Contacto web · ${solicitud.firstName} ${solicitud.lastName}`,
        texto: lineas.join('\n'),
        html: `<pre style="font-family:inherit">${escapar(lineas.join('\n'))}</pre>`,
        responderA: solicitud.email,
      })

      if (enviado) {
        await admin.from('contact_requests').update({ email_sent_at: new Date().toISOString() }).eq('id', registro.id)
      }
      else {
        // Sin proveedor configurado no hay envío; la solicitud queda y se avisa (RF-N.6).
        throw new Error('Correo interno no configurado.')
      }
    },
  }
}
