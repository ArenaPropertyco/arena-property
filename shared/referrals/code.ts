/**
 * HU-50 · RF-50.1…RF-50.4 — el código de referido y su enlace compartible.
 *
 * El código se dicta por teléfono y se escribe a mano, así que su alfabeto excluye
 * los caracteres que se confunden: nada de `0`/`O` ni de `1`/`I`/`L`. La longitud
 * es fija y el formato resultante encaja con el que ya validan el registro (HU-04)
 * y la atribución (HU-51), para que un código generado aquí nunca sea rechazado
 * allá.
 *
 * La unicidad no se confía a esta función: la garantiza una restricción de la base
 * (RF-50.1). Aquí solo se produce un candidato con el formato correcto. El código
 * tampoco se edita nunca (RF-50.2): no existe función que lo cambie, y la base lo
 * refuerza con un disparador.
 */

/** RF-50.1 · alfabeto legible: sin `0`, `O`, `1`, `I` ni `L`. */
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** RF-50.1 · longitud fija del código. */
export const CODE_LENGTH = 8

/** RF-50.3 · parámetro del enlace que transporta el código hasta el sitio público. */
export const REFERRAL_QUERY_PARAM = 'ref'

/** RF-50.1 · un código nuevo con el formato definido. La unicidad la decide la base. */
export function generateCode(random: () => number = Math.random): string {
  let codigo = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    const posicion = Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length
    codigo += CODE_ALPHABET[posicion]
  }
  return codigo
}

/** CA-50.1 · ¿tiene el código el formato de esta casa? */
export function isCodeValid(code: string | null | undefined): boolean {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) {
    return false
  }
  return [...code].every(letra => CODE_ALPHABET.includes(letra))
}

/** RF-50.3 · CA-50.3 · el enlace que aterriza en el sitio público con el código puesto. */
export function referralLink(baseUrl: string, code: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`
}

/** Textos ya traducidos que la interfaz pasa para armar cada destino. */
export interface ShareTexts {
  subject: string
  message: string
}

export interface ShareLinks {
  whatsapp: string
  email: string
  x: string
  facebook: string
}

/**
 * RF-50.4 · CA-50.4 · los destinos de difusión, con el enlace codificado. Cada uno
 * es una URL lista para un `<a href>`: la interfaz no arma texto por su cuenta.
 */
export function shareLinks(link: string, texts: ShareTexts): ShareLinks {
  const cuerpo = encodeURIComponent(`${texts.message} ${link}`)
  const enlace = encodeURIComponent(link)

  return {
    whatsapp: `https://wa.me/?text=${cuerpo}`,
    email: `mailto:?subject=${encodeURIComponent(texts.subject)}&body=${cuerpo}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(texts.message)}&url=${enlace}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enlace}`,
  }
}
