import { esCodigoReferidoValido, normalizarCodigoReferido } from '#shared/identity/registro'
import { REFERRAL_QUERY_PARAM } from '#shared/referrals/code'
import type { Database } from '#shared/types/database.types'

/**
 * HU-51 · RF-51.1, RF-51.2, HU-46 · RF-46.6 y HU-03 · RF-03.5 — el código de
 * referido con el que llegó el visitante, para prellenar registro y contacto.
 *
 * Viene del enlace (`?ref=`) o de la cookie `arena_ref` que ya usan HU-04 y
 * HU-61. Si llega por enlace se deja en la cookie: la atribución sobrevive a la
 * navegación sin que cada página tenga que arrastrar el parámetro. Solo se
 * conserva si tiene formato plausible; uno inválido no bloquea nada, se ignora
 * (RF-51.6).
 *
 * Además, el clic se registra en el servidor contra un identificador anónimo de
 * navegador (`arena_ref_v`), que no identifica a nadie: es lo que permite que la
 * ventana de 90 días (D-03) se mida contra una fecha que el cliente no escribe.
 */
const NOVENTA_DIAS = 60 * 60 * 24 * 90

export function useCodigoDeReferido() {
  const ruta = useRoute()
  const cookie = useCookie<string | null>('arena_ref', { maxAge: NOVENTA_DIAS, sameSite: 'lax' })
  const visitante = useCookie<string | null>('arena_ref_v', { maxAge: NOVENTA_DIAS, sameSite: 'lax' })

  const delEnlace = typeof ruta.query[REFERRAL_QUERY_PARAM] === 'string'
    ? normalizarCodigoReferido(ruta.query[REFERRAL_QUERY_PARAM] as string)
    : null

  if (delEnlace && esCodigoReferidoValido(delEnlace) && cookie.value !== delEnlace) {
    cookie.value = delEnlace
  }

  const codigo = computed(() => {
    const candidato = normalizarCodigoReferido(delEnlace ?? cookie.value)
    return candidato && esCodigoReferidoValido(candidato) ? candidato : null
  })

  /**
   * RF-51.1 · deja constancia del clic. Solo en el navegador y solo cuando el
   * código llega por enlace: recargar una página no es un clic nuevo. Un fallo de
   * red aquí no puede romper la navegación del visitante.
   */
  async function registrarClic(): Promise<void> {
    if (!import.meta.client || !delEnlace || !esCodigoReferidoValido(delEnlace)) {
      return
    }
    if (!visitante.value) {
      visitante.value = crypto.randomUUID()
    }
    try {
      const client = useSupabaseClient<Database>()
      await client.rpc('record_referral_click', { visitor: visitante.value, referral_code: delEnlace })
    }
    catch {
      // RF-51.6 · el programa de referidos nunca bloquea al visitante.
    }
  }

  return { codigo, visitante, registrarClic }
}
