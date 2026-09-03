import { describe, expect, it } from 'vitest'
import {
  CAMPOS_DE_FICHA,
  CLAVES_DE_VALIDACION_DE_FICHA,
  LONGITUD_MINIMA_DE_DESCRIPCION,
  normalizarFicha,
  validarFicha,
} from '#shared/properties/ficha'
import type { FichaTecnica } from '#shared/properties/ficha'

/**
 * HU-08 · RF-08.1 — ficha técnica de la propiedad.
 *
 * Validación pura con claves i18n, igual que el registro (HU-04): el dominio no
 * contiene texto visible y la interfaz traduce. Cada campo falla por separado para
 * que el formulario pueda señalar exactamente dónde está el problema (CA-08.3).
 */

function ficha(cambios: Partial<FichaTecnica> = {}): FichaTecnica {
  return {
    name: 'Casa Arena Palomino',
    areaM2: 240,
    bedrooms: 4,
    bathrooms: 3,
    parkingSpots: 2,
    description: 'Casa frente al mar con terraza, piscina privada y acceso directo a la playa. '
      + 'Distribuida en dos niveles, con zona social abierta y cocina integral equipada.',
    amenities: ['Piscina', 'Aire acondicionado', 'Wifi'],
    location: { country: 'CO', region: 'La Guajira', city: 'Palomino', address: 'Km 3 vía Palomino' },
    photos: 6,
    videoUrl: null,
    floorPlanPath: null,
    ...cambios,
  }
}

function camposConError(cambios: Partial<FichaTecnica>): string[] {
  return validarFicha(ficha(cambios)).map(error => error.name)
}

describe('CA-08.3 · validación de la ficha técnica', () => {
  it('una ficha completa y en rango no produce errores', () => {
    expect(validarFicha(ficha())).toEqual([])
  })

  it('CA-08.3 · m² menor o igual que cero se rechaza', () => {
    expect(camposConError({ areaM2: 0 })).toEqual(['areaM2'])
    expect(camposConError({ areaM2: -40 })).toEqual(['areaM2'])
  })

  it('CA-08.3 · las cuentas de habitaciones, baños y estacionamientos son enteros no negativos', () => {
    expect(camposConError({ bedrooms: -1 })).toEqual(['bedrooms'])
    expect(camposConError({ bathrooms: 2.5 })).toEqual(['bathrooms'])
    expect(camposConError({ parkingSpots: -2 })).toEqual(['parkingSpots'])
  })

  it('CA-08.3 · un estudio sin habitaciones y sin parqueadero es válido', () => {
    expect(validarFicha(ficha({ bedrooms: 0, parkingSpots: 0 }))).toEqual([])
  })

  it('CA-08.3 · el nombre no puede quedar vacío', () => {
    expect(camposConError({ name: '   ' })).toEqual(['name'])
  })

  it('CA-08.3 · la descripción larga exige un mínimo real de contenido', () => {
    expect(camposConError({ description: 'Bonita casa.' })).toEqual(['description'])
    expect(validarFicha(ficha({ description: 'x'.repeat(LONGITUD_MINIMA_DE_DESCRIPCION) }))).toEqual([])
  })

  it('CA-08.3 · la ubicación exige país, región y ciudad', () => {
    expect(camposConError({ location: { country: '', region: 'La Guajira', city: 'Palomino', address: '' } }))
      .toEqual(['location'])
    expect(camposConError({ location: { country: 'CO', region: '  ', city: 'Palomino', address: '' } }))
      .toEqual(['location'])
    expect(camposConError({ location: { country: 'CO', region: 'La Guajira', city: '', address: '' } }))
      .toEqual(['location'])
  })

  it('CA-08.3 · la dirección es opcional: no toda propiedad la publica', () => {
    expect(validarFicha(ficha({ location: { country: 'CO', region: 'La Guajira', city: 'Palomino', address: '' } })))
      .toEqual([])
  })

  it('CA-08.3 · RF-08.1 · la ficha no queda completa sin al menos una foto', () => {
    expect(camposConError({ photos: 0 })).toEqual(['photos'])
  })

  it('CA-08.3 · el equipamiento no admite entradas vacías', () => {
    expect(camposConError({ amenities: ['Piscina', '   '] })).toEqual(['amenities'])
  })

  it('CA-08.3 · el equipamiento puede venir vacío: se llena después', () => {
    expect(validarFicha(ficha({ amenities: [] }))).toEqual([])
  })

  it('CA-08.3 · el video, si viene, debe ser una URL http(s)', () => {
    expect(camposConError({ videoUrl: 'javascript:alert(1)' })).toEqual(['videoUrl'])
    expect(camposConError({ videoUrl: 'no es una url' })).toEqual(['videoUrl'])
    expect(validarFicha(ficha({ videoUrl: 'https://videos.arenaproperty.co/palomino.mp4' }))).toEqual([])
  })

  it('CA-08.3 · varios campos fuera de rango se reportan todos, no solo el primero', () => {
    expect(camposConError({ areaM2: 0, bedrooms: -1, photos: 0 }).sort())
      .toEqual(['areaM2', 'bedrooms', 'photos'])
  })

  it('RF-08.1 · toda clave de validación pertenece al catálogo cerrado', () => {
    const claves = validarFicha(ficha({ areaM2: 0, name: '', description: '', photos: 0 }))
      .map(error => error.message)

    expect(claves.every(clave => CLAVES_DE_VALIDACION_DE_FICHA.includes(clave))).toBe(true)
  })

  it('RF-08.1 · todo campo que reporta error pertenece al vocabulario de campos', () => {
    const campos = validarFicha(ficha({ areaM2: 0, bathrooms: -1, videoUrl: 'x', amenities: [''] }))
      .map(error => error.name)

    expect(campos.every(campo => CAMPOS_DE_FICHA.includes(campo))).toBe(true)
  })
})

describe('RF-08.1 · normalización de la ficha antes de guardarla', () => {
  it('recorta los espacios de los textos', () => {
    const normalizada = normalizarFicha(ficha({
      name: '  Casa Arena  ',
      location: { country: ' co ', region: ' La Guajira ', city: ' Palomino ', address: '  ' },
    }))

    expect(normalizada.name).toBe('Casa Arena')
    expect(normalizada.location.region).toBe('La Guajira')
    expect(normalizada.location.address).toBeNull()
  })

  it('el código de país queda en mayúsculas, para que el filtro por región agrupe', () => {
    expect(normalizarFicha(ficha({ location: { country: 'co', region: 'X', city: 'Y', address: '' } })).location.country)
      .toBe('CO')
  })

  it('descarta las entradas vacías del equipamiento y no repite', () => {
    expect(normalizarFicha(ficha({ amenities: [' Piscina ', '', 'Piscina', 'Wifi'] })).amenities)
      .toEqual(['Piscina', 'Wifi'])
  })

  it('una URL de video vacía se guarda como ausente, no como cadena vacía', () => {
    expect(normalizarFicha(ficha({ videoUrl: '   ' })).videoUrl).toBeNull()
  })
})
