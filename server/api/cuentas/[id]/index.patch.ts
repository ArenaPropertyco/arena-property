import { errorDePerfilDesdeBase, normalizarPerfil, validarCuenta } from '#shared/identity/edicion-de-perfil'
import { normalizarEmail } from '#shared/identity/registro'

/**
 * Roles · el Superadmin edita los datos de cualquier cuenta: nombre, teléfono,
 * idioma y correo.
 *
 * Nombre, teléfono e idioma se escriben con el cliente del propio Superadmin, bajo
 * RLS: la base vuelve a comprobar el rol y la auditoría registra al autor real. El
 * correo es la llave de acceso y vive en Supabase Auth, así que se cambia con la
 * API de administración (el único uso de privilegio aquí) y el disparador de
 * sincronización lo lleva al perfil. Se confirma en el acto: lo decide el Superadmin.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Cuerpo {
  fullName?: string | null
  phone?: string | null
  locale?: string
  email?: string
}

export default defineEventHandler(async (event) => {
  const { userId, comoSuperadmin, conPrivilegio } = await exigirSuperadmin(event)

  const cuentaId = getRouterParam(event, 'id') ?? ''
  if (!UUID.test(cuentaId)) {
    throw createError({ statusCode: 400, statusMessage: 'roles.edit.errors.failed' })
  }

  const cuerpo = await readBody<Cuerpo>(event)
  const datos = {
    fullName: cuerpo?.fullName ?? null,
    phone: cuerpo?.phone ?? null,
    locale: cuerpo?.locale ?? 'es',
    email: normalizarEmail(cuerpo?.email ?? ''),
  }
  const errores = validarCuenta(datos)
  if (errores.length > 0) {
    throw createError({ statusCode: 400, statusMessage: errores[0]!.message })
  }

  const actual = await comoSuperadmin.from('profiles').select('email').eq('id', cuentaId).maybeSingle()
  if (!actual.data) {
    throw createError({ statusCode: 404, statusMessage: 'roles.edit.errors.failed' })
  }

  // 1 · El correo, por la cuenta de acceso.
  if (datos.email !== normalizarEmail(actual.data.email ?? '')) {
    // Supabase Auth responde un 500 con la violación de unicidad si el correo ya es
    // de otra cuenta: se comprueba antes para dar el motivo claro.
    const ocupado = await comoSuperadmin.from('profiles').select('id').eq('email', datos.email).neq('id', cuentaId).limit(1)
    if ((ocupado.data ?? []).length > 0) {
      throw createError({ statusCode: 409, statusMessage: 'auth.errors.email_in_use' })
    }
    const { error } = await conPrivilegio.auth.admin.updateUserById(cuentaId, { email: datos.email, email_confirm: true })
    if (error) {
      const enUso = error.code === 'email_exists' || /already|registered|23505|duplicate/i.test(`${error.code ?? ''} ${error.message}`)
      throw createError({ statusCode: enUso ? 409 : 502, statusMessage: enUso ? 'auth.errors.email_in_use' : 'roles.edit.errors.failed' })
    }
    // TR-01 · el disparador sincroniza sin autor; aquí queda quién lo decidió.
    await conPrivilegio.from('audit_log').insert({
      actor_id: userId,
      actor_role: 'superadmin',
      action: 'profile.correo_cambiado',
      entity_type: 'profile',
      entity_id: cuentaId,
      reason: 'Correo de acceso cambiado por el Superadmin',
      previous_state: { email: actual.data.email },
      next_state: { email: datos.email },
    })
  }

  // 2 · El perfil, bajo RLS y auditado con el Superadmin como autor.
  const perfil = normalizarPerfil(datos)
  const { error } = await comoSuperadmin
    .from('profiles')
    .update({ full_name: perfil.fullName, phone: perfil.phone, locale: perfil.locale })
    .eq('id', cuentaId)
  if (error) {
    throw createError({ statusCode: 400, statusMessage: errorDePerfilDesdeBase(error.message) })
  }

  return { ok: true }
})
