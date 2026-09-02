import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato de RT-01: el proyecto compila con TypeScript `strict`.
 * Complementa a `tsc --build`, que es quien realmente falla si un tipo no cierra.
 */

const raiz = process.cwd()

describe('RT-01 · TypeScript strict', () => {
  it('nuxt.config.ts declara `strict`', () => {
    const configuracion = readFileSync(resolve(raiz, 'nuxt.config.ts'), 'utf8')

    expect(configuracion).toMatch(/typescript:\s*\{[^}]*strict:\s*true/s)
  })

  it.each(['app', 'server', 'shared', 'node'])('el tsconfig generado de %s queda en modo estricto', (proyecto) => {
    const generado = readFileSync(resolve(raiz, `.nuxt/tsconfig.${proyecto}.json`), 'utf8')

    expect(generado).toMatch(/"strict":\s*true/)
  })
})
