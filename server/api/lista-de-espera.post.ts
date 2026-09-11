import type { InscripcionEnListaDeEspera } from '#shared/waitlist/esquema'
import { procesarInscripcion } from '#shared/waitlist/procesar'

/**
 * HU-47 · RF-47.1…RF-47.3 · D-24 — recibe la inscripción en la lista de espera.
 *
 * La ruta no decide nada: arma la inscripción, obtiene la IP y delega en
 * `procesarInscripcion` (validación, límite de tasa, persistencia y correo de
 * confirmación, en ese orden). Un envío inválido responde 400 con la clave i18n
 * del primer error; un duplicado, 409; un cupo agotado, 429.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo extends Partial<InscripcionEnListaDeEspera> {
  locale?: string
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

export default defineEventHandler(async (event) => {
  const cuerpo = await readBody<Cuerpo>(event)
  const idioma = cuerpo?.locale === 'en' ? 'en' : 'es'
  const propertyId = texto(cuerpo?.propertyId)

  if (!UUID.test(propertyId)) {
    throw createError({ statusCode: 400, statusMessage: 'waitlist.errors.save_failed' })
  }

  const inscripcion: InscripcionEnListaDeEspera = {
    propertyId,
    fullName: texto(cuerpo?.fullName),
    email: texto(cuerpo?.email),
    phone: texto(cuerpo?.phone),
    consent: cuerpo?.consent === true,
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'desconocida'
  const resultado = await procesarInscripcion(inscripcion, { ip }, puertosDeListaDeEspera(event, { ip, locale: idioma }))

  if (!resultado.ok) {
    const codigo = resultado.clave === 'waitlist.errors.rate_limited'
      ? 429
      : resultado.clave === 'waitlist.errors.already_enrolled' ? 409 : 400
    throw createError({ statusCode: codigo, statusMessage: resultado.clave })
  }

  return { id: resultado.id, correoEnviado: resultado.correoEnviado !== false }
})
