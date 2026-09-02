import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/**
 * HU-05 · RF-05.1 y HU-07 · RF-07.3 — guarda de servidor para acciones de Superadmin.
 *
 * Devuelve dos clientes con propósitos distintos:
 *   - `comoSuperadmin`: el cliente del propio usuario. Escribe bajo RLS, así que la
 *     base vuelve a comprobar el rol y la auditoría registra al autor real.
 *   - `conPrivilegio`: la llave de servicio, solo para lo que RLS no puede hacer
 *     (crear cuentas en Supabase Auth). Nunca se usa para escribir datos de negocio.
 */
export async function exigirSuperadmin(event: H3Event) {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'auth.errors.unknown' })
  }

  const comoSuperadmin = await serverSupabaseClient<Database>(event)
  const { data } = await comoSuperadmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'superadmin')
    .maybeSingle()

  if (!data) {
    throw createError({ statusCode: 403, statusMessage: 'auth.errors.unknown' })
  }

  return {
    user,
    comoSuperadmin,
    conPrivilegio: serverSupabaseServiceRole<Database>(event),
  }
}
