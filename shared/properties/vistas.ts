/**
 * HU-08…HU-11 · las formas que comparten composables, componentes y páginas.
 *
 * Solo tipos: describen lo que la interfaz recibe ya resuelto —el estado comercial
 * derivado, la etiqueta del administrador, la URL firmada del medio—, no cómo se
 * consulta. Así ningún componente tiene que recomponer un dato ni saber de Supabase.
 */

import type { CopAmount } from '../money/importe'
import type { PropiedadListada } from './catalogo'
import type { ComercialDerivado } from './estados'
import type { EstadoDeFraccion } from './fracciones'
import type { Medio } from './medios'

/** Una propiedad tal como la pinta el panel: con quién la administra y sus conteos. */
export interface PropiedadDelPanel extends PropiedadListada {
  /** Correo o nombre del administrador asignado; `null` si todavía no tiene. */
  adminLabel: string | null
  fractionCount: number
  availableFractions: number
}

/** Ficha completa de una propiedad, para la pantalla de detalle. */
export interface PropiedadDetallada extends PropiedadDelPanel {
  description: string
  areaM2: number
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  amenities: string[]
  country: string
  city: string
  address: string | null
  videoUrl: string | null
  comingSoon: boolean
  /** Nombres o correos de los administradores asignados (RF-05.4). */
  adminLabels: string[]
  /** Estado comercial derivado; `null` mientras no esté fraccionada (D-18). */
  commercialDerived: ComercialDerivado | null
}

/** Una fracción con lo que la tabla necesita mostrar sin volver a consultar. */
export interface FraccionListada {
  id: string
  propertyId: string
  number: number
  listPrice: CopAmount
  status: EstadoDeFraccion
  ownerId: string | null
  /** Nombre o correo del titular (D-16); `null` si la fracción no está vendida. */
  ownerLabel: string | null
  calendarActive: boolean
  /** HU-58 · plan de pagos vigente de la fracción vendida; `null` si no lo hay. */
  planId: string | null
}

/** Un medio con la URL con la que la galería lo pinta. */
export interface MedioConUrl extends Medio {
  /** URL firmada; el bucket es privado y las firmas caducan (RF-08.5). */
  url: string
}

/** Una cuenta que puede elegirse en un desplegable (titular, administrador). */
export interface OpcionDeCuenta {
  id: string
  label: string
}
