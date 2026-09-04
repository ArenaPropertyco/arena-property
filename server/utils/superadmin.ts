import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'

/** Identificador de la cuenta a partir de los claims (`sub`), o `null` si no hay sesión. */
export function idDeCuenta(claims: { sub?: string, id?: string } | null | undefined): string | null {
  const id = claims?.sub ?? claims?.id ?? null
  return typeof id === 'string' && id !== '' ? id : null
}

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
  // `serverSupabaseUser` devuelve los claims del JWT verificado: la cuenta es `sub`,
  // no `id`. Buscar el rol por `id` no encontraba nada y rechazaba a todo el mundo.
  const userId = idDeCuenta(user)
  if (!user || !userId) {
    throw createError({ statusCode: 401, statusMessage: 'auth.errors.unknown' })
  }

  const comoSuperadmin = await serverSupabaseClient<Database>(event)
  const { data } = await comoSuperadmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'superadmin')
    .maybeSingle()

  if (!data) {
    throw createError({ statusCode: 403, statusMessage: 'auth.errors.unknown' })
  }

  return {
    user,
    userId,
    comoSuperadmin,
    conPrivilegio: serverSupabaseServiceRole<Database>(event),
  }
}
