/**
 * HU-59 · RF-59.1…RF-59.6, RF-59.8 · D-28, D-33, D-36 · schedule.md P-12, P-13,
 * P-14, I-02, I-03 — la ventana anual de reubicación por semanas.
 *
 * Cada año, en una ventana que el Superadmin configura por propiedad, las
 * fracciones acceden por turnos rotativos de 48 horas y cada Propietario puede
 * mover una semana elegida (sin confirmar) a otra libre de la misma temporada. El
 * cupo 1/1/1/3 no cambia. Terminados los turnos y hasta el cierre, la ventana
 * queda abierta por orden de llegada; cerrada, lo no reubicado se queda donde
 * está. Todo es puro: la base repite las mismas reglas en `relocate_week`.
 */

import type { Dia, SemanaDeRejilla } from './rejilla'
import type { SemanaClasificada, Temporada } from './temporadas'
import type { AllocationState } from './week-projection'

/** P-12 · la ventana abre el 1 de octubre del año anterior. */
export const RELOCATION_WINDOW_OPENING = { month: 10, day: 1 } as const
/** P-13 · duración total de la ventana, en días. */
export const RELOCATION_WINDOW_DAYS = 16
/** P-14 · duración del turno de cada fracción, en horas. */
export const RELOCATION_TURN_HOURS = 48

const BOGOTA_OFFSET = '-05:00'
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** RF-59.1 · lo que el Superadmin decide al configurar la ventana. */
export interface RelocationWindowConfig {
  opensAt: string
  durationDays: number
  turnHours: number
  order: number[]
}

export interface RelocationWindow {
  /** Instante ISO de apertura. */
  opensAt: string
  durationDays: number
  turnHours: number
  /** Números de fracción en orden de turno. */
  order: readonly number[]
  /** Cierre anticipado por el Superadmin o el Administrador, si lo hubo. */
  closedAt?: string | null
}

function instant(iso: string): number {
  return Date.parse(iso)
}

