/**
 * E1 · DT-10 · RT-03 — el manifiesto tipado de una página institucional.
 *
 * Cada página pública (HU-00, HU-41…HU-44, HU-48) declara aquí qué secciones
 * tiene, en qué orden, con qué claves i18n y adónde lleva cada CTA. La página lo
 * recorre y no fija secciones en el marcado; los criterios de aceptación se
 * prueban contra el manifiesto y contra los locales, nunca contra el HTML.
 */

import type { RutaPublica } from './rutas'

export interface CtaDeSeccion {
  labelKey: string
  destino: RutaPublica
}

export interface SeccionDePagina<Id extends string = string> {
  id: Id
  orden: number
  tituloKey: string
  /** Claves i18n adicionales que la sección pinta (antetítulo, descripción, ítems). */
  claves: readonly string[]
  cta?: CtaDeSeccion
}

/** Las secciones por su `orden`, en un arreglo nuevo. */
export function seccionesOrdenadas<T extends SeccionDePagina>(secciones: readonly T[]): T[] {
  return [...secciones].sort((a, b) => a.orden - b.orden)
}

/** Todas las claves i18n que el manifiesto promete, sin repetir. */
export function clavesDeSecciones(secciones: readonly SeccionDePagina[]): string[] {
  return [...new Set(secciones.flatMap(seccion => [
    seccion.tituloKey,
    ...seccion.claves,
    ...(seccion.cta ? [seccion.cta.labelKey] : []),
  ]))]
}

/**
 * Lo que invalida un manifiesto: un identificador repetido (`duplicated:<id>`) o
 * un orden que no crece de una sección a la siguiente (`order:<id>`).
 */
export function problemasDelManifiesto(secciones: readonly SeccionDePagina[]): string[] {
  const problemas: string[] = []
  const vistos = new Set<string>()
  let ordenAnterior = Number.NEGATIVE_INFINITY

  for (const seccion of secciones) {
    if (vistos.has(seccion.id)) {
      problemas.push(`duplicated:${seccion.id}`)
    }
    vistos.add(seccion.id)
    if (seccion.orden <= ordenAnterior) {
      problemas.push(`order:${seccion.id}`)
    }
    ordenAnterior = seccion.orden
  }

  return problemas
}

/**
 * Lo que invalida una lista de entradas tipadas (preguntas, testimonios): un
 * identificador repetido o una clave vacía en alguno de los campos exigidos.
 */
export function problemasDeEntradas<T extends { id: string }>(
  entradas: readonly T[],
  campos: readonly (keyof T & string)[],
): string[] {
  const problemas: string[] = []
  const vistos = new Set<string>()

  for (const entrada of entradas) {
    if (vistos.has(entrada.id)) {
      problemas.push(`duplicated:${entrada.id}`)
    }
    vistos.add(entrada.id)
    for (const campo of campos) {
      if (String(entrada[campo] ?? '').trim() === '') {
        problemas.push(`empty:${entrada.id}:${campo}`)
      }
    }
  }

  return problemas
}

/** Compone `prefijo.<id>.<campo>` para cada id y cada campo, en ese orden. */
export function clavesDe(prefijo: string, ids: readonly string[], campos: readonly string[]): string[] {
  return ids.flatMap(id => campos.map(campo => `${prefijo}.${id}.${campo}`))
}
