import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import { availableWeeks, turnOf } from '#shared/scheduling/selection'
import type { SelectionTurn } from '#shared/scheduling/selection'
import type { AllocationEntry, SwapRequestDraft } from '#shared/scheduling/swaps'
import type { BloquePico, SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'
import type { FraccionPropia, SwapRequestListed } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-12 · RF-12.3, RF-12.4, RF-12.6 · D-32 — la selección de semanas vista por el
 * Propietario: si la selección está abierta, si le toca, qué semanas siguen
 * libres, cuáles eligió y sus solicitudes de intercambio.
 *
 * El turno y la composición los calcula `shared/scheduling/selection`; la base
 * vuelve a comprobarlos en `select_weeks` y `request_week_swap`.
 */

interface SeleccionPropia {
  calendarId: string
  abiertaEl: string | null
  clasificacion: SemanaClasificada[]
  turnos: SelectionTurn[]
  asignaciones: AllocationEntry[]
  solicitudes: SwapRequestListed[]
}

export function useWeekSelection(fraccion: Ref<FraccionPropia | null>, anio: Ref<number>) {
  const client = useSupabaseClient<Database>()

  const rejilla = computed(() => rejillaDelAnio(anio.value))

  const consulta = useAsyncData<SeleccionPropia | null>(
    () => `seleccion-propia-${fraccion.value?.id}-${anio.value}`,
    async () => {
      const propia = fraccion.value
      if (!propia) {
        return null
      }
      const calendario = await client
        .from('season_calendars')
        .select('id, published_at')
        .eq('property_id', propia.propertyId)
        .eq('year', anio.value)
        .maybeSingle()
      if (!calendario.data) {
        return null
      }
      const id = calendario.data.id

      const [semanas, copropietarios, turnos, asignaciones, solicitudes] = await Promise.all([
        client.from('calendar_weeks').select('index, season, peak_block').eq('calendar_id', id).order('index'),
        client.rpc('copropietarios_de', { propiedad: propia.propertyId }),
        client.from('selection_turns').select('position, fractions(number)').eq('calendar_id', id).order('position'),
        client.from('allocations').select('fractions(number), calendar_weeks(index, season)').eq('calendar_id', id),
        client.from('week_swap_requests')
          .select('id, status, message, created_at, resolution_reason, requester:requester_fraction_id(number), target:target_fraction_id(number), offered:offered_week_id(index, season), requested:requested_week_id(index)')
          .eq('calendar_id', id)
          .order('created_at', { ascending: false }),
      ])

      const entradas = (asignaciones.data ?? []).flatMap<AllocationEntry>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        const semana = fila.calendar_weeks as unknown as { index: number, season: Temporada } | null
        return numero !== undefined && semana ? [{ fraction: numero, week: semana.index, season: semana.season }] : []
      })
      const elegidas = new Map<number, number>()
      for (const entrada of entradas) elegidas.set(entrada.fraction, (elegidas.get(entrada.fraction) ?? 0) + 1)
      // D-31 · D-32 · solo las fracciones con calendario activo tienen turno.
      const conTitular = new Set((copropietarios.data ?? []).filter(f => f.calendar_active).map(f => f.fraction_number))

      return {
        calendarId: id,
        abiertaEl: calendario.data.published_at,
        clasificacion: (semanas.data ?? []).map(fila => ({
          indice: fila.index,
          temporada: fila.season as Temporada,
          bloquePico: (fila.peak_block ?? null) as BloquePico | null,
        })),
        turnos: (turnos.data ?? []).flatMap<SelectionTurn>((fila) => {
          const numero = (fila.fractions as unknown as { number: number } | null)?.number
          return numero === undefined
            ? []
            : [{ fraction: numero, position: fila.position, hasOwner: conTitular.has(numero) || (numero === propia.number && propia.calendarActive), selectedWeeks: elegidas.get(numero) ?? 0 }]
        }),
        asignaciones: entradas,
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
    { watch: [fraccion, anio] },
  )

  const cargada = computed(() => consulta.data.value ?? null)
  const abierta = computed(() => cargada.value?.abiertaEl !== null && cargada.value?.abiertaEl !== undefined)
  const taken = computed(() => new Set((cargada.value?.asignaciones ?? []).map(a => a.week)))
  const turno = computed(() => (cargada.value && fraccion.value)
    ? turnOf(cargada.value.turnos, fraccion.value.number)
    : { position: null, canSelect: false, done: false, waitingFor: null })

  async function elegir(semanas: number[]): Promise<ResultadoDeEscritura> {
    const propia = fraccion.value
    const calendario = cargada.value?.calendarId
    if (!propia || !calendario) {
      return { ok: false, clave: 'calendar.selection.errors.select_failed' }
    }
    const { error } = await client.rpc('select_weeks', { calendar: calendario, fraction: propia.id, week_indexes: semanas })
    if (error) {
      return { ok: false, clave: 'calendar.selection.errors.select_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function solicitar(borrador: SwapRequestDraft, mensaje: string | null): Promise<ResultadoDeEscritura> {
    const propia = fraccion.value
    const calendario = cargada.value?.calendarId
    if (!propia || !calendario) {
      return { ok: false, clave: 'calendar.swaps.errors.request_failed' }
    }
    const { error } = await client.rpc('request_week_swap', {
      calendar: calendario,
      fraction: propia.id,
      offered_week: borrador.offeredWeek,
      target_fraction: borrador.targetFraction,
      requested_week: borrador.requestedWeek,
      message: mensaje ?? undefined,
    })
    if (error) {
      return { ok: false, clave: 'calendar.swaps.errors.request_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    rejilla,
    existe: computed(() => cargada.value !== null),
    abierta,
    clasificacion: computed(() => cargada.value?.clasificacion ?? []),
    turnos: computed(() => cargada.value?.turnos ?? []),
    turno,
    taken,
    disponibles: computed(() => availableWeeks(cargada.value?.clasificacion ?? [], taken.value)),
    asignaciones: computed(() => cargada.value?.asignaciones ?? []),
    propias: computed(() => (cargada.value?.asignaciones ?? []).filter(a => a.fraction === fraccion.value?.number)),
    solicitudes: computed(() => cargada.value?.solicitudes ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    elegir,
    solicitar,
  }
}
