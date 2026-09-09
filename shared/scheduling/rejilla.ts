/**
 * HU-12 · RF-12.1 · D-11, D-30 — la rejilla anual sábado a sábado y las noches
 * que quedan fuera (Fechas Especiales).
 *
 * Todo es aritmética de días de calendario en formato `AAAA-MM-DD`, hecha sobre
 * milisegundos UTC para que la zona horaria del navegador no corra ningún día. La
 * noche va de las 15:00 a las 11:00 en `America/Bogota` (schedule.md P-02, P-03);
 * eso vive en la frontera de presentación, no aquí.
 */

export type Dia = string

export const NOCHES_POR_SEMANA = 7
/** schedule.md P-02 · horas de entrada y salida por defecto. */
export const HORA_DE_CHECK_IN = '15:00'
export const HORA_DE_CHECK_OUT = '11:00'

const MS_POR_DIA = 86_400_000

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

function aMilisegundos(dia: Dia): number {
  const [anio, mes, d] = dia.split('-').map(Number)
  return Date.UTC(anio!, mes! - 1, d!)
}

function desdeMilisegundos(ms: number): Dia {
  const fecha = new Date(ms)
  return `${fecha.getUTCFullYear()}-${dosDigitos(fecha.getUTCMonth() + 1)}-${dosDigitos(fecha.getUTCDate())}`
}

export function diaDesde(anio: number, mes: number, dia: number): Dia {
  return desdeMilisegundos(Date.UTC(anio, mes - 1, dia))
}

export function sumarDias(dia: Dia, cantidad: number): Dia {
  return desdeMilisegundos(aMilisegundos(dia) + cantidad * MS_POR_DIA)
}

/** Diferencia en días entre dos fechas (`hasta − desde`). */
export function diasEntre(desde: Dia, hasta: Dia): number {
  return Math.round((aMilisegundos(hasta) - aMilisegundos(desde)) / MS_POR_DIA)
}

/** 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(dia: Dia): number {
  return new Date(aMilisegundos(dia)).getUTCDay()
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

/** P-01 · el ancla de la rejilla: el primer sábado del año. */
export function primerSabado(anio: number): Dia {
  const primero = diaDesde(anio, 1, 1)
  return sumarDias(primero, (6 - diaDeLaSemana(primero) + 7) % 7)
}

export function ultimoDia(anio: number): Dia {
  return diaDesde(anio, 12, 31)
}

/** Todas las noches del año, en orden. */
export function nochesDelAnio(anio: number): Dia[] {
  const total = esBisiesto(anio) ? 366 : 365
  const primero = diaDesde(anio, 1, 1)
  return Array.from({ length: total }, (_, i) => sumarDias(primero, i))
}

export interface SemanaDeRejilla {
  /** Posición en la rejilla, desde 0. */
  indice: number
  /** Sábado de entrada. */
  inicio: Dia
  /** Sábado de salida (no es noche de la semana). */
  fin: Dia
  /** Las 7 noches, de sábado a viernes. */
  noches: Dia[]
}

/** RF-12.1 · las semanas completas sábado→sábado que caben dentro del año (51 o 52). */
export function rejillaDelAnio(anio: number): SemanaDeRejilla[] {
  const semanas: SemanaDeRejilla[] = []
  const cierre = ultimoDia(anio)
  let inicio = primerSabado(anio)

  while (sumarDias(inicio, NOCHES_POR_SEMANA - 1) <= cierre) {
    semanas.push({
      indice: semanas.length,
      inicio,
      fin: sumarDias(inicio, NOCHES_POR_SEMANA),
      noches: Array.from({ length: NOCHES_POR_SEMANA }, (_, i) => sumarDias(inicio, i)),
    })
    inicio = sumarDias(inicio, NOCHES_POR_SEMANA)
  }

  return semanas
}

/** D-30 · las noches fuera de la rejilla: antes del primer sábado y tras la última semana. */
export function fechasEspecialesDelAnio(anio: number): Dia[] {
  const rejilla = rejillaDelAnio(anio)
  const primera = rejilla[0]!.inicio
  const siguienteALaUltima = rejilla[rejilla.length - 1]!.fin
  return nochesDelAnio(anio).filter(noche => noche < primera || noche >= siguienteALaUltima)
}
