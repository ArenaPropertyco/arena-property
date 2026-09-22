import { fractionWindowActive, relocationErrorKey, relocationTurnOf, windowPhase } from '#shared/scheduling/relocation'
import type { FractionWindow, RelocationTurn, RelocationWindow, WindowPhase } from '#shared/scheduling/relocation'
import type { FraccionPropia } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-59 · RF-59.3…RF-59.6 · D-36 — la ventana de reubicación vista por el
 * Propietario: si existe, en qué fase está y qué puede hacer su fracción ahora
 * mismo. El estado del turno lo calcula `shared/scheduling/relocation` con el
 * instante que avanza; mover una semana es una función de la base que vuelve a
 * validar todo (RF-59.8). RF-59.9 · D-47 · si el Superadmin abrió a la fracción
 * una ventana individual, esa manda: hay turno aunque no haya ventana general.
 */

interface VentanaCargada extends RelocationWindow {
  calendarId: string
}

/** RF-59.9 · la ventana individual vigente de la fracción para el año, con su calendario. */
export interface VentanaIndividual extends FractionWindow {
  calendarId: string
}

export function useRelocation(fraccion: Ref<FraccionPropia | null>, anio: Ref<number>, individual?: Ref<VentanaIndividual | null>) {
  const client = useSupabaseClient<Database>()
  const ahora = useAhora()

  const consulta = useAsyncData<VentanaCargada | null>(
    () => `ventana-propia-${fraccion.value?.id}-${anio.value}`,
    async () => {
      const propia = fraccion.value
      if (!propia) {
        return null
      }
      const ventana = await client
        .from('selection_windows')
        .select('id, calendar_id, opens_at, duration_days, turn_hours, closed_at')
        .eq('property_id', propia.propertyId)
        .eq('year', anio.value)
        .maybeSingle()
      if (!ventana.data) {
        return null
      }
      const turnos = await client
        .from('selection_window_turns')
        .select('position, fractions(number)')
        .eq('window_id', ventana.data.id)
        .order('position')
      return {
        calendarId: ventana.data.calendar_id,
        opensAt: ventana.data.opens_at,
        durationDays: ventana.data.duration_days,
        turnHours: ventana.data.turn_hours,
        closedAt: ventana.data.closed_at,
        order: (turnos.data ?? []).flatMap((fila) => {
          const numero = (fila.fractions as unknown as { number: number } | null)?.number
          return numero === undefined ? [] : [numero]
        }),
      }
    },
    { watch: [fraccion, anio] },
  )

  const ventana = computed(() => consulta.data.value ?? null)
  const fase = computed<WindowPhase | null>(() => ventana.value ? windowPhase(ventana.value, ahora.value) : null)
  const individualActiva = computed(() => fractionWindowActive(individual?.value, ahora.value))
  const turno = computed<RelocationTurn | null>(() => (fraccion.value && (ventana.value || individualActiva.value))
    ? relocationTurnOf(ventana.value, fraccion.value.number, ahora.value, individual?.value)
    : null)

  async function reubicar(fromWeek: number, toWeek: number): Promise<ResultadoDeEscritura> {
    const propia = fraccion.value
    const calendario = ventana.value?.calendarId ?? individual?.value?.calendarId
    if (!propia || !calendario) {
      return { ok: false, clave: 'calendar.relocation.errors.relocate_failed' }
    }
    const { error } = await client.rpc('relocate_week', { calendar: calendario, fraction: propia.id, from_week: fromWeek, to_week: toWeek })
    if (error) {
      return { ok: false, clave: relocationErrorKey(error.message) ?? 'calendar.relocation.errors.relocate_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    ventana,
    fase,
    turno,
    ahora,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    reubicar,
  }
}
