import { crearRegistroDeCtas } from '#shared/content/analitica'
import type { SeccionDeLaHome } from '#shared/content/home'

/**
 * HU-00 · RF-00.8 · RT-12 — conecta el manifiesto con `nuxt-gtag`: un evento por
 * activación de CTA con la sección de origen (CA-00.5). El módulo registra la vista
 * de página por su cuenta; si no hay identificador configurado, no envía nada.
 */
export function useAnaliticaDeCtas() {
  const registrar = crearRegistroDeCtas((nombre, parametros) => {
    useTrackEvent(nombre, parametros)
  })

  return { registrarCta: (seccion: SeccionDeLaHome) => registrar(seccion) }
}
