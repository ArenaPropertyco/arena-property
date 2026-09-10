/**
 * HU-51 · RF-51.1…RF-51.7 · D-03, D-04 — la atribución del referido.
 *
 * Es la historia de mayor riesgo del programa: de estas reglas depende que dos
 * Embajadores no se disputen la misma comisión. Cuatro invariantes las resumen:
 *
 * 1. **Ventana de 90 días (D-03).** Un clic atribuye si el prospecto se registra
 *    dentro de los 90 días siguientes; pasado el plazo, ese clic ya no cuenta.
 * 2. **La primera gana (RF-51.3).** Entre varios clics válidos, atribuye el más
 *    antiguo; los posteriores no la sobreescriben.
 * 3. **Nadie se auto-refiere (RF-51.4).** Mismo usuario o mismo correo se ignora.
 * 4. **Una comisión por prospecto (D-04).** La atribución acompaña al prospecto de
 *    por vida, pero solo su primera compra paga.
 *
 * Un código inválido o inhabilitado nunca bloquea al prospecto: simplemente no
 * crea atribución (RF-51.6). Todo es puro; la base repite las mismas reglas.
 */

import type { Day } from './commission'

/** D-03 · días entre el clic y el registro para que la atribución valga. */
export const ATTRIBUTION_WINDOW_DAYS = 90

/** RF-51.5 · el ciclo de vida del referido, en orden. */
export const REFERRAL_STAGES = ['registered', 'payment_in_progress', 'paid'] as const

export type ReferralStage = typeof REFERRAL_STAGES[number]

/** Los hechos de la compra (HU-06, HU-58) que mueven el ciclo. */
export type ReferralEvent = 'purchase_started' | 'payment_completed' | 'purchase_voided'

export const ATTRIBUTION_VALIDATION_KEYS = [
  'referrals.attribution.validation.unknown_code',
  'referrals.attribution.validation.disabled_code',
  'referrals.attribution.validation.self_referral',
  'referrals.attribution.validation.window_expired',
  'referrals.attribution.validation.invalid_transition',
] as const

export type AttributionValidationKey = typeof ATTRIBUTION_VALIDATION_KEYS[number]

/** Un clic en un enlace de referido, tal como queda registrado. */
export interface ReferralClick {
  code: string
  clickedAt: Day
}

/** Un código vivo del programa, con su dueño, para resolver la atribución. */
export interface ReferralCodeEntry {
  code: string
  ambassadorId: string
  ownerEmail: string
  /** HU-33 · un Embajador suspendido tiene el código inhabilitado. */
  enabled: boolean
  /** Cuenta del Embajador, cuando se conoce; sirve para detectar la auto-referencia. */
  ownerId?: string | null
}

export interface AttributionContext {
  codes: readonly ReferralCodeEntry[]
  prospectEmail: string
  prospectId: string | null
  registeredAt: Day
  windowDays?: number
}

export type AttributionRejection = 'no_code' | 'unknown_code' | 'disabled_code' | 'self_referral' | 'window_expired'

export type AttributionOutcome
  = | { attributed: true, ambassadorId: string, code: string, clickedAt: Day }
    | { attributed: false, reason: AttributionRejection }

