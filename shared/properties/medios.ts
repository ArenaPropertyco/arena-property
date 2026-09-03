/**
 * HU-08 · RF-08.5 y RT-12 — fotos, video y plano elevado en Supabase Storage.
 *
 * La ruta del objeto es parte de la seguridad, no una convención estética: la política
 * de Storage decide por la **primera carpeta**, que es el identificador de la
 * propiedad. Si el nombre del archivo se cuela con `../`, el objeto acaba fuera de esa
 * carpeta y la política deja de acotar. Por eso la ruta se construye aquí, con el
 * nombre saneado, y ninguna llamada arma la plantilla a mano.
 */

export const TIPOS_DE_MEDIO = ['photo', 'video', 'floor_plan'] as const
export type TipoDeMedio = typeof TIPOS_DE_MEDIO[number]

/** Bucket privado de la migración de HU-08. */
export const BUCKET_DE_PROPIEDADES = 'property-media'

const MiB = 1024 * 1024

export const MIMES_PERMITIDOS: Record<TipoDeMedio, readonly string[]> = {
  photo: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
  video: ['video/mp4', 'video/webm'],
  // El plano llega como imagen o PDF; `glb` es lo que consume el visor 3D de HU-02.
  floor_plan: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'model/gltf-binary'],
}

/** Topes por tipo. Ninguno supera el `file_size_limit` del bucket (50 MiB). */
export const TAMANO_MAXIMO: Record<TipoDeMedio, number> = {
  photo: 10 * MiB,
  video: 50 * MiB,
  floor_plan: 20 * MiB,
}

export const CLAVES_DE_VALIDACION_DE_MEDIO = [
  'properties.validation.media_format',
  'properties.validation.media_too_large',
  'properties.validation.media_empty',
] as const

export type ClaveDeValidacionDeMedio = typeof CLAVES_DE_VALIDACION_DE_MEDIO[number]

/** Medio ya guardado, tal como lo lista la galería. */
export interface Medio {
  id: string
  kind: TipoDeMedio
  path: string
  position: number
}

export interface ArchivoACargar {
  tipo: TipoDeMedio
  mime: string
  size: number
}

export function validarArchivo(archivo: ArchivoACargar): ClaveDeValidacionDeMedio | null {
  if (archivo.size <= 0) {
    return 'properties.validation.media_empty'
  }
  if (!MIMES_PERMITIDOS[archivo.tipo].includes(archivo.mime)) {
    return 'properties.validation.media_format'
  }
  if (archivo.size > TAMANO_MAXIMO[archivo.tipo]) {
    return 'properties.validation.media_too_large'
  }
  return null
}

/**
 * Nombre seguro: sin acentos, en minúsculas y solo con lo que sobrevive a una URL.
 * Se toma el último segmento para que un `../../otro/archivo` no salga de su carpeta.
 */
function sanearNombre(nombre: string): string {
  const base = nombre.split(/[/\\]/).pop() ?? ''

  return base
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/\.{2,}/g, '.')
}

/**
 * `<propiedad>/<tipo>/<identificador>-<nombre>`. El identificador lo pone quien
 * llama —esta función es pura— y evita que dos archivos con el mismo nombre se pisen.
 */
export function rutaDeMedio(
  propertyId: string,
  tipo: TipoDeMedio,
  nombre: string,
  identificador: string,
): string {
  const saneado = sanearNombre(nombre)
  const archivo = saneado === '' ? identificador : `${identificador}-${saneado}`

  return `${propertyId}/${tipo}/${archivo}`
}

/** Los medios de un tipo, en el orden que fijó el administrador. */
export function ordenarMedios(medios: readonly Medio[], tipo: TipoDeMedio): Medio[] {
  return medios
    .filter(medio => medio.kind === tipo)
    .slice()
    .sort((a, b) => a.position - b.position)
}

/** Siguiente posición libre dentro del tipo, para que la serie no choque. */
export function siguienteOrden(medios: readonly Medio[], tipo: TipoDeMedio): number {
  const posiciones = ordenarMedios(medios, tipo).map(medio => medio.position)

  return posiciones.length === 0 ? 0 : Math.max(...posiciones) + 1
}
