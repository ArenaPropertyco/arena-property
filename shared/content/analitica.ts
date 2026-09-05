/**
 * HU-00 · RF-00.8 · RT-12 — un evento de `nuxt-gtag` por activación de CTA, con el
 * identificador de la sección de origen tomado del manifiesto (CA-00.5). La vista
 * de página la registra el módulo por su cuenta.
 */

import type { IdDeSeccion, SeccionDeLaHome } from './home'

export const EVENTO_DE_CTA = 'cta_click' as const

export interface ParametrosDeCta {
  section: IdDeSeccion
  destination: string
}

export interface EventoDeCta {
  nombre: typeof EVENTO_DE_CTA
  parametros: ParametrosDeCta
}

export type EnviarEvento = (nombre: typeof EVENTO_DE_CTA, parametros: ParametrosDeCta) => void

/** El evento que produce activar el CTA de una sección; `null` si no tiene CTA. */
export function eventoDeCta(seccion: SeccionDeLaHome): EventoDeCta | null {
  if (!seccion.cta) {
    return null
  }
  return {
    nombre: EVENTO_DE_CTA,
    parametros: { section: seccion.id, destination: seccion.cta.destino },
  }
}

/**
 * Devuelve la función que la página conecta al evento `cta` de cada sección: envía
 * exactamente un evento por activación y dice si lo envió.
 */
export function crearRegistroDeCtas(enviar: EnviarEvento): (seccion: SeccionDeLaHome) => boolean {
  return (seccion) => {
    const evento = eventoDeCta(seccion)
    if (!evento) {
      return false
    }
    enviar(evento.nombre, evento.parametros)
    return true
  }
}
