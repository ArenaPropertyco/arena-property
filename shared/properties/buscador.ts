/**
 * HU-22 · RF-22.1, RF-22.2, RF-22.3 — el buscador de propiedades del
 * Administrador.
 *
 * No inventa un filtro nuevo: reutiliza el de HU-10 (texto sin acentos ni
 * mayúsculas, región, visibilidad y estado comercial) sobre las propiedades que
 * de verdad administra quien busca (HU-05). La RLS deja pasar lo publicado a
 * cualquiera, así que primero se recorta a lo asignado y después se busca: un
 * término que solo coincide con una propiedad ajena no devuelve nada (CA-22.3).
 * El Superadmin busca sobre todas.
 */

import type { ActorDeGestion } from './asignaciones'
import { propiedadesGestionadas } from './asignaciones'
import { filtrarPropiedades } from './catalogo'
import type { FiltroDePropiedades, PropiedadListada } from './catalogo'

/** RF-22.1 · RF-22.2 · RF-22.3 · lo asignado, filtrado; nunca lo ajeno. */
export function buscarPropiedadesAsignadas<T extends PropiedadListada>(
  propiedades: readonly T[],
  filtro: FiltroDePropiedades,
  actor: ActorDeGestion,
): T[] {
  return filtrarPropiedades(propiedadesGestionadas(propiedades, actor), filtro) as T[]
}
