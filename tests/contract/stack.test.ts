import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
  it('stack.md declara los 14 módulos base', () => {
    expect(modulosBase).toHaveLength(14)
  })

  it('ninguna dependencia de package.json está fuera de stack.md', () => {
    const instaladas = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]
    const noAprobadas = instaladas.filter(nombre => !aprobadas.has(nombre))

    expect(noAprobadas).toEqual([])
  })

  it('los 14 módulos base están instalados', () => {
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

  it('los 14 módulos base están registrados en nuxt.config.ts', () => {
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

  /**
   * T-271 · el stack cerrado también vale para lo que el código importa: un paquete
   * que llega como dependencia de otro no se usa directo en tiempo de ejecución,
   * porque su versión la decide un tercero. Solo se admiten tipos de los motores
   * que la propia plataforma trae (Nitro, el cliente de `@nuxtjs/supabase`), que
   * desaparecen al compilar.
   */
  it('el código no importa en ejecución ningún paquete fuera de package.json', () => {
    const declaradas = new Set([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ])
    const soloTipos = new Set(['h3', '@supabase/supabase-js'])

    function archivos(dir: string): string[] {
      return readdirSync(dir).flatMap((entrada) => {
        const ruta = join(dir, entrada)
        return statSync(ruta).isDirectory() ? archivos(ruta) : /\.(ts|vue)$/.test(entrada) ? [ruta] : []
      })
    }

    const fuera = ['app', 'shared', 'server'].flatMap(dir => archivos(resolve(raiz, dir))).flatMap((archivo) => {
      const codigo = readFileSync(archivo, 'utf8')
      return [...codigo.matchAll(/^import\s+(type\s+)?[^'"]*from\s+'([^'.#~][^']*)'/gm)].flatMap(([, tipo, origen]) => {
        const paquete = origen!.startsWith('@') ? origen!.split('/').slice(0, 2).join('/') : origen!.split('/')[0]!
        if (paquete.startsWith('node:') || declaradas.has(paquete) || (tipo && soloTipos.has(paquete))) {
          return []
        }
        return [`${archivo.slice(raiz.length + 1)} → ${origen}`]
      })
    })

    expect(fuera).toEqual([])
  })
})
