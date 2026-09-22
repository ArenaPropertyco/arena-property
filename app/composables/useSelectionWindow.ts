import type { RelocationWindowConfig } from '#shared/scheduling/relocation'
import type { FractionWindowListed, RelocationTurnListed, SelectionWindowListed } from '#shared/scheduling/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-59 · RF-59.1, RF-59.2, RF-59.6 · D-36 — la ventana de reubicación de un
 * calendario vista por quien gestiona: apertura, duración, turnos con su franja y
 * el nombre de cada titular (D-16). Configurar, ajustar, reabrir y eliminar
 * (solo el Superadmin, D-47 y D-48) y cerrar son funciones de la base que repiten
 * las reglas; el orden
 * sugerido también sale de ella (RF-59.2). RF-59.9 · las ventanas individuales
 * abiertas del calendario, con abrir y cerrar, también del Superadmin.
 */
export function useSelectionWindow(calendarId: Ref<string | null>, propertyId: Ref<string | null>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<SelectionWindowListed | null>(
    () => `ventana-${calendarId.value}`,
    async () => {
      const calendario = calendarId.value
      const propiedad = propertyId.value
      if (!calendario || !propiedad) {
        return null
      }
      const ventana = await client
        .from('selection_windows')
        .select('id, opens_at, closes_at, duration_days, turn_hours, closed_at')
        .eq('calendar_id', calendario)
        .maybeSingle()
      if (!ventana.data) {
        return null
      }
      const [turnos, copropietarios] = await Promise.all([
        client.from('selection_window_turns').select('position, opens_at, closes_at, fractions(number)').eq('window_id', ventana.data.id).order('position'),
        client.rpc('copropietarios_de', { propiedad }),
      ])
      const nombreDe = new Map((copropietarios.data ?? []).map(fila => [fila.fraction_number, fila.owner_name]))
      const turns = (turnos.data ?? []).flatMap<RelocationTurnListed>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        return numero === undefined
          ? []
          : [{ fraction: numero, position: fila.position, opensAt: fila.opens_at, closesAt: fila.closes_at, ownerName: nombreDe.get(numero) ?? null }]
      })
      return {
        id: ventana.data.id,
        opensAt: ventana.data.opens_at,
        closesAt: ventana.data.closes_at,
        durationDays: ventana.data.duration_days,
        turnHours: ventana.data.turn_hours,
        closedAt: ventana.data.closed_at,
        order: turns.map(t => t.fraction),
        turns,
      }
    },
    { watch: [calendarId] },
  )

  /** RF-59.9 · las ventanas individuales sin cerrar del calendario; si vencieron, se muestran así. */
  const individuales = useAsyncData<FractionWindowListed[]>(
    () => `ventanas-individuales-${calendarId.value}`,
    async () => {
      const calendario = calendarId.value
      const propiedad = propertyId.value
      if (!calendario || !propiedad) {
        return []
      }
      const [ventanas, copropietarios] = await Promise.all([
        client.from('fraction_windows').select('id, opens_at, closes_at, fractions(number)').eq('calendar_id', calendario).is('closed_at', null).order('created_at'),
        client.rpc('copropietarios_de', { propiedad }),
      ])
      const nombreDe = new Map((copropietarios.data ?? []).map(fila => [fila.fraction_number, fila.owner_name]))
      return (ventanas.data ?? []).flatMap<FractionWindowListed>((fila) => {
        const numero = (fila.fractions as unknown as { number: number } | null)?.number
        return numero === undefined
          ? []
          : [{ id: fila.id, fraction: numero, ownerName: nombreDe.get(numero) ?? null, opensAt: fila.opens_at, closesAt: fila.closes_at, closedAt: null }]
      })
    },
    { watch: [calendarId] },
  )

  /** RF-59.2 · el orden que la base sugiere: el de la selección el primer año, el anterior rotado después. */
  async function ordenSugerido(): Promise<number[]> {
    if (!calendarId.value) {
      return []
    }
    const { data } = await client.rpc('suggested_relocation_order', { calendar: calendarId.value })
    return data ?? []
  }

  async function configurar(config: RelocationWindowConfig): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.configure_failed' }
    }
    const { error } = await client.rpc('configure_selection_window', {
      calendar: calendarId.value,
      opens_at: config.opensAt,
      duration_days: config.durationDays,
      turn_hours: config.turnHours,
      fraction_order: config.order,
    })
    if (error) {
      return { ok: false, clave: error.message.includes('terminaría en el pasado') ? 'calendar.relocation.errors.ends_in_past' : 'calendar.relocation.errors.configure_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-59.6 · D-47 · reabrir una ventana cerrada antes de tiempo; vencida, hay que guardarla con nuevas fechas. */
  async function reabrir(): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.reopen_failed' }
    }
    const { error } = await client.rpc('reopen_selection_window', { calendar: calendarId.value })
    if (error) {
      return { ok: false, clave: error.message.includes('ya venció') ? 'calendar.relocation.errors.expired' : 'calendar.relocation.errors.reopen_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-59.9 · abrir a una fracción su ventana individual desde ahora y por las horas dadas. */
  async function abrirIndividual(fraction: number, hours: number): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.individual.errors.open_failed' }
    }
    const { error } = await client.rpc('open_fraction_window', { calendar: calendarId.value, fraction_number: fraction, hours })
    if (error) {
      return { ok: false, clave: error.message.includes('no tiene titular') ? 'calendar.relocation.individual.errors.no_owner' : 'calendar.relocation.individual.errors.open_failed' }
    }
    await individuales.refresh()
    return { ok: true }
  }

  async function cerrarIndividual(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('close_fraction_window', { window_id: id })
    if (error) {
      return { ok: false, clave: 'calendar.relocation.individual.errors.close_failed' }
    }
    await individuales.refresh()
    return { ok: true }
  }

  /** RF-59.10 · D-48 · eliminar la ventana en cualquier fase; lo ya reubicado no se deshace. */
  async function eliminar(): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.delete_failed' }
    }
    const { error } = await client.rpc('delete_selection_window', { calendar: calendarId.value })
    if (error) {
      return { ok: false, clave: 'calendar.relocation.errors.delete_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function cerrar(): Promise<ResultadoDeEscritura> {
    if (!calendarId.value) {
      return { ok: false, clave: 'calendar.relocation.errors.close_failed' }
    }
    const { error } = await client.rpc('close_selection_window', { calendar: calendarId.value })
    if (error) {
      return { ok: false, clave: 'calendar.relocation.errors.close_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    ventana: computed(() => consulta.data.value ?? null),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    individuales: computed(() => individuales.data.value ?? []),
    ordenSugerido,
    configurar,
    reabrir,
    eliminar,
    cerrar,
    abrirIndividual,
    cerrarIndividual,
  }
}
