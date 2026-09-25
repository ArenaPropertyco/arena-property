import { hoy as hoyDe } from '#shared/dates/formato'
import { rejillaDelAnio } from '#shared/scheduling/rejilla'
import type { SemanaClasificada } from '#shared/scheduling/temporadas'
import { projectPropertyWeeks } from '#shared/scheduling/week-projection'
import type { AllocationState, PropertyProjectionInput, RentedWeek } from '#shared/scheduling/week-projection'
import { weekErrorKey } from '#shared/scheduling/week-usage'
import type { ReleaseReason, UsageContext } from '#shared/scheduling/week-usage'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-13 · RF-13.3 · HU-14 · RF-14.1, RF-14.6, RF-14.7 · D-31, D-43 — el tablero de
 * semanas de una propiedad para quien la gestiona.
 *
 * Carga lo que la base sabe del calendario abierto (semanas elegidas por cada
 * fracción con sus marcas, bloqueos, turnos, titulares y semanas ya colocadas a
 * un tercero) y se lo pasa al motor puro: la proyección de cada semana y el cupo
 * de cada fracción salen de `shared/scheduling/week-projection`. La clasificación
 * la aporta la página, que ya la tiene cargada para la rejilla.
 *
 * Confirmar, cancelar y liberar son las mismas funciones de la base que usa el
 * Propietario: aceptan a quien gestiona la propiedad y vuelven a validar todo.
 */

interface TableroCargado {
  fracciones: { id: string, number: number, calendarActive: boolean }[]
  coOwners: { fraction: number, name: string | null, calendarActive: boolean }[]
  allocations: AllocationState[]
  blocks: { week: number, reason: string }[]
  selectionComplete: boolean
  rentals: RentedWeek[]
}

