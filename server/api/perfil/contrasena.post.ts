import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import { validarCambioDeContrasena } from '#shared/identity/edicion-de-perfil'
import type { Database } from '#shared/types/database.types'

/**
 * Perfil · cambiar (o crear) la contraseña de la propia cuenta.
 *
 * Desde el navegador, Supabase Auth cambia la contraseña con solo tener sesión:
 * una sesión robada bastaría para quedarse con la cuenta. Por eso el cambio pasa
 * por aquí, que **verifica la actual** contra Supabase Auth antes de fijar la nueva.
 * Una cuenta creada con Google no tiene contraseña: entonces se crea, sin pedir una
 * actual que no existe (lo dice `tengo_contrasena()`, que no expone el hash).
 *
 * La nueva se fija con la llave de servicio (API de administración), el único uso
 * de privilegio de esta ruta. El cambio queda auditado sin ningún dato secreto.
 */

interface Cuerpo {
  actual?: string
  nueva?: string
  confirmacion?: string
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const userId = idDeCuenta(user)
  const email = typeof user?.email === 'string' ? user.email : null
  if (!user || !userId || !email) {
    throw createError({ statusCode: 401, statusMessage: 'auth.errors.unknown' })
  }

  const cuerpo = await readBody<Cuerpo>(event)
  const datos = { actual: cuerpo?.actual ?? '', nueva: cuerpo?.nueva ?? '', confirmacion: cuerpo?.confirmacion ?? '' }

  const comoCuenta = await serverSupabaseClient<Database>(event)
  const { data: tieneContrasena, error: errorDeConsulta } = await comoCuenta.rpc('tengo_contrasena')
  if (errorDeConsulta) {
    throw createError({ statusCode: 500, statusMessage: 'profile.password.errors.failed' })
  }

  const errores = validarCambioDeContrasena(datos, tieneContrasena === true)
  if (errores.length > 0) {
    throw createError({ statusCode: 400, statusMessage: errores[0]!.message })
  }

  // La actual se comprueba intentando entrar con ella; un fallo es contraseña errónea.
  if (tieneContrasena) {
    const { url, key } = useRuntimeConfig(event).public.supabase
    const valida = await $fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: key },
      body: { email, password: datos.actual },
    }).then(() => true, () => false)
    if (!valida) {
      throw createError({ statusCode: 400, statusMessage: 'profile.password.errors.wrong_current' })
    }
  }

  const conPrivilegio = serverSupabaseServiceRole<Database>(event)
  const { error } = await conPrivilegio.auth.admin.updateUserById(userId, { password: datos.nueva })
  if (error) {
    throw createError({ statusCode: 502, statusMessage: 'profile.password.errors.failed' })
  }

  // TR-01 · constancia del cambio, nunca de la contraseña.
  await conPrivilegio.from('audit_log').insert({
    actor_id: userId,
    actor_role: 'user',
    action: tieneContrasena ? 'profile.contrasena_cambiada' : 'profile.contrasena_creada',
    entity_type: 'profile',
    entity_id: userId,
    reason: tieneContrasena ? 'Contraseña cambiada por su titular' : 'Contraseña creada por su titular',
  })

  return { ok: true, creada: !tieneContrasena }
})
