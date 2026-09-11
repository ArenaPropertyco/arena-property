import { describe, expect, it } from 'vitest'
import { clavesDe, clavesDeSecciones, problemasDelManifiesto, seccionesOrdenadas } from '#shared/content/manifiesto'
import type { SeccionDePagina } from '#shared/content/manifiesto'
import { RUTAS_PUBLICAS } from '#shared/content/rutas'

/**
 * E1 · DT-10 · RT-03 — el manifiesto tipado genérico del que salen todas las
 * páginas institucionales. Lo que aquí se prueba vale para cada manifiesto.
 */

const secciones: SeccionDePagina[] = [
  { id: 'b', orden: 2, tituloKey: 'x.b.title', claves: ['x.b.description'] },
  { id: 'a', orden: 1, tituloKey: 'x.a.title', claves: [], cta: { labelKey: 'x.a.cta', destino: RUTAS_PUBLICAS.registro } },
]

describe('manifiesto genérico', () => {
  it('ordena por `orden` sin mutar la entrada', () => {
    expect(seccionesOrdenadas(secciones).map(s => s.id)).toEqual(['a', 'b'])
    expect(secciones.map(s => s.id)).toEqual(['b', 'a'])
  })

  it('reúne todas las claves i18n prometidas, incluida la del CTA, sin repetir', () => {
    expect(clavesDeSecciones(secciones)).toEqual(['x.b.title', 'x.b.description', 'x.a.title', 'x.a.cta'])
    expect(clavesDeSecciones([...secciones, ...secciones])).toHaveLength(4)
  })

  it('detecta identificadores repetidos y órdenes no crecientes', () => {
    // El orden se juzga tal como se declara: un manifiesto desordenado es un error, no algo que arreglar por debajo.
    expect(problemasDelManifiesto(secciones)).toEqual(['order:a'])
    expect(problemasDelManifiesto(seccionesOrdenadas(secciones))).toEqual([])
    expect(problemasDelManifiesto([...seccionesOrdenadas(secciones), { id: 'a', orden: 3, tituloKey: 't', claves: [] }])).toEqual(['duplicated:a'])
    expect(problemasDelManifiesto([{ id: 'a', orden: 2, tituloKey: 't', claves: [] }, { id: 'b', orden: 2, tituloKey: 't', claves: [] }])).toEqual(['order:b'])
  })

  it('compone claves por prefijo, identificador y campo', () => {
    expect(clavesDe('p.items', ['one', 'two'], ['title', 'description']))
      .toEqual(['p.items.one.title', 'p.items.one.description', 'p.items.two.title', 'p.items.two.description'])
  })
})
