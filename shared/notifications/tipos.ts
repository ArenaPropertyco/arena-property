/**
 * TR-03 · RF-N.1 — el modelo único de notificación.
 *
 * Un catálogo cerrado de tipos: cada uno sabe a quién alcanza (RF-N.3) y si además
 * de la bandeja exige correo (RF-N.2). Las historias que emiten (HU-16, HU-29,
 * HU-31, HU-54, HU-57, HU-58) apuntan aquí y no inventan tipos por su cuenta; la
 * base repite la lista en su restricción.
 */

export const TIPOS_DE_NOTIFICACION = [
  /** HU-16 · reserva propia confirmada. */
  'stay_confirmed',
  /** HU-16 · cambio de calendario que toca la fracción propia (HU-15, HU-17). */
  'calendar_changed',
  /** HU-58 · RF-58.7 · el plan se completó y el derecho de uso quedó activo. */
  'calendar_activated',
  /** HU-29 · novedad publicada sobre una propiedad. */
  'announcement_published',
  /** HU-31 · comunicado global a un segmento. */
  'broadcast',
  /** HU-57 · un referido pasó a «En proceso de pago». */
  'referral_in_progress',
  /** HU-57 · un referido completó el pago: monto y fecha de salida de gracia. */
  'referral_paid',
  /** HU-54, HU-57 · la comisión pasó a disponible. */
  'commission_available',
  /** HU-57 · solicitud de retiro aprobada. */
  'withdrawal_approved',
  /** HU-57 · solicitud de retiro pagada. */
  'withdrawal_paid',
] as const

export type TipoDeNotificacion = typeof TIPOS_DE_NOTIFICACION[number]

/** RF-N.3 · a quién alcanza cada tipo; decide qué resolutor se usa. */
export type Alcance = 'fraction' | 'property' | 'segment' | 'ambassador'

export const ALCANCE: Record<TipoDeNotificacion, Alcance> = {
  stay_confirmed: 'fraction',
  calendar_changed: 'fraction',
  calendar_activated: 'fraction',
  announcement_published: 'property',
  broadcast: 'segment',
  referral_in_progress: 'ambassador',
  referral_paid: 'ambassador',
  commission_available: 'ambassador',
  withdrawal_approved: 'ambassador',
  withdrawal_paid: 'ambassador',
}

/** RF-N.2 · in-app siempre; correo cuando el tipo lo exige. Hoy todos lo exigen. */
export const REQUIERE_CORREO: Record<TipoDeNotificacion, boolean> = {
  stay_confirmed: true,
  calendar_changed: true,
  calendar_activated: true,
  announcement_published: true,
  broadcast: true,
  referral_in_progress: true,
  referral_paid: true,
  commission_available: true,
  withdrawal_approved: true,
  withdrawal_paid: true,
}

export type CargaDeNotificacion = Record<string, unknown>

/** Un evento de negocio tal como llega al canal, antes de resolver destinatarios. */
export interface EventoDeNotificacion {
  kind: TipoDeNotificacion
  /** Entidad de origen (`payment_plan`, `announcement`, `commission`…). */
  entityType: string
  entityId: string
  /** Propiedad relacionada, si aplica. */
  propertyId: string | null
  payload: CargaDeNotificacion
}

export function esTipoDeNotificacion(valor: unknown): valor is TipoDeNotificacion {
  return typeof valor === 'string' && (TIPOS_DE_NOTIFICACION as readonly string[]).includes(valor)
}
