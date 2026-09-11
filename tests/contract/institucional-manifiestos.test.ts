import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COMPARATIVO, SECCIONES_DE_BENEFICIOS, VENTAJAS } from '#shared/content/beneficios'
import { REGLAS_PUBLICADAS, SECCIONES_DE_AGENDAMIENTO } from '#shared/content/agendamiento'
import { CONDICIONES_DEL_PROGRAMA, PASOS_DEL_PROGRAMA, RUTA_DE_INSCRIPCION, SECCIONES_DE_EMBAJADORES } from '#shared/content/embajadores'
import { clavesDe, clavesDeSecciones } from '#shared/content/manifiesto'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { LO_QUE_HACEMOS, LO_QUE_NO_SOMOS, PASOS_DE_COMPRA, PILARES_DE_LA_ESTRUCTURA, SECCIONES_DEL_MODELO } from '#shared/content/modelo'
import { INFORMACION_DE_INTERES, PREGUNTAS_FRECUENTES, SECCIONES_DE_NOSOTROS, TESTIMONIOS } from '#shared/content/nosotros'
import { archivosDePagina, RUTAS_PUBLICAS } from '#shared/content/rutas'
import { aplanarClaves } from '#shared/i18n/keys'

/**
 * HU-41, HU-42, HU-43, HU-44, HU-48 · RT-03 · DT-10 — las subpáginas
 * institucionales se prueban por contrato: manifiesto, rutas e i18n. Nunca contra
 * el marcado renderizado (principio 4).
 */

const raiz = process.cwd()

function locale(codigo: string): Record<string, string> {
  return aplanarClaves(JSON.parse(readFileSync(resolve(raiz, `i18n/locales/${codigo}.json`), 'utf8')))
}

const es = locale('es')
const en = locale('en')

/** Todas las claves que cada página promete: manifiesto más sus estructuras. */
const PAGINAS: Record<string, { secciones: readonly SeccionDePagina[], extra: string[] }> = {
  'HU-41 · modelo': {
    secciones: SECCIONES_DEL_MODELO,
    extra: [
      ...clavesDe('model.structure.items', PILARES_DE_LA_ESTRUCTURA, ['title', 'description']),
      ...clavesDe('model.whatWeDo.items', LO_QUE_HACEMOS, ['title', 'description']),
      ...clavesDe('model.whatWeAreNot.items', LO_QUE_NO_SOMOS, ['title', 'description']),
      ...clavesDe('model.path.steps', PASOS_DE_COMPRA.map(p => p.id), ['title', 'description']),
    ],
  },
  'HU-42 · beneficios': {
    secciones: SECCIONES_DE_BENEFICIOS,
    extra: [
      ...COMPARATIVO.flatMap(fila => [fila.labelKey, fila.traditional.textoKey, fila.fractional.textoKey].filter((c): c is string => Boolean(c))),
      ...clavesDe('benefits.items', VENTAJAS, ['title', 'description']),
    ],
  },
  'HU-43 · agendamiento': {
    secciones: SECCIONES_DE_AGENDAMIENTO,
    extra: [
      ...clavesDe('scheduling.rules', REGLAS_PUBLICADAS, ['title', 'description']),
      ...['alta', 'media_alta', 'media', 'baja'].map(t => `scheduling.seasons.names.${t}`),
    ],
  },
  'HU-44 · nosotros': {
    secciones: SECCIONES_DE_NOSOTROS,
    extra: [
      ...PREGUNTAS_FRECUENTES.flatMap(p => [p.preguntaKey, p.respuestaKey]),
      ...TESTIMONIOS.flatMap(t => [t.autorKey, t.rolKey, t.citaKey]),
      ...clavesDe('about.info.items', INFORMACION_DE_INTERES, ['title', 'description']),
    ],
  },
  'HU-48 · embajadores': {
    secciones: SECCIONES_DE_EMBAJADORES,
    extra: [
      ...clavesDe('ambassadors.flow.steps', PASOS_DEL_PROGRAMA, ['title', 'description']),
      ...clavesDe('ambassadors.terms.items', CONDICIONES_DEL_PROGRAMA, ['title', 'description']),
    ],
  },
}

describe.each(Object.entries(PAGINAS))('%s · claves i18n en paridad (CA-41.3, CA-42.3, CA-43.3, CA-44.3, CA-48.3)', (_pagina, { secciones, extra }) => {
  const claves = [...new Set([...clavesDeSecciones(secciones), ...extra])]

  it('el manifiesto aporta claves que comprobar', () => {
    expect(claves.length).toBeGreaterThan(4)
  })

  it('toda clave existe en es.json', () => {
    expect(claves.filter(clave => !(clave in es))).toEqual([])
  })

  it('toda clave existe en en.json, en paridad', () => {
    expect(claves.filter(clave => !(clave in en))).toEqual([])
  })

  it('CA-44.2 · ningún texto prometido queda vacío en ninguno de los dos idiomas', () => {
    expect(claves.filter(clave => (es[clave] ?? '').trim() === '' || (en[clave] ?? '').trim() === '')).toEqual([])
  })
})

describe('paridad de locales por página, con nombre propio para la trazabilidad', () => {
  it('CA-41.3 · las claves del manifiesto del modelo de negocio existen en es.json y en.json', () => {
    const claves = clavesDeSecciones(SECCIONES_DEL_MODELO)
    expect(claves.filter(clave => !(clave in es) || !(clave in en))).toEqual([])
  })

  it('CA-48.3 · las claves del manifiesto del Programa de Embajadores existen en es.json y en.json', () => {
    const claves = clavesDeSecciones(SECCIONES_DE_EMBAJADORES)
    expect(claves.filter(clave => !(clave in es) || !(clave in en))).toEqual([])
  })
})

describe('CA-41.2 · CA-43.3 · CA-44.3 · CA-48.2 · cada CTA resuelve a una ruta declarada del router', () => {
  const conCta = Object.values(PAGINAS).flatMap(({ secciones }) => secciones.filter(s => s.cta))

  it('todos los CTA de las subpáginas llevan al registro (HU-04)', () => {
    expect(conCta.length).toBeGreaterThanOrEqual(5)
    expect(new Set(conCta.map(s => s.cta!.destino))).toEqual(new Set([RUTAS_PUBLICAS.registro]))
  })

  it.each(Object.values(RUTAS_PUBLICAS))('la ruta pública %s tiene página', (ruta) => {
    expect(archivosDePagina(ruta).some(archivo => existsSync(resolve(raiz, archivo)))).toBe(true)
  })

  it('CA-48.2 · el destino con sesión del CTA de Embajadores existe como página privada', () => {
    expect(archivosDePagina(RUTA_DE_INSCRIPCION).some(archivo => existsSync(resolve(raiz, archivo)))).toBe(true)
  })

  it('las subpáginas ya no son marcadores de posición', () => {
    for (const ruta of [RUTAS_PUBLICAS.modelo, RUTAS_PUBLICAS.beneficios, RUTAS_PUBLICAS.agendamiento, RUTAS_PUBLICAS.nosotros]) {
      const archivo = archivosDePagina(ruta).find(candidato => existsSync(resolve(raiz, candidato)))!
      expect(readFileSync(resolve(raiz, archivo), 'utf8')).not.toContain('PublicPlaceholder')
    }
  })
})
