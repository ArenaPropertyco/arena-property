/**
 * HU-29 · RF-29.1, RF-29.3…RF-29.6 · HU-30 · RF-30.3 — la novedad de una
 * propiedad como funciones puras.
 *
 * Aquí viven la validación del aviso (CA-29.2), el estado abierta/resuelta que se
 * deriva de la fecha de resolución y nunca se guarda aparte, la semántica de color
 * de la urgencia —el rojo solo para urgente (RT-07)—, el destinatario —toda la
 * propiedad o una sola fracción (D-46)—, el interruptor de visibilidad hacia los
 * propietarios y el orden y filtro del historial. La base repite la validación en
 * sus restricciones y resuelve los destinatarios con las mismas reglas de TR-03.
 */

import { destinatariosDeFraccion, destinatariosDePropiedad } from './destinatarios'
import type { FraccionConTitular } from './destinatarios'

export const URGENCIAS = ['informative', 'important', 'urgent'] as const
export type Urgencia = typeof URGENCIAS[number]

export const ESTADOS_DE_NOVEDAD = ['open', 'resolved'] as const
export type EstadoDeNovedad = typeof ESTADOS_DE_NOVEDAD[number]

export const LARGO_MAXIMO_DE_TITULO = 120
export const LARGO_MAXIMO_DE_CUERPO = 2000

/** Lo que quien gestiona declara al publicar (RF-29.1, RF-29.5, RF-29.6). */
export interface NuevaNovedad {
  propertyId: string
  /** RF-29.5 · a una fracción concreta; `null`, a toda la propiedad. */
  fractionId: string | null
  title: string
  body: string
  urgency: Urgencia
  /** RF-29.6 · visible para los propietarios; solo el Superadmin la publica inactiva. */
  active: boolean
}

/** Una novedad tal como la lista el historial (RF-29.3, RF-30.1). */
export interface Novedad extends NuevaNovedad {
  id: string
  propertyName: string | null
  /** RF-29.5 · número de la fracción destinataria, si la hay. */
  fractionNumber: number | null
  createdAt: string
  createdByLabel: string | null
  resolvedAt: string | null
  status: EstadoDeNovedad
}

/** RF-29.5 · una fracción a la que se le puede dirigir una novedad: vendida y con titular. */
export interface FraccionDestinataria extends FraccionConTitular {
  propertyId: string
  number: number
  /** Nombre o correo del titular (D-16), para el selector. */
  ownerLabel: string | null
}

export const CLAVES_DE_VALIDACION_DE_NOVEDAD = [
  'announcements.validation.property_required',
  'announcements.validation.title_required',
  'announcements.validation.title_too_long',
  'announcements.validation.body_required',
  'announcements.validation.body_too_long',
  'announcements.validation.urgency_required',
  'announcements.validation.fraction_not_in_property',
] as const

export type ClaveDeValidacionDeNovedad = typeof CLAVES_DE_VALIDACION_DE_NOVEDAD[number]

export type CampoDeNovedad = keyof NuevaNovedad

export interface ErrorDeNovedad {
  name: CampoDeNovedad
  message: ClaveDeValidacionDeNovedad
}

export function esUrgencia(valor: unknown): valor is Urgencia {
  return typeof valor === 'string' && (URGENCIAS as readonly string[]).includes(valor)
}

/**
 * CA-29.2 · RF-29.1 · RF-29.5 · un error por campo, en el orden del formulario.
 * La fracción, si viene, tiene que estar entre las de la propiedad; sin la lista,
 * la comprueba la base.
 */
export function validarNovedad(novedad: NuevaNovedad, fracciones: readonly FraccionDestinataria[] = []): ErrorDeNovedad[] {
  const errores: ErrorDeNovedad[] = []
  const titulo = novedad.title.trim()
  const cuerpo = novedad.body.trim()

  if (novedad.propertyId.trim() === '') {
    errores.push({ name: 'propertyId', message: 'announcements.validation.property_required' })
  }
  if (novedad.fractionId !== null && fracciones.length > 0
    && !fracciones.some(fraccion => fraccion.id === novedad.fractionId && fraccion.propertyId === novedad.propertyId)) {
    errores.push({ name: 'fractionId', message: 'announcements.validation.fraction_not_in_property' })
  }
  if (titulo === '') {
    errores.push({ name: 'title', message: 'announcements.validation.title_required' })
  }
  else if (titulo.length > LARGO_MAXIMO_DE_TITULO) {
    errores.push({ name: 'title', message: 'announcements.validation.title_too_long' })
  }
  if (cuerpo === '') {
    errores.push({ name: 'body', message: 'announcements.validation.body_required' })
  }
  else if (cuerpo.length > LARGO_MAXIMO_DE_CUERPO) {
    errores.push({ name: 'body', message: 'announcements.validation.body_too_long' })
  }
  if (!esUrgencia(novedad.urgency)) {
    errores.push({ name: 'urgency', message: 'announcements.validation.urgency_required' })
  }

  return errores
}

