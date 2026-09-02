import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aplanarClaves } from '#shared/i18n/keys'

/**
 * Contrato del principio 6 ("cero strings visibles hardcodeados"):
 * toda clave i18n usada en el código existe en los dos locales.
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}

const es = locale('es')
const en = locale('en')

function archivos(directorio: string, extensiones: string[]): string[] {
  const absoluto = resolve(raiz, directorio)
  let entradas: string[]
  try {
    entradas = readdirSync(absoluto)
  }
  catch {
    return []
  }

  return entradas.flatMap((entrada) => {
    const ruta = join(directorio, entrada)
    if (statSync(resolve(raiz, ruta)).isDirectory()) {
      return archivos(ruta, extensiones)
    }
    return extensiones.some(extension => entrada.endsWith(extension)) ? [ruta] : []
  })
}

/** Claves citadas como `t('a.b')` o `$t("a.b")` en el código de la interfaz. */
function clavesUsadas(): { clave: string, archivo: string }[] {
  return archivos('app', ['.vue', '.ts']).flatMap((archivo) => {
    const contenido = readFileSync(resolve(raiz, archivo), 'utf8')
    // Solo `t(` o `$t(` como identificador entero: `select('user_id')` también termina en `t(`.
    return [...contenido.matchAll(/(?<![\w$.])\$?t\(\s*['"]([\w.]+)['"]/g)]
      .map(coincidencia => ({ clave: coincidencia[1]!, archivo }))
  })
}

describe('RT-05 · las claves usadas existen en ambos locales', () => {
  it('ninguna clave usada falta en es.json', () => {
    const faltantes = clavesUsadas().filter(({ clave }) => !(clave in es))

    expect(faltantes).toEqual([])
  })

  it('ninguna clave usada falta en en.json', () => {
    const faltantes = clavesUsadas().filter(({ clave }) => !(clave in en))

    expect(faltantes).toEqual([])
  })
})
