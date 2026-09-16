import { hoy as hoyDe } from '#shared/dates/formato'
import {
  filtroDeHistorialVacio,
  historialDeSemanas,
  propiedadesDelHistorial,
  semanasPropias,
} from '#shared/scheduling/historial'
import type { FiltroDeHistorial, SemanaHistorica } from '#shared/scheduling/historial'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { ReleaseReason } from '#shared/scheduling/week-usage'
import type { Database } from '#shared/types/database.types'

/**
 * HU-20 · RF-20.1…RF-20.4 · D-42, D-43 — las semanas del Propietario, pasadas y
 * futuras, de todas sus fracciones y calendarios publicados.
 *
 * Orquesta: lee las asignaciones de las fracciones propias con su semana y su
 * calendario, marca las que ya tienen tercero y, para las liberadas y rentadas,
 * toma del estado de cuenta (HU-19) el ingreso atribuido a la fracción, que es la
 * única cifra que existe de verdad (RF-20.4). Filtrar y ordenar es de
 * `shared/scheduling/historial`.
 */

interface SemanaEmbebida {
  id: string
  index: number
  starts_on: string
  ends_on: string
  season: Temporada
}

export function useHistorialDeSemanas() {
  const client = useSupabaseClient<Database>()
  const { fracciones } = useFraccionesPropias()
  const { lineas } = useEstadoDeCuenta()

  const hoy = computed(() => hoyDe())
  const ids = computed(() => fracciones.value.map(fraccion => fraccion.id))

  const consulta = useAsyncData<SemanaHistorica[]>(
    'historial-semanas',
    async () => {
      if (ids.value.length === 0) {
        return []
      }
      const { data: asignaciones } = await client
        .from('allocations')
        .select('fraction_id, confirmed_at, released_at, release_reason, calendar_weeks!inner(id, index, starts_on, ends_on, season), season_calendars!inner(property_id, published_at)')
        .in('fraction_id', ids.value)
        .not('season_calendars.published_at', 'is', null)

      const semanasIds = (asignaciones ?? []).flatMap(fila => (fila.calendar_weeks as unknown as SemanaEmbebida | null)?.id ?? [])
      const reservas = semanasIds.length === 0
        ? { data: [] as { week_id: string }[] }
        : await client.from('third_party_bookings').select('week_id').in('week_id', semanasIds).eq('status', 'confirmed')
      const rentadas = new Set((reservas.data ?? []).map(fila => fila.week_id))

      return (asignaciones ?? []).flatMap<SemanaHistorica>((fila) => {
        const propia = fracciones.value.find(fraccion => fraccion.id === fila.fraction_id)
        const semana = fila.calendar_weeks as unknown as SemanaEmbebida | null
        const calendario = fila.season_calendars as unknown as { property_id: string } | null
        if (!propia || !semana || !calendario) {
          return []
        }
        return [{
          propertyId: calendario.property_id,
          propertyName: propia.propertyName,
          fraction: propia.number,
          week: semana.index,
          startsOn: semana.starts_on,
          endsOn: semana.ends_on,
          season: semana.season,
          confirmedAt: fila.confirmed_at,
          releasedAt: fila.released_at,
          releaseReason: fila.release_reason as ReleaseReason | null,
          rented: rentadas.has(semana.id),
          income: null,
        }]
      })
    },
    { watch: [ids] },
  )

  /** RF-20.4 · D-39 · el ingreso de una liberada y rentada es la línea atribuida de esa semana. */
  const semanas = computed<SemanaHistorica[]>(() => (consulta.data.value ?? []).map((semana) => {
    if (!semana.rented) {
      return semana
    }
    const ingreso = lineas.value.find(linea =>
      linea.kind === 'income' && linea.allocation === 'single_fraction' && linea.reversedAt === null
      && linea.propertyId === semana.propertyId && linea.fraction === semana.fraction && linea.weekStartsOn === semana.startsOn)
    return ingreso ? { ...semana, income: ingreso.amount } : semana
  }))

  const propias = computed(() => fracciones.value.map(fraccion => ({ propertyId: fraccion.propertyId, number: fraccion.number })))
  const filtro = ref<FiltroDeHistorial>(filtroDeHistorialVacio())
  const historial = computed(() => historialDeSemanas(semanas.value, propias.value, filtro.value, hoy.value))
  const propiedades = computed(() => propiedadesDelHistorial(semanasPropias(semanas.value, propias.value)))

  function limpiarFiltro() {
    filtro.value = filtroDeHistorialVacio()
  }

  return {
    /** Todas las semanas propias, sin filtrar: lo que el portafolio (HU-18) necesita. */
    semanas,
    historial,
    filtro,
    propiedades,
    hoy,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    limpiarFiltro,
  }
}
