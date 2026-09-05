/**
 * HU-01 · RF-01.1…RF-01.4 · D-18 — el catálogo tal como lo ve el Visitante.
 *
 * Lógica pura sobre lo que la RLS ya dejó pasar (RF-01.5): aquí se decide qué se
 * pinta y cómo se filtra, no quién puede ver qué. Reutiliza el recorte por
 * visibilidad de `catalogo.ts`, el mismo que usa la vista global del Superadmin.
 */

import type { CopAmount } from '../money/importe'
import { propiedadesDelCatalogo } from './catalogo'
import type { PropiedadListada } from './catalogo'
import type { EstadoComercial } from './estados'

/** Una propiedad del catálogo público, con la ficha resumida de RF-01.4. */
export interface PropiedadPublica extends Omit<PropiedadListada, 'adminIds'> {
  slug: string
  city: string
  country: string
  /** Precio desde: la fracción disponible más barata; `null` si no hay ninguna. */
  lowestPrice: CopAmount | null
  availableFractions: number
  fractionCount: number
  /** Foto principal firmada; `null` si la propiedad aún no tiene fotos. */
  photoUrl: string | null
  areaM2: number
  bedrooms: number
  bathrooms: number
  parkingSpots: number
}

export interface FiltroDeCatalogo {
  region: string | null
  precioMin: CopAmount | null
  precioMax: CopAmount | null
  comercial: EstadoComercial | null
  /** Filtro derivado (D-18): sin fracciones disponibles y ya a la venta. */
  listaDeEspera: boolean
}

export function filtroDeCatalogoVacio(): FiltroDeCatalogo {
  return { region: null, precioMin: null, precioMax: null, comercial: null, listaDeEspera: false }
}

export function hayFiltroDeCatalogoActivo(filtro: FiltroDeCatalogo): boolean {
  return filtro.region !== null
    || filtro.precioMin !== null
    || filtro.precioMax !== null
    || filtro.comercial !== null
    || filtro.listaDeEspera
}

/** HU-47 · «Lista de espera» no es un estado: es no tener disponibles estando a la venta. */
export function admiteListaDeEspera(propiedad: PropiedadPublica): boolean {
  return propiedad.commercial !== 'coming_soon' && propiedad.availableFractions === 0
}

/** RF-01.3 · los criterios se combinan; el resultado los cumple todos a la vez. */
export function filtrarCatalogo(
  propiedades: readonly PropiedadPublica[],
  filtro: FiltroDeCatalogo,
): PropiedadPublica[] {
  const publicadas = propiedadesDelCatalogo(propiedades.map(propiedad => ({ ...propiedad, adminIds: [] })))
  const visibles = new Set(publicadas.map(propiedad => propiedad.id))

  return propiedades.filter((propiedad) => {
    if (!visibles.has(propiedad.id)) {
      return false
    }
    if (filtro.region !== null && propiedad.region !== filtro.region) {
      return false
    }
    if (filtro.comercial !== null && propiedad.commercial !== filtro.comercial) {
      return false
    }
    if (filtro.listaDeEspera && !admiteListaDeEspera(propiedad)) {
      return false
    }
    if (filtro.precioMin !== null || filtro.precioMax !== null) {
      if (propiedad.lowestPrice === null) {
        return false
      }
      if (filtro.precioMin !== null && propiedad.lowestPrice < filtro.precioMin) {
        return false
      }
      if (filtro.precioMax !== null && propiedad.lowestPrice > filtro.precioMax) {
        return false
      }
    }
    return true
  })
}

/** El rango de precios que ofrece el filtro sale de los datos; `null` si nada tiene precio. */
export function rangoDePrecios(propiedades: readonly PropiedadPublica[]): { min: CopAmount, max: CopAmount } | null {
  const precios = propiedades
    .map(propiedad => propiedad.lowestPrice)
    .filter((precio): precio is CopAmount => precio !== null)

  if (precios.length === 0) {
    return null
  }
  return { min: Math.min(...precios) as CopAmount, max: Math.max(...precios) as CopAmount }
}

/** Regiones presentes en el catálogo, ordenadas para el selector. */
export function regionesDelCatalogo(propiedades: readonly PropiedadPublica[]): string[] {
  return [...new Set(propiedades.map(propiedad => propiedad.region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
}
