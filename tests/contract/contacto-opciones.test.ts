import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clavesDeOpciones } from '#shared/contact/esquema'
import { aplanarClaves } from '#shared/i18n/keys'

/**
 * HU-46 · CA-46.3 y HU-03 · CA-03.3 — las opciones de las tres selecciones tienen
 * texto en ambos locales, en paridad, y no hay opciones traducidas de más.
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}

const es = locale('es')
const en = locale('en')
const claves = clavesDeOpciones()

describe('CA-46.3 · CA-03.3 · claves i18n de las selecciones', () => {
  it('CA-46.3 · las 10 opciones (4 intenciones, 3 tipos, 3 rangos) existen en es.json y en.json', () => {
    expect(claves).toHaveLength(10)
    expect(claves.filter(clave => !(clave in es))).toEqual([])
    expect(claves.filter(clave => !(clave in en))).toEqual([])
  })

  it('CA-03.3 · no hay opciones traducidas que el esquema no declare', () => {
    const grupos = ['contact.intents.', 'contact.propertyTypes.', 'contact.incomeRanges.']
    const sobrantes = Object.keys(es)
      .filter(clave => grupos.some(grupo => clave.startsWith(grupo)))
      .filter(clave => !claves.includes(clave))

    expect(sobrantes).toEqual([])
  })

  it('CA-46.3 · las opciones de renta llevan las cifras exactas de RF-46.3', () => {
    expect(es['contact.incomeRanges.under_4m']).toContain('4.000.000')
    expect(es['contact.incomeRanges.between_4m_7m']).toContain('7.000.000')
    expect(es['contact.incomeRanges.over_7m']).toContain('7.000.000')
  })
})
