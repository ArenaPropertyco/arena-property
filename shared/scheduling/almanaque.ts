/**
 * HU-13 · RF-13.2 · HU-14 · RF-14.1 · RT-06 — la vista de almanaque del calendario
 * por semanas: los doce meses del año con sus días, y cada día apuntando a la
 * semana de la rejilla en la que cae.
 *
 * Función pura. Recibe las celdas ya proyectadas (`WeekCell`) y devuelve la
 * cuadrícula que la interfaz pinta: cada mes empieza en lunes, con huecos al
 * inicio para alinear el día 1, y cada día lleva el índice de su semana o `null`
 * si es una noche de la bolsa del Administrador (D-42), fuera de la rejilla.
 *
 * Una semana va de sábado a viernes (P-01): el sábado de salida ya es el de
 * entrada de la siguiente, así que se asigna a esta y no a la anterior.
 */

import { NOCHES_POR_SEMANA, diaDeLaSemana, diaDesde, esBisiesto, sumarDias } from './rejilla'
import type { Dia } from './rejilla'
import type { WeekCell } from './week-projection'

export interface DiaDeAlmanaque {
  dia: Dia
  numero: number
  /** Índice de la semana de la rejilla que lo contiene; `null` fuera de la rejilla. */
  semana: number | null
}

export interface MesDeAlmanaque {
  /** `AAAA-MM`. */
  clave: string
  /** 1…12. */
  mes: number
  /** Huecos antes del día 1 para que la cuadrícula empiece en lunes (0…6). */
  huecos: number
  dias: DiaDeAlmanaque[]
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Lunes = 0 … domingo = 6, que es como se lee un almanaque (RT-06). */
export function columnaDesdeLunes(dia: Dia): number {
  return (diaDeLaSemana(dia) + 6) % 7
}

export function mesesDelAlmanaque(anio: number, cells: readonly WeekCell[]): MesDeAlmanaque[] {
  // Cada semana cubre sus siete noches: [inicio, fin). El fin es de la siguiente.
  const semanaDelDia = new Map<Dia, number>()
  for (const cell of cells) {
    for (let noche = 0; noche < NOCHES_POR_SEMANA; noche++) {
      semanaDelDia.set(sumarDias(cell.startsOn, noche), cell.week)
    }
  }

  return DIAS_POR_MES.map((cantidad, indice) => {
    const mes = indice + 1
    const total = mes === 2 && esBisiesto(anio) ? 29 : cantidad
    const primero = diaDesde(anio, mes, 1)
    return {
      clave: primero.slice(0, 7),
      mes,
      huecos: columnaDesdeLunes(primero),
      dias: Array.from({ length: total }, (_, i) => {
        const dia = diaDesde(anio, mes, i + 1)
        return { dia, numero: i + 1, semana: semanaDelDia.get(dia) ?? null }
      }),
    }
  })
}
