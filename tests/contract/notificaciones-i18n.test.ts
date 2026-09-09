import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { aplanarClaves } from '#shared/i18n/keys'
import { TIPOS_DE_NOTIFICACION } from '#shared/notifications/tipos'

/**
 * TR-03 · RF-N.5 · RT-05 — la bandeja pinta cada tipo con título y cuerpo desde
 * i18n, en ambos locales y sin tipos traducidos de más.
 */

const raiz = process.cwd()
function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}
const es = locale('es')
const en = locale('en')

describe('RT-05 · claves de la bandeja por tipo de notificación', () => {
  it.each(TIPOS_DE_NOTIFICACION)('%s tiene título y cuerpo en es.json y en.json', (tipo) => {
    for (const campo of ['title', 'body']) {
      expect(es[`notifications.kinds.${tipo}.${campo}`], `es ${tipo}.${campo}`).toBeTruthy()
      expect(en[`notifications.kinds.${tipo}.${campo}`], `en ${tipo}.${campo}`).toBeTruthy()
    }
  })

  it('no hay tipos traducidos que el catálogo no declare', () => {
    const sobrantes = Object.keys(es)
      .filter(clave => clave.startsWith('notifications.kinds.'))
      .map(clave => clave.split('.')[2]!)
      .filter(tipo => !(TIPOS_DE_NOTIFICACION as readonly string[]).includes(tipo))

    expect([...new Set(sobrantes)]).toEqual([])
  })
})
