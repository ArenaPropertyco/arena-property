import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato del enrutado de páginas.
 *
 * En Nuxt, un archivo `x.vue` que convive con una carpeta `x/` se convierte en la
 * **ruta padre** de lo que hay dentro, y sus hijas solo se pintan donde el padre
 * ponga un `<NuxtPage />`. Sin esa salida, entrar a `/x/hija` renderiza el padre y
 * la hija no aparece nunca: la página se ve vacía y sin error.
 *
 * La forma sana para una página que no es un contenedor es `x/index.vue`.
 */

const raiz = process.cwd()
const paginas = resolve(raiz, 'app/pages')

function carpetasDePaginas(directorio = paginas, prefijo = ''): string[] {
  return readdirSync(directorio).flatMap((entrada) => {
    const ruta = resolve(directorio, entrada)
    if (!statSync(ruta).isDirectory()) {
      return []
    }
    const relativa = prefijo ? `${prefijo}/${entrada}` : entrada
    return [relativa, ...carpetasDePaginas(ruta, relativa)]
  })
}

describe('enrutado · una página con hijas debe poder mostrarlas', () => {
  it('hay carpetas de páginas que revisar', () => {
    expect(carpetasDePaginas().length).toBeGreaterThan(0)
  })

  it.each(carpetasDePaginas())('la carpeta %s no queda tapada por una página hermana sin salida', (carpeta) => {
    const hermana = resolve(paginas, `${carpeta}.vue`)
    if (!existsSync(hermana)) {
      return
    }

    // Si existe la hermana, es una ruta padre: sin `<NuxtPage />` sus hijas no se pintan.
    expect(
      readFileSync(hermana, 'utf8'),
      `app/pages/${carpeta}.vue es padre de app/pages/${carpeta}/; o renderiza <NuxtPage /> o debe ser ${carpeta}/index.vue`,
    ).toContain('<NuxtPage')
  })
})