export function useSemanasDePropiedad(
  propertyId: Ref<string | null>,
  calendarId: Ref<string | null>,
  anio: Ref<number>,
  clasificacion: Ref<SemanaClasificada[]>,
) {
  const client = useSupabaseClient<Database>()

  const today = computed(() => hoyDe())
  const rejilla = computed(() => rejillaDelAnio(anio.value))

  const consulta = useAsyncData<TableroCargado | null>(
    () => `semanas-propiedad-${calendarId.value}`,
    async () => {
      const id = calendarId.value
      const propiedad = propertyId.value
      if (!id || !propiedad) {
        return null
      }

      const [asignaciones, bloqueos, turnos, fracciones, copropietarios, reservas] = await Promise.all([
        client.from('allocations').select('confirmed_at, released_at, release_reason, fractions(number), calendar_weeks(index)').eq('calendar_id', id),
        client.from('week_blocks').select('reason, calendar_weeks(index)').eq('calendar_id', id).is('lifted_at', null),
        client.from('selection_turns').select('fractions(number)').eq('calendar_id', id),
        client.from('fractions').select('id, number, calendar_active').eq('property_id', propiedad).order('number'),
        client.rpc('copropietarios_de', { propiedad }),
        client.from('third_party_bookings').select('calendar_weeks(index)').eq('calendar_id', id).eq('status', 'confirmed'),
      ])

      const indiceDe = (fila: { calendar_weeks: unknown }) => (fila.calendar_weeks as unknown as { index: number } | null)?.index

      const allocations = (asignaciones.data ?? []).flatMap<AllocationState>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        const semana = indiceDe(fila)
        return numero === undefined || semana === undefined
          ? []
          : [{ fraction: numero, week: semana, confirmedAt: fila.confirmed_at, releasedAt: fila.released_at, releaseReason: fila.release_reason as ReleaseReason | null }]
      })

      const coOwners = (copropietarios.data ?? []).map(fila => ({
        fraction: fila.fraction_number,
        name: fila.owner_name,
        calendarActive: fila.calendar_active,
      }))

      // D-32 · mientras haya turnos sin elegir, las semanas libres no son bolsa: siguen elegibles.
      const activas = new Set(coOwners.filter(f => f.calendarActive).map(f => f.fraction))
      const elegidas = new Map<number, number>()
      for (const a of allocations) elegidas.set(a.fraction, (elegidas.get(a.fraction) ?? 0) + 1)
      const selectionComplete = (turnos.data ?? [])
        .map(fila => (fila.fractions as unknown as { number: number } | null)?.number)
        .filter((numero): numero is number => numero !== undefined && activas.has(numero))
        .every(numero => (elegidas.get(numero) ?? 0) > 0)

      return {
        fracciones: (fracciones.data ?? []).map(fila => ({ id: fila.id, number: fila.number, calendarActive: fila.calendar_active })),
        coOwners,
        allocations,
        blocks: (bloqueos.data ?? []).flatMap((fila) => {
          const semana = indiceDe(fila)
          return semana === undefined ? [] : [{ week: semana, reason: fila.reason }]
        }),
        selectionComplete,
        // D-43 · aquí solo importa cuál ya tiene tercero; el reparto del ingreso es de HU-40.
        rentals: (reservas.data ?? []).flatMap<RentedWeek>((fila) => {
          const semana = indiceDe(fila)
          return semana === undefined ? [] : [{ week: semana, attributedFraction: null, income: null }]
        }),
      }
    },
    { watch: [calendarId, propertyId] },
  )

  const cargado = computed(() => consulta.data.value ?? null)

  const input = computed<PropertyProjectionInput | null>(() => {
    const datos = cargado.value
    if (!datos) {
      return null
    }
    return {
      today: today.value,
      rejilla: rejilla.value,
      classification: clasificacion.value,
      allocations: datos.allocations,
      blocks: datos.blocks,
      selectionComplete: datos.selectionComplete,
      coOwners: datos.coOwners,
      rentals: datos.rentals,
    }
  })

  const proyeccion = computed(() => input.value ? projectPropertyWeeks(input.value) : null)

  /**
   * Lo que el motor puro necesita para explicar cada acción antes de enviarla. La
   * activación de cada fracción ya la aplicó la proyección al marcar qué es
   * accionable; la base la vuelve a comprobar.
   */
  const context = computed<UsageContext | null>(() => cargado.value
    ? { calendarActive: true, today: today.value, activatedOn: null, blockedWeeks: new Set(cargado.value.blocks.map(b => b.week)) }
    : null)

  async function ejecutar(nombre: 'confirm_week' | 'cancel_week' | 'release_week', week: number, fallo: string): Promise<ResultadoDeEscritura> {
    const calendario = calendarId.value
    const datos = cargado.value
    const numero = datos?.allocations.find(a => a.week === week)?.fraction
    const fraccion = datos?.fracciones.find(f => f.number === numero)
    if (!calendario || !fraccion) {
      return { ok: false, clave: fallo }
    }
    const { error } = await client.rpc(nombre, { calendar: calendario, fraction: fraccion.id, week_index: week })
    if (error) {
      return { ok: false, clave: weekErrorKey(error.message) ?? fallo }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    cells: computed(() => proyeccion.value?.cells ?? []),
    cupoPorFraccion: computed(() => proyeccion.value?.quotaByFraction ?? new Map()),
    fracciones: computed(() => (cargado.value?.fracciones ?? []).map(f => ({
      number: f.number,
      ownerName: cargado.value?.coOwners.find(c => c.fraction === f.number)?.name ?? null,
      calendarActive: f.calendarActive,
    }))),
    context,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    confirm: (week: number) => ejecutar('confirm_week', week, 'calendar.weeks.errors.confirm_failed'),
    cancel: (week: number) => ejecutar('cancel_week', week, 'calendar.weeks.errors.cancel_failed'),
    release: (week: number) => ejecutar('release_week', week, 'calendar.weeks.errors.release_failed'),
  }
}
