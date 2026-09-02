import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contrato del principio 1 de la constitución ("Stack cerrado"):
 * `package.json` no contiene nada fuera de `docs/stack.md`, y los módulos base
 * declarados ahí están instalados y registrados en `nuxt.config.ts`.
 */

const raiz = process.cwd()
const stackMd = readFileSync(resolve(raiz, 'docs/stack.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const nuxtConfig = readFileSync(resolve(raiz, 'nuxt.config.ts'), 'utf8')

/** La plataforma misma, nombrada en la sección "Plataforma" de stack.md. */
const PLATAFORMA = ['nuxt', 'vue', 'vue-router']

function seccion(desde: string, hasta: string): string {
  const inicio = stackMd.indexOf(desde)
  const fin = hasta ? stackMd.indexOf(hasta) : stackMd.length
  return stackMd.slice(inicio, fin === -1 ? stackMd.length : fin)
}

/** Nombres entre comillas invertidas en la primera columna de una tabla. */
function paquetesDeTabla(texto: string): string[] {
  return [...texto.matchAll(/^\|\s*`([^`]+)`(?:\s*\+\s*`([^`]+)`)?\s*\|/gm)]
    .flatMap(fila => [fila[1], fila[2]])
    .filter((nombre): nombre is string => Boolean(nombre))
}

/** Nombres entre comillas invertidas en un párrafo. */
function paquetesDeParrafo(texto: string): string[] {
  return [...texto.matchAll(/`([^`]+)`/g)]
    .map(coincidencia => coincidencia[1])
    .filter((nombre): nombre is string => Boolean(nombre) && /^(@[\w.-]+\/)?[\w.-]+$/.test(nombre!))
}

const modulosBase = paquetesDeTabla(seccion('## Módulos base', '## Complementos aprobados'))
const complementos = paquetesDeTabla(seccion('## Complementos aprobados', '## Necesidades resueltas'))
const desarrollo = paquetesDeParrafo(seccion('## Dependencias de desarrollo permitidas', ''))

const aprobadas = new Set([...PLATAFORMA, ...modulosBase, ...complementos, ...desarrollo])

describe('RT-01 · stack cerrado', () => {
  it('stack.md declara los 13 módulos base', () => {
    expect(modulosBase).toHaveLength(13)
  })

  it('ninguna dependencia de package.json está fuera de stack.md', () => {
    const instaladas = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]
    const noAprobadas = instaladas.filter(nombre => !aprobadas.has(nombre))

    expect(noAprobadas).toEqual([])
  })

  it('los 13 módulos base están instalados', () => {
    const instaladas = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ])
    const faltantes = modulosBase.filter(nombre => !instaladas.has(nombre))

    expect(faltantes).toEqual([])
  })

  it('los complementos aprobados están instalados', () => {
    const instaladas = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ])
    const faltantes = complementos.filter(nombre => !instaladas.has(nombre))

    expect(faltantes).toEqual([])
  })

  it('los 13 módulos base están registrados en nuxt.config.ts', () => {
    const faltantes = modulosBase.filter(nombre => !nuxtConfig.includes(nombre))

    expect(faltantes).toEqual([])
  })

  it('no se instala `framer-motion`: es una librería de React (stack.md)', () => {
    const instaladas = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ])

    expect(instaladas.has('framer-motion')).toBe(false)
  })
})
