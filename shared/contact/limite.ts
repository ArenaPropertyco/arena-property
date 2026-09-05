/**
 * D-24 · límite de tasa de los formularios públicos, por IP y por correo.
 *
 * Ventana deslizante en memoria: basta para que el envío de correo no sea un vector
 * de abuso sin sumar infraestructura. El reloj se inyecta para probarlo sin esperar.
 */

import { normalizarEmail } from '../identity/registro'

export interface PoliticaDeTasa {
  /** Envíos admitidos por clave dentro de la ventana. */
  maximo: number
  ventanaMs: number
}

/** Tres envíos por cuarto de hora: un visitante real no escribe más; un robot, sí. */
export const POLITICA_DE_CONTACTO: PoliticaDeTasa = { maximo: 3, ventanaMs: 15 * 60 * 1000 }

export interface Limitador {
  /** Registra el intento y dice si cabe en la ventana. */
  admite: (clave: string) => boolean
}

export function crearLimitador(politica: PoliticaDeTasa, ahora: () => number = () => Date.now()): Limitador {
  const intentos = new Map<string, number[]>()

  return {
    admite(clave) {
      const momento = ahora()
      const vigentes = (intentos.get(clave) ?? []).filter(instante => momento - instante < politica.ventanaMs)

      if (vigentes.length >= politica.maximo) {
        intentos.set(clave, vigentes)
        return false
      }

      intentos.set(clave, [...vigentes, momento])
      return true
    },
  }
}

/** Un envío consume cupo en las dos claves a la vez: por IP y por correo. */
export function clavesDeTasa(origen: { ip: string, email: string }): string[] {
  return [`ip:${origen.ip}`, `email:${normalizarEmail(origen.email)}`]
}
