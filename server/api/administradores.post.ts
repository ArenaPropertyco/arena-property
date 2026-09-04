import { normalizarEmail, validarRegistro } from '#shared/identity/registro'

/**
 * HU-05 · RF-05.1 — alta de Administrador por invitación.
 *
 * Solo el Superadmin llega aquí (`exigirSuperadmin`). La invitación necesita la
 * llave de servicio porque crea la cuenta en Supabase Auth; el rol y las
 * asignaciones se escriben con el cliente del propio Superadmin para que RLS los
 * vuelva a validar y la auditoría registre quién lo hizo (RF-07.4, TR-01).
 *
 * Al crearse la cuenta, el disparador de la base le da perfil y rol `user`; aquí
 * se le suma `property_admin` (RF-07.1: los roles se acumulan).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo {
  email?: string
  propertyIds?: string[]
  locale?: string
}

export default defineEventHandler(async (event) => {
  const { userId, comoSuperadmin, conPrivilegio } = await exigirSuperadmin(event)
  const cuerpo = await readBody<Cuerpo>(event)

  const email = normalizarEmail(cuerpo?.email ?? '')
  if (validarRegistro({ email, password: 'invitacion1' }).some(error => error.name === 'email')) {
    throw createError({ statusCode: 400, statusMessage: 'auth.validation.email_invalid' })
  }

  const propiedades = (cuerpo?.propertyIds ?? []).filter(id => UUID.test(id))
  const idioma = cuerpo?.locale === 'en' ? 'en' : 'es'

  // 1 · La cuenta, por invitación de correo.
  const invitacion = await conPrivilegio.auth.admin.inviteUserByEmail(email, {
    data: { locale: idioma },
  })

  if (invitacion.error || !invitacion.data.user) {
    const yaExiste = invitacion.error?.code === 'email_exists'
      || /already/i.test(invitacion.error?.message ?? '')
    throw createError({
      statusCode: yaExiste ? 409 : 502,
      statusMessage: yaExiste ? 'auth.errors.email_in_use' : 'auth.errors.unknown',
    })
  }

  const adminId = invitacion.data.user.id

  // 2 · El rol, bajo RLS y auditado con el Superadmin como autor.
  const rol = await comoSuperadmin
    .from('user_roles')
    .insert({ user_id: adminId, role: 'property_admin', granted_by: userId })

  if (rol.error) {
    throw createError({ statusCode: 500, statusMessage: 'auth.errors.unknown' })
  }

  // 3 · Las propiedades, si vienen. Sin catálogo (HU-08) la lista llega vacía.
  if (propiedades.length > 0) {
    const asignacion = await comoSuperadmin
      .from('property_admins')
      .insert(propiedades.map(propertyId => ({
        admin_id: adminId,
        property_id: propertyId,
        assigned_by: userId,
      })))

    if (asignacion.error) {
      throw createError({ statusCode: 500, statusMessage: 'auth.errors.unknown' })
    }
  }

  return { id: adminId, email, propertyIds: propiedades }
})