function toIso(ms: number): string {
  return new Date(ms).toISOString()
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** `AAAA-MM-DDTHH:mm` en hora de Bogotá → instante ISO. */
export function fromBogotaInput(local: string): string {
  const withSeconds = local.length === 16 ? `${local}:00` : local
  return new Date(`${withSeconds}${BOGOTA_OFFSET}`).toISOString()
}

/** Instante ISO → `AAAA-MM-DDTHH:mm` en hora de Bogotá, listo para un campo `datetime-local`. */
export function toBogotaInput(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

/** P-12 · la apertura por defecto de la ventana del año: 1 de octubre del año anterior, 00:00 de Bogotá. */
export function defaultWindowOpening(year: number): string {
  return fromBogotaInput(`${year - 1}-${twoDigits(RELOCATION_WINDOW_OPENING.month)}-${twoDigits(RELOCATION_WINDOW_OPENING.day)}T00:00`)
}

/** P-13 · cuándo cierra la ventana si nadie la cierra antes. */
export function windowClosesAt(window: Pick<RelocationWindow, 'opensAt' | 'durationDays'>): string {
  return toIso(instant(window.opensAt) + window.durationDays * DAY_MS)
}

/** RF-59.2 · la primera pasa al final, tantas veces como se pida. */
export function rotateOrder(order: readonly number[], steps: number): number[] {
  const n = order.length
  if (n === 0) {
    return []
  }
  const k = ((steps % n) + n) % n
  return [...order.slice(k), ...order.slice(0, k)]
}

/** RF-59.2 · el orden de un año a partir del orden base y su año. */
export function relocationOrderFor(baseOrder: readonly number[], baseYear: number, year: number): number[] {
  return rotateOrder(baseOrder, Math.max(0, year - baseYear))
}

/** CA-59.6 · quién abre la ventana cada año, durante `years` años consecutivos. */
export function firstTurnsOver(baseOrder: readonly number[], baseYear: number, years: number): number[] {
  return Array.from({ length: years }, (_, i) => relocationOrderFor(baseOrder, baseYear, baseYear + i)[0])
    .filter((fraction): fraction is number => fraction !== undefined)
}

export interface TurnSlot {
  fraction: number
  position: number
  opensAt: string
  closesAt: string
}

/** RF-59.1 · P-14 · cada fracción del orden recibe una franja consecutiva desde la apertura. */
export function turnSlots(window: RelocationWindow): TurnSlot[] {
  const start = instant(window.opensAt)
  const turn = window.turnHours * HOUR_MS
  return window.order.map((fraction, position) => ({
    fraction,
    position,
    opensAt: toIso(start + position * turn),
    closesAt: toIso(start + (position + 1) * turn),
  }))
}

export type WindowPhase = 'scheduled' | 'turns' | 'open' | 'closed'

/** RF-59.6 · programada, por turnos, abierta por orden de llegada o cerrada. */
export function windowPhase(window: RelocationWindow, now: string): WindowPhase {
  const t = instant(now)
  if (window.closedAt || t >= instant(windowClosesAt(window))) {
    return 'closed'
  }
  if (t < instant(window.opensAt)) {
    return 'scheduled'
  }
  const last = turnSlots(window).at(-1)
  return last && t < instant(last.closesAt) ? 'turns' : 'open'
}

export type RelocationTurnState = 'scheduled' | 'before' | 'own' | 'after' | 'open' | 'closed' | 'none'

export interface RelocationTurn {
  state: RelocationTurnState
  canRelocate: boolean
  /** Cuándo abre (o abrió) la franja propia. */
  opensAt: string | null
  /** Hasta cuándo se puede operar en el estado actual. */
  closesAt: string | null
  /** Milisegundos hasta el siguiente cambio de estado que importa a la fracción. */
  remainingMs: number
  /** La fracción en turno, cuando se espera a otra. */
  waitingFor: number | null
}

/** RF-59.3 · RF-59.6 · CA-59.5 · qué puede hacer la fracción en este instante. */
export function relocationTurnOf(window: RelocationWindow, fraction: number, now: string): RelocationTurn {
  const slots = turnSlots(window)
  const own = slots.find(slot => slot.fraction === fraction)
  const none: RelocationTurn = { state: 'none', canRelocate: false, opensAt: null, closesAt: null, remainingMs: 0, waitingFor: null }
  if (!own) {
    return none
  }
  const t = instant(now)
  const closes = windowClosesAt(window)
  const phase = windowPhase(window, now)
  if (phase === 'closed') {
    return { ...none, state: 'closed', opensAt: own.opensAt, closesAt: window.closedAt ?? closes }
  }
  if (phase === 'scheduled') {
    return { ...none, state: 'scheduled', opensAt: own.opensAt, closesAt: own.closesAt, remainingMs: instant(own.opensAt) - t }
  }
  if (phase === 'open') {
    return { ...none, state: 'open', canRelocate: true, opensAt: own.opensAt, closesAt: closes, remainingMs: instant(closes) - t }
  }
  const current = slots.find(slot => t >= instant(slot.opensAt) && t < instant(slot.closesAt))
  if (t < instant(own.opensAt)) {
    return { ...none, state: 'before', opensAt: own.opensAt, closesAt: own.closesAt, remainingMs: instant(own.opensAt) - t, waitingFor: current?.fraction ?? null }
  }
  if (t < instant(own.closesAt)) {
    return { ...none, state: 'own', canRelocate: true, opensAt: own.opensAt, closesAt: own.closesAt, remainingMs: instant(own.closesAt) - t }
  }
  const lastCloses = slots.at(-1)?.closesAt ?? closes
  return { ...none, state: 'after', opensAt: own.opensAt, closesAt: closes, remainingMs: instant(lastCloses) - t, waitingFor: current?.fraction ?? null }
}

/** Lo que queda, descompuesto para mostrarlo; nunca negativo. */
export function remainingParts(ms: number): { days: number, hours: number, minutes: number } {
  const total = Math.max(0, ms)
  return {
    days: Math.floor(total / DAY_MS),
    hours: Math.floor((total % DAY_MS) / HOUR_MS),
    minutes: Math.floor((total % HOUR_MS) / MINUTE_MS),
  }
}

export const RELOCATION_VALIDATION_KEYS = [
  'calendar.relocation.validation.calendar_inactive',
  'calendar.relocation.validation.window_closed',
  'calendar.relocation.validation.outside_turn',
  'calendar.relocation.validation.not_own',
  'calendar.relocation.validation.week_locked',
  'calendar.relocation.validation.same_week',
  'calendar.relocation.validation.week_unknown',
  'calendar.relocation.validation.season_mismatch',
  'calendar.relocation.validation.in_the_past',
  'calendar.relocation.validation.week_taken',
  'calendar.relocation.validation.week_rented',
  'calendar.relocation.validation.week_blocked',
] as const

export type RelocationValidationKey = typeof RELOCATION_VALIDATION_KEYS[number]

export interface RelocationError {
  message: RelocationValidationKey
  from?: Temporada
  to?: Temporada
  fraction?: number
  opensAt?: string | null
  waitingFor?: number | null
}

export interface RelocationMove {
  fraction: number
  fromWeek: number
  toWeek: number
}

export interface RelocationContext {
  rejilla: readonly SemanaDeRejilla[]
  classification: readonly SemanaClasificada[]
  /** Todas las semanas con dueño del calendario, con sus marcas (las liberadas son bolsa de renta). */
  allocations: readonly AllocationState[]
  /** RF-15.2 · semanas bloqueadas por el Administrador. */
  blockedWeeks: ReadonlySet<number>
  today: Dia
  /** D-31 · I-08 · sin interruptor se conserva el turno pero no se opera. */
  calendarActive: boolean
  /** Si se conoce, el movimiento también se comprueba contra el turno (el Administrador no lo pasa). */
  turn?: RelocationTurn | null
}

/** RF-59.8 · lo que impide la reubicación; vacío si procede. */
export function validateRelocation(move: RelocationMove, context: RelocationContext): RelocationError[] {
  if (!context.calendarActive) {
    return [{ message: 'calendar.relocation.validation.calendar_inactive' }]
  }
  if (context.turn) {
    if (context.turn.state === 'closed') {
      return [{ message: 'calendar.relocation.validation.window_closed' }]
    }
    if (!context.turn.canRelocate) {
      return [{ message: 'calendar.relocation.validation.outside_turn', opensAt: context.turn.opensAt, waitingFor: context.turn.waitingFor }]
    }
  }

  const from = context.allocations.find(a => a.week === move.fromWeek)
  if (!from || from.fraction !== move.fraction) {
    return [{ message: 'calendar.relocation.validation.not_own' }]
  }
  // CA-59.4 · I-03 · solo se mueve lo elegido y pendiente de confirmar.
  if (from.confirmedAt !== null || from.releasedAt !== null) {
    return [{ message: 'calendar.relocation.validation.week_locked' }]
  }
  if (move.toWeek === move.fromWeek) {
    return [{ message: 'calendar.relocation.validation.same_week' }]
  }
  const target = context.classification.find(s => s.indice === move.toWeek)
  if (!target) {
    return [{ message: 'calendar.relocation.validation.week_unknown' }]
  }
  // CA-59.1 · I-03 · nadie convierte bajas en altas.
  const fromSeason = context.classification.find(s => s.indice === move.fromWeek)?.temporada
  if (fromSeason !== target.temporada) {
    return [{ message: 'calendar.relocation.validation.season_mismatch', from: fromSeason, to: target.temporada }]
  }
  const startOf = (week: number) => context.rejilla.find(s => s.indice === week)?.inicio ?? ''
  if (startOf(move.fromWeek) < context.today || startOf(move.toWeek) < context.today) {
    return [{ message: 'calendar.relocation.validation.in_the_past' }]
  }
  // CA-59.3 · RF-59.5 · el destino tiene que estar libre.
  const occupant = context.allocations.find(a => a.week === move.toWeek)
  if (occupant) {
    return occupant.releasedAt !== null
      ? [{ message: 'calendar.relocation.validation.week_rented' }]
      : [{ message: 'calendar.relocation.validation.week_taken', fraction: occupant.fraction }]
  }
  if (context.blockedWeeks.has(move.toWeek)) {
    return [{ message: 'calendar.relocation.validation.week_blocked' }]
  }
  return []
}

/** CA-59.2 · el reparto tras mover: la semana cambia de fecha, no de dueño. */
export function applyRelocation(allocations: readonly AllocationState[], move: RelocationMove): AllocationState[] {
  return allocations.map(entry => entry.fraction === move.fraction && entry.week === move.fromWeek
    ? { ...entry, week: move.toWeek }
    : entry)
}

/** RF-59.3 · las semanas propias que se pueden mover: elegidas, sin confirmar, sin liberar y futuras. */
export function movableWeeks(
  allocations: readonly AllocationState[],
  fraction: number,
  context: { rejilla: readonly SemanaDeRejilla[], today: Dia },
): number[] {
  const startOf = new Map(context.rejilla.map(s => [s.indice, s.inicio]))
  return allocations
    .filter(a => a.fraction === fraction && a.confirmedAt === null && a.releasedAt === null && (startOf.get(a.week) ?? '') >= context.today)
    .map(a => a.week)
    .sort((a, b) => a - b)
}

/** RF-59.5 · los destinos posibles de una semana: libres, de su temporada, futuras y sin bloquear. */
export function relocationTargetsFor(fromWeek: number, context: RelocationContext): SemanaClasificada[] {
  const season = context.classification.find(s => s.indice === fromWeek)?.temporada
  if (!season) {
    return []
  }
  const taken = new Set(context.allocations.map(a => a.week))
  const startOf = new Map(context.rejilla.map(s => [s.indice, s.inicio]))
  return context.classification
    .filter(s => s.temporada === season && s.indice !== fromWeek && !taken.has(s.indice) && !context.blockedWeeks.has(s.indice)
      && (startOf.get(s.indice) ?? '') >= context.today)
    .sort((a, b) => a.indice - b.indice)
}

export interface RelocationOutcome {
  /** Semanas que siguen donde estaban. */
  kept: AllocationState[]
  moved: RelocationMove[]
  /** Semanas que quedaron libres: bolsa del Administrador y renta (HU-39). */
  freed: number[]
}

/** CA-59.7 · RF-59.6 · el balance del cierre: qué se quedó, qué se movió y qué quedó libre. */
export function closeWindowOutcome(before: readonly AllocationState[], after: readonly AllocationState[]): RelocationOutcome {
  const key = (a: AllocationState) => `${a.fraction}:${a.week}`
  const afterKeys = new Set(after.map(key))
  const beforeKeys = new Set(before.map(key))
  const fractions = [...new Set(before.map(a => a.fraction))].sort((a, b) => a - b)

  const moved: RelocationMove[] = []
  for (const fraction of fractions) {
    const origins = before.filter(a => a.fraction === fraction && !afterKeys.has(key(a))).map(a => a.week).sort((a, b) => a - b)
    const targets = after.filter(a => a.fraction === fraction && !beforeKeys.has(key(a))).map(a => a.week).sort((a, b) => a - b)
    origins.forEach((fromWeek, i) => {
      const toWeek = targets[i]
      if (toWeek !== undefined) {
        moved.push({ fraction, fromWeek, toWeek })
      }
    })
  }
  const stillTaken = new Set(after.map(a => a.week))
  const freed = [...new Set(before.filter(a => !afterKeys.has(key(a)) && !stillTaken.has(a.week)).map(a => a.week))].sort((a, b) => a - b)

  return { kept: before.filter(a => afterKeys.has(key(a))), moved, freed }
}

/** RF-59.8 · el rechazo de la base, reconocido por el código de la regla que cita. */
export function relocationErrorKey(message: string): RelocationValidationKey | null {
  if (message.includes('I-08') || message.includes('CA-14.0')) {
    return 'calendar.relocation.validation.calendar_inactive'
  }
  if (message.includes('CA-59.1')) {
    return 'calendar.relocation.validation.season_mismatch'
  }
  if (message.includes('CA-59.3')) {
    return message.includes('RF-15.2')
      ? 'calendar.relocation.validation.week_blocked'
      : message.includes('HU-39') ? 'calendar.relocation.validation.week_rented' : 'calendar.relocation.validation.week_taken'
  }
  if (message.includes('CA-59.4')) {
    return 'calendar.relocation.validation.week_locked'
  }
  if (message.includes('CA-59.5')) {
    return 'calendar.relocation.validation.outside_turn'
  }
  if (message.includes('CA-59.7')) {
    return 'calendar.relocation.validation.window_closed'
  }
  if (message.includes('RF-59.3')) {
    return 'calendar.relocation.validation.not_own'
  }
  if (message.includes('RF-59.5')) {
    return message.includes('ya pasó') ? 'calendar.relocation.validation.in_the_past' : 'calendar.relocation.validation.week_unknown'
  }
  return null
}
