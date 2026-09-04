import type { H3Event } from 'h3'
import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '#shared/types/database.types'
import { idDeCuenta } from './superadmin'

/**
 * HU-06 · RF-06.1 y HU-05 · RF-05.3 — guarda de servidor para quien gestiona una
 * propiedad: el Superadmin o su Administrador con asignación vigente.
 *
 * Como `exigirSuperadmin`, devuelve dos clientes: el de la sesión, que escribe bajo
 * RLS con su autor en la auditoría, y el de servicio, reservado a lo que RLS no
 * puede hacer (crear cuentas en Supabase Auth). La decisión de quién gestiona qué la
 * toma la base con las mismas tablas que sus políticas; aquí solo se consulta.
 */
export async function exigirGestionDePropiedad(event: H3Event, propertyId: string) {
  const user = await serverSupabaseUser(event)
  // Los claims del JWT traen la cuenta en `sub`, no en `id`.
  const userId = idDeCuenta(user)
  if (!user || !userId) {
    throw createError({ statusCode: 401, statusMessage: 'auth.errors.unknown' })
  }

  const comoGestor = await serverSupabaseClient<Database>(event)

  const [roles, asignacion] = await Promise.all([
    comoGestor.from('user_roles').select('role').eq('user_id', userId).eq('role', 'superadmin').maybeSingle(),
    comoGestor
      .from('property_admins')
      .select('id')
      .eq('admin_id', userId)
      .eq('property_id', propertyId)
      .is('revoked_at', null)
      .maybeSingle(),
  ])

  if (!roles.data && !asignacion.data) {
    throw createError({ statusCode: 403, statusMessage: 'purchases.validation.not_property_admin' })
  }

  return {
    user,
    userId,
    comoGestor,
    conPrivilegio: serverSupabaseServiceRole<Database>(event),
  }
}
