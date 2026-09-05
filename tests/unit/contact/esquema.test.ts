import { describe, expect, it } from 'vitest'
import {
  CLAVES_DE_VALIDACION_DE_CONTACTO,
  claveDeIntencion,
  claveDeRango,
  claveDeTipo,
  INTENCIONES_DE_COMPRA,
  normalizarContacto,
  RANGOS_DE_RENTA,
  TIPOS_DE_PROPIEDAD,
  validarContacto,
} from '#shared/contact/esquema'
import type { SolicitudDeContacto } from '#shared/contact/esquema'

/**
 * HU-46 · RF-46.1…RF-46.4 y HU-03 · RF-03.2, RF-03.3 — un solo esquema de
 * validación para el formulario general y el de la ficha.
 */

function solicitud(cambios: Partial<SolicitudDeContacto> = {}): SolicitudDeContacto {
  return {
    firstName: 'Ana',
    lastName: 'Gómez',
    email: 'Ana@Ejemplo.com',
    phone: '+57 310 000 0000',
    message: 'Quiero conocer el modelo.',
    intent: 'investment',
    propertyType: 'vacation',
    incomeRange: 'over_7m',
    referralCode: null,
    propertyId: null,
    ...cambios,
  }
}

describe('CA-46.1 · el formulario general valida por campo', () => {
  it('una solicitud completa no produce errores', () => {
    expect(validarContacto(solicitud(), 'general')).toEqual([])
  })

  it('CA-46.1 · con requeridos vacíos o correo inválido devuelve errores por campo con su clave i18n', () => {
    const errores = validarContacto(
      solicitud({ firstName: ' ', lastName: '', email: 'sin-arroba', phone: '', message: '', propertyType: null, incomeRange: null, intent: null }),
      'general',
    )

    expect(errores.map(error => error.name)).toEqual([
      'firstName', 'lastName', 'email', 'phone', 'message', 'intent', 'propertyType', 'incomeRange',
    ])
    expect(errores.every(error => CLAVES_DE_VALIDACION_DE_CONTACTO.includes(error.message))).toBe(true)
    expect(errores.find(error => error.name === 'email')?.message).toBe('contact.validation.email_invalid')
  })

  it('RF-46.6 · el código de referido es opcional pero, escrito, tiene formato plausible', () => {
    expect(validarContacto(solicitud({ referralCode: ' luis-2026 ' }), 'general')).toEqual([])
    expect(validarContacto(solicitud({ referralCode: 'x' }), 'general').map(error => error.name)).toEqual(['referralCode'])
  })
})

describe('CA-03.1 · el formulario de la ficha exige correo válido e intención', () => {
  it('CA-03.1 · sin correo válido o sin intención se rechaza con errores por campo', () => {
    const errores = validarContacto(solicitud({ email: 'nada', intent: null, propertyType: null, incomeRange: null }), 'property')

    expect(errores.map(error => error.name)).toEqual(['email', 'intent'])
  })

  it('en la ficha no se piden tipo de propiedad ni renta: son del formulario general', () => {
    expect(validarContacto(solicitud({ propertyType: null, incomeRange: null }), 'property')).toEqual([])
  })
})

describe('CA-03.3 · CA-46.3 · las selecciones tienen exactamente sus opciones', () => {
  it('CA-03.3 · la intención de compra son exactamente las 4 opciones de RF-03.2', () => {
    expect([...INTENCIONES_DE_COMPRA]).toEqual(['second_home', 'truly_mine', 'same_place_every_summer', 'investment'])
    expect(claveDeIntencion('investment')).toBe('contact.intents.investment')
  })

  it('CA-46.3 · tipo de propiedad: Vivienda Vacacional / Vivienda Residencial / Terreno', () => {
    expect([...TIPOS_DE_PROPIEDAD]).toEqual(['vacation', 'residential', 'land'])
    expect(claveDeTipo('land')).toBe('contact.propertyTypes.land')
  })

  it('CA-46.3 · renta familiar: menos de $4M / entre $4M y $7M / más de $7M', () => {
    expect([...RANGOS_DE_RENTA]).toEqual(['under_4m', 'between_4m_7m', 'over_7m'])
    expect(claveDeRango('under_4m')).toBe('contact.incomeRanges.under_4m')
  })

  it('un valor fuera del catálogo se rechaza aunque venga tipado desde fuera', () => {
    const errores = validarContacto(solicitud({ intent: 'otra' as never }), 'general')
    expect(errores.map(error => error.name)).toEqual(['intent'])
  })
})

describe('normalización antes de persistir', () => {
  it('recorta espacios, baja el correo a minúsculas y normaliza el código', () => {
    const limpia = normalizarContacto(solicitud({ firstName: '  Ana ', referralCode: ' luis-2026 ' }))

    expect(limpia.firstName).toBe('Ana')
    expect(limpia.email).toBe('ana@ejemplo.com')
    expect(limpia.referralCode).toBe('LUIS-2026')
  })
})
