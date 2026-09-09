/**
 * TR-03 · RF-N.3 — resolución de destinatarios como función pura, una por tipo
 * de evento. Reciben hechos ya consultados y devuelven cuentas, sin duplicados y
 * en orden estable. Quién ejecuta la consulta (Nitro o un disparador) es cosa de
 * la capa que llama; aquí no hay I/O.
 */

import type { Rol } from '../permissions/roles'
import { ALCANCE } from './tipos'
import type { EventoDeNotificacion } from './tipos'

export interface FraccionConTitular {
  id: string
  ownerId: string | null
}

export interface CuentaConRoles {
  id: string
  roles: readonly Rol[]
  status?: 'active' | 'suspended'
}

/** HU-31 · segmentos de un comunicado. */
export const SEGMENTOS = ['owners', 'property_admins', 'ambassadors', 'all'] as const
export type Segmento = typeof SEGMENTOS[number]

const ROL_DEL_SEGMENTO: Record<Exclude<Segmento, 'all'>, Rol> = {
  owners: 'owner',
  property_admins: 'property_admin',
  ambassadors: 'ambassador',
}

function unicos(ids: readonly string[]): string[] {
  return [...new Set(ids)]
}

/** CA-N.1 · HU-16 · RF-16.2 · solo el titular de esa fracción, y nadie si no tiene. */
export function destinatariosDeFraccion(fraccion: FraccionConTitular): string[] {
  return fraccion.ownerId ? [fraccion.ownerId] : []
}

/** CA-N.2 · HU-29 · todos los titulares de la propiedad, una vez cada uno. */
export function destinatariosDePropiedad(fracciones: readonly FraccionConTitular[]): string[] {
  return unicos(fracciones.map(fraccion => fraccion.ownerId).filter((id): id is string => id !== null))
}

/** HU-31 · las cuentas activas del segmento; `all` es toda cuenta activa. */
export function destinatariosDeSegmento(cuentas: readonly CuentaConRoles[], segmento: Segmento): string[] {
  return unicos(cuentas
    .filter(cuenta => (cuenta.status ?? 'active') === 'active')
    .filter(cuenta => segmento === 'all' || cuenta.roles.includes(ROL_DEL_SEGMENTO[segmento]))
    .map(cuenta => cuenta.id))
}

/** HU-54, HU-57 · RF-57.2 · el embajador dueño del referido o del retiro. */
export function destinatariosDeEmbajador(atribucion: { ambassadorId: string | null }): string[] {
  return atribucion.ambassadorId ? [atribucion.ambassadorId] : []
}

/** Lo que cada alcance necesita para resolver; se pasa solo lo que aplica. */
export interface ContextoDeDestinatarios {
  fraccion?: FraccionConTitular
  fracciones?: readonly FraccionConTitular[]
  cuentas?: readonly CuentaConRoles[]
  segmento?: Segmento
  atribucion?: { ambassadorId: string | null }
}

/** RF-N.3 · elige el resolutor por el alcance del tipo; sin contexto, nadie. */
export function resolverDestinatarios(evento: EventoDeNotificacion, contexto: ContextoDeDestinatarios): string[] {
  switch (ALCANCE[evento.kind]) {
    case 'fraction':
      return contexto.fraccion ? destinatariosDeFraccion(contexto.fraccion) : []
    case 'property':
      return contexto.fracciones ? destinatariosDePropiedad(contexto.fracciones) : []
    case 'segment':
      return contexto.cuentas && contexto.segmento ? destinatariosDeSegmento(contexto.cuentas, contexto.segmento) : []
    case 'ambassador':
      return contexto.atribucion ? destinatariosDeEmbajador(contexto.atribucion) : []
  }
}
