import { crearRegistroDeCtas } from '#shared/content/analitica'
import type { SeccionDePagina } from '#shared/content/manifiesto'

/**
 * HU-00 · RF-00.8 · RT-12 — conecta el manifiesto con `nuxt-gtag`: un evento por
 * activación de CTA con la sección de origen (CA-00.5). Sirve a la home y a las
 * subpáginas (HU-41…HU-48); el destino se puede pasar cuando la página lo decide
 * por sesión. El módulo registra la vista de página por su cuenta.
 */
export function useAnaliticaDeCtas() {
  const registrar = crearRegistroDeCtas((nombre, parametros) => {
    useTrackEvent(nombre, parametros)
  })

  return { registrarCta: (seccion: SeccionDePagina, destino?: string) => registrar(seccion, destino) }
}
