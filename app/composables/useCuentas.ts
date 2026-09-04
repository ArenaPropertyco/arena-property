import type { CuentaConocida } from '#shared/purchases/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * Las cuentas activas que la sesión puede ver, para vincular a alguien que ya se
 * registró sin crearle otra cuenta (HU-06 · RF-06.1). La RLS de `profiles` decide
 * cuántas son: todas para el Superadmin, la propia para el resto. No se filtra
 * nada aquí: si la lista viene vacía, la interfaz solo ofrece escribir el correo.
 */
export function useCuentas() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<CuentaConocida[]>('cuentas-conocidas', async () => {
    const { data } = await client
      .from('profiles')
      .select('id, email, full_name')
      .eq('status', 'active')
      .order('email')

    return (data ?? []).map(perfil => ({ id: perfil.id, email: perfil.email, fullName: perfil.full_name }))
  })

  return {
    cuentas: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
