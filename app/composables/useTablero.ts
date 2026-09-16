import { hoy as hoyDe } from '#shared/dates/formato'
import { resumenesDelTablero } from '#shared/properties/tablero'
import type { ReservaProxima, ResumenDePropiedad } from '#shared/properties/tablero'
import type { Database } from '#shared/types/database.types'

/**
 * HU-21 · RF-21.1, RF-21.2, RF-21.3 — el tablero del Administrador: un resumen por
 * propiedad administrada con su ocupación, sus próximas reservas y sus alertas.
 *
 * Orquesta, no calcula: junta lo que la base sabe de las propiedades gestionadas
 * —semanas confirmadas por venir, conflictos de bloqueo abiertos, solicitudes de
 * intercambio abiertas y semanas por colocar— y se lo pasa a
 * `shared/properties/tablero`, que arma los resúmenes. El alcance lo fija dos
 * veces la misma regla: la RLS solo entrega lo asignado, y `propiedadesGestionadas`
 * descarta lo que se lee por estar publicado pero no se gestiona (CA-21.3).
 */

interface OperacionCargada {
  reservas: ReservaProxima[]
  conflictos: { propertyId: string }[]
  solicitudes: { propertyId: string }[]
}

export function useTablero() {
  const client = useSupabaseClient<Database>()
  const { propiedades, pendiente: cargandoPropiedades } = usePropiedades()
  const { roles, idDeCuenta } = useCuenta()
  const { semanas: porColocar } = useSemanasPorColocar()

  const hoy = computed(() => hoyDe())
  const actor = computed(() => ({ id: idDeCuenta.value, esSuperadmin: roles.value.includes('superadmin') }))
  const ids = computed(() => propiedades.value.map(propiedad => propiedad.id))

  const operacion = useAsyncData<OperacionCargada>(
    'tablero-operacion',
    async () => {
      if (ids.value.length === 0) {
        return { reservas: [], conflictos: [], solicitudes: [] }
      }
      const [reservas, conflictos, solicitudes] = await Promise.all([
        client
          .from('allocations')
          .select('fractions!inner(number, property_id), calendar_weeks!inner(index, starts_on, ends_on)')
          .in('fractions.property_id', ids.value)
          .not('confirmed_at', 'is', null)
          .is('released_at', null)
          .gte('calendar_weeks.starts_on', hoy.value),
        client.from('calendar_conflicts').select('property_id').in('property_id', ids.value).eq('status', 'open'),
        client.from('week_swap_requests').select('property_id').in('property_id', ids.value).eq('status', 'open'),
      ])

      return {
        reservas: (reservas.data ?? []).flatMap<ReservaProxima>((fila) => {
          const fraccion = fila.fractions as unknown as { number: number, property_id: string } | null
          const semana = fila.calendar_weeks as unknown as { index: number, starts_on: string, ends_on: string } | null
          return fraccion && semana
            ? [{ propertyId: fraccion.property_id, fraction: fraccion.number, week: semana.index, startsOn: semana.starts_on, endsOn: semana.ends_on }]
            : []
        }),
        conflictos: (conflictos.data ?? []).map(fila => ({ propertyId: fila.property_id })),
        solicitudes: (solicitudes.data ?? []).map(fila => ({ propertyId: fila.property_id })),
      }
    },
    { watch: [ids] },
  )

  const resumenes = computed<ResumenDePropiedad[]>(() => resumenesDelTablero(propiedades.value, actor.value, {
    reservas: operacion.data.value?.reservas ?? [],
    conflictos: operacion.data.value?.conflictos ?? [],
    solicitudes: operacion.data.value?.solicitudes ?? [],
    porColocar: porColocar.value.map(semana => ({ propertyId: semana.propertyId })),
    hoy: hoy.value,
  }))

  return {
    resumenes,
    pendiente: computed(() => cargandoPropiedades.value || operacion.pending.value),
    recargar: operacion.refresh,
  }
}
