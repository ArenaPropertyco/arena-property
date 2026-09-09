/**
 * HU-12 · RF-12.9 — reconfigurar un calendario con estadías existentes exige
 * confirmación y no las elimina: lo que queda fuera del nuevo reparto se lista
 * como conflicto para la bandeja del Administrador (HU-17).
 */

import type { Dia } from './rejilla'
import type { Reparto } from './reparto'

export interface EstadiaExistente {
  id: string
  fraccion: number
  noches: readonly Dia[]
}

export interface ConflictoDeReconfiguracion {
  estadia: string
  fraccion: number
  /** Noches de la estadía que ya no pertenecen a su fracción. */
  noches: Dia[]
  /** Fracción a la que ahora pertenece la primera noche en conflicto; `null` si fue a la bolsa. */
  ahoraDe: number | null
}

export function requiereConfirmacion(estadias: readonly EstadiaExistente[]): boolean {
  return estadias.length > 0
}

export function conflictosDeReconfiguracion(reparto: Reparto, estadias: readonly EstadiaExistente[]): ConflictoDeReconfiguracion[] {
  const duenoDe = new Map<Dia, number>()
  for (const asignacion of reparto.asignaciones) {
    for (const noche of asignacion.noches) {
      duenoDe.set(noche, asignacion.fraccion)
    }
  }

  const conflictos: ConflictoDeReconfiguracion[] = []
  for (const estadia of estadias) {
    const fuera = estadia.noches.filter(noche => duenoDe.get(noche) !== estadia.fraccion)
    if (fuera.length > 0) {
      conflictos.push({ estadia: estadia.id, fraccion: estadia.fraccion, noches: [...fuera], ahoraDe: duenoDe.get(fuera[0]!) ?? null })
    }
  }
  return conflictos
}
