import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato de las compuertas del plan §5: `pnpm lint`, `pnpm test` y el informe
 * de trazabilidad corren en integración continua sobre cada pull request.
 */

const raiz = process.cwd()
const RUTA_CI = '.github/workflows/ci.yml'

describe('RT-01 · compuertas de integración continua', () => {
  it('existe el flujo de integración continua', () => {
    expect(existsSync(resolve(raiz, RUTA_CI))).toBe(true)
  })

  it.each(['pnpm lint', 'pnpm test', 'pnpm trace'])('el flujo ejecuta `%s`', (comando) => {
    expect(readFileSync(resolve(raiz, RUTA_CI), 'utf8')).toContain(comando)
  })

  it('el flujo se dispara en cada pull request', () => {
    expect(readFileSync(resolve(raiz, RUTA_CI), 'utf8')).toMatch(/pull_request/)
  })

  it('package.json declara los comandos de las compuertas', () => {
    const paquete = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(Object.keys(paquete.scripts)).toEqual(expect.arrayContaining(['lint', 'test', 'trace']))
  })
})
