import { describe, expect, it } from 'vitest'
import { esCodigoReferidoValido } from '#shared/identity/registro'
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateCode,
  isCodeValid,
  REFERRAL_QUERY_PARAM,
  referralLink,
  shareLinks,
} from '#shared/referrals/code'

/**
 * HU-50 · RF-50.1…RF-50.4 — el código de referido y su enlace compartible.
 *
 * El código es legible en voz alta: alfabeto sin caracteres que se confundan
 * (nada de 0/O ni 1/I/L), longitud fija y formato compatible con el que ya validan
 * el registro (HU-04) y la atribución (HU-51).
 */

/** Generador determinista: recorre el alfabeto para que la prueba no dependa del azar. */
function secuencia(desde: number): () => number {
  let i = desde
  return () => {
    const valor = (i % CODE_ALPHABET.length) / CODE_ALPHABET.length
    i += 1
    return valor
  }
}

describe('CA-50.1 · RF-50.1 · el formato del código', () => {
  it('CA-50.1 · el alfabeto excluye los caracteres ambiguos y la longitud es fija', () => {
    expect(CODE_LENGTH).toBe(8)
    for (const ambiguo of ['0', 'O', '1', 'I', 'L']) {
      expect(CODE_ALPHABET).not.toContain(ambiguo)
    }
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length)
  })

  it('CA-50.1 · mil códigos generados cumplen el formato y ninguno se repite', () => {
    const codigos = Array.from({ length: 1000 }, () => generateCode())
    for (const codigo of codigos) {
      expect(codigo).toHaveLength(CODE_LENGTH)
      expect(isCodeValid(codigo)).toBe(true)
      expect([...codigo].every(letra => CODE_ALPHABET.includes(letra))).toBe(true)
    }
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('CA-50.1 · el código generado también pasa la validación del registro (HU-04) y de la atribución', () => {
    for (let i = 0; i < 50; i++) {
      expect(esCodigoReferidoValido(generateCode(secuencia(i)))).toBe(true)
    }
  })

  it('CA-50.1 · un código con formato ajeno se rechaza', () => {
    expect(isCodeValid('ABC')).toBe(false)
    expect(isCodeValid('ARENA0OO')).toBe(false)
    expect(isCodeValid('arena234')).toBe(false)
    expect(isCodeValid('ARENA-23')).toBe(false)
    expect(isCodeValid(null)).toBe(false)
  })
})

describe('CA-50.3 · RF-50.3 · el enlace compartible', () => {
  const BASE = 'https://arena-property.com'
  const CODIGO = 'ARENA234'

  it('CA-50.3 · el enlace lleva el código en el parámetro definido y apunta a la ruta pública', () => {
    expect(REFERRAL_QUERY_PARAM).toBe('ref')
    expect(referralLink(BASE, CODIGO)).toBe('https://arena-property.com/?ref=ARENA234')
  })

  it('CA-50.3 · la base con barra final o con ruta no duplica separadores', () => {
    expect(referralLink('https://arena-property.com/', CODIGO)).toBe('https://arena-property.com/?ref=ARENA234')
    expect(referralLink(BASE, 'ARENA-23')).toBe('https://arena-property.com/?ref=ARENA-23')
  })
})

describe('CA-50.4 · RF-50.4 · los enlaces de difusión', () => {
  const ENLACE = 'https://arena-property.com/?ref=ARENA234'
  const TEXTOS = { subject: 'Conoce Arena Property', message: 'Sé dueño de una propiedad en Bocagrande.' }

  it('CA-50.4 · WhatsApp lleva el enlace codificado dentro del texto', () => {
    const { whatsapp } = shareLinks(ENLACE, TEXTOS)
    expect(whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(`${TEXTOS.message} ${ENLACE}`)}`)
    expect(whatsapp).toContain(encodeURIComponent(ENLACE))
    expect(whatsapp).not.toContain(' ')
  })

  it('CA-50.4 · el correo lleva asunto y cuerpo codificados, con el enlace en el cuerpo', () => {
    const { email } = shareLinks(ENLACE, TEXTOS)
    expect(email).toBe(`mailto:?subject=${encodeURIComponent(TEXTOS.subject)}&body=${encodeURIComponent(`${TEXTOS.message} ${ENLACE}`)}`)
    expect(email).toContain(encodeURIComponent(ENLACE))
  })

  it('CA-50.4 · las redes reciben el enlace como parámetro codificado', () => {
    const enlaces = shareLinks(ENLACE, TEXTOS)
    expect(enlaces.x).toContain(encodeURIComponent(ENLACE))
    expect(enlaces.facebook).toContain(encodeURIComponent(ENLACE))
    for (const destino of Object.values(enlaces)) {
      expect(destino.startsWith('https://') || destino.startsWith('mailto:')).toBe(true)
    }
  })
})
