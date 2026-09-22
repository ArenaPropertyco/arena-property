import type { ReassignmentProposal } from '#shared/scheduling/reassignment'
import { swapErrorKey } from '#shared/scheduling/swaps'
import type { SwapProposal, AllocationEntry } from '#shared/scheduling/swaps'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { SelectionTurnListed, SwapRequestListed } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-12 · RF-12.4, RF-12.5, RF-12.6 · D-32 — lo que el Administrador maneja de la
 * selección de un calendario: el orden de turnos, cuánto lleva elegido cada
 * fracción, las semanas ya elegidas, los intercambios y las solicitudes.
 * HU-17 · RF-17.1, RF-17.3 — y la reasignación de una semana a otra libre.
 *
 * Todo lo que decide reglas vive en `shared/scheduling/selection`, `swaps` y
 * `reassignment`; la base las repite en `open_calendar_selection`, `swap_weeks`,
 * `resolve_swap_request` y `reassign_week`.
 */

interface SeleccionCargada {
  turnos: SelectionTurnListed[]
  asignaciones: AllocationEntry[]
  /** Semanas confirmadas o liberadas: no se intercambian (D-33). */
  lockedWeeks: number[]
  /** Semanas ya en la bolsa de renta: tampoco se reasignan (D-43). */
  releasedWeeks: number[]
  /** Semanas rentadas a un tercero: no son destino de nada (HU-39). */
  rentedWeeks: number[]
  solicitudes: SwapRequestListed[]
  fracciones: { number: number, ownerName: string | null, hasOwner: boolean }[]
}

