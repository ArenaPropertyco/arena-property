/**
 * HU-17 · RF-17.5 · HU-39 · RF-39.6 · HU-21 · RF-21.1b · D-39, D-43 — la bolsa de
 * renta tal como la ve quien tiene que colocarla.
 *
 * `terceros.ts` responde si una semana admite renta y con qué origen entró. Aquí
 * se junta lo uno con lo otro y se añade el dato que el Administrador necesita
 * antes de rentar: si esa semana es **atribuible**, es decir, si su renta será de
 * la fracción que la liberó (D-39) en vez de repartirse entre las ocho. Sin esa
 * marca, dos semanas idénticas en pantalla mandan el dinero a sitios distintos.
 *
 * La alerta del tablero (RF-21.1b) sale de la misma lista: lo que sigue en la
 * bolsa y todavía tiene fecha por delante. Una semana cuya entrada ya pasó deja de
 * ser alerta porque ya no hay nada que colocar.
 */

import { esAtribuible } from '../finance/ingresos'
import type { Dia } from './rejilla'
import type { Temporada } from './temporadas'
import { origenDeSemanaRentada, puedeRentarseAUnTercero } from './terceros'
import type { EstadoDeSemanaParaRenta } from './terceros'
import type { SemanaDeBolsa } from './vistas-renta'

/** Una semana del año con todo lo que decide si es bolsa y cómo se presenta. */
export interface SemanaCandidata extends EstadoDeSemanaParaRenta {
  endsOn: Dia
  season: Temporada | null
}

export interface SemanaDeLaBolsa extends SemanaDeBolsa {
  season: Temporada | null
  /** D-39 · su renta es de la fracción de origen, no de la propiedad. */
  attributable: boolean
}

/** RF-17.5 · RF-39.6 · CA-17.5 · CA-39.6 · las semanas colocables, en orden de rejilla. */
export function bolsaDeRenta(semanas: readonly SemanaCandidata[]): SemanaDeLaBolsa[] {
  return semanas
    .filter(semana => puedeRentarseAUnTercero(semana).ok)
    .map<SemanaDeLaBolsa>((semana) => {
      const origen = origenDeSemanaRentada(semana)
      return {
        week: semana.week,
        startsOn: semana.startsOn,
        endsOn: semana.endsOn,
        season: semana.season,
        originReason: origen.reason,
        originFraction: origen.fraction,
        attributable: esAtribuible(origen.reason),
      }
    })
    .sort((a, b) => a.week - b.week)
}

/** RF-21.1b · CA-21.4 · lo que sigue sin tercero y todavía se puede colocar. */
export function semanasPorColocar(bolsa: readonly SemanaDeLaBolsa[], hoy: Dia): SemanaDeLaBolsa[] {
  return bolsa
    .filter(semana => semana.startsOn >= hoy)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
}
