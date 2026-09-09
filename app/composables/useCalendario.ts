import { validarRejillaParaCriterio, CRITERIO_POR_DEFECTO } from '#shared/scheduling/criterio'
import { fechasEspecialesDelAnio, rejillaDelAnio } from '#shared/scheduling/rejilla'
import { clasificacionSugerida, TEMPORADAS } from '#shared/scheduling/temporadas'
import type { BloquePico, SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-12 · RF-12.2, RF-12.7 — la rejilla clasificada de una propiedad para un año.
 *
 * La rejilla sale del motor puro de `shared/scheduling` (DT-07); aquí se carga lo
 * guardado, se mantiene la clasificación que edita el Administrador y se llama a
 * la función de la base que la persiste. Abrir la selección, los turnos y los
 * intercambios viven en `useSelectionOrder` (D-32).
 */

interface CalendarioGuardado {
  id: string
  anioBase: number
  publicadoEl: string | null
  clasificacion: SemanaClasificada[]
}

export function useCalendario(propertyId: Ref<string | null>, anio: Ref<number>) {
  const client = useSupabaseClient<Database>()
  const { t } = useI18n()

  const rejilla = computed(() => rejillaDelAnio(anio.value))
  const fechasEspeciales = computed(() => fechasEspecialesDelAnio(anio.value))

  const consulta = useAsyncData<CalendarioGuardado | null>(
    () => `calendario-${propertyId.value}-${anio.value}`,
    async () => {
      if (!propertyId.value) {
        return null
      }
      const calendario = await client
        .from('season_calendars')
        .select('id, base_year, published_at')
        .eq('property_id', propertyId.value)
        .eq('year', anio.value)
        .maybeSingle()
      if (!calendario.data) {
        return null
      }

      const semanas = await client.from('calendar_weeks').select('index, season, peak_block').eq('calendar_id', calendario.data.id).order('index')

      return {
        id: calendario.data.id,
        anioBase: calendario.data.base_year,
        publicadoEl: calendario.data.published_at,
        clasificacion: (semanas.data ?? []).map(fila => ({
          indice: fila.index,
          temporada: fila.season as Temporada,
          bloquePico: (fila.peak_block ?? null) as BloquePico | null,
        })),
      }
    },
    { watch: [propertyId, anio] },
  )

  const guardado = computed(() => consulta.data.value ?? null)

  /** La clasificación que se edita: la guardada, o una sugerida si no hay calendario. */
  const clasificacion = ref<SemanaClasificada[]>([])
  watch([guardado, rejilla], () => {
    clasificacion.value = guardado.value?.clasificacion.length
      ? guardado.value.clasificacion
      : clasificacionSugerida(anio.value, rejilla.value)
  }, { immediate: true })

  /** RF-12.7 · lo que a la rejilla le falta para que las 8 fracciones puedan elegir. */
  const errorDeRejilla = computed(() => {
    const faltantes = validarRejillaParaCriterio(clasificacion.value, CRITERIO_POR_DEFECTO)
    const primero = faltantes[0]
    return primero
      ? t('calendar.errors.impossible_grid', { season: t(`calendar.seasons.${primero.temporada}`), available: primero.disponibles, required: primero.necesarias })
      : null
  })

  async function guardar(): Promise<ResultadoDeEscritura> {
    if (!propertyId.value) {
      return { ok: false, clave: 'calendar.errors.save_failed' }
    }
    const semanas = rejilla.value.map((semana) => {
      const clasificada = clasificacion.value.find(s => s.indice === semana.indice)
      return {
        index: semana.indice,
        starts_on: semana.inicio,
        ends_on: semana.fin,
        season: clasificada?.temporada ?? 'baja',
        peak_block: clasificada?.bloquePico ?? null,
      }
    })
    const { error } = await client.rpc('guardar_calendario', {
      propiedad: propertyId.value,
      anio: anio.value,
      anio_base: guardado.value?.anioBase ?? anio.value,
      // `null` deja el criterio por defecto de la base (P-04); el tipo generado no admite `undefined`.
      criterio: null,
      semanas: semanas as never,
    })
    if (error) {
      return { ok: false, clave: 'calendar.errors.save_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    id: computed(() => guardado.value?.id ?? null),
    rejilla,
    fechasEspeciales,
    clasificacion,
    errorDeRejilla,
    publicadoEl: computed(() => guardado.value?.publicadoEl ?? null),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    guardar,
    temporadas: TEMPORADAS,
  }
}
