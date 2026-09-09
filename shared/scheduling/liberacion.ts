/**
 * HU-12 · RF-12.8 · D-15 · schedule.md P-11, I-09 — liberación automática.
 *
 * Una noche asignada que a `plazo` días de su fecha no tiene estadía declarada
 * pasa a la bolsa de renta a terceros (HU-39). Función pura e idempotente: la
 * tarea de `pg_cron` aplica esta misma regla en la base cada día.
 */

import type { Dia } from './rejilla'
import { sumarDias } from './rejilla'

export const PLAZO_DE_LIBERACION_DIAS = 60

export interface NocheAsignada {
  fraccion: number
  noche: Dia
}

export interface EstadiaDeclarada {
  fraccion: number
  noches: readonly Dia[]
}

export function claveDeNoche(noche: NocheAsignada): string {
  return `${noche.fraccion}:${noche.noche}`
}

/**
 * Las noches que vencen hoy: dentro del plazo, todavía no pasadas, sin estadía
 * de su fracción y no liberadas antes. Conserva el orden de entrada.
 */
export function nochesVencidas(
  asignadas: readonly NocheAsignada[],
  estadias: readonly EstadiaDeclarada[],
  hoy: Dia,
  plazoDias: number = PLAZO_DE_LIBERACION_DIAS,
  yaLiberadas: ReadonlySet<string> = new Set(),
): NocheAsignada[] {
  const limite = sumarDias(hoy, plazoDias)
  const ocupadas = new Set(estadias.flatMap(estadia => estadia.noches.map(noche => `${estadia.fraccion}:${noche}`)))

  return asignadas.filter(noche =>
    noche.noche >= hoy
    && noche.noche <= limite
    && !ocupadas.has(claveDeNoche(noche))
    && !yaLiberadas.has(claveDeNoche(noche)))
}
