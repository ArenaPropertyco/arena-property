/**
 * HU-20 · RF-20.1…RF-20.4 · D-42, D-43 — el historial de semanas del Propietario.
 *
 * Es de **semanas**, no de estadías por noches (D-42), e incluye el destino de las
 * que se soltaron: una liberada figura en la bolsa de renta o ya rentada a un
 * tercero, y solo en ese caso con el ingreso que le tocó a la fracción (D-43).
 * Sin renta no se muestra importe, porque no existe.
 *
 * Todo es puro: la RLS entrega las semanas de la propiedad (D-16, los copropietarios
 * se ven entre sí), y aquí se dejan solo las de las fracciones propias (CA-20.3),
 * se filtran (CA-20.1) y se ordenan con las futuras primero (CA-20.2).
 */

import type { CopAmount } from '../money/importe'
import type { Dia } from './rejilla'
import type { Temporada } from './temporadas'
import type { ReleaseReason } from './week-usage'

export const ESTADOS_DE_SEMANA_HISTORICA = ['elected', 'confirmed', 'used', 'cancelled', 'released', 'expired', 'rented'] as const
export type EstadoDeSemanaHistorica = typeof ESTADOS_DE_SEMANA_HISTORICA[number]

/** Una semana de una fracción con lo que la base sabe de ella. */
export interface SemanaHistorica {
  propertyId: string
  propertyName: string
  fraction: number
  week: number
  startsOn: Dia
  endsOn: Dia
  season: Temporada
  confirmedAt: string | null
  releasedAt: string | null
  releaseReason: ReleaseReason | null
  /** RF-20.4 · un tercero ya ocupa la semana. */
  rented: boolean
  /** RF-20.4 · D-39 · lo que la renta le dejó a la fracción; `null` sin renta o si se prorrateó. */
  income: CopAmount | null
}

/** RF-20.1 · RF-20.4 · el estado real de la semana hoy. */
export function estadoHistorico(semana: SemanaHistorica, today: Dia): EstadoDeSemanaHistorica {
  if (semana.releasedAt) {
    if (semana.rented) {
      return 'rented'
    }
    if (semana.releaseReason === 'cancelled') {
      return 'cancelled'
    }
    return semana.releaseReason === 'expired' ? 'expired' : 'released'
  }
  if (semana.confirmedAt) {
    return semana.endsOn <= today ? 'used' : 'confirmed'
  }
  return 'elected'
}

/** RF-20.2 · la semana que entra hoy todavía está por delante. */
export function esFutura(semana: Pick<SemanaHistorica, 'startsOn'>, today: Dia): boolean {
  return semana.startsOn >= today
}

export interface FiltroDeHistorial {
  propertyId: string | null
  desde: Dia | null
  hasta: Dia | null
}

export function filtroDeHistorialVacio(): FiltroDeHistorial {
  return { propertyId: null, desde: null, hasta: null }
}

/** CA-20.3 · solo las semanas de las fracciones propias, aunque compartan propiedad. */
export function semanasPropias(
  semanas: readonly SemanaHistorica[],
  fracciones: readonly { propertyId: string, number: number }[],
): SemanaHistorica[] {
  return semanas.filter(semana => fracciones.some(f => f.propertyId === semana.propertyId && f.number === semana.fraction))
}

/** CA-20.1 · propiedad y rango de entrada, combinables. */
export function filtrarHistorial(semanas: readonly SemanaHistorica[], filtro: FiltroDeHistorial): SemanaHistorica[] {
  return semanas.filter(semana =>
    (filtro.propertyId === null || semana.propertyId === filtro.propertyId)
    && (filtro.desde === null || semana.startsOn >= filtro.desde)
    && (filtro.hasta === null || semana.startsOn <= filtro.hasta))
}

/** CA-20.2 · futuras ascendentes, luego pasadas descendentes. */
export function ordenarHistorial(semanas: readonly SemanaHistorica[], today: Dia): SemanaHistorica[] {
  const futuras = semanas.filter(semana => esFutura(semana, today)).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const pasadas = semanas.filter(semana => !esFutura(semana, today)).sort((a, b) => b.startsOn.localeCompare(a.startsOn))
  return [...futuras, ...pasadas]
}

/** RF-20.3 · el historial completo: propias, filtradas y en orden. */
export function historialDeSemanas(
  semanas: readonly SemanaHistorica[],
  fracciones: readonly { propertyId: string, number: number }[],
  filtro: FiltroDeHistorial,
  today: Dia,
): SemanaHistorica[] {
  return ordenarHistorial(filtrarHistorial(semanasPropias(semanas, fracciones), filtro), today)
}

/** Las propiedades presentes en el historial, sin repetir y por nombre, para el filtro. */
export function propiedadesDelHistorial(semanas: readonly SemanaHistorica[]): { id: string, name: string }[] {
  const vistas = new Map<string, string>()
  for (const semana of semanas) {
    vistas.set(semana.propertyId, semana.propertyName)
  }
  return [...vistas.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
}
