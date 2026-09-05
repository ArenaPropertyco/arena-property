import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { clavesDelManifiesto, IDS_DE_SECCION, SECCIONES_DE_LA_HOME } from '#shared/content/home'
import { archivosDePagina, RUTAS_PUBLICAS } from '#shared/content/rutas'
import { aplanarClaves } from '#shared/i18n/keys'

/**
 * HU-00 · RF-00.2 · RT-03 — la home se prueba por contrato sobre su manifiesto
 * tipado, nunca contra el marcado renderizado (principio 4).
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}

describe('CA-00.1 · el manifiesto declara las siete secciones de RF-00.1', () => {
  it('CA-00.1 · son exactamente navbar, hero, modelo de negocio, beneficios, propiedades, CTA y footer, en ese orden', () => {
    expect(SECCIONES_DE_LA_HOME.map(seccion => seccion.id))
      .toEqual(['navbar', 'hero', 'business_model', 'benefits', 'properties', 'cta', 'footer'])
    expect([...IDS_DE_SECCION]).toEqual(SECCIONES_DE_LA_HOME.map(seccion => seccion.id))
  })

  it('CA-00.1 · el orden declarado es creciente y sin identificadores duplicados', () => {
    const ordenes = SECCIONES_DE_LA_HOME.map(seccion => seccion.orden)
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))
    expect(new Set(SECCIONES_DE_LA_HOME.map(seccion => seccion.id)).size).toBe(SECCIONES_DE_LA_HOME.length)
  })
})

describe('CA-00.2 · cada CTA resuelve a una ruta declarada del router', () => {
  const conCta = SECCIONES_DE_LA_HOME.filter(seccion => seccion.cta)

  it('CA-00.2 · modelo de negocio → HU-41, beneficios → HU-42, CTA principal → registro o catálogo', () => {
    const destinos = Object.fromEntries(conCta.map(seccion => [seccion.id, seccion.cta!.destino]))

    expect(destinos.business_model).toBe(RUTAS_PUBLICAS.modelo)
    expect(destinos.benefits).toBe(RUTAS_PUBLICAS.beneficios)
    expect(destinos.properties).toBe(RUTAS_PUBLICAS.catalogo)
    expect([RUTAS_PUBLICAS.registro, RUTAS_PUBLICAS.catalogo]).toContain(destinos.cta)
  })

  it.each(conCta.map(seccion => [seccion.id, seccion.cta!.destino] as const))(
    'CA-00.2 · el destino de %s (%s) existe como página en app/pages',
    (_id, destino) => {
      const candidatos = archivosDePagina(destino)
      expect(candidatos.some(archivo => existsSync(resolve(raiz, archivo))), `${destino} → ${candidatos.join(' | ')}`).toBe(true)
    },
  )

  it.each(Object.values(RUTAS_PUBLICAS))('la ruta pública %s tiene página', (ruta) => {
    expect(archivosDePagina(ruta).some(archivo => existsSync(resolve(raiz, archivo)))).toBe(true)
  })
})

describe('CA-00.3 · las claves i18n del manifiesto existen en ambos locales', () => {
  const es = locale('es')
  const en = locale('en')
  const claves = clavesDelManifiesto(SECCIONES_DE_LA_HOME)

  it('el manifiesto aporta claves que comprobar', () => {
    expect(claves.length).toBeGreaterThan(7)
  })

  it('CA-00.3 · toda clave del manifiesto existe en es.json', () => {
    expect(claves.filter(clave => !(clave in es))).toEqual([])
  })

  it('CA-00.3 · toda clave del manifiesto existe en en.json, en paridad', () => {
    expect(claves.filter(clave => !(clave in en))).toEqual([])
  })
})
