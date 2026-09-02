/**
 * Presentación de la identidad de una cuenta.
 *
 * Funciones puras: deciden qué nombre mostrar cuando el perfil aún no tiene uno.
 * Hoy `full_name` está vacío en toda alta —ni el registro por correo ni el de Google
 * lo rellenan todavía (HU-61 · RF-61.7)—, así que el correo es lo único que hay.
 */

export interface IdentidadVisible {
  fullName?: string | null
  email?: string | null
}

/** El nombre real si lo hay; si no, la parte local del correo. Nunca el correo entero. */
export function nombreParaMostrar(identidad: IdentidadVisible): string {
  const nombre = (identidad.fullName ?? '').trim()
  if (nombre !== '') {
    return nombre
  }

  const correo = (identidad.email ?? '').trim()
  const local = correo.split('@')[0] ?? ''

  return local
}

/** Hasta dos iniciales en mayúscula, para el avatar sin foto. */
export function inicialesDe(texto: string): string {
  const palabras = texto
    .split(/[\s._-]+/)
    .map(palabra => palabra.trim())
    .filter(palabra => palabra !== '')

  return palabras
    .slice(0, 2)
    .map(palabra => palabra.charAt(0).toUpperCase())
    .join('')
}
