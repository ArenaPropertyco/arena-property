/**
 * HU-08 · RF-08.1 — ficha técnica de la propiedad.
 *
 * Validación pura con claves i18n, igual que el registro de HU-04: el dominio no
 * lleva texto visible y la interfaz traduce. Se devuelven **todos** los campos que
 * fallan, no el primero: un formulario que corrige de a un error por envío es una
 * forma lenta de perder al administrador que está cargando una propiedad.
 */

export const CLAVES_DE_VALIDACION_DE_FICHA = [
  'properties.validation.name_required',
  'properties.validation.area_not_positive',
  'properties.validation.count_invalid',
  'properties.validation.description_too_short',
  'properties.validation.location_incomplete',
  'properties.validation.photos_required',
  'properties.validation.amenity_empty',
  'properties.validation.video_url_invalid',
] as const

export type ClaveDeValidacionDeFicha = typeof CLAVES_DE_VALIDACION_DE_FICHA[number]

export const CAMPOS_DE_FICHA = [
  'name',
  'areaM2',
  'bedrooms',
  'bathrooms',
  'parkingSpots',
  'description',
  'location',
  'photos',
  'amenities',
  'videoUrl',
] as const

export type CampoDeFicha = typeof CAMPOS_DE_FICHA[number]

/** «Descripción larga» de RF-08.1: lo bastante para describir la propiedad de verdad. */
export const LONGITUD_MINIMA_DE_DESCRIPCION = 80

export interface Ubicacion {
  /** Código ISO de dos letras; se guarda en mayúsculas para que el filtro agrupe. */
  country: string
  region: string
  city: string
  address: string | null
}

export interface FichaTecnica {
  name: string
  areaM2: number
  bedrooms: number
  bathrooms: number
  parkingSpots: number
  description: string
  amenities: string[]
  location: Ubicacion
  /** Cuántas fotos trae la carga múltiple; el archivo lo valida `medios.ts`. */
  photos: number
  videoUrl: string | null
  floorPlanPath: string | null
}

export interface ErrorDeFicha {
  name: CampoDeFicha
  message: ClaveDeValidacionDeFicha
}

/** Conteos de la ficha: enteros y no negativos. Un estudio tiene 0 habitaciones. */
const CONTEOS = ['bedrooms', 'bathrooms', 'parkingSpots'] as const

function vacio(texto: string | null | undefined): boolean {
  return (texto ?? '').trim() === ''
}

/** Solo `http` y `https`: un `javascript:` en un atributo `src` es una vía de ataque. */
function esUrlDeVideo(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol)
  }
  catch {
    return false
  }
}

export function validarFicha(ficha: FichaTecnica): ErrorDeFicha[] {
  const errores: ErrorDeFicha[] = []

  if (vacio(ficha.name)) {
    errores.push({ name: 'name', message: 'properties.validation.name_required' })
  }

  if (!(ficha.areaM2 > 0) || !Number.isFinite(ficha.areaM2)) {
    errores.push({ name: 'areaM2', message: 'properties.validation.area_not_positive' })
  }

  for (const campo of CONTEOS) {
    const valor = ficha[campo]
    if (!Number.isInteger(valor) || valor < 0) {
      errores.push({ name: campo, message: 'properties.validation.count_invalid' })
    }
  }

  if ((ficha.description ?? '').trim().length < LONGITUD_MINIMA_DE_DESCRIPCION) {
    errores.push({ name: 'description', message: 'properties.validation.description_too_short' })
  }

  // La dirección exacta es opcional: no toda propiedad publica su calle.
  if (vacio(ficha.location?.country) || vacio(ficha.location?.region) || vacio(ficha.location?.city)) {
    errores.push({ name: 'location', message: 'properties.validation.location_incomplete' })
  }

  if (!Number.isInteger(ficha.photos) || ficha.photos < 1) {
    errores.push({ name: 'photos', message: 'properties.validation.photos_required' })
  }

  if ((ficha.amenities ?? []).some(vacio)) {
    errores.push({ name: 'amenities', message: 'properties.validation.amenity_empty' })
  }

  if (!vacio(ficha.videoUrl) && !esUrlDeVideo(ficha.videoUrl!.trim())) {
    errores.push({ name: 'videoUrl', message: 'properties.validation.video_url_invalid' })
  }

  return errores
}

/**
 * Deja la ficha como se guarda: textos recortados, país en mayúsculas, equipamiento
 * sin huecos ni repeticiones y opcionales vacíos como `null`. Una cadena vacía y un
 * dato ausente son cosas distintas, y guardar `''` obliga a comprobar las dos en
 * cada consulta posterior.
 */
export function normalizarFicha(ficha: FichaTecnica): FichaTecnica {
  const texto = (valor: string | null | undefined): string => (valor ?? '').trim()
  const opcional = (valor: string | null | undefined): string | null => texto(valor) || null

  return {
    ...ficha,
    name: texto(ficha.name),
    description: texto(ficha.description),
    amenities: [...new Set((ficha.amenities ?? []).map(texto).filter(Boolean))],
    location: {
      country: texto(ficha.location?.country).toUpperCase(),
      region: texto(ficha.location?.region),
      city: texto(ficha.location?.city),
      address: opcional(ficha.location?.address),
    },
    videoUrl: opcional(ficha.videoUrl),
    floorPlanPath: opcional(ficha.floorPlanPath),
  }
}
