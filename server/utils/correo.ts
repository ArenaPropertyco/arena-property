/**
 * DT-08 · TR-03 · RF-N.2 — correo transaccional por la API REST de Resend con
 * `$fetch`, sin SDK (docs/stack.md). Las credenciales viven en runtime config de
 * servidor. Sin llave configurada no se envía y se dice: el negocio sigue (RF-N.6).
 */

export interface CorreoInterno {
  asunto: string
  texto: string
  html: string
  /** Responder-a: el correo del visitante que escribió. */
  responderA?: string
}

export async function enviarCorreoInterno(correo: CorreoInterno): Promise<{ enviado: boolean }> {
  const config = useRuntimeConfig()

  if (!config.resendApiKey || !config.contactInbox) {
    console.warn('[correo] Sin NUXT_RESEND_API_KEY o NUXT_CONTACT_INBOX: el correo interno no se envía.')
    return { enviado: false }
  }

  await $fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.resendApiKey}` },
    body: {
      from: config.mailFrom,
      to: [config.contactInbox],
      reply_to: correo.responderA,
      subject: correo.asunto,
      text: correo.texto,
      html: correo.html,
    },
  })

  return { enviado: true }
}
