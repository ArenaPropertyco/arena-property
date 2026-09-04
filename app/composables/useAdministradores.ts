import type { Administrador } from '#shared/identity/cuentas'
import type { Rol } from '#shared/permissions/roles'
import { cambiosDeAsignacion, cuentasPromovibles, hayCambios } from '#shared/properties/asignaciones'
import type { CuentaPromovible } from '#shared/properties/asignaciones'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Una propiedad tal como la elige el Superadmin al asignarla. */
export interface PropiedadAsignable {
  id: string
  name: string
}

/**
 * HU-05 · RF-05.1, RF-05.2 y RF-05.4 — administradores, sus propiedades asignadas
 * y el estado de su cuenta.
 *
 * Tres vías de escritura, todas bajo RLS y auditadas con el Superadmin como autor:
 *   - invitar por correo pasa por la ruta de servidor porque crea la cuenta en Auth;
 *   - promover una cuenta existente es otorgarle el rol en `user_roles`;
 *   - asignar o retirar propiedades escribe solo el cambio mínimo en
 *     `property_admins`, para no inventar en el histórico retiros que no ocurrieron.
 */

export function useAdministradores() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()

  const datos = useAsyncData('administradores', async () => {
    const [perfiles, roles, asignaciones, propiedades] = await Promise.all([
      client.from('profiles').select('id, email, full_name, status').order('email'),
      client.from('user_roles').select('user_id, role'),
      client.from('property_admins').select('admin_id, property_id').is('revoked_at', null),
      client.from('property_overview').select('id, name').order('name'),
    ])

    const rolesPorCuenta = new Map<string, Rol[]>()
    for (const fila of roles.data ?? []) {
      rolesPorCuenta.set(fila.user_id, [...(rolesPorCuenta.get(fila.user_id) ?? []), fila.role as Rol])
    }

    const propiedadesPorAdmin = new Map<string, string[]>()
    for (const fila of asignaciones.data ?? []) {
      propiedadesPorAdmin.set(fila.admin_id, [...(propiedadesPorAdmin.get(fila.admin_id) ?? []), fila.property_id])
    }

    const cuentas: CuentaPromovible[] = (perfiles.data ?? []).map(perfil => ({
      id: perfil.id,
      email: perfil.email,
      fullName: perfil.full_name,
      status: perfil.status,
      roles: rolesPorCuenta.get(perfil.id) ?? [],
    }))

    const administradores: Administrador[] = cuentas
      .filter(cuenta => cuenta.roles.includes('property_admin'))
      .map(cuenta => ({
        id: cuenta.id,
        email: cuenta.email,
        fullName: cuenta.fullName,
        status: cuenta.status,
        propiedades: propiedadesPorAdmin.get(cuenta.id) ?? [],
      }))

    return {
      administradores,
      candidatos: cuentasPromovibles(cuentas),
      propiedades: (propiedades.data ?? [])
        .filter((fila): fila is { id: string, name: string } => fila.id !== null && fila.name !== null)
        .map<PropiedadAsignable>(fila => ({ id: fila.id, name: fila.name })),
    }
  })

  async function invitar(email: string, locale: string): Promise<ResultadoDeEscritura> {
    try {
      await $fetch('/api/administradores', { method: 'POST', body: { email, locale } })
      await datos.refresh()
      return { ok: true }
    }
    catch (error) {
      const clave = (error as { statusMessage?: string, data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
        ?? 'auth.errors.unknown'
      return { ok: false, clave }
    }
  }

  /** RF-05.1 · una cuenta existente recibe el rol Administrador (RF-07.1: se acumula). */
  async function promover(cuentaId: string): Promise<ResultadoDeEscritura> {
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: cuentaId, role: 'property_admin', granted_by: user.value?.id ?? null })

    if (error) {
      return { ok: false, clave: 'admins.promoteFailed' }
    }

    await datos.refresh()
    return { ok: true }
  }

  /**
   * RF-05.1 · RF-05.2 · deja las propiedades del administrador en la lista pedida:
   * otorga las que faltan y retira las que sobran, sin borrar nada.
   */
  async function sincronizarPropiedades(adminId: string, deseadas: string[]): Promise<ResultadoDeEscritura> {
    const vigentes = await client
      .from('property_admins')
      .select('property_id')
      .eq('admin_id', adminId)
      .is('revoked_at', null)

    const cambio = cambiosDeAsignacion((vigentes.data ?? []).map(fila => fila.property_id), deseadas)
    if (!hayCambios(cambio)) {
      return { ok: true }
    }

    const autor = user.value?.id ?? null

    if (cambio.otorgar.length > 0) {
      const { error } = await client.from('property_admins').insert(
        cambio.otorgar.map(propertyId => ({ admin_id: adminId, property_id: propertyId, assigned_by: autor })),
      )
      if (error) {
        return { ok: false, clave: 'admins.propertiesFailed' }
      }
    }

    if (cambio.retirar.length > 0) {
      const { error } = await client
        .from('property_admins')
        .update({ revoked_at: new Date().toISOString(), revoked_by: autor })
        .eq('admin_id', adminId)
        .in('property_id', cambio.retirar)
        .is('revoked_at', null)
      if (error) {
        return { ok: false, clave: 'admins.propertiesFailed' }
      }
    }

    await datos.refresh()
    return { ok: true }
  }

  return {
    administradores: computed(() => datos.data.value?.administradores ?? []),
    candidatos: computed(() => datos.data.value?.candidatos ?? []),
    propiedades: computed(() => datos.data.value?.propiedades ?? []),
    pendiente: datos.pending,
    invitar,
    promover,
    sincronizarPropiedades,
  }
}
