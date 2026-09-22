import { fractionWindowActive } from '#shared/scheduling/relocation'
import type { FraccionPropia } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { VentanaIndividual } from './useRelocation'

/**
 * HU-59 · RF-59.9 · D-47 — la ventana individual que el Superadmin pudo abrir a
 * la fracción propia para el año: si existe y está vigente, la selección no
 * espera turno y la reubicación no necesita ventana general. Si está vigente lo
 * decide `shared/scheduling/relocation` con el instante que avanza.
 */
export function useFractionWindow(fraccion: Ref<FraccionPropia | null>, anio: Ref<number>) {
  const client = useSupabaseClient<Database>()
  const ahora = useAhora()

  const consulta = useAsyncData<VentanaIndividual | null>(
    () => `ventana-individual-${fraccion.value?.id}-${anio.value}`,
    async () => {
      const propia = fraccion.value
      if (!propia) {
        return null
      }
      const { data } = await client
        .from('fraction_windows')
        .select('calendar_id, opens_at, closes_at')
        .eq('fraction_id', propia.id)
        .eq('year', anio.value)
        .is('closed_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ? { calendarId: data.calendar_id, opensAt: data.opens_at, closesAt: data.closes_at, closedAt: null } : null
    },
    { watch: [fraccion, anio] },
  )

  const ventana = computed(() => consulta.data.value ?? null)

  return {
    ventana,
    activa: computed(() => fractionWindowActive(ventana.value, ahora.value)),
    recargar: consulta.refresh,
  }
}
