import { validarCambioDeContrasena } from '#shared/identity/edicion-de-perfil'

/**
 * Roles · el Superadmin fija una contraseña nueva a cualquier cuenta: la persona
 * la olvidó, perdió el acceso a su correo o la cuenta nació con Google y necesita
 * entrar con contraseña.
 *
 * No se pide la actual: quien decide es el Superadmin (`exigirSuperadmin`), y la
 * contraseña se fija con la API de administración de Supabase Auth, el único uso
 * de privilegio aquí. La nueva cumple las reglas del registro. Queda auditado quién
 * la cambió y a quién, nunca la contraseña.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo {
  nueva?: string
  confirmacion?: string
}

export default defineEventHandler(async (event) => {
  const { userId, comoSuperadmin, conPrivilegio } = await exigirSuperadmin(event)

  const cuentaId = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(cuentaId)) {
    throw createError({ statusCode: 400, statusMessage: 'roles.edit.errors.failed' })
  }

  const cuerpo = await readBody<Cuerpo>(event)
  const datos = { actual: '', nueva: cuerpo?.nueva ?? '', confirmacion: cuerpo?.confirmacion ?? '' }
  const errores = validarCambioDeContrasena(datos, false)
  if (errores.length > 0) {
    throw createError({ statusCode: 400, statusMessage: errores[0]!.message })
  }

  // La cuenta tiene que existir y ser visible para el Superadmin bajo RLS.
  const cuenta = await comoSuperadmin.from('profiles').select('id').eq('id', cuentaId).maybeSingle()
  if (!cuenta.data) {
    throw createError({ statusCode: 404, statusMessage: 'roles.edit.errors.failed' })
  }

  const { error } = await conPrivilegio.auth.admin.updateUserById(cuentaId, { password: datos.nueva })
  if (error) {
    throw createError({ statusCode: 502, statusMessage: 'profile.password.errors.failed' })
  }

  // TR-01 · constancia de quién la fijó y a quién, nunca de la contraseña.
  await conPrivilegio.from('audit_log').insert({
    actor_id: userId,
    actor_role: 'superadmin',
    action: 'profile.contrasena_restablecida',
    entity_type: 'profile',
    entity_id: cuentaId,
    reason: 'Contraseña fijada por el Superadmin',
  })

  return { ok: true }
})
