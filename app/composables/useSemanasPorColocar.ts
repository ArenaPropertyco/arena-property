import { hoy as hoyDe } from '#shared/dates/formato'
import { bolsaDeRenta, semanasPorColocar } from '#shared/scheduling/bolsa'
import type { SemanaCandidata, SemanaDeLaBolsa } from '#shared/scheduling/bolsa'
import type { Temporada } from '#shared/scheduling/temporadas'
import type { ReleaseReason } from '#shared/scheduling/week-usage'
import type { Database } from '#shared/types/database.types'

/**
 * HU-21 · RF-21.1b · D-43 — las semanas que siguen esperando tercero, en las
 * propiedades que quien mira administra.
 *
 * Es la alerta del día a día: una semana liberada no avisa dos veces, así que si
 * el aviso de TR-03 se pasó por alto, esto es lo que queda para recordarlo. La
 * lista la arma el dominio (`shared/scheduling/bolsa`); aquí solo se junta lo que
 * la base sabe de las propiedades administradas, en una sola tanda de consultas
 * para que el tablero no dependa de cuántas propiedades haya.
 *
 * Se miran el año en curso y el siguiente: lo anterior ya no se puede colocar y lo
 * posterior todavía no tiene calendario publicado.
 */
export interface SemanaPorColocar extends SemanaDeLaBolsa {
  propertyId: string
  propertyName: string
  year: number
}

export function useSemanasPorColocar() {
  const client = useSupabaseClient<Database>()
  const { roles } = useCuenta()

  const hoy = computed(() => hoyDe())

  const consulta = useAsyncData<SemanaPorColocar[]>(
    'semanas-por-colocar',
    async () => {
      const esSuperadmin = roles.value.includes('superadmin')

      // El Superadmin alcanza todas; el Administrador, solo las asignadas (HU-05).
      const propiedades = esSuperadmin
        ? (await client.from('properties').select('id, name').order('name')).data ?? []
        : ((await client.from('property_admins').select('properties(id, name)').is('revoked_at', null)).data ?? [])
            .flatMap(fila => (fila.properties as unknown as { id: string, name: string } | null) ?? [])

      const ids = propiedades.map(p => p.id)
      if (ids.length === 0) {
        return []
      }

      const anio = Number(hoy.value.slice(0, 4))
      const { data: calendarios } = await client
        .from('season_calendars')
        .select('id, property_id, year')
        .in('property_id', ids)
        .in('year', [anio, anio + 1])
        .not('published_at', 'is', null)

      const calendarIds = (calendarios ?? []).map(c => c.id)
      if (calendarIds.length === 0) {
        return []
      }

      const [semanas, asignaciones, bloqueos, turnos, reservas, fracciones] = await Promise.all([
        client.from('calendar_weeks').select('calendar_id, index, starts_on, ends_on, season').in('calendar_id', calendarIds),
        client.from('allocations').select('calendar_id, confirmed_at, released_at, release_reason, calendar_weeks(index), fractions(number)').in('calendar_id', calendarIds),
        client.from('week_blocks').select('calendar_id, calendar_weeks(index)').in('calendar_id', calendarIds).is('lifted_at', null),
        client.from('selection_turns').select('calendar_id, fractions(number)').in('calendar_id', calendarIds),
        client.from('third_party_bookings').select('calendar_id, calendar_weeks(index)').in('calendar_id', calendarIds).eq('status', 'confirmed'),
        client.from('fractions').select('property_id, number, calendar_active').in('property_id', ids),
      ])

      const indiceDe = (fila: { calendar_weeks: unknown }) =>
        (fila.calendar_weeks as unknown as { index: number } | null)?.index
      const numeroDe = (fila: { fractions: unknown }) =>
        (fila.fractions as unknown as { number: number } | null)?.number

      const porCalendario = <T extends { calendar_id: string }>(filas: T[] | null) => {
        const mapa = new Map<string, T[]>()
        for (const fila of filas ?? []) {
          mapa.set(fila.calendar_id, [...(mapa.get(fila.calendar_id) ?? []), fila])
        }
        return mapa
      }

      const semanasDe = porCalendario(semanas.data)
      const asignacionesDe = porCalendario(asignaciones.data)
      const bloqueosDe = porCalendario(bloqueos.data)
      const turnosDe = porCalendario(turnos.data)
      const reservasDe = porCalendario(reservas.data)

      const nombreDe = new Map(propiedades.map(p => [p.id, p.name]))
      const activasDe = new Map<string, Set<number>>()
      for (const fila of fracciones.data ?? []) {
        if (fila.calendar_active) {
          activasDe.set(fila.property_id, (activasDe.get(fila.property_id) ?? new Set()).add(fila.number))
        }
      }

      return (calendarios ?? []).flatMap<SemanaPorColocar>((calendario) => {
        const estados = new Map<number, { fraction: number | null, confirmedAt: string | null, releasedAt: string | null, releaseReason: ReleaseReason | null }>()
        for (const fila of asignacionesDe.get(calendario.id) ?? []) {
          const semana = indiceDe(fila)
          if (semana !== undefined) {
            estados.set(semana, {
              fraction: numeroDe(fila) ?? null,
              confirmedAt: fila.confirmed_at,
              releasedAt: fila.released_at,
              releaseReason: fila.release_reason as ReleaseReason | null,
            })
          }
        }

        const bloqueadas = new Set((bloqueosDe.get(calendario.id) ?? []).flatMap(fila => indiceDe(fila) ?? []))
        const rentadas = new Set((reservasDe.get(calendario.id) ?? []).flatMap(fila => indiceDe(fila) ?? []))

        // D-32 · con turnos sin elegir, las semanas libres todavía no son bolsa.
        const activas = activasDe.get(calendario.property_id) ?? new Set<number>()
        const elegidas = new Set([...estados.values()].flatMap(estado => estado.fraction ?? []))
        const selectionComplete = (turnosDe.get(calendario.id) ?? [])
          .flatMap(fila => numeroDe(fila) ?? [])
          .filter(numero => activas.has(numero))
          .every(numero => elegidas.has(numero))

        const candidatas = (semanasDe.get(calendario.id) ?? []).map<SemanaCandidata>((fila) => {
          const estado = estados.get(fila.index) ?? null
          return {
            week: fila.index,
            startsOn: fila.starts_on,
            endsOn: fila.ends_on,
            season: (fila.season ?? null) as Temporada | null,
            fraction: estado?.fraction ?? null,
            confirmedAt: estado?.confirmedAt ?? null,
            releasedAt: estado?.releasedAt ?? null,
            releaseReason: estado?.releaseReason ?? null,
            blocked: bloqueadas.has(fila.index),
            alreadyRented: rentadas.has(fila.index),
            selectionComplete,
          }
        })

        return semanasPorColocar(bolsaDeRenta(candidatas), hoy.value).map(semana => ({
          ...semana,
          propertyId: calendario.property_id,
          propertyName: nombreDe.get(calendario.property_id) ?? '',
          year: calendario.year,
        }))
      }).sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    },
    { watch: [roles] },
  )

  return {
    semanas: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
