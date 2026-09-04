/**
 * DT-12 · fechas con `Intl` y funciones puras ancladas a `America/Bogota`.
 *
 * Un día de calendario (`AAAA-MM-DD`) se muestra tal cual es, sin que la zona
 * horaria del navegador lo corra al día anterior: se interpreta en la zona del
 * negocio y se formatea en la región del idioma, las mismas de `shared/money`.
 */

import type { Idioma } from '../money/formato'
import { regionDe } from '../money/formato'

export const ZONA_HORARIA = 'America/Bogota'

const DIA = /^\d{4}-\d{2}-\d{2}$/

/** `2026-09-03` → «3 sept 2026» / «Sep 3, 2026». Devuelve el texto tal cual si no es un día. */
export function formatearDia(dia: string, idioma: Idioma): string {
  if (!DIA.test(dia)) {
    return dia
  }

  return new Intl.DateTimeFormat(regionDe(idioma), {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${dia}T12:00:00-05:00`))
}

/** Instante ISO → fecha y hora en la zona del negocio. */
export function formatearInstante(iso: string, idioma: Idioma): string {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) {
    return iso
  }

  return new Intl.DateTimeFormat(regionDe(idioma), {
    timeZone: ZONA_HORARIA,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(fecha)
}

/** El día de hoy en la zona del negocio, como `AAAA-MM-DD`. */
export function hoy(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora)

  const valor = (tipo: string) => partes.find(parte => parte.type === tipo)?.value ?? ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}
