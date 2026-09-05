/**
 * E1 · las rutas públicas del sitio institucional, declaradas una sola vez.
 *
 * Los manifiestos de contenido apuntan aquí y no a cadenas sueltas: así el test de
 * contrato (CA-00.2) puede comprobar que cada destino existe como página en
 * `app/pages`, y renombrar una ruta obliga a tocar un solo sitio.
 */

export const RUTAS_PUBLICAS = {
  inicio: '/',
  catalogo: '/propiedades',
  modelo: '/modelo',
  beneficios: '/beneficios',
  agendamiento: '/agendamiento',
  nosotros: '/nosotros',
  contacto: '/contacto',
  registro: '/registro',
} as const

export type RutaPublica = typeof RUTAS_PUBLICAS[keyof typeof RUTAS_PUBLICAS]

/** Ruta del detalle de una propiedad publicada (HU-02). */
export function rutaDePropiedad(slug: string): string {
  return `${RUTAS_PUBLICAS.catalogo}/${slug}`
}

/**
 * Archivos de `app/pages` que Nuxt aceptaría para una ruta: `x/index.vue` o `x.vue`.
 * Lo usa el contrato de enrutado; no decide cuál de los dos existe.
 */
export function archivosDePagina(ruta: RutaPublica | string): string[] {
  const limpia = ruta.replace(/^\/+|\/+$/g, '')
  if (limpia === '') {
    return ['app/pages/index.vue']
  }
  return [`app/pages/${limpia}/index.vue`, `app/pages/${limpia}.vue`]
}
