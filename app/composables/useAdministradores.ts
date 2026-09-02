import type { Administrador } from '#shared/identity/cuentas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-05 · RF-05.1 y RF-05.4 — administradores, sus propiedades asignadas y el
 * estado de su cuenta. La invitación pasa por la ruta de servidor porque crea una
 * cuenta en Supabase Auth; todo lo demás es lectura bajo RLS.
 */

export function useAdministradores() {
  const client = useSupabaseClient<Database>()

  const administradores = useAsyncData<Administrador[]>('administradores', async () => {
    const roles = await client.from('user_roles').select('user_id').eq('role', 'property_admin')
    const ids = [...new Set((roles.data ?? []).map(fila => fila.user_id))]
    if (ids.length === 0) {
      return []
    }

    const [perfiles, asignaciones] = await Promise.all([
      client.from('profiles').select('id, email, full_name, status').in('id', ids).order('email'),
      client.from('property_admins').select('admin_id, property_id').in('admin_id', ids).is('revoked_at', null),
    ])

    const propiedadesPorAdmin = new Map<string, string[]>()
    for (const fila of asignaciones.data ?? []) {
      propiedadesPorAdmin.set(fila.admin_id, [...(propiedadesPorAdmin.get(fila.admin_id) ?? []), fila.property_id])
    }

    return (perfiles.data ?? []).map(perfil => ({
      id: perfil.id,
      email: perfil.email,
      fullName: perfil.full_name,
      status: perfil.status,
      propiedades: propiedadesPorAdmin.get(perfil.id) ?? [],
    }))
  })

  async function invitar(email: string, locale: string): Promise<{ ok: true } | { ok: false, clave: string }> {
    try {
      await $fetch('/api/administradores', { method: 'POST', body: { email, locale } })
      await administradores.refresh()
      return { ok: true }
    }
    catch (error) {
      const clave = (error as { statusMessage?: string, data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
        ?? 'auth.errors.unknown'
      return { ok: false, clave }
    }
  }

  return {
    administradores: computed(() => administradores.data.value ?? []),
    pendiente: administradores.pending,
    invitar,
  }
}
