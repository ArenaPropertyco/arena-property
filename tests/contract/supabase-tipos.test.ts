import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato de RT-04 y del principio 5: los tipos de la base se generan,
 * viven en `shared/types` y son los que consume @nuxtjs/supabase.
 */

const raiz = process.cwd()
const RUTA_TIPOS = 'shared/types/database.types.ts'

describe('RT-04 · tipos generados de Supabase', () => {
  it('el archivo de tipos existe en shared/types', () => {
    expect(existsSync(resolve(raiz, RUTA_TIPOS))).toBe(true)
  })

  it('expone el tipo `Database`', () => {
    const tipos = readFileSync(resolve(raiz, RUTA_TIPOS), 'utf8')

    expect(tipos).toMatch(/export type Database/)
  })

  it('nuxt.config.ts apunta @nuxtjs/supabase a ese archivo', () => {
    const configuracion = readFileSync(resolve(raiz, 'nuxt.config.ts'), 'utf8')

    expect(configuracion).toContain('shared/types/database.types.ts')
  })

  it('existe la carpeta de migraciones, único lugar donde cambia el esquema', () => {
    expect(existsSync(resolve(raiz, 'supabase/migrations'))).toBe(true)
  })
})
