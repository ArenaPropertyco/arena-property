/**
 * TR-03 · RF-N.2 y RF-N.6 — despacho del correo, aparte de la operación de negocio.
 *
 * La notificación in-app ya existe cuando esto corre; aquí solo se intenta el correo
 * de cada destinatario pendiente. Un fallo del proveedor no lanza: se registra con
 * su siguiente intento y se sigue con el resto (CA-N.6). La espera crece por
 * intento y, agotada la política, se deja de reintentar.
 */

import { htmlDe, plantillaDe } from './plantillas'
import type { Idioma } from './plantillas'
import type { CargaDeNotificacion, TipoDeNotificacion } from './tipos'

export interface CorreoPendiente {
  /** Fila del destinatario que se marca al enviar o al fallar. */
  id: string
  email: string
  locale: Idioma
  kind: TipoDeNotificacion
  payload: CargaDeNotificacion
  /** Intentos ya hechos antes de este. */
  attempts: number
}

export interface CorreoSaliente {
  to: string
  subject: string
  text: string
  html: string
}

export interface PuertosDeDespacho {
  enviar: (correo: CorreoSaliente) => Promise<void>
  marcarEnviado: (id: string) => Promise<void>
  /** `siguiente` en ISO, o `null` cuando la política se agotó. */
  registrarFallo: (id: string, intento: number, error: string, siguiente: string | null) => Promise<void>
}

export interface PoliticaDeReintento {
  maximo: number
  baseMs: number
}

/** Cinco intentos con espera que se duplica: 5, 10, 20, 40 minutos. */
export const POLITICA_DE_REINTENTO: PoliticaDeReintento = { maximo: 5, baseMs: 5 * 60 * 1000 }

/** Cuándo volver a intentar tras `intentos` fallos; `null` si ya no cabe otro. */
export function siguienteIntento(intentos: number, ahora: Date, politica: PoliticaDeReintento = POLITICA_DE_REINTENTO): Date | null {
  if (intentos >= politica.maximo) {
    return null
  }
  return new Date(ahora.getTime() + politica.baseMs * 2 ** (intentos - 1))
}

export interface ResumenDeDespacho {
  enviados: number
  fallidos: number
  agotados: number
}

export async function despacharPendientes(
  pendientes: readonly CorreoPendiente[],
  puertos: PuertosDeDespacho,
  ahora: () => Date = () => new Date(),
  politica: PoliticaDeReintento = POLITICA_DE_REINTENTO,
): Promise<ResumenDeDespacho> {
  const resumen: ResumenDeDespacho = { enviados: 0, fallidos: 0, agotados: 0 }

  for (const pendiente of pendientes) {
    const plantilla = plantillaDe(pendiente.kind, pendiente.locale, pendiente.payload)
    try {
      await puertos.enviar({ to: pendiente.email, subject: plantilla.asunto, text: plantilla.texto, html: htmlDe(plantilla.texto) })
      await puertos.marcarEnviado(pendiente.id)
      resumen.enviados += 1
    }
    catch (error) {
      const intento = pendiente.attempts + 1
      const siguiente = siguienteIntento(intento, ahora(), politica)
      await puertos.registrarFallo(pendiente.id, intento, error instanceof Error ? error.message : String(error), siguiente?.toISOString() ?? null)
      if (siguiente) {
        resumen.fallidos += 1
      }
      else {
        resumen.agotados += 1
      }
    }
  }

  return resumen
}
