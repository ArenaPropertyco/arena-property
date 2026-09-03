/**
 * HU-08 · RF-08.2 y HU-10 · RF-10.2 — qué propiedades se listan y con qué filtros.
 *
 * Lógica pura compartida por el catálogo público (HU-01) y la vista global del
 * Superadmin (HU-10): las dos pantallas recortan con las mismas funciones y ninguna
 * decide por su cuenta qué esconder.
 *
 * Importante para no confundir capas: esto **no** es la frontera de seguridad. Quién
 * puede ver qué lo decide la RLS (DT-05); lo que llega aquí ya viene recortado por la
 * base. Este filtro es el de la interfaz.
 */

import type { EstadoComercial, Visibilidad } from './estados'
import { apareceEnCatalogo } from './estados'

/** Lo mínimo que una propiedad expone para listarse y filtrarse. */
export interface PropiedadListada {
  id: string
  name: string
  region: string
  visibility: Visibilidad
  commercial: EstadoComercial
  /** Administradores con asignación vigente (HU-05). */
  adminIds: string[]
}

export interface FiltroDePropiedades {
  administrador?: string | null
  visibilidad?: Visibilidad | null
  comercial?: EstadoComercial | null
  region?: string | null
  texto?: string | null
}

export function filtroVacio(): FiltroDePropiedades {
  return { administrador: null, visibilidad: null, comercial: null, region: null, texto: null }
}

/** Un criterio nulo, vacío o de solo espacios no filtra nada. */
function activo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim()
  return limpio === '' ? null : limpio
}

/**
 * Sin acentos y en minúsculas: quien busca «bahia» espera encontrar «Bahía».
 * `NFD` separa la letra de su tilde y el rango de marcas combinantes la descarta.
 */
function plegar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
}

export function hayFiltroActivo(filtro: FiltroDePropiedades): boolean {
  return [filtro.administrador, filtro.visibilidad, filtro.comercial, filtro.region, filtro.texto]
    .some(criterio => activo(criterio) !== null)
}

/** RF-10.2 · los criterios se combinan: el resultado cumple todos a la vez. */
export function filtrarPropiedades(
  propiedades: readonly PropiedadListada[],
  filtro: FiltroDePropiedades,
): PropiedadListada[] {
  const administrador = activo(filtro.administrador)
  const visibilidad = activo(filtro.visibilidad)
  const comercial = activo(filtro.comercial)
  const region = activo(filtro.region)
  const texto = activo(filtro.texto)

  return propiedades.filter((propiedad) => {
    if (administrador !== null && !propiedad.adminIds.includes(administrador)) {
      return false
    }
    if (visibilidad !== null && propiedad.visibility !== visibilidad) {
      return false
    }
    if (comercial !== null && propiedad.commercial !== comercial) {
      return false
    }
    if (region !== null && propiedad.region !== region) {
      return false
    }
    if (texto !== null && !plegar(propiedad.name).includes(plegar(texto))) {
      return false
    }
    return true
  })
}

/** CA-08.4 · el catálogo público solo muestra lo publicado: ni borradores ni inactivas. */
export function propiedadesDelCatalogo(propiedades: readonly PropiedadListada[]): PropiedadListada[] {
  return propiedades.filter(propiedad => apareceEnCatalogo(propiedad.visibility))
}

/** Regiones presentes en los datos, para que el filtro no ofrezca opciones inventadas. */
export function regionesDe(propiedades: readonly PropiedadListada[]): string[] {
  return [...new Set(propiedades.map(propiedad => propiedad.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}

/** Administradores con alguna propiedad asignada, en el orden en que aparecen. */
export function administradoresDe(propiedades: readonly PropiedadListada[]): string[] {
  return [...new Set(propiedades.flatMap(propiedad => propiedad.adminIds))]
}
