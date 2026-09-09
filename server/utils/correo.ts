/**
 * DT-08 · TR-03 · RF-N.2 — correo transaccional por la API REST de Resend con
 * `$fetch`, sin SDK (docs/stack.md). Las credenciales viven en runtime config de
 * servidor. Sin llave configurada no se envía y se dice: el negocio sigue (RF-N.6).
 */

export interface CorreoSaliente {
  to: string
  subject: string
  text: string
  html: string
  /** Responder-a, cuando el correo lo origina una persona. */
  replyTo?: string
}

/** ¿Hay proveedor configurado? Si no, el despacho se omite en vez de fallar. */
export function correoConfigurado(): boolean {
  const config = useRuntimeConfig()
  return Boolean(config.resendApiKey && config.mailFrom)
}

/** Envía un correo; lanza si el proveedor falla, para que quien llama registre el fallo. */
export async function enviarCorreo(correo: CorreoSaliente): Promise<void> {
  const config = useRuntimeConfig()
  if (!correoConfigurado()) {
    throw new Error('Proveedor de correo no configurado (NUXT_RESEND_API_KEY, NUXT_MAIL_FROM).')
  }

  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}` },
    body: {
      from: config.mailFrom,
      to: [correo.to],
      reply_to: correo.replyTo,
      subject: correo.subject,
      text: correo.text,
      html: correo.html,
    },
  })
}

export interface CorreoInterno {
  asunto: string
  texto: string
  html: string
  responderA?: string
}

/** HU-46 · HU-03 · correo a la bandeja principal de Arena Property. */
export async function enviarCorreoInterno(correo: CorreoInterno): Promise<{ enviado: boolean }> {
  const config = useRuntimeConfig()

  if (!correoConfigurado() || !config.contactInbox) {
    console.warn('[correo] Sin NUXT_RESEND_API_KEY o NUXT_CONTACT_INBOX: el correo interno no se envía.')
    return { enviado: false }
  }

  await enviarCorreo({
    to: config.contactInbox,
    subject: correo.asunto,
    text: correo.texto,
    html: correo.html,
    replyTo: correo.responderA,
  })

  return { enviado: true }
}
