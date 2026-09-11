import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-47 · RF-47.2, RF-47.3 — envía la inscripción a la ruta Nitro, que valida,
 * limita la tasa (D-24), persiste con la llave de servicio y manda el correo de
 * confirmación. El cliente nunca escribe en `waitlist_entries`.
 */
export function useListaDeEspera() {
  const { locale } = useI18n()

  async function inscribir(inscripcion: InscripcionEnListaDeEspera): Promise<ResultadoDeEscritura & { correoEnviado?: boolean }> {
    try {
      const respuesta = await $fetch<{ id: string, correoEnviado: boolean }>('/api/lista-de-espera', {
        method: 'POST',
        body: { ...inscripcion, locale: locale.value },
      })
      return { ok: true, correoEnviado: respuesta.correoEnviado }
    }
    catch (error) {
      const clave = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
        ?? 'waitlist.errors.save_failed'
      return { ok: false, clave }
    }
  }

  return { inscribir }
}
