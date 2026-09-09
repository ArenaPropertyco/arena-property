import type { Temporada } from '#shared/scheduling/temporadas'
import type { WeekBlockListed } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-15 · RF-15.1…RF-15.5 · D-33 — los bloqueos por semanas de un calendario y
 * los conflictos abiertos que dejaron sobre semanas confirmadas (RF-15.4). Crear y
 * levantar son funciones de la base: comprueban la asignación (CA-15.4), exigen
 * motivo (CA-15.1) y lo llevan a la auditoría (RF-15.5).
 */

export type ResultadoDeBloqueo
  = { ok: true, conflictos: number }
    | { ok: false, clave: string }

export function useWeekBlocks(calendarId: Ref<string | null>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<WeekBlockListed[]>(
    () => `bloqueos-${calendarId.value}`,
    async () => {
      const calendario = calendarId.value
      if (!calendario) {
        return []
      }
      const [bloques, conflictos] = await Promise.all([
        client.from('week_blocks').select('id, reason, created_at, lifted_at, calendar_weeks(index, starts_on, ends_on, season)').eq('calendar_id', calendario).order('created_at', { ascending: false }),
        client.from('calendar_conflicts').select('block_id, fractions(number), calendar_weeks(index)').eq('status', 'open'),
      ])

      const porBloqueo = new Map<string, { fraction: number, week: number }[]>()
      for (const fila of conflictos.data ?? []) {
        if (!fila.block_id) continue
        const fraction = (fila.fractions as unknown as { number: number } | null)?.number
        const week = (fila.calendar_weeks as unknown as { index: number } | null)?.index
        if (fraction === undefined || week === undefined) continue
        porBloqueo.set(fila.block_id, [...(porBloqueo.get(fila.block_id) ?? []), { fraction, week }])
      }

      return (bloques.data ?? []).flatMap<WeekBlockListed>((fila) => {
        const semana = fila.calendar_weeks as unknown as { index: number, starts_on: string, ends_on: string, season: Temporada } | null
        if (!semana) return []
        return [{
          id: fila.id,
          week: semana.index,
          startsOn: semana.starts_on,
          endsOn: semana.ends_on,
          season: semana.season,
          reason: fila.reason,
          createdAt: fila.created_at,
          liftedAt: fila.lifted_at,
          conflicts: porBloqueo.get(fila.id) ?? [],
        }]
      })
    },
    { watch: [calendarId] },
  )

  async function crear(weeks: number[], reason: string): Promise<ResultadoDeBloqueo> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.blocks.errors.create_failed' }
    }
    const { data, error } = await client.rpc('block_weeks', { calendar: calendarId.value, week_indexes: weeks, reason })
    if (error) {
      return { ok: false, clave: 'calendar.blocks.errors.create_failed' }
    }
    await consulta.refresh()
    const conflictos = (data as { conflicts?: unknown[] } | null)?.conflicts ?? []
    return { ok: true, conflictos: conflictos.length }
  }

  async function levantar(id: string, reason: string): Promise<ResultadoDeBloqueo> {
    const { error } = await client.rpc('lift_week_block', { block: id, reason })
    if (error) {
      return { ok: false, clave: 'calendar.blocks.errors.lift_failed' }
    }
    await consulta.refresh()
    return { ok: true, conflictos: 0 }
  }

  return {
    bloqueos: computed(() => consulta.data.value ?? []),
    blockedWeeks: computed(() => (consulta.data.value ?? []).filter(b => b.liftedAt === null).map(b => b.week)),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    crear,
    levantar,
  }
}
