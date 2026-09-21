/**
 * HU-21 · RF-21.1, RF-21.2, RF-21.3 · TR-02 RF-D.5 — los indicadores del tablero
 * del Administrador, como funciones puras.
 *
 * El porcentaje vendido sale en puntos básicos enteros (RF-D.4) y se presenta con
 * `formatearPorcentaje` (CA-21.1); las próximas reservas son las semanas
 * confirmadas cuya entrada no ha pasado, por cercanía (CA-21.2); y hay un resumen
 * por propiedad que quien mira gestiona de verdad, ni una más (CA-21.3). Las
 * alertas son los conflictos de bloqueo (HU-15/HU-17), las solicitudes de
 * intercambio abiertas (HU-12), las semanas por colocar (RF-21.1b) y las novedades
 * abiertas de la propiedad (HU-29 · RF-29.3), que dejan de contar al resolverse.
 */

import { proporcionEnPuntosBasicos } from '../money/formato'
import type { Dia } from '../scheduling/rejilla'
import { propiedadesGestionadas } from './asignaciones'
import type { ActorDeGestion } from './asignaciones'
import { FRACCIONES_POR_PROPIEDAD } from './fracciones'

/** Lo mínimo de una propiedad para resumirla. */
export interface PropiedadResumible {
  id: string
  name: string
  adminIds: readonly string[]
  fractionCount: number
  soldFractions: number
}

/** Una semana confirmada como uso propio, tal como el tablero la lista. */
export interface ReservaProxima {
  propertyId: string
  fraction: number
  week: number
  startsOn: Dia
  endsOn: Dia
}

export interface AlertasDePropiedad {
  conflicts: number
  swapRequests: number
  weeksToPlace: number
  /** HU-29 · RF-29.3 · novedades publicadas que siguen abiertas. */
  openAnnouncements: number
}

export interface ResumenDePropiedad {
  id: string
  name: string
  fractionCount: number
  soldFractions: number
  /** Fracciones vendidas sobre el total, en puntos básicos (3 de 8 → 3750). */
  soldShare: number
  upcoming: ReservaProxima[]
  alerts: AlertasDePropiedad
  alertCount: number
}

/** Cuántas reservas próximas muestra cada tarjeta. */
export const PROXIMAS_POR_DEFECTO = 3

/** CA-21.1 · RF-21.2 · vendidas sobre el total, en puntos básicos; sin fracciones, 0. */
export function porcentajeVendido(vendidas: number, total: number = FRACCIONES_POR_PROPIEDAD): number {
  if (total <= 0) {
    return 0
  }
  return proporcionEnPuntosBasicos(vendidas, total)
}

/** CA-21.2 · solo las que todavía no han entrado, de la más cercana a la más lejana. */
export function proximasReservas<T extends { startsOn: Dia }>(reservas: readonly T[], hoy: Dia, tope: number = PROXIMAS_POR_DEFECTO): T[] {
  return reservas
    .filter(reserva => reserva.startsOn >= hoy)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    .slice(0, tope)
}

export interface ContextoDeResumen {
  reservas: readonly ReservaProxima[]
  alertas: AlertasDePropiedad
  hoy: Dia
  proximas?: number
}

export function resumenDePropiedad(propiedad: PropiedadResumible, contexto: ContextoDeResumen): ResumenDePropiedad {
  const alertas = contexto.alertas
  return {
    id: propiedad.id,
    name: propiedad.name,
    fractionCount: propiedad.fractionCount,
    soldFractions: propiedad.soldFractions,
    soldShare: porcentajeVendido(propiedad.soldFractions, propiedad.fractionCount),
    upcoming: proximasReservas(contexto.reservas, contexto.hoy, contexto.proximas),
    alerts: alertas,
    alertCount: alertas.conflicts + alertas.swapRequests + alertas.weeksToPlace + alertas.openAnnouncements,
  }
}

interface DePropiedad {
  propertyId: string
}

export interface ContextoDelTablero {
  reservas: readonly ReservaProxima[]
  conflictos: readonly DePropiedad[]
  solicitudes: readonly DePropiedad[]
  porColocar: readonly DePropiedad[]
  /** HU-29 · las novedades abiertas, una entrada por novedad. */
  novedades: readonly DePropiedad[]
  hoy: Dia
  proximas?: number
}

function cuenta(items: readonly DePropiedad[], propertyId: string): number {
  return items.filter(item => item.propertyId === propertyId).length
}

/** CA-21.3 · RF-21.3 · un resumen por propiedad gestionada, en el orden en que llegan. */
export function resumenesDelTablero(
  propiedades: readonly PropiedadResumible[],
  actor: ActorDeGestion,
  contexto: ContextoDelTablero,
): ResumenDePropiedad[] {
  return propiedadesGestionadas(propiedades, actor).map(propiedad => resumenDePropiedad(propiedad, {
    reservas: contexto.reservas.filter(reserva => reserva.propertyId === propiedad.id),
    alertas: {
      conflicts: cuenta(contexto.conflictos, propiedad.id),
      swapRequests: cuenta(contexto.solicitudes, propiedad.id),
      weeksToPlace: cuenta(contexto.porColocar, propiedad.id),
      openAnnouncements: cuenta(contexto.novedades, propiedad.id),
    },
    hoy: contexto.hoy,
    proximas: contexto.proximas,
  }))
}
