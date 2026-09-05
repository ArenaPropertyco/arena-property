/**
 * HU-46 · RF-46.5 y HU-03 · RF-03.4 — qué pasa con un envío de contacto.
 *
 * Orquestación pura con puertos inyectados: validar, limitar la tasa (D-24),
 * persistir y enviar el correo interno exactamente una vez (CA-46.2). Un fallo del
 * correo no deshace la solicitud ya guardada (RF-N.6): se informa y se sigue.
 */

import { clavesDeTasa } from './limite'
import { normalizarContacto, validarContacto } from './esquema'
import type { ClaveDeValidacionDeContacto, ContextoDeContacto, SolicitudDeContacto } from './esquema'

export interface PuertosDeContacto {
  /** Consume cupo para cada clave; `false` si alguna está agotada. */
  admite: (claves: string[]) => boolean
  persistir: (solicitud: SolicitudDeContacto, contexto: ContextoDeContacto) => Promise<{ id: string }>
  enviarCorreo: (solicitud: SolicitudDeContacto, registro: { id: string }) => Promise<void>
}

export type ClaveDeErrorDeContacto = ClaveDeValidacionDeContacto | 'contact.errors.rate_limited' | 'contact.errors.send_failed'

export type ResultadoDeContacto
  = | { ok: true, id: string, correoEnviado?: false }
    | { ok: false, clave: ClaveDeErrorDeContacto }

export async function procesarContacto(
  solicitud: SolicitudDeContacto,
  contexto: ContextoDeContacto,
  origen: { ip: string },
  puertos: PuertosDeContacto,
): Promise<ResultadoDeContacto> {
  const errores = validarContacto(solicitud, contexto)
  if (errores.length > 0) {
    return { ok: false, clave: errores[0]!.message }
  }

  const limpia = normalizarContacto(solicitud)

  if (!puertos.admite(clavesDeTasa({ ip: origen.ip, email: limpia.email }))) {
    return { ok: false, clave: 'contact.errors.rate_limited' }
  }

  const registro = await puertos.persistir(limpia, contexto)

  try {
    await puertos.enviarCorreo(limpia, registro)
  }
  catch {
    return { ok: true, id: registro.id, correoEnviado: false }
  }

  return { ok: true, id: registro.id }
}
