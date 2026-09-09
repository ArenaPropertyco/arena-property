import { hoy } from '#shared/dates/formato'
import type { FraccionPropia } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-13 · RF-13.1 · D-31 — las fracciones de quien mira, con su interruptor de
 * calendario y su fecha de activación (RF-14.1c). La RLS de `fractions` deja al
 * titular leer las suyas aunque la propiedad no esté publicada (D-16).
 */
export function useFraccionesPropias() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta } = useCuenta()

  const consulta = useAsyncData<FraccionPropia[]>('fracciones-propias', async () => {
    const cuenta = idDeCuenta.value
    if (!cuenta) {
      return []
    }

    const { data } = await client
      .from('fractions')
      .select('id, number, property_id, calendar_active, calendar_activated_at, properties(name)')
      .eq('owner_id', cuenta)
      .order('number')

    return (data ?? []).map<FraccionPropia>(fila => ({
      id: fila.id,
      number: fila.number,
      propertyId: fila.property_id,
      propertyName: (fila.properties as unknown as { name: string } | null)?.name ?? '',
      calendarActive: fila.calendar_active,
      activadoEl: fila.calendar_activated_at ? hoy(new Date(fila.calendar_activated_at)) : null,
    }))
  }, { watch: [idDeCuenta] })

  return {
    fracciones: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
