import { describe, expect, it } from 'vitest'
import {
  BUCKET_DE_PROPIEDADES,
  MIMES_PERMITIDOS,
  TAMANO_MAXIMO,
  TIPOS_DE_MEDIO,
  ordenarMedios,
  rutaDeMedio,
  siguienteOrden,
  validarArchivo,
  esModelo3D,
  mimeDeArchivo,
} from '#shared/properties/medios'
import type { Medio } from '#shared/properties/medios'

/**
 * HU-08 · RF-08.5 y RT-12 — fotos, video y plano elevado en Supabase Storage.
 *
 * La ruta del objeto no es cosmética: la política de Storage decide por la **primera
 * carpeta**, que es el identificador de la propiedad. Si la ruta se arma mal, la
 * política deja de acotar y un administrador podría escribir en la carpeta de otro.
 * Por eso la construcción de rutas es una función pura y probada, no una plantilla
 * escrita a mano en cada llamada.
 */

const PROPIEDAD = 'c0000000-0000-4000-8000-00000000000a'

describe('RF-08.5 · vocabulario de medios', () => {
  it('los tres tipos son foto, video y plano elevado', () => {
    expect(TIPOS_DE_MEDIO).toEqual(['photo', 'video', 'floor_plan'])
  })

  it('cada tipo declara sus formatos permitidos y su tope de tamaño', () => {
    for (const tipo of TIPOS_DE_MEDIO) {
      expect(MIMES_PERMITIDOS[tipo].length).toBeGreaterThan(0)
      expect(TAMANO_MAXIMO[tipo]).toBeGreaterThan(0)
    }
  })

  it('ningún tope supera el límite del bucket declarado en config.toml (50 MiB)', () => {
    for (const tipo of TIPOS_DE_MEDIO) {
      expect(TAMANO_MAXIMO[tipo]).toBeLessThanOrEqual(50 * 1024 * 1024)
    }
  })
})