/**
 * RF-29.5 · CA-29.4 · a quién va la novedad: al titular de su fracción, o a todos
 * los de la propiedad, una vez cada uno. Mismas reglas de TR-03 (RF-N.3); la base
 * las repite en `private.notificar_novedad`.
 */
export function destinatariosDeNovedad(
  novedad: { propertyId: string, fractionId: string | null },
  fracciones: readonly (FraccionConTitular & { propertyId: string })[],
): string[] {
  const dePropiedad = fracciones.filter(fraccion => fraccion.propertyId === novedad.propertyId)
  if (novedad.fractionId !== null) {
    const fraccion = dePropiedad.find(candidata => candidata.id === novedad.fractionId)
    return fraccion ? destinatariosDeFraccion(fraccion) : []
  }
  return destinatariosDePropiedad(dePropiedad)
}

/** RF-29.6 · CA-29.5 · lo que un Propietario puede ver: solo lo activo. */
export function visibleParaPropietarios(novedad: { active: boolean }): boolean {
  return novedad.active
}

/** RF-29.6 · el interruptor, en memoria, para reflejarlo al instante. */
export function cambiarVisibilidad(novedad: Novedad, active: boolean): Novedad {
  return novedad.active === active ? novedad : { ...novedad, active }
}

/** RF-29.3 · el estado es la fecha de resolución, leída; no hay una columna que pueda contradecirla. */
export function estadoDeNovedad(novedad: { resolvedAt: string | null }): EstadoDeNovedad {
  return novedad.resolvedAt === null ? 'open' : 'resolved'
}

/** RF-29.3 · resolver deja fecha y estado; una ya resuelta conserva la suya. */
export function resolverNovedad(novedad: Novedad, ahora: string): Novedad {
  if (novedad.resolvedAt !== null) {
    return novedad
  }
  return { ...novedad, resolvedAt: ahora, status: 'resolved' }
}

/** RF-29.3 · RF-21.2 · las que alimentan las alertas del tablero. */
export function novedadesAbiertas<T extends { resolvedAt: string | null }>(novedades: readonly T[]): T[] {
  return novedades.filter(novedad => novedad.resolvedAt === null)
}

/**
 * RF-29.4 · RT-07 · el color de cada urgencia, atado a los alias semánticos de
 * marca: `error` es el rojo y se reserva para lo urgente; `warning` es lo
 * importante y `neutral` lo informativo. Ninguna vista elige color por su cuenta.
 */
export type ColorDeUrgencia = 'neutral' | 'warning' | 'error'

export const COLOR_DE_URGENCIA: Record<Urgencia, ColorDeUrgencia> = {
  informative: 'neutral',
  important: 'warning',
  urgent: 'error',
}

export function colorDeUrgencia(urgencia: Urgencia): ColorDeUrgencia {
  return COLOR_DE_URGENCIA[urgencia]
}

/** De más a menos urgente, para ordenar. */
const PESO_DE_URGENCIA: Record<Urgencia, number> = { urgent: 0, important: 1, informative: 2 }

/** RF-29.3 · RF-29.4 · abiertas primero; dentro, las más urgentes y luego las más recientes. */
export function ordenarNovedades<T extends { resolvedAt: string | null, urgency: Urgencia, createdAt: string }>(novedades: readonly T[]): T[] {
  return [...novedades].sort((a, b) => {
    const abiertas = Number(a.resolvedAt !== null) - Number(b.resolvedAt !== null)
    if (abiertas !== 0) {
      return abiertas
    }
    if (a.resolvedAt === null) {
      const urgencia = PESO_DE_URGENCIA[a.urgency] - PESO_DE_URGENCIA[b.urgency]
      if (urgencia !== 0) {
        return urgencia
      }
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export interface FiltroDeNovedades {
  propertyId: string | null
  status: EstadoDeNovedad | null
}

export function filtroDeNovedadesVacio(): FiltroDeNovedades {
  return { propertyId: null, status: null }
}

export function hayFiltroDeNovedadesActivo(filtro: FiltroDeNovedades): boolean {
  return filtro.propertyId !== null || filtro.status !== null
}

/** RF-30.3 · por propiedad y por estado; los criterios se combinan. */
export function filtrarNovedades<T extends { propertyId: string, resolvedAt: string | null }>(novedades: readonly T[], filtro: FiltroDeNovedades): T[] {
  return novedades.filter(novedad =>
    (filtro.propertyId === null || novedad.propertyId === filtro.propertyId)
    && (filtro.status === null || estadoDeNovedad(novedad) === filtro.status))
}
