import { ErrorDeClasificacionInvalida, ErrorDeRejillaImposible } from '#shared/scheduling/criterio'
import type { EstadiaExistente } from '#shared/scheduling/reconfiguracion'
import { conflictosDeReconfiguracion } from '#shared/scheduling/reconfiguracion'
import { fechasEspecialesDelAnio, rejillaDelAnio, sumarDias } from '#shared/scheduling/rejilla'
import { repartir } from '#shared/scheduling/reparto'
import type { Reparto } from '#shared/scheduling/reparto'
import { clasificacionSugerida, TEMPORADAS } from '#shared/scheduling/temporadas'
import type { BloquePico, SemanaClasificada, Temporada } from '#shared/scheduling/temporadas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-12 · RF-12.2…RF-12.9 — el calendario de una propiedad para un año.
 *
 * La rejilla y el reparto salen del motor puro de `shared/scheduling` (DT-07);
 * aquí se carga lo guardado, se mantiene la clasificación que edita el
 * Administrador y se llama a las funciones de la base que persisten y validan.
 */

interface CalendarioGuardado {
  id: string
  anioBase: number
  publicadoEl: string | null
  clasificacion: SemanaClasificada[]
  estadias: EstadiaExistente[]
}

export type ResultadoDePublicacion
  = { ok: true, conflictos: number }
    | { ok: false, clave: string, requiereConfirmacion?: boolean }

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

      const [semanas, estadias] = await Promise.all([
        client.from('calendar_weeks').select('index, season, peak_block').eq('calendar_id', calendario.data.id).order('index'),
        client.from('stays').select('id, nights, fractions(number)').eq('calendar_id', calendario.data.id).eq('status', 'confirmed'),
      ])

      return {
        id: calendario.data.id,
        anioBase: calendario.data.base_year,
        publicadoEl: calendario.data.published_at,
        clasificacion: (semanas.data ?? []).map(fila => ({
          indice: fila.index,
          temporada: fila.season as Temporada,
          bloquePico: (fila.peak_block ?? null) as BloquePico | null,
        })),
        estadias: (estadias.data ?? []).map(fila => ({
          id: fila.id,
          fraccion: (fila.fractions as unknown as { number: number } | null)?.number ?? 0,
          noches: nochesDeRango(fila.nights),
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

  const anioBase = computed(() => guardado.value?.anioBase ?? anio.value)

  /** RF-12.6 · el reparto se recalcula con cada cambio; el error se traduce aquí. */
  const previsualizacion = computed<{ reparto: Reparto | null, error: string | null }>(() => {
    try {
      return { reparto: repartir({ anio: anio.value, anioBase: anioBase.value, rejilla: rejilla.value, semanas: clasificacion.value }), error: null }
    }
    catch (error) {
      if (error instanceof ErrorDeRejillaImposible) {
        const primero = error.faltantes[0]!
        return { reparto: null, error: t('calendar.errors.impossible_grid', { season: t(`calendar.seasons.${primero.temporada}`), available: primero.disponibles, required: primero.necesarias }) }
      }
      if (error instanceof ErrorDeClasificacionInvalida) {
        return { reparto: null, error: t('calendar.errors.invalid_classification') }
      }
      throw error
    }
  })

  const conflictos = computed(() => previsualizacion.value.reparto && guardado.value
    ? conflictosDeReconfiguracion(previsualizacion.value.reparto, guardado.value.estadias)
    : [])

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
      anio_base: anioBase.value,
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

  /** RF-12.3 · RF-12.9 · guarda la clasificación vigente y publica el reparto del motor. */
  async function publicar(confirmar = false): Promise<ResultadoDePublicacion> {
    const reparto = previsualizacion.value.reparto
    if (!reparto) {
      return { ok: false, clave: 'calendar.errors.publish_failed' }
    }
    if (guardado.value && guardado.value.estadias.length > 0 && !confirmar) {
      return { ok: false, clave: 'calendar.errors.publish_failed', requiereConfirmacion: true }
    }

    const guardadoOk = await guardar()
    if (!guardadoOk.ok) {
      return guardadoOk
    }
    const calendario = consulta.data.value?.id
    if (!calendario) {
      return { ok: false, clave: 'calendar.errors.publish_failed' }
    }

    const { data, error } = await client.rpc('publicar_calendario', {
      calendario,
      reparto: reparto.asignaciones.map(a => ({ fraction_number: a.fraccion, weeks: a.semanas })) as never,
      confirmar,
    })
    if (error) {
      return { ok: false, clave: 'calendar.errors.publish_failed' }
    }
    await consulta.refresh()
    const listados = (data as { conflicts?: unknown[] } | null)?.conflicts ?? []
    return { ok: true, conflictos: listados.length }
  }

  return {
    rejilla,
    fechasEspeciales,
    clasificacion,
    anioBase,
    reparto: computed(() => previsualizacion.value.reparto),
    errorDeReparto: computed(() => previsualizacion.value.error),
    conflictos,
    estadias: computed(() => guardado.value?.estadias.length ?? 0),
    publicadoEl: computed(() => guardado.value?.publicadoEl ?? null),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    guardar,
    publicar,
    temporadas: TEMPORADAS,
  }
}

/** `[2027-01-02,2027-01-04)` → las noches del rango, sin la de salida. */
function nochesDeRango(rango: unknown): string[] {
  const texto = String(rango ?? '')
  const partes = texto.match(/^[[(]([\d-]+),([\d-]+)[)\]]$/)
  if (!partes) {
    return []
  }
  const noches: string[] = []
  let dia = partes[1]!
  const fin = texto.endsWith(']') ? sumarDias(partes[2]!, 1) : partes[2]!
  while (dia < fin) {
    noches.push(dia)
    dia = sumarDias(dia, 1)
  }
  return noches
}
