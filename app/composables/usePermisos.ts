import type { AjusteDeCapacidad, Alcance, Capacidad, Columna } from '#shared/permissions/mapa'
import { MATRIZ, matrizEfectiva } from '#shared/permissions/mapa'
import type { Database } from '#shared/types/database.types'

/**
 * HU-07 · RF-07.3 — la matriz efectiva: la del VSM con los ajustes del Superadmin.
 *
 * La consulta la comparte toda la aplicación bajo una sola clave, para que la guarda
 * de rutas y la interfaz decidan siempre con la misma matriz. Quién puede ajustar lo
 * decide RLS; aquí solo se escribe y se recarga.
 */
export function usePermisos() {
  const client = useSupabaseClient<Database>()

  const ajustes = useAsyncData<AjusteDeCapacidad[]>('permisos-ajustes', async () => {
    const { data } = await client
      .from('role_capabilities')
      .select('capability, role, scope')

    return (data ?? []).map(fila => ({
      capacidad: fila.capability as Capacidad,
      columna: fila.role as Columna,
      alcance: fila.scope as Alcance,
    }))
  })

  const matriz = computed(() => matrizEfectiva(ajustes.data.value ?? []))

  /** Guarda el ajuste de una celda, o lo retira si vuelve al valor del VSM. */
  async function ajustar(ajuste: AjusteDeCapacidad): Promise<'ok' | 'error'> {
    const esElDeLaBase = MATRIZ[ajuste.capacidad][ajuste.columna] === ajuste.alcance

    const { error } = esElDeLaBase
      ? await client
          .from('role_capabilities')
          .delete()
          .eq('capability', ajuste.capacidad)
          .eq('role', ajuste.columna)
      : await client
          .from('role_capabilities')
          .upsert({
            capability: ajuste.capacidad,
            role: ajuste.columna,
            scope: ajuste.alcance,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'capability,role' })

    if (error) {
      return 'error'
    }

    await ajustes.refresh()
    return 'ok'
  }

  return {
    matriz,
    ajustes: computed(() => ajustes.data.value ?? []),
    pendiente: ajustes.pending,
    ajustar,
    esperar: () => ajustes,
  }
}
