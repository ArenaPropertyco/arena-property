/**
 * HU-47 · RF-47.2, RF-47.3 · D-24 — qué pasa con una inscripción en la lista de
 * espera.
 *
 * Orquestación pura con puertos inyectados: validar, limitar la tasa por IP y
 * correo, persistir (la base rechaza el segundo intento del mismo correo en la
 * misma propiedad) y enviar el correo de confirmación exactamente una vez
 * (CA-47.3). Un fallo del correo no deshace la inscripción (RF-N.6).
 */

import { clavesDeTasa } from '../contact/limite'
import type { PoliticaDeTasa } from '../contact/limite'
import { normalizarInscripcion, validarInscripcion } from './esquema'
import type { ClaveDeValidacionDeListaDeEspera, InscripcionEnListaDeEspera } from './esquema'

/** D-24 · la misma política que el contacto: tres envíos por cuarto de hora. */
export const POLITICA_DE_LISTA_DE_ESPERA: PoliticaDeTasa = { maximo: 3, ventanaMs: 15 * 60 * 1000 }

export interface PuertosDeListaDeEspera {
  /** Consume cupo para cada clave; `false` si alguna está agotada. */
  admite: (claves: string[]) => boolean
  /** `'duplicada'` cuando ese correo ya estaba inscrito en esa propiedad (CA-47.2). */
  persistir: (inscripcion: InscripcionEnListaDeEspera) => Promise<{ id: string } | 'duplicada'>
  enviarConfirmacion: (inscripcion: InscripcionEnListaDeEspera, registro: { id: string }) => Promise<void>
}

export type ClaveDeErrorDeListaDeEspera
  = | ClaveDeValidacionDeListaDeEspera
    | 'waitlist.errors.rate_limited'
    | 'waitlist.errors.already_enrolled'
    | 'waitlist.errors.save_failed'

export type ResultadoDeInscripcion
  = | { ok: true, id: string, correoEnviado?: false }
    | { ok: false, clave: ClaveDeErrorDeListaDeEspera }

export async function procesarInscripcion(
  inscripcion: InscripcionEnListaDeEspera,
  origen: { ip: string },
  puertos: PuertosDeListaDeEspera,
): Promise<ResultadoDeInscripcion> {
  const errores = validarInscripcion(inscripcion)
  if (errores.length > 0) {
    return { ok: false, clave: errores[0]!.message }
  }

  const limpia = normalizarInscripcion(inscripcion)

  if (!puertos.admite(clavesDeTasa({ ip: origen.ip, email: limpia.email }))) {
    return { ok: false, clave: 'waitlist.errors.rate_limited' }
  }

  const registro = await puertos.persistir(limpia)
  if (registro === 'duplicada') {
    return { ok: false, clave: 'waitlist.errors.already_enrolled' }
  }

  try {
    await puertos.enviarConfirmacion(limpia, registro)
  }
  catch {
    return { ok: true, id: registro.id, correoEnviado: false }
  }

  return { ok: true, id: registro.id }
}
