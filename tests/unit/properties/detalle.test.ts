import { describe, expect, it } from 'vitest'
import { pesos } from '#shared/money/importe'
import {
  CAMPOS_DEL_DETALLE,
  fraccionesDisponibles,
  modoDelPlano,
  resolverDetalle,
} from '#shared/properties/detalle'
import type { PropiedadPublicada } from '#shared/properties/detalle'

/**
 * HU-02 · RF-02.1, RF-02.3, RF-02.5 — cómo se resuelve la ficha pública.
 */

function propiedad(cambios: Partial<PropiedadPublicada> = {}): PropiedadPublicada {
  return {
    id: 'p1',
    slug: 'casa-arena-palomino',
    name: 'Casa Arena Palomino',
    region: 'La Guajira',
    city: 'Palomino',
    country: 'CO',
    visibility: 'published',
    commercial: 'fractions_available',
    lowestPrice: pesos(180_000_000),
    availableFractions: 5,
    fractionCount: 8,
    soldFractions: 3,
    photoUrl: 'https://firmada/1.jpg',
    areaM2: 120,
    bedrooms: 3,
    bathrooms: 2,
    parkingSpots: 1,
    description: 'Una casa frente al mar con terraza y piscina privada, a dos cuadras de la playa de Palomino.',
    amenities: ['Piscina', 'Terraza'],
    address: null,
    videoUrl: null,
    fotos: [{ id: 'm1', kind: 'photo', path: 'p1/photo/1.jpg', position: 0, url: 'https://firmada/1.jpg' }],
    plano: null,
    video: null,
    ...cambios,
  }
}

describe('CA-02.1 · una publicada resuelve con todos los campos de RF-02.2 y RF-02.3', () => {
  it('CA-02.1 · dado un slug de propiedad publicada, el detalle trae la ficha completa', () => {
    const resolucion = resolverDetalle(propiedad(), { puedeGestionar: false })

    expect(resolucion.estado).toBe('publicada')
    if (resolucion.estado !== 'publicada') {
      return
    }
    for (const campo of CAMPOS_DEL_DETALLE) {
      expect(resolucion.propiedad, campo).toHaveProperty(campo)
    }
  })
})

describe('CA-02.2 · una no publicada o inexistente responde 404', () => {
  it('CA-02.2 · inexistente → no encontrada', () => {
    expect(resolverDetalle(null, { puedeGestionar: false })).toEqual({ estado: 'no_encontrada' })
  })

  it('CA-02.2 · en borrador o inactiva → no encontrada para el Visitante', () => {
    expect(resolverDetalle(propiedad({ visibility: 'draft' }), { puedeGestionar: false }).estado).toBe('no_encontrada')
    expect(resolverDetalle(propiedad({ visibility: 'inactive' }), { puedeGestionar: false }).estado).toBe('no_encontrada')
  })

  it('RF-02.1 · el Administrador asignado y el Superadmin la ven en vista previa con distintivo de borrador', () => {
    expect(resolverDetalle(propiedad({ visibility: 'draft' }), { puedeGestionar: true }).estado).toBe('vista_previa')
  })
})

describe('CA-02.3 · fracciones disponibles = 8 − vendidas', () => {
  it('CA-02.3 · con N vendidas quedan 8 − N', () => {
    expect(fraccionesDisponibles(0)).toBe(8)
    expect(fraccionesDisponibles(3)).toBe(5)
    expect(fraccionesDisponibles(8)).toBe(0)
  })

  it('nunca es negativo ni supera 8', () => {
    expect(fraccionesDisponibles(9)).toBe(0)
    expect(fraccionesDisponibles(-1)).toBe(8)
  })
})

describe('CA-02.4 · modo de presentación del plano elevado', () => {
  it('CA-02.4 · sin WebGL o con prefers-reduced-motion se muestra la imagen estática', () => {
    expect(modoDelPlano({ webgl: false, reducirMovimiento: false })).toBe('imagen')
    expect(modoDelPlano({ webgl: true, reducirMovimiento: true })).toBe('imagen')
  })

  it('CA-02.4 · con soporte y sin preferencia de movimiento reducido, el visor 3D', () => {
    expect(modoDelPlano({ webgl: true, reducirMovimiento: false })).toBe('visor3d')
  })
})
