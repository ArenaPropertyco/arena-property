import { hoy as hoyDe } from '#shared/dates/formato'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import type { BloquePico, SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'
import type { FraccionPropia } from '#shared/scheduling/vistas'
import { projectWeeks } from '#shared/scheduling/week-projection'
import type { AllocationState, WeekProjectionInput } from '#shared/scheduling/week-projection'
import { weekErrorKey } from '#shared/scheduling/week-usage'
import type { ReleaseReason, UsageContext } from '#shared/scheduling/week-usage'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-13 · RF-13.1…RF-13.4 · HU-14 · RF-14.1…RF-14.9 · D-33 — el calendario por
 * semanas de una fracción propia para un año.
 *
 * Carga lo que la base sabe del año (rejilla clasificada, semanas elegidas por
 * cada fracción con sus marcas, bloqueos, turnos y copropietarios por nombre) y
 * se lo pasa al motor puro: la proyección de cada semana y el contexto de uso
 * salen de `shared/scheduling/week-projection` (RF-13.4). Confirmar, cancelar y
 * liberar son funciones de la base que vuelven a validar todo (RF-14.10).
 */

interface CalendarioCargado {
  id: string
  abiertoEl: string | null
  classification: SemanaClasificada[]
  allocations: AllocationState[]
  blocks: { week: number, reason: string }[]
  selectionComplete: boolean
  coOwners: { fraction: number, name: string | null }[]
}

export function useOwnerWeeks(fraccion: Ref<FraccionPropia | null>, anio: Ref<number>) {
  const client = useSupabaseClient<Database>()

  const today = computed(() => hoyDe())
  const rejilla = computed(() => rejillaDelAnio(anio.value))

  const consulta = useAsyncData<CalendarioCargado | null>(
    () => `semanas-propias-${fraccion.value?.id}-${anio.value}`,
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
      if (!calendario.data?.published_at) {
        return null
      }
      const id = calendario.data.id

      const [semanas, asignaciones, bloqueos, turnos, copropietarios] = await Promise.all([
        client.from('calendar_weeks').select('index, season, peak_block').eq('calendar_id', id).order('index'),
        client.from('allocations').select('confirmed_at, released_at, release_reason, fractions(number), calendar_weeks(index)').eq('calendar_id', id),
        client.from('week_blocks').select('reason, calendar_weeks(index)').eq('calendar_id', id).is('lifted_at', null),
        client.from('selection_turns').select('fractions(number)').eq('calendar_id', id),
        client.rpc('copropietarios_de', { propiedad: propia.propertyId }),
      ])

      const allocations = (asignaciones.data ?? []).flatMap<AllocationState>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        const semana = (fila.calendar_weeks as unknown as { index: number } | null)?.index
        return numero === undefined || semana === undefined
          ? []
          : [{ fraction: numero, week: semana, confirmedAt: fila.confirmed_at, releasedAt: fila.released_at, releaseReason: fila.release_reason as ReleaseReason | null }]
      })

      // D-32 · mientras haya turnos sin elegir, las semanas libres no son bolsa: siguen elegibles.
      const activas = new Set((copropietarios.data ?? []).filter(f => f.calendar_active).map(f => f.fraction_number))
      const elegidas = new Map<number, number>()
      for (const a of allocations) elegidas.set(a.fraction, (elegidas.get(a.fraction) ?? 0) + 1)
      const selectionComplete = (turnos.data ?? [])
        .map(fila => (fila.fractions as unknown as { number: number } | null)?.number)
        .filter((numero): numero is number => numero !== undefined && activas.has(numero))
        .every(numero => (elegidas.get(numero) ?? 0) > 0)

      return {
        id,
        abiertoEl: calendario.data.published_at,
        classification: (semanas.data ?? []).map(fila => ({
          indice: fila.index,
          temporada: fila.season as Temporada,
          bloquePico: (fila.peak_block ?? null) as BloquePico | null,
        })),
        allocations,
        blocks: (bloqueos.data ?? []).flatMap((fila) => {
          const semana = (fila.calendar_weeks as unknown as { index: number } | null)?.index
          return semana === undefined ? [] : [{ week: semana, reason: fila.reason }]
        }),
        selectionComplete,
        coOwners: (copropietarios.data ?? []).map(fila => ({ fraction: fila.fraction_number, name: fila.owner_name })),
      }
    },
    { watch: [fraccion, anio] },
  )

  const cargado = computed(() => consulta.data.value ?? null)

  const input = computed<WeekProjectionInput | null>(() => {
    const datos = cargado.value
    const propia = fraccion.value
    if (!datos || !propia) {
      return null
    }
    return {
      today: today.value,
      ownFraction: propia.number,
      calendarActive: propia.calendarActive,
      activatedOn: propia.activadoEl,
      rejilla: rejilla.value,
      classification: datos.classification,
      allocations: datos.allocations,
      blocks: datos.blocks,
      selectionComplete: datos.selectionComplete,
      coOwners: datos.coOwners,
    }
  })

  const projection = computed(() => input.value ? projectWeeks(input.value) : null)

  /** Lo que el motor puro necesita para explicar cada acción antes de enviarla. */
  const context = computed<UsageContext | null>(() => {
    const propia = fraccion.value
    if (!propia || !cargado.value) {
      return null
    }
    return {
      calendarActive: propia.calendarActive,
      today: today.value,
      activatedOn: propia.activadoEl,
      blockedWeeks: new Set(cargado.value.blocks.map(b => b.week)),
    }
  })

  async function ejecutar(nombre: 'confirm_week' | 'cancel_week' | 'release_week', week: number, fallo: string): Promise<ResultadoDeEscritura> {
    const propia = fraccion.value
    const calendario = cargado.value?.id
    if (!propia || !calendario) {
      return { ok: false, clave: fallo }
    }
    const { error } = await client.rpc(nombre, { calendar: calendario, fraction: propia.id, week_index: week })
    if (error) {
      return { ok: false, clave: weekErrorKey(error.message) ?? fallo }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    rejilla,
    today,
    abierto: computed(() => cargado.value !== null),
    abiertoEl: computed(() => cargado.value?.abiertoEl ?? null),
    projection,
    context,
    /** HU-59 · lo que el motor de reubicación necesita, tal como lo sabe la base. */
    allocations: computed(() => cargado.value?.allocations ?? []),
    classification: computed(() => cargado.value?.classification ?? []),
    blockedWeeks: computed(() => (cargado.value?.blocks ?? []).map(b => b.week)),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    confirm: (week: number) => ejecutar('confirm_week', week, 'calendar.weeks.errors.confirm_failed'),
    cancel: (week: number) => ejecutar('cancel_week', week, 'calendar.weeks.errors.cancel_failed'),
    release: (week: number) => ejecutar('release_week', week, 'calendar.weeks.errors.release_failed'),
  }
}