/** La atribución persistida de un prospecto. */
export interface Attribution {
  id: string
  ambassadorId: string
  code: string
  prospectId: string | null
  prospectEmail: string
  clickedAt: Day
  registeredAt: Day | null
  stage: ReferralStage
  /** D-04 · la compra que ya pagó comisión; `null` mientras ninguna lo hizo. */
  commissionedPurchaseId: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function daysBetween(from: Day, to: Day): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/** CA-51.6 · D-03 · ¿cae el registro dentro de la ventana que abrió el clic? */
export function withinWindow(clickedAt: Day, registeredAt: Day, days: number = ATTRIBUTION_WINDOW_DAYS): boolean {
  const transcurridos = daysBetween(clickedAt, registeredAt)
  return transcurridos >= 0 && transcurridos <= days
}

/** CA-51.2 · RF-51.4 · el mismo correo es la misma persona, escríbase como se escriba. */
export function isSelfReferral(ownerEmail: string | null | undefined, prospectEmail: string | null | undefined): boolean {
  const dueno = normalizeEmail(ownerEmail)
  return dueno !== '' && dueno === normalizeEmail(prospectEmail)
}

function rejectionFor(click: ReferralClick, context: AttributionContext): AttributionRejection | null {
  const entry = context.codes.find(c => c.code === click.code)
  if (!entry) {
    return 'unknown_code'
  }
  if (!entry.enabled) {
    return 'disabled_code'
  }
  if (isSelfReferral(entry.ownerEmail, context.prospectEmail)
    || (entry.ownerId != null && context.prospectId != null && entry.ownerId === context.prospectId)) {
    return 'self_referral'
  }
  if (!withinWindow(click.clickedAt, context.registeredAt, context.windowDays ?? ATTRIBUTION_WINDOW_DAYS)) {
    return 'window_expired'
  }
  return null
}

/**
 * CA-51.1 · CA-51.2 · CA-51.5 · CA-51.6 · a quién queda atribuido el prospecto.
 *
 * Se recorren los clics del más antiguo al más reciente y gana el primero que
 * pasa todas las reglas. Si ninguno pasa, el motivo que se devuelve es el del clic
 * más antiguo: es el que explica por qué el prospecto creía tener atribución.
 */
export function resolveAttribution(clicks: readonly ReferralClick[], context: AttributionContext): AttributionOutcome {
  if (clicks.length === 0) {
    return { attributed: false, reason: 'no_code' }
  }
  const ordenados = [...clicks].sort((a, b) => a.clickedAt.localeCompare(b.clickedAt))

  for (const click of ordenados) {
    if (rejectionFor(click, context) === null) {
      const entry = context.codes.find(c => c.code === click.code)!
      return { attributed: true, ambassadorId: entry.ambassadorId, code: entry.code, clickedAt: click.clickedAt }
    }
  }
  return { attributed: false, reason: rejectionFor(ordenados[0]!, context) ?? 'no_code' }
}

const TRANSITIONS: Record<ReferralStage, Partial<Record<ReferralEvent, ReferralStage>>> = {
  registered: { purchase_started: 'payment_in_progress' },
  payment_in_progress: { payment_completed: 'paid', purchase_voided: 'registered' },
  paid: {},
}

/** CA-51.4 · RF-51.5 · la etapa siguiente, o `null` si la transición no existe. */
export function nextStage(current: ReferralStage, event: ReferralEvent): ReferralStage | null {
  return TRANSITIONS[current][event] ?? null
}

/**
 * CA-51.7 · RF-51.7 · D-04 · ¿paga comisión esta compra? Solo si el referido llegó
 * al pago completo y ninguna compra suya la generó antes.
 */
export function generatesCommission(
  attribution: Pick<Attribution, 'stage' | 'commissionedPurchaseId'>,
  purchaseId: string,
): boolean {
  return attribution.stage === 'paid' && attribution.commissionedPurchaseId === null && purchaseId !== ''
}

/** D-04 · la atribución con su compra comisionada anotada. Devuelve una copia. */
export function markCommissioned(attribution: Attribution, purchaseId: string): Attribution {
  return { ...attribution, commissionedPurchaseId: purchaseId }
}

/** RF-51.6 · el rechazo de la base, reconocido por el código de la regla que cita. */
export function attributionErrorKey(message: string): AttributionValidationKey | null {
  if (message.includes('CA-51.2') || message.includes('RF-51.4')) {
    return 'referrals.attribution.validation.self_referral'
  }
  if (message.includes('CA-51.5') || message.includes('RF-51.6')) {
    return 'referrals.attribution.validation.disabled_code'
  }
  if (message.includes('CA-51.6')) {
    return 'referrals.attribution.validation.window_expired'
  }
  if (message.includes('CA-51.4') || message.includes('RF-51.5')) {
    return 'referrals.attribution.validation.invalid_transition'
  }
  return null
}