export function useSelectionOrder(calendarId: Ref<string | null>, propertyId: Ref<string | null>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<SeleccionCargada | null>(
    () => `seleccion-${calendarId.value}`,
    async () => {
      const calendario = calendarId.value
      const propiedad = propertyId.value
      if (!calendario || !propiedad) {
        return null
      }
      const [copropietarios, turnos, asignaciones, solicitudes, reservas] = await Promise.all([
        client.rpc('copropietarios_de', { propiedad }),
        client.from('selection_turns').select('position, fractions(number)').eq('calendar_id', calendario).order('position'),
        client.from('allocations').select('confirmed_at, released_at, fractions(number), calendar_weeks(index, season)').eq('calendar_id', calendario),
        client.from('week_swap_requests')
          .select('id, status, message, created_at, resolution_reason, requester:requester_fraction_id(number), target:target_fraction_id(number), offered:offered_week_id(index, season), requested:requested_week_id(index)')
          .eq('calendar_id', calendario)
          .order('created_at', { ascending: false }),
        client.from('third_party_bookings').select('calendar_weeks(index)').eq('calendar_id', calendario).eq('status', 'confirmed'),
      ])

      const fracciones = (copropietarios.data ?? []).map(fila => ({
        number: fila.fraction_number,
        ownerName: fila.owner_name,
        // D-31 · D-32 · sin calendario activo no hay turno: la fracción se salta.
        hasOwner: fila.calendar_active,
      }))
      const nombreDe = new Map(fracciones.map(f => [f.number, f.ownerName]))

      const entradas = (asignaciones.data ?? []).flatMap<AllocationEntry>((fila) => {
        const fraccion = (fila.fractions as unknown as { number: number } | null)?.number
        const semana = fila.calendar_weeks as unknown as { index: number, season: Temporada } | null
        return fraccion !== undefined && semana ? [{ fraction: fraccion, week: semana.index, season: semana.season }] : []
      })
      const elegidas = new Map<number, number>()
      for (const entrada of entradas) elegidas.set(entrada.fraction, (elegidas.get(entrada.fraction) ?? 0) + 1)
      const indicesDe = (filas: { calendar_weeks: unknown }[]) => filas
        .map(fila => (fila.calendar_weeks as unknown as { index: number } | null)?.index)
        .filter((index): index is number => index !== undefined)
      const lockedWeeks = indicesDe((asignaciones.data ?? []).filter(fila => fila.confirmed_at !== null || fila.released_at !== null))
      const releasedWeeks = indicesDe((asignaciones.data ?? []).filter(fila => fila.released_at !== null))
      const rentedWeeks = indicesDe(reservas.data ?? [])

      return {
        fracciones,
        turnos: (turnos.data ?? []).flatMap<SelectionTurnListed>((fila) => {
          const numero = (fila.fractions as unknown as { number: number } | null)?.number
          if (numero === undefined) return []
          const propietario = fracciones.find(f => f.number === numero)
          return [{ fraction: numero, position: fila.position, ownerName: nombreDe.get(numero) ?? null, hasOwner: propietario?.hasOwner ?? false, selectedWeeks: elegidas.get(numero) ?? 0 }]
        }),
        asignaciones: entradas,
        lockedWeeks,
        releasedWeeks,
        rentedWeeks,
        solicitudes: (solicitudes.data ?? []).map<SwapRequestListed>(fila => ({
          id: fila.id,
          status: fila.status as SwapRequestListed['status'],
          message: fila.message,
          createdAt: fila.created_at,
          resolutionReason: fila.resolution_reason,
          requesterFraction: (fila.requester as unknown as { number: number } | null)?.number ?? 0,
          targetFraction: (fila.target as unknown as { number: number } | null)?.number ?? 0,
          offeredWeek: (fila.offered as unknown as { index: number } | null)?.index ?? 0,
          requestedWeek: (fila.requested as unknown as { index: number } | null)?.index ?? 0,
          season: ((fila.offered as unknown as { season: Temporada } | null)?.season ?? 'baja'),
        })),
      }
    },
    { watch: [calendarId] },
  )

  const cargada = computed(() => consulta.data.value ?? null)

  /** RF-12.5 · el orden que la base sugiere: el de compra el primer año, el anterior rotado después. */
  async function ordenSugerido(): Promise<number[]> {
    if (!calendarId.value) {
      return []
    }
    const { data } = await client.rpc('suggested_selection_order', { calendar: calendarId.value })
    return data ?? []
  }

  async function abrir(orden: number[]): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.selection.errors.open_failed' }
    }
    const { error } = await client.rpc('open_calendar_selection', { calendar: calendarId.value, fraction_order: orden })
    if (error) {
      return { ok: false, clave: error.message.includes('RF-12.7') ? 'calendar.errors.impossible_grid' : 'calendar.selection.errors.open_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function intercambiar(propuesta: SwapProposal, motivo: string): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.swaps.errors.swap_failed' }
    }
    const { error } = await client.rpc('swap_weeks', {
      calendar: calendarId.value,
      fraction_a: propuesta.from.fraction,
      week_a: propuesta.from.week,
      fraction_b: propuesta.to.fraction,
      week_b: propuesta.to.week,
      reason: motivo,
    })
    if (error) {
      return { ok: false, clave: 'calendar.swaps.errors.swap_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** HU-17 · RF-17.1 · mover una semana de una fracción a otra libre; la base repite las reglas de `reassignment`. */
  async function reasignar(propuesta: ReassignmentProposal): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.reassignment.errors.reassign_failed' }
    }
    const { error } = await client.rpc('reassign_week', {
      calendar: calendarId.value,
      fraction: propuesta.fraction,
      from_week: propuesta.fromWeek,
      to_week: propuesta.toWeek,
      reason: propuesta.reason,
      override_season: propuesta.overrideSeason,
    })
    if (error) {
      return { ok: false, clave: 'calendar.reassignment.errors.reassign_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function resolver(id: string, aprobar: boolean, motivo: string | null): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('resolve_swap_request', { request: id, approve: aprobar, reason: motivo ?? undefined })
    if (error) {
      // RF-12.9 · la base sabe por qué no se puede; decirlo es la mitad del arreglo.
      return { ok: false, clave: swapErrorKey(error.message) ?? 'calendar.swaps.errors.resolve_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    turnos: computed(() => cargada.value?.turnos ?? []),
    fracciones: computed(() => cargada.value?.fracciones ?? []),
    asignaciones: computed(() => cargada.value?.asignaciones ?? []),
    lockedWeeks: computed(() => cargada.value?.lockedWeeks ?? []),
    releasedWeeks: computed(() => cargada.value?.releasedWeeks ?? []),
    rentedWeeks: computed(() => cargada.value?.rentedWeeks ?? []),
    solicitudes: computed(() => cargada.value?.solicitudes ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    ordenSugerido,
    abrir,
    intercambiar,
    reasignar,
    resolver,
  }
}
