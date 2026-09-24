/**
 * TR-03 · RF-N.2 · RT-05 — plantillas de correo por tipo de notificación, en los
 * dos idiomas. Viven aquí y no en `i18n/locales` porque las consume Nitro, que no
 * tiene el runtime de vue-i18n. La bandeja in-app usa las claves de i18n; el correo,
 * estas. Ambas se prueban por contrato.
 */

import { cargaLegible } from './legible'
import type { CargaDeNotificacion, TipoDeNotificacion } from './tipos'

export const IDIOMAS = ['es', 'en'] as const
export type Idioma = typeof IDIOMAS[number]

export interface Plantilla {
  asunto: string
  texto: string
}

/** El idioma del perfil del destinatario; lo desconocido cae en español. */
export function idiomaDe(locale: string | null | undefined): Idioma {
  return locale === 'en' ? 'en' : 'es'
}

type Textos = { asunto: string, texto: string }

const PLANTILLAS: Record<TipoDeNotificacion, Record<Idioma, Textos>> = {
  stay_confirmed: {
    es: { asunto: 'Tu reserva en {property_name} está confirmada', texto: 'Tu estadía en {property_name} del {check_in} al {check_out} quedó confirmada para la fracción {fraction_number}/8.' },
    en: { asunto: 'Your stay at {property_name} is confirmed', texto: 'Your stay at {property_name} from {check_in} to {check_out} is confirmed for fraction {fraction_number}/8.' },
  },
  calendar_changed: {
    es: { asunto: 'Cambio en el calendario de tu fracción en {property_name}', texto: 'Hubo un cambio que afecta la fracción {fraction_number}/8 de {property_name}: {detail}. Revisa tu calendario en el panel.' },
    en: { asunto: 'Calendar change for your fraction at {property_name}', texto: 'There was a change affecting fraction {fraction_number}/8 at {property_name}: {detail}. Check your calendar in the dashboard.' },
  },
  calendar_activated: {
    es: { asunto: 'Tu calendario en {property_name} ya está activo', texto: 'El plan de pagos de la fracción {fraction_number}/8 de {property_name} se completó. Desde hoy puedes reservar tus noches desde el panel.' },
    en: { asunto: 'Your calendar at {property_name} is now active', texto: 'The payment plan for fraction {fraction_number}/8 at {property_name} is complete. From today you can book your nights from the dashboard.' },
  },
  announcement_published: {
    es: { asunto: 'Novedad en {property_name}: {title}', texto: '{title}\n\n{body}\n\nPublicado por la administración de {property_name}.' },
    en: { asunto: 'News at {property_name}: {title}', texto: '{title}\n\n{body}\n\nPosted by the {property_name} administration.' },
  },
  broadcast: {
    es: { asunto: 'Comunicado de Arena Property: {title}', texto: '{title}\n\n{body}' },
    en: { asunto: 'Arena Property announcement: {title}', texto: '{title}\n\n{body}' },
  },
  referral_in_progress: {
    es: { asunto: 'Tu referido inició su plan de pagos', texto: 'Tu referido {referral_label} cerró la compra de una fracción en {property_name} y empezó a pagar. Te avisaremos cuando complete el pago.' },
    en: { asunto: 'Your referral started their payment plan', texto: 'Your referral {referral_label} closed the purchase of a fraction at {property_name} and started paying. We will let you know when the payment is complete.' },
  },
  referral_paid: {
    es: { asunto: 'Tu referido completó el pago: {amount} a tu favor', texto: 'Tu referido {referral_label} completó el pago de su fracción. Se acreditó {amount} a tu saldo, que estará disponible para retiro el {available_on}.' },
    en: { asunto: 'Your referral completed payment: {amount} for you', texto: 'Your referral {referral_label} completed the payment for their fraction. {amount} was credited to your balance and will be available for withdrawal on {available_on}.' },
  },
  commission_available: {
    es: { asunto: 'Tienes {amount} disponibles para retirar', texto: 'La comisión de {amount} salió del periodo de gracia y ya puedes solicitar su retiro desde tu billetera.' },
    en: { asunto: 'You have {amount} available to withdraw', texto: 'The {amount} commission left the grace period and you can now request a withdrawal from your wallet.' },
  },
  withdrawal_approved: {
    es: { asunto: 'Tu retiro de {amount} fue aprobado', texto: 'Aprobamos tu solicitud de retiro por {amount}. Te avisaremos cuando el pago esté hecho.' },
    en: { asunto: 'Your {amount} withdrawal was approved', texto: 'We approved your withdrawal request for {amount}. We will let you know once the payment is made.' },
  },
  withdrawal_paid: {
    es: { asunto: 'Tu retiro de {amount} fue pagado', texto: 'El retiro por {amount} ya fue pagado a la cuenta que registraste. El comprobante queda en tu billetera.' },
    en: { asunto: 'Your {amount} withdrawal was paid', texto: 'The {amount} withdrawal was paid to the account you registered. The receipt is in your wallet.' },
  },
  owner_statement_closed: {
    es: { asunto: 'Corte de {period} en {property_name}: {balance}', texto: 'Cerramos el mes de {period} en {property_name}. El neto del mes fue {amount} y el saldo de tu billetera en esa propiedad queda en {balance}. Si es negativo, te toca pagarlo; si es positivo, puedes retirarlo desde tu billetera.' },
    en: { asunto: '{period} statement for {property_name}: {balance}', texto: 'We closed {period} for {property_name}. The month net was {amount} and your wallet balance for that property is now {balance}. If it is negative, it is due; if it is positive, you can withdraw it from your wallet.' },
  },
  owner_payment_reported: {
    es: { asunto: 'Pago reportado en {property_name}: {amount}', texto: 'Un Propietario reportó un pago de {amount} en {property_name}. Revisa el comprobante en el tablero de cobros y confírmalo o recházalo.' },
    en: { asunto: 'Payment reported at {property_name}: {amount}', texto: 'An owner reported a {amount} payment at {property_name}. Review the receipt on the collections board and confirm or reject it.' },
  },
  owner_payment_confirmed: {
    es: { asunto: 'Tu pago de {amount} fue confirmado', texto: 'Confirmamos tu pago de {amount} en {property_name}. Ya se refleja en el saldo de tu billetera.' },
    en: { asunto: 'Your {amount} payment was confirmed', texto: 'We confirmed your {amount} payment at {property_name}. It is now reflected in your wallet balance.' },
  },
  owner_payment_rejected: {
    es: { asunto: 'Tu pago de {amount} fue rechazado', texto: 'No pudimos confirmar tu pago de {amount} en {property_name}. Motivo: {reason}. El cobro sigue pendiente; puedes reportar el pago de nuevo desde tu billetera.' },
    en: { asunto: 'Your {amount} payment was rejected', texto: 'We could not confirm your {amount} payment at {property_name}. Reason: {reason}. The charge is still pending; you can report the payment again from your wallet.' },
  },
  owner_withdrawal_paid: {
    es: { asunto: 'Tu retiro de {amount} fue pagado', texto: 'El retiro por {amount} de {property_name} ya fue pagado a la cuenta que indicaste. El comprobante queda en tu billetera.' },
    en: { asunto: 'Your {amount} withdrawal was paid', texto: 'The {amount} withdrawal from {property_name} was paid to the account you provided. The receipt is in your wallet.' },
  },
  owner_withdrawal_rejected: {
    es: { asunto: 'Tu retiro de {amount} fue rechazado', texto: 'No pudimos pagar tu retiro de {amount} de {property_name}. Motivo: {reason}. Puedes pedirlo de nuevo desde tu billetera.' },
    en: { asunto: 'Your {amount} withdrawal was rejected', texto: 'We could not pay your {amount} withdrawal from {property_name}. Reason: {reason}. You can request it again from your wallet.' },
  },
}

/** Sustituye `{campo}` por la carga legible; lo que falte queda vacío, nunca un marcador suelto. */
function interpolar(texto: string, legible: Record<string, string>): string {
  return texto.replace(/\{([a-z_]+)\}/g, (_, campo: string) => legible[campo] ?? '')
}

export function plantillaDe(tipo: TipoDeNotificacion, idioma: Idioma, carga: CargaDeNotificacion): Plantilla {
  const textos = PLANTILLAS[tipo][idioma]
  const legible = cargaLegible(carga, idioma)
  return { asunto: interpolar(textos.asunto, legible), texto: interpolar(textos.texto, legible) }
}

/** HTML mínimo y seguro a partir del texto: se escapa y se respetan los saltos. */
export function htmlDe(texto: string): string {
  const escapado = texto.replace(/[&<>"']/g, caracter => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[caracter] ?? caracter))
  return `<div style="font-family: sans-serif; line-height: 1.5">${escapado.replace(/\n/g, '<br>')}</div>`
}
