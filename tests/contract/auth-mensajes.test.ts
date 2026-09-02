import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aplanarClaves } from '#shared/i18n/keys'
import { CLAVES_DE_ERROR_DE_AUTH } from '#shared/identity/errores'
import { CLAVES_DE_VALIDACION } from '#shared/identity/registro'

/**
 * HU-04 · RF-04.5 — contrato: toda clave de error o validación que el dominio pueda
 * devolver existe en los dos locales, y ningún texto visible expone detalle técnico.
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}

const es = locale('es')
const en = locale('en')

/** Palabras que delatan un mensaje técnico filtrado a la interfaz. */
const DETALLE_TECNICO = /supabase|postgres|jwt|token|sql|null|undefined|stack|exception|status \d{3}|\bpq:/i

describe('RF-04.5 · mensajes de autenticación', () => {
  it.each([...CLAVES_DE_ERROR_DE_AUTH, ...CLAVES_DE_VALIDACION])('la clave %s existe en es.json y en.json', (clave) => {
    expect(es[clave], `falta en es.json: ${clave}`).toBeTruthy()
    expect(en[clave], `falta en en.json: ${clave}`).toBeTruthy()
  })

  it('ningún mensaje de autenticación expone detalle técnico', () => {
    const claves = [...CLAVES_DE_ERROR_DE_AUTH, ...CLAVES_DE_VALIDACION]
    const sospechosos = claves
      .flatMap(clave => [[clave, es[clave]], [clave, en[clave]]])
      .filter(([, texto]) => DETALLE_TECNICO.test(texto ?? ''))

    expect(sospechosos).toEqual([])
  })
})
