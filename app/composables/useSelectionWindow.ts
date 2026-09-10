import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import type { RelocationTurnListed, SelectionWindowListed } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-59 · RF-59.1, RF-59.2, RF-59.6 · D-36 — la ventana de reubicación de un
 * calendario vista por quien gestiona: apertura, duración, turnos con su franja y
 * el nombre de cada titular (D-16). Configurar (solo el Superadmin) y cerrar son
 * funciones de la base que repiten las reglas; el orden sugerido también sale de
 * ella (RF-59.2).
 */
export function useSelectionWindow(calendarId: Ref<string | null>, propertyId: Ref<string | null>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<SelectionWindowListed | null>(
    () => `ventana-${calendarId.value}`,
    async () => {
      const calendario = calendarId.value
      const propiedad = propertyId.value
      if (!calendario || !propiedad) {
        return null
      }
      const ventana = await client
        .from('selection_windows')
        .select('id, opens_at, closes_at, duration_days, turn_hours, closed_at')
        .eq('calendar_id', calendario)
        .maybeSingle()
      if (!ventana.data) {
        return null
      }
      const [turnos, copropietarios] = await Promise.all([
        client.from('selection_window_turns').select('position, opens_at, closes_at, fractions(number)').eq('window_id', ventana.data.id).order('position'),
        client.rpc('copropietarios_de', { propiedad }),
      ])
      const nombreDe = new Map((copropietarios.data ?? []).map(fila => [fila.fraction_number, fila.owner_name]))
      const turns = (turnos.data ?? []).flatMap<RelocationTurnListed>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        return numero === undefined
          ? []
          : [{ fraction: numero, position: fila.position, opensAt: fila.opens_at, closesAt: fila.closes_at, ownerName: nombreDe.get(numero) ?? null }]
      })
      return {
        id: ventana.data.id,
        opensAt: ventana.data.opens_at,
        closesAt: ventana.data.closes_at,
        durationDays: ventana.data.duration_days,
        turnHours: ventana.data.turn_hours,
        closedAt: ventana.data.closed_at,
        order: turns.map(t => t.fraction),
        turns,
      }
    },
    { watch: [calendarId] },
  )

  /** RF-59.2 · el orden que la base sugiere: el de la selección el primer año, el anterior rotado después. */
  async function ordenSugerido(): Promise<number[]> {
    if (!calendarId.value) {
      return []
    }
    const { data } = await client.rpc('suggested_relocation_order', { calendar: calendarId.value })
    return data ?? []
  }

  async function configurar(config: RelocationWindowConfig): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.configure_failed' }
    }
    const { error } = await client.rpc('configure_selection_window', {
      calendar: calendarId.value,
      opens_at: config.opensAt,
      duration_days: config.durationDays,
      turn_hours: config.turnHours,
      fraction_order: config.order,
    })
    if (error) {
      return { ok: false, clave: 'calendar.relocation.errors.configure_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function cerrar(): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.close_failed' }
    }
    const { error } = await client.rpc('close_selection_window', { calendar: calendarId.value })
    if (error) {
      return { ok: false, clave: 'calendar.relocation.errors.close_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    ventana: computed(() => consulta.data.value ?? null),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    ordenSugerido,
    configurar,
    cerrar,
  }
}