describe('RF-08.5 · validación del archivo antes de subirlo', () => {
  it('acepta una foto JPEG dentro del tope', () => {
    expect(validarArchivo({ tipo: 'photo', mime: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull()
  })

  it('rechaza un formato que no corresponde al tipo', () => {
    expect(validarArchivo({ tipo: 'photo', mime: 'video/mp4', size: 1000 }))
      .toBe('properties.validation.media_format')
    expect(validarArchivo({ tipo: 'video', mime: 'image/png', size: 1000 }))
      .toBe('properties.validation.media_format')
  })

  it('rechaza un archivo que excede el tope de su tipo', () => {
    expect(validarArchivo({ tipo: 'photo', mime: 'image/jpeg', size: TAMANO_MAXIMO.photo + 1 }))
      .toBe('properties.validation.media_too_large')
  })

  it('rechaza un archivo vacío: subirlo dejaría un medio roto en la ficha', () => {
    expect(validarArchivo({ tipo: 'photo', mime: 'image/jpeg', size: 0 }))
      .toBe('properties.validation.media_empty')
  })

  it('el plano elevado admite imagen, PDF y el modelo 3D que consume HU-02', () => {
    expect(validarArchivo({ tipo: 'floor_plan', mime: 'application/pdf', size: 1000 })).toBeNull()
    expect(validarArchivo({ tipo: 'floor_plan', mime: 'model/gltf-binary', size: 1000 })).toBeNull()
  })
})

describe('HU-02 · RF-02.5 · el plano elevado como modelo 3D', () => {
  it('el MIME de un .glb se infiere por extensión cuando el navegador no lo reporta', () => {
    expect(mimeDeArchivo('plano.glb', '')).toBe('model/gltf-binary')
    expect(mimeDeArchivo('PLANO.GLB', '')).toBe('model/gltf-binary')
  })

  it('si el navegador reporta un MIME, ese manda', () => {
    expect(mimeDeArchivo('foto.jpg', 'image/jpeg')).toBe('image/jpeg')
  })

  it('una extensión desconocida sin MIME sigue vacía y la validación la rechaza', () => {
    expect(mimeDeArchivo('archivo.xyz', '')).toBe('')
    expect(validarArchivo({ tipo: 'floor_plan', mime: mimeDeArchivo('archivo.xyz', ''), size: 10 }))
      .toBe('properties.validation.media_format')
  })

  it('CA-02.4 · un plano en .glb pasa la validación y se reconoce como modelo 3D por su ruta', () => {
    expect(validarArchivo({ tipo: 'floor_plan', mime: mimeDeArchivo('apartamento.glb', ''), size: 70_000 })).toBeNull()
    expect(esModelo3D('p1/floor_plan/abc-apartamento.glb')).toBe(true)
    expect(esModelo3D('p1/floor_plan/abc-plano.png')).toBe(false)
  })
})

describe('RF-08.5 · ruta del objeto en Storage', () => {
  it('el bucket es uno solo y con nombre estable', () => {
    expect(BUCKET_DE_PROPIEDADES).toBe('property-media')
  })

  it('la primera carpeta es la propiedad: es lo que mira la política de Storage', () => {
    const ruta = rutaDeMedio(PROPIEDAD, 'photo', 'Terraza al Atardecer.JPG', 'abc123')

    expect(ruta.split('/')[0]).toBe(PROPIEDAD)
    expect(ruta.split('/')[1]).toBe('photo')
  })

  it('el nombre se normaliza: sin acentos, sin espacios y en minúsculas', () => {
    expect(rutaDeMedio(PROPIEDAD, 'photo', 'Habitación Príncipal.JPG', 'abc123'))
      .toBe(`${PROPIEDAD}/photo/abc123-habitacion-principal.jpg`)
  })

  it('un nombre con separadores de ruta no puede escaparse de su carpeta', () => {
    const ruta = rutaDeMedio(PROPIEDAD, 'photo', '../../otro/secreto.png', 'abc123')

    expect(ruta.startsWith(`${PROPIEDAD}/photo/`)).toBe(true)
    expect(ruta).not.toContain('..')
    expect(ruta.split('/')).toHaveLength(3)
  })

  it('un nombre sin extensión ni caracteres útiles sigue produciendo una ruta válida', () => {
    expect(rutaDeMedio(PROPIEDAD, 'video', '###', 'abc123')).toBe(`${PROPIEDAD}/video/abc123`)
  })

  it('el identificador evita que dos archivos con el mismo nombre se pisen', () => {
    const primera = rutaDeMedio(PROPIEDAD, 'photo', 'foto.jpg', 'uno')
    const segunda = rutaDeMedio(PROPIEDAD, 'photo', 'foto.jpg', 'dos')

    expect(primera).not.toBe(segunda)
  })
})

describe('RF-08.5 · orden de la galería', () => {
  const medios: Medio[] = [
    { id: 'm3', kind: 'photo', path: 'p/3', position: 2 },
    { id: 'm1', kind: 'photo', path: 'p/1', position: 0 },
    { id: 'mv', kind: 'video', path: 'p/v', position: 0 },
    { id: 'm2', kind: 'photo', path: 'p/2', position: 1 },
  ]

  it('las fotos se muestran en el orden que fijó el administrador', () => {
    expect(ordenarMedios(medios, 'photo').map(medio => medio.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('el orden es por tipo: el video no se cuela entre las fotos', () => {
    expect(ordenarMedios(medios, 'video').map(medio => medio.id)).toEqual(['mv'])
  })

  it('el siguiente orden continúa la serie del tipo, sin chocar con otro', () => {
    expect(siguienteOrden(medios, 'photo')).toBe(3)
    expect(siguienteOrden(medios, 'video')).toBe(1)
    expect(siguienteOrden(medios, 'floor_plan')).toBe(0)
  })

  it('ordenar no altera la lista original', () => {
    const original = [...medios]
    ordenarMedios(medios, 'photo')

    expect(medios).toEqual(original)
  })
})
