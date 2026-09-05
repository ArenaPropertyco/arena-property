import { esCodigoReferidoValido, normalizarCodigoReferido } from '#shared/identity/registro'

/**
 * HU-51 · RF-51.2, HU-46 · RF-46.6 y HU-03 · RF-03.5 — el código de referido con el
 * que llegó el visitante, para prellenar registro y contacto.
 *
 * Viene del enlace (`?ref=`) o de la cookie `arena_ref` que ya usan HU-04 y HU-61.
 * Si llega por enlace se deja en la cookie: la atribución sobrevive a la navegación
 * sin que cada página tenga que arrastrar el parámetro. Solo se conserva si tiene
 * formato plausible; uno inválido no bloquea nada, se ignora (RF-51.6).
 */
export function useCodigoDeReferido() {
  const ruta = useRoute()
  const cookie = useCookie<string | null>('arena_ref', { maxAge: 60 * 60 * 24 * 90, sameSite: 'lax' })

  const delEnlace = typeof ruta.query.ref === 'string' ? normalizarCodigoReferido(ruta.query.ref) : null
  if (delEnlace && esCodigoReferidoValido(delEnlace) && cookie.value !== delEnlace) {
    cookie.value = delEnlace
  }

  const codigo = computed(() => {
    const candidato = normalizarCodigoReferido(delEnlace ?? cookie.value)
    return candidato && esCodigoReferidoValido(candidato) ? candidato : null
  })

  return { codigo }
}
