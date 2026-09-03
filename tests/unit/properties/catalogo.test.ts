import { describe, expect, it } from 'vitest'
import {
  administradoresDe,
  filtroVacio,
  filtrarPropiedades,
  hayFiltroActivo,
  propiedadesDelCatalogo,
  regionesDe,
} from '#shared/properties/catalogo'
import type { PropiedadListada } from '#shared/properties/catalogo'

/**
 * HU-08 · RF-08.2 y HU-10 · RF-10.2 — qué propiedades se ven y con qué filtros.
 *
 * Es lógica pura y compartida: el catálogo público (HU-01) y la vista global del
 * Superadmin (HU-10) filtran con las mismas funciones, y ninguna vista decide por su
 * cuenta qué esconder. Lo que la RLS ya haya recortado llega aquí como una lista más
 * corta; el filtro no es la frontera de seguridad, es la del interfaz.
 */

const ADMIN_A = 'b0000000-0000-4000-8000-00000000000a'
const ADMIN_B = 'b0000000-0000-4000-8000-00000000000b'

function propiedad(cambios: Partial<PropiedadListada> & { id: string }): PropiedadListada {
  return {
    name: `Propiedad ${cambios.id}`,
    region: 'La Guajira',
    visibility: 'published',
    commercial: 'fractions_available',
    adminIds: [ADMIN_A],
    ...cambios,
  }
}

const CATALOGO: PropiedadListada[] = [
  propiedad({ id: '1', visibility: 'published', region: 'La Guajira', adminIds: [ADMIN_A] }),
  propiedad({ id: '2', visibility: 'draft', region: 'La Guajira', adminIds: [ADMIN_A] }),
  propiedad({ id: '3', visibility: 'inactive', region: 'Magdalena', adminIds: [ADMIN_B] }),
  propiedad({ id: '4', visibility: 'published', region: 'Magdalena', commercial: 'sold_out', adminIds: [ADMIN_B] }),
  propiedad({ id: '5', visibility: 'published', region: 'Bolívar', commercial: 'coming_soon', adminIds: [ADMIN_A, ADMIN_B] }),
]

function ids(propiedades: PropiedadListada[]): string[] {
  return propiedades.map(entrada => entrada.id)
}

describe('CA-08.4 · el catálogo solo muestra lo publicado', () => {
  it('CA-08.4 · una propiedad en borrador no aparece en el catálogo', () => {
    expect(ids(propiedadesDelCatalogo(CATALOGO))).not.toContain('2')
  })

  it('CA-08.4 · una propiedad inactiva tampoco aparece', () => {
    expect(ids(propiedadesDelCatalogo(CATALOGO))).not.toContain('3')
  })

  it('CA-08.4 · quedan exactamente las publicadas', () => {
    expect(ids(propiedadesDelCatalogo(CATALOGO))).toEqual(['1', '4', '5'])
  })

  it('CA-08.4 · el catálogo no altera la lista que recibe', () => {
    const original = [...CATALOGO]
    propiedadesDelCatalogo(CATALOGO)

    expect(CATALOGO).toEqual(original)
  })
})

describe('CA-10.2 · filtros combinables de la vista global', () => {
  it('sin filtro no se recorta nada: el Superadmin ve todos los estados (CA-10.1)', () => {
    expect(ids(filtrarPropiedades(CATALOGO, filtroVacio()))).toEqual(['1', '2', '3', '4', '5'])
  })

  it('filtra por administrador asignado', () => {
    expect(ids(filtrarPropiedades(CATALOGO, { administrador: ADMIN_B }))).toEqual(['3', '4', '5'])
  })

  it('filtra por estado de visibilidad', () => {
    expect(ids(filtrarPropiedades(CATALOGO, { visibilidad: 'draft' }))).toEqual(['2'])
  })

  it('filtra por estado comercial', () => {
    expect(ids(filtrarPropiedades(CATALOGO, { comercial: 'sold_out' }))).toEqual(['4'])
  })

  it('filtra por región', () => {
    expect(ids(filtrarPropiedades(CATALOGO, { region: 'Magdalena' }))).toEqual(['3', '4'])
  })

  it('CA-10.2 · administrador + estado + región cumple los tres criterios a la vez', () => {
    const resultado = filtrarPropiedades(CATALOGO, {
      administrador: ADMIN_B,
      visibilidad: 'published',
      region: 'Magdalena',
    })

    expect(ids(resultado)).toEqual(['4'])
    expect(resultado.every(entrada => entrada.adminIds.includes(ADMIN_B))).toBe(true)
    expect(resultado.every(entrada => entrada.visibility === 'published')).toBe(true)
    expect(resultado.every(entrada => entrada.region === 'Magdalena')).toBe(true)
  })

  it('CA-10.2 · una combinación sin coincidencias devuelve la lista vacía, no todo', () => {
    expect(filtrarPropiedades(CATALOGO, { administrador: ADMIN_A, region: 'Magdalena' })).toEqual([])
  })

  it('RF-10.2 · un criterio nulo o vacío no filtra', () => {
    expect(ids(filtrarPropiedades(CATALOGO, { region: null, administrador: '', visibilidad: null })))
      .toEqual(['1', '2', '3', '4', '5'])
  })

  it('RF-10.2 · el texto busca por nombre sin distinguir mayúsculas ni acentos', () => {
    const conAcento = [propiedad({ id: '6', name: 'Casa Bahía Solano' })]

    expect(ids(filtrarPropiedades(conAcento, { texto: 'bahia' }))).toEqual(['6'])
    expect(ids(filtrarPropiedades(conAcento, { texto: 'SOLANO' }))).toEqual(['6'])
    expect(filtrarPropiedades(conAcento, { texto: 'palomino' })).toEqual([])
  })

  it('RF-10.2 · el filtrado es puro: no reordena ni muta la lista de entrada', () => {
    const original = [...CATALOGO]
    filtrarPropiedades(CATALOGO, { region: 'Magdalena' })

    expect(CATALOGO).toEqual(original)
  })
})

describe('RF-10.2 · opciones que la interfaz ofrece sin inventarlas', () => {
  it('las regiones salen de los datos, ordenadas y sin repetir', () => {
    expect(regionesDe(CATALOGO)).toEqual(['Bolívar', 'La Guajira', 'Magdalena'])
  })

  it('los administradores salen de las asignaciones, sin repetir', () => {
    expect(administradoresDe(CATALOGO)).toEqual([ADMIN_A, ADMIN_B])
  })

  it('un filtro vacío se reconoce como tal, para poder ofrecer «limpiar»', () => {
    expect(hayFiltroActivo(filtroVacio())).toBe(false)
    expect(hayFiltroActivo({ region: '  ' })).toBe(false)
    expect(hayFiltroActivo({ region: 'Magdalena' })).toBe(true)
  })
})
