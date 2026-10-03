/**
 * Datos de contacto institucionales, tal como los publica el sitio oficial. Un
 * único lugar: pie, CTA y página de contacto los leen de aquí.
 */

export const CONTACTO_ARENA = {
  whatsapp: '+57 310 685 4769',
  whatsappUrl: 'https://wa.me/573106854769',
  ciudad: 'Cartagena de Indias, Colombia',
} as const

/** Mensaje que el botón del hero deja escrito al abrir el chat de WhatsApp. */
export const MENSAJE_WHATSAPP_HERO = 'Hola, me interesa una fracción en Arena Property'
/** Mensaje y texto del botón flotante, visible en todo el sitio público. */
export const MENSAJE_WHATSAPP_FLOTANTE = 'Quiero saber más sobre las propiedades fraccionadas'

/** `wa.me` con el mensaje ya escrito; el visitante solo tiene que enviarlo. */
export function urlDeWhatsapp(mensaje: string): string {
  return `${CONTACTO_ARENA.whatsappUrl}?text=${encodeURIComponent(mensaje)}`
}
