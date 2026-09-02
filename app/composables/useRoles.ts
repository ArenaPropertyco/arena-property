import type { CuentaConRoles } from '#shared/identity/cuentas'
import type { Rol } from '#shared/permissions/roles'
import { esCombinacionValida } from '#shared/permissions/roles'
import type { Database } from '#shared/types/database.types'

/**
 * HU-07 · RF-07.3 — cuentas y sus roles, para la pantalla del Superadmin.
 * Orquesta consultas y escrituras; RLS decide quién puede y el disparador de la
 * base rechaza combinaciones inválidas. La comprobación previa aquí solo evita un
 * viaje inútil y da un mensaje claro.
 */

export function useRoles() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()

  const cuentas = useAsyncData<CuentaConRoles[]>('cuentas-con-roles', async () => {
    const [perfiles, roles] = await Promise.all([
      client.from('profiles').select('id, email, full_name, status').order('email'),
      client.from('user_roles').select('user_id, role'),
    ])

    const porCuenta = new Map<string, Rol[]>()
    for (const fila of roles.data ?? []) {
      porCuenta.set(fila.user_id, [...(porCuenta.get(fila.user_id) ?? []), fila.role as Rol])
    }

    return (perfiles.data ?? []).map(perfil => ({
      id: perfil.id,
      email: perfil.email,
      fullName: perfil.full_name,
      status: perfil.status,
      roles: porCuenta.get(perfil.id) ?? [],
    }))
  })

  async function otorgar(cuenta: CuentaConRoles, rol: Rol): Promise<'ok' | 'combinacion_invalida' | 'error'> {
    if (!esCombinacionValida([...cuenta.roles, rol])) {
      return 'combinacion_invalida'
    }
    const { error } = await client
      .from('user_roles')
      .insert({ user_id: cuenta.id, role: rol, granted_by: user.value?.id ?? null })
    if (error) {
      return 'error'
    }
    await cuentas.refresh()
    return 'ok'
  }

  async function retirar(cuenta: CuentaConRoles, rol: Rol): Promise<'ok' | 'error'> {
    const { error } = await client
      .from('user_roles')
      .delete()
      .eq('user_id', cuenta.id)
      .eq('role', rol)
    if (error) {
      return 'error'
    }
    await cuentas.refresh()
    return 'ok'
  }

  return {
    cuentas: computed(() => cuentas.data.value ?? []),
    pendiente: cuentas.pending,
    otorgar,
    retirar,
  }
}
