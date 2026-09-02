import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aplanarClaves } from '#shared/i18n/keys'

/**
 * Contrato de RT-05 y del principio 6 de la constitución:
 * `en.json` y `es.json` siempre en paridad de claves, sin valores vacíos.
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8'))
}

const es = aplanarClaves(locale('es'))
const en = aplanarClaves(locale('en'))

describe('RT-05 · paridad de claves entre locales', () => {
  it('ambos locales declaran claves', () => {
    expect(Object.keys(es).length).toBeGreaterThan(0)
    expect(Object.keys(en).length).toBeGreaterThan(0)
  })

  it('toda clave de es.json existe en en.json', () => {
    const faltantes = Object.keys(es).filter(clave => !(clave in en))

    expect(faltantes).toEqual([])
  })

  it('toda clave de en.json existe en es.json', () => {
    const faltantes = Object.keys(en).filter(clave => !(clave in es))

    expect(faltantes).toEqual([])
  })

  it('ningún valor traducido queda vacío', () => {
    const vacias = [...Object.entries(es), ...Object.entries(en)]
      .filter(([, valor]) => typeof valor !== 'string' || valor.trim() === '')
      .map(([clave]) => clave)

    expect(vacias).toEqual([])
  })

  it('ninguna traducción quedó igual al identificador de su clave', () => {
    const sinTraducir = Object.entries(en).filter(([clave, valor]) => valor === clave)

    expect(sinTraducir).toEqual([])
  })
})
