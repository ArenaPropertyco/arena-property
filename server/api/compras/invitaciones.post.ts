import { normalizarCodigoReferido, normalizarEmail } from '#shared/identity/registro'
import { pesos } from '#shared/money/importe'
import { validarInvitacion } from '#shared/purchases/invitaciones'

/**
 * HU-06 · RF-06.1 — invitación por correo a comprar una fracción.
 *
 * Si el correo no tiene cuenta, se crea por invitación de Supabase Auth, que envía
 * el correo con el enlace para entrar; si ya la tiene, se vincula la cuenta. La
 * fila de la invitación la escribe la sesión de quien invita: la RLS vuelve a
 * comprobar que administra la propiedad (CA-06.1) y el disparador, que la fracción
 * aún puede venderse (CA-06.4). El correo al invitado que ya tiene cuenta lo
 * enviará TR-03 cuando exista la bandeja de notificaciones.
 *
 * RF-06.4 · el código del embajador, si viene, va en los metadatos de la cuenta
 * nueva (el disparador de alta lo convierte en atribución del perfil) y en la fila
 * de la invitación, para que el cierre lo arrastre al plan aunque la cuenta ya
 * existiera sin atribución.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo {
  fractionId?: string
  propertyId?: string
  email?: string
  agreedPrice?: number
  referralCode?: string | null
  locale?: string
}

export default defineEventHandler(async (event) => {
  const cuerpo = await readBody<Cuerpo>(event)

  const fractionId = cuerpo?.fractionId ?? ''
  const propertyId = cuerpo?.propertyId ?? ''
  if (!UUID.test(fractionId) || !UUID.test(propertyId)) {
    throw createError({ statusCode: 400, statusMessage: 'purchases.errors.invite_failed' })
  }

  const { comoGestor, conPrivilegio } = await exigirGestionDePropiedad(event, propertyId)

  const email = normalizarEmail(cuerpo?.email ?? '')
  const precio = Number(cuerpo?.agreedPrice)
  const codigo = normalizarCodigoReferido(typeof cuerpo?.referralCode === 'string' ? cuerpo.referralCode : null)
  const idioma = cuerpo?.locale === 'en' ? 'en' : 'es'

  // La fracción, bajo la RLS de quien invita: si no la ve, no la administra.
  const fraccion = await comoGestor
    .from('fractions')
    .select('id, property_id, status')
    .eq('id', fractionId)
    .maybeSingle()

  if (!fraccion.data || fraccion.data.property_id !== propertyId) {
    throw createError({ statusCode: 404, statusMessage: 'purchases.validation.fraction_not_invitable' })
  }

  const errores = validarInvitacion(
    {
      fractionId,
      propertyId,
      fractionStatus: fraccion.data.status,
      email,
      agreedPrice: Number.isInteger(precio) ? pesos(precio) : pesos(0),
      referralCode: codigo,
    },
    { administraLaPropiedad: true },
  )
  if (errores.length > 0) {
    throw createError({ statusCode: 400, statusMessage: errores[0]!.message })
  }

  // 1 · La cuenta del invitado: se vincula si existe, se crea por invitación si no.
  const existente = await conPrivilegio.from('profiles').select('id').ilike('email', email).maybeSingle()
  let inviteeId = existente.data?.id ?? null

  if (!inviteeId) {
    const invitacion = await conPrivilegio.auth.admin.inviteUserByEmail(email, {
      data: codigo ? { locale: idioma, referral_code: codigo } : { locale: idioma },
    })
    if (invitacion.error || !invitacion.data.user) {
      throw createError({ statusCode: 502, statusMessage: 'purchases.errors.invite_failed' })
    }
    inviteeId = invitacion.data.user.id
  }

  // 2 · La invitación, bajo RLS y auditada con quien invita como autor.
  const fila = await comoGestor
    .from('purchase_invitations')
    .insert({
      fraction_id: fractionId,
      property_id: propertyId,
      invitee_email: email,
      invitee_id: inviteeId,
      agreed_price: precio,
      referral_code: codigo,
    })
    .select('id')
    .single()

  if (fila.error) {
    const clave = fila.error.code === '23505'
      ? 'purchases.errors.already_pending'
      : fila.error.code === '42501'
        ? 'purchases.validation.not_property_admin'
        : fila.error.code === 'P0001'
          ? 'purchases.validation.fraction_not_invitable'
          : 'purchases.errors.invite_failed'
    throw createError({ statusCode: fila.error.code === '42501' ? 403 : 409, statusMessage: clave })
  }

  return { id: fila.data.id, email, inviteeId }
})
