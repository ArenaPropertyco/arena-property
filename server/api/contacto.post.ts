import type { ContextoDeContacto, SolicitudDeContacto } from '#shared/contact/esquema'
import { procesarContacto } from '#shared/contact/procesar'

/**
 * HU-46 · RF-46.5 y HU-03 · RF-03.4 — recibe el formulario de contacto.
 *
 * La ruta no decide nada: arma la solicitud, obtiene la IP y delega en
 * `procesarContacto` (validación, límite de tasa D-24, persistencia y correo, en
 * ese orden). Un envío inválido responde 400 con la clave i18n del primer error;
 * un cupo agotado, 429.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo extends Partial<SolicitudDeContacto> {
  contexto?: ContextoDeContacto
  locale?: string
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

export default defineEventHandler(async (event) => {
  const cuerpo = await readBody<Cuerpo>(event)
  const contexto: ContextoDeContacto = cuerpo?.contexto === 'property' ? 'property' : 'general'
  const idioma = cuerpo?.locale === 'en' ? 'en' : 'es'
  const propertyId = texto(cuerpo?.propertyId)

  if (contexto === 'property' && !UUID.test(propertyId)) {
    throw createError({ statusCode: 400, statusMessage: 'contact.errors.send_failed' })
  }

  const solicitud: SolicitudDeContacto = {
    firstName: texto(cuerpo?.firstName),
    lastName: texto(cuerpo?.lastName),
    email: texto(cuerpo?.email),
    phone: texto(cuerpo?.phone),
    message: texto(cuerpo?.message),
    intent: (cuerpo?.intent ?? null) as SolicitudDeContacto['intent'],
    propertyType: (cuerpo?.propertyType ?? null) as SolicitudDeContacto['propertyType'],
    incomeRange: (cuerpo?.incomeRange ?? null) as SolicitudDeContacto['incomeRange'],
    referralCode: texto(cuerpo?.referralCode) || null,
    propertyId: contexto === 'property' ? propertyId : null,
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'desconocida'
  const resultado = await procesarContacto(solicitud, contexto, { ip }, puertosDeContacto(event, { ip, locale: idioma }))

  if (!resultado.ok) {
    throw createError({
      statusCode: resultado.clave === 'contact.errors.rate_limited' ? 429 : 400,
      statusMessage: resultado.clave,
    })
  }

  return { id: resultado.id, correoEnviado: resultado.correoEnviado !== false }
})
