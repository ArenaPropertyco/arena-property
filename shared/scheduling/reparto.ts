/**
 * HU-12 · RF-12.3, RF-12.6 · D-12, D-13, D-27 — el motor de reparto.
 *
 * Función pura: recibe el año, la rejilla clasificada, el criterio y el año base,
 * y devuelve qué semanas y qué noches recibe cada fracción, qué queda en la bolsa
 * del Administrador y a quién fue cada bloque pico. Determinista y sin I/O (DT-07):
 * la base guarda el resultado y protege las invariantes.
 *
 * Cómo se reparte cada temporada: se toman las primeras 8·n semanas por orden de
 * rejilla (n = semanas por fracción del criterio) y se colocan en 8·n ranuras; la
 * fracción con posición p toma las ranuras p, p+8, p+16… Así dos fracciones nunca
 * comparten semana y el reparto se corre con la posición año tras año. En alta, los
 * bloques pico se colocan antes, en la ranura de la fracción que dicta D-27; el
 * resto de semanas altas llena las ranuras libres por orden.
 */

import { FRACCIONES_POR_PROPIEDAD } from '../properties/fracciones'
import { CRITERIO_POR_DEFECTO, ErrorDeClasificacionInvalida, ErrorDeRejillaImposible, validarRejillaParaCriterio } from './criterio'
import type { Criterio } from './criterio'
import type { Dia, SemanaDeRejilla } from './rejilla'
import { fraccionDelBloque, posicionDe } from './rotacion'
import { BLOQUES_PICO, TEMPORADAS, validarClasificacion } from './temporadas'
import type { BloquePico, SemanaClasificada, Temporada } from './temporadas'

export interface EntradaDeReparto {
  anio: number
  anioBase: number
  rejilla: readonly SemanaDeRejilla[]
  semanas: readonly SemanaClasificada[]
  criterio?: Criterio
}

export interface AsignacionDeFraccion {
  fraccion: number
  posicion: number
  /** Índices de semana, ordenados. */
  semanas: number[]
  /** Todas las noches del año que le tocan, ordenadas. */
  noches: Dia[]
  cupo: Record<Temporada, number>
  bloquesPico: BloquePico[]
}

export interface Reparto {
  anio: number
  anioBase: number
  criterio: Criterio
  asignaciones: AsignacionDeFraccion[]
  /** Semanas de la rejilla que no se reparten; se comportan como bloqueos (HU-15). */
  bolsaDelAdministrador: number[]
  /** Qué fracción recibió cada bloque pico; `null` si la rejilla no lo marcó. */
  bloquesPico: Record<BloquePico, number | null>
}

const FRACCIONES = Array.from({ length: FRACCIONES_POR_PROPIEDAD }, (_, i) => i + 1)

export function repartir(entrada: EntradaDeReparto): Reparto {
  const criterio = entrada.criterio ?? CRITERIO_POR_DEFECTO
  const semanas = [...entrada.semanas].sort((a, b) => a.indice - b.indice)

  const invalida = validarClasificacion(entrada.rejilla, semanas)
  if (invalida.length > 0) {
    throw new ErrorDeClasificacionInvalida([...new Set(invalida.map(e => e.message))])
  }
  const faltantes = validarRejillaParaCriterio(semanas, criterio)
  if (faltantes.length > 0) {
    throw new ErrorDeRejillaImposible(faltantes)
  }

  const nochesDeSemana = new Map(entrada.rejilla.map(s => [s.indice, s.noches]))
  const posicion = new Map(FRACCIONES.map(f => [f, posicionDe(f, entrada.anio, entrada.anioBase)]))
  const semanasDe = new Map<number, number[]>(FRACCIONES.map(f => [f, []]))
  const bloquesDe = new Map<number, BloquePico[]>(FRACCIONES.map(f => [f, []]))
  const bloquesPico: Record<BloquePico, number | null> = { christmas: null, new_year: null, holy_week: null }
  const bolsa: number[] = []

  for (const temporada of TEMPORADAS) {
    const porFraccion = criterio[temporada]
    const ranuras: (number | null)[] = Array.from({ length: FRACCIONES_POR_PROPIEDAD * porFraccion }, () => null)
    const candidatas = semanas.filter(s => s.temporada === temporada)

    // Alta: los bloques pico van primero, a la fracción que dicta D-27.
    if (temporada === 'alta') {
      for (const bloque of BLOQUES_PICO) {
        const semana = candidatas.find(s => s.bloquePico === bloque)
        if (!semana) {
          continue
        }
        const fraccion = fraccionDelBloque(bloque, entrada.anio, entrada.anioBase)
        const p = posicion.get(fraccion)!
        for (let ronda = 0; ronda < porFraccion; ronda++) {
          const ranura = p + FRACCIONES_POR_PROPIEDAD * ronda
          if (ranuras[ranura] === null) {
            ranuras[ranura] = semana.indice
            break
          }
        }
        bloquesPico[bloque] = fraccion
        bloquesDe.get(fraccion)!.push(bloque)
      }
    }

    // El resto de la temporada llena las ranuras libres por orden de rejilla; lo que sobra, a la bolsa.
    const yaColocadas = new Set(ranuras.filter((r): r is number => r !== null))
    const libres = candidatas.filter(s => !yaColocadas.has(s.indice))
    for (const semana of libres) {
      const ranura = ranuras.indexOf(null)
      if (ranura === -1) {
        bolsa.push(semana.indice)
        continue
      }
      ranuras[ranura] = semana.indice
    }

    for (const fraccion of FRACCIONES) {
      const p = posicion.get(fraccion)!
      for (let ronda = 0; ronda < porFraccion; ronda++) {
        const indice = ranuras[p + FRACCIONES_POR_PROPIEDAD * ronda]
        if (indice !== null && indice !== undefined) {
          semanasDe.get(fraccion)!.push(indice)
        }
      }
    }
  }

  const temporadaDe = new Map(semanas.map(s => [s.indice, s.temporada]))

  const asignaciones = FRACCIONES.map<AsignacionDeFraccion>((fraccion) => {
    const indices = [...semanasDe.get(fraccion)!].sort((a, b) => a - b)
    const cupo = Object.fromEntries(TEMPORADAS.map(t => [t, 0])) as Record<Temporada, number>
    for (const indice of indices) {
      cupo[temporadaDe.get(indice)!] += nochesDeSemana.get(indice)!.length
    }
    return {
      fraccion,
      posicion: posicion.get(fraccion)!,
      semanas: indices,
      noches: indices.flatMap(indice => nochesDeSemana.get(indice)!).sort(),
      cupo,
      bloquesPico: [...bloquesDe.get(fraccion)!].sort((a, b) => BLOQUES_PICO.indexOf(a) - BLOQUES_PICO.indexOf(b)),
    }
  })

  return {
    anio: entrada.anio,
    anioBase: entrada.anioBase,
    criterio,
    asignaciones,
    bolsaDelAdministrador: bolsa.sort((a, b) => a - b),
    bloquesPico,
  }
}
