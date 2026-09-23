import { describe, expect, it } from 'vitest'
import { buscarPropiedadesAsignadas } from '#shared/properties/buscador'
import { filtroVacio } from '#shared/properties/catalogo'
import type { PropiedadListada } from '#shared/properties/catalogo'

/**
 * HU-22 · RF-22.1, RF-22.2, RF-22.3 — el buscador del Administrador.
 *
 * Reutiliza el filtro de HU-10 (texto, región, estados) sobre las propiedades
 * que de verdad administra (HU-05). La RLS deja pasar lo publicado a cualquiera;
 * aquí se recorta a lo asignado antes de buscar, así que un término que solo
 * coincide con una propiedad ajena no devuelve nada (CA-22.3).
 */

const ADMIN_A = 'admin-a'
const ADMIN_B = 'admin-b'

function propiedad(cambios: Partial<PropiedadListada> & { id: string, name: string }): PropiedadListada {
  return {
    region: 'Bolívar',
    city: 'Cartagena',
    visibility: 'published',
    commercial: 'fractions_available',
    adminIds: [ADMIN_A],
    ...cambios,
  }
}

const PROPIEDADES: PropiedadListada[] = [
  propiedad({ id: '1', name: 'Casa Cartagena Centro', region: 'Bolívar', city: 'Cartagena' }),
  propiedad({ id: '2', name: 'Refugio Salento', region: 'Quindío', city: 'Salento', visibility: 'draft' }),
  propiedad({ id: '3', name: 'Bahía Sol', region: 'Bolívar', city: 'CARTAGENA', commercial: 'sold_out' }),
  // Ajena: solo la administra B.
  propiedad({ id: '4', name: 'Cartagena Mar', region: 'Bolívar', city: 'Cartagena', adminIds: [ADMIN_B] }),
]

const ACTOR_A = { id: ADMIN_A, esSuperadmin: false }

describe('CA-22.1 · RF-22.1 · la búsqueda normaliza mayúsculas y acentos', () => {
  it('CA-22.1 · «cartagena» coincide con «Cartagena» y «CARTAGENA», por nombre o por ubicación', () => {
    const ids = buscarPropiedadesAsignadas(PROPIEDADES, { ...filtroVacio(), texto: 'cartagena' }, ACTOR_A).map(p => p.id)
    expect(ids).toEqual(['1', '3'])
  })

  it('«bahia» sin tilde encuentra «Bahía»', () => {
    expect(buscarPropiedadesAsignadas(PROPIEDADES, { ...filtroVacio(), texto: 'bahia' }, ACTOR_A).map(p => p.id)).toEqual(['3'])
  })
})

describe('CA-22.2 · RF-22.2 · texto, región y estado se combinan', () => {
  it('CA-22.2 · el resultado cumple los tres criterios a la vez', () => {
    const ids = buscarPropiedadesAsignadas(
      PROPIEDADES,
      { ...filtroVacio(), texto: 'cartagena', region: 'Bolívar', comercial: 'sold_out' },
      ACTOR_A,
    ).map(p => p.id)
    expect(ids).toEqual(['3'])
  })

  it('el estado de visibilidad también filtra', () => {
    expect(buscarPropiedadesAsignadas(PROPIEDADES, { ...filtroVacio(), visibilidad: 'draft' }, ACTOR_A).map(p => p.id)).toEqual(['2'])
  })
})

describe('CA-22.3 · RF-22.3 · nunca devuelve propiedades no asignadas', () => {
  it('CA-22.3 · un término que solo coincide con una propiedad ajena no la trae', () => {
    expect(buscarPropiedadesAsignadas(PROPIEDADES, { ...filtroVacio(), texto: 'Cartagena Mar' }, ACTOR_A)).toEqual([])
  })

  it('sin filtro, el Administrador ve solo las suyas; el Superadmin, todas', () => {
    expect(buscarPropiedadesAsignadas(PROPIEDADES, filtroVacio(), ACTOR_A).map(p => p.id)).toEqual(['1', '2', '3'])
    expect(buscarPropiedadesAsignadas(PROPIEDADES, filtroVacio(), { id: 's', esSuperadmin: true })).toHaveLength(4)
  })
})
