/**
 * RT-05 · utilidades puras sobre los diccionarios de i18n.
 * Sin Nuxt y sin I/O: quien llama decide de dónde salen los objetos.
 */

/** Diccionario de traducción tal como vive en `i18n/locales/*.json`. */
export type Diccionario = { [clave: string]: string | Diccionario }

/**
 * Convierte un diccionario anidado en un mapa plano `"a.b.c" -> valor`.
 * Es la base de toda comparación de paridad entre locales (CA-00.3).
 */
export function aplanarClaves(
  diccionario: Diccionario | Record<string, unknown>,
  prefijo = '',
): Record<string, string> {
  const plano: Record<string, string> = {}

  for (const [clave, valor] of Object.entries(diccionario)) {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave

    if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      Object.assign(plano, aplanarClaves(valor as Diccionario, ruta))
    }
    else {
      plano[ruta] = String(valor)
    }
  }

  return plano
}

/** Claves presentes en `referencia` que faltan en `comparado`. */
export function clavesFaltantes(
  referencia: Record<string, string>,
  comparado: Record<string, string>,
): string[] {
  return Object.keys(referencia).filter(clave => !(clave in comparado))
}
