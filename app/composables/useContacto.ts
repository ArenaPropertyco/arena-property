import type { ContextoDeContacto, SolicitudDeContacto } from '#shared/contact/esquema'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-46 · RF-46.5 y HU-03 · RF-03.4 — envía la solicitud a la ruta Nitro, que
 * valida, limita la tasa (D-24), persiste con la llave de servicio y manda el
 * correo interno. El cliente nunca escribe en `contact_requests`.
 */
export function useContacto() {
  const { locale } = useI18n()

  async function enviar(solicitud: SolicitudDeContacto, contexto: ContextoDeContacto): Promise<ResultadoDeEscritura & { correoEnviado?: boolean }> {
    try {
      const respuesta = await $fetch<{ id: string, correoEnviado: boolean }>('/api/contacto', {
        method: 'POST',
        body: { ...solicitud, contexto, locale: locale.value },
      })
      return { ok: true, correoEnviado: respuesta.correoEnviado }
    }
    catch (error) {
      const clave = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
        ?? 'contact.errors.send_failed'
      return { ok: false, clave }
    }
  }

  return { enviar }
}
