import type { CopAmount } from '#shared/money/importe'
import { origenDeSemanaRentada, puedeRentarseAUnTercero } from '#shared/scheduling/terceros'
import type { EstadoDeSemanaParaRenta, NuevoTercero } from '#shared/scheduling/terceros'
import type { OrigenDeSemana } from '#shared/finance/ingresos'
import type { ReleaseReason } from '#shared/scheduling/week-usage'
import type { HuespedRegistrado, ReservaListada, SemanaDeBolsa } from '#shared/scheduling/vistas-renta'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-39 · RF-39.1…RF-39.5 · HU-40 · RF-40.1, RF-40.4 · D-39 — la renta a terceros
 * de una propiedad en un año.
 *
 * Orquesta, no decide. Qué semana está en la bolsa y con qué origen lo resuelve
 * `shared/scheduling/terceros` sobre lo que la base devuelve, y la base lo vuelve a
 * comprobar al escribir (CA-39.1, CA-39.5). El reparto del ingreso no se toca
 * desde aquí: se manda el bruto y el disparador decide (RF-40.2).
 */
export interface SolicitudDeReserva {
  week: number
  guestId: string | null
  guest: NuevoTercero | null
}

export function useRentas(propiedadId: Ref<string>, anio: Ref<number>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData(
    () => `rentas-${propiedadId.value}-${anio.value}`,
    async () => {
      if (!propiedadId.value) {
        return null
      }

      const [propiedad, calendario] = await Promise.all([
        client.from('properties').select('id, name, rental_commission_basis_points').eq('id', propiedadId.value).maybeSingle(),
        client.from('season_calendars').select('id, published_at').eq('property_id', propiedadId.value).eq('year', anio.value).maybeSingle(),
      ])

      if (!propiedad.data) {
        return null
      }

      const calendarId = calendario.data?.id ?? ''
      if (calendarId === '' || !calendario.data?.published_at) {
        return {
          propiedad: {
            id: propiedad.data.id,
            name: propiedad.data.name,
            comisionPuntosBasicos: propiedad.data.rental_commission_basis_points,
          },
          semanas: [] as SemanaDeBolsa[],
          reservas: [] as ReservaListada[],
          huespedes: [] as HuespedRegistrado[],
        }
      }

      const [semanas, asignaciones, bloqueos, turnos, copropietarios, reservas, huespedes] = await Promise.all([
        client.from('calendar_weeks').select('id, index, starts_on, ends_on').eq('calendar_id', calendarId).order('index'),
        client.from('allocations').select('confirmed_at, released_at, release_reason, calendar_weeks(index), fractions(number)').eq('calendar_id', calendarId),
        client.from('week_blocks').select('calendar_weeks(index)').eq('calendar_id', calendarId).is('lifted_at', null),
        client.from('selection_turns').select('fractions(number)').eq('calendar_id', calendarId),
        client.rpc('copropietarios_de', { propiedad: propiedadId.value }),
        client
          .from('third_party_bookings')
          .select('id, status, cancel_reason, origin_reason, calendar_weeks(index, starts_on), fractions(number), third_parties(full_name)')
          .eq('calendar_id', calendarId)
          .order('created_at', { ascending: false }),
        client.from('third_parties').select('id, full_name, document_kind, document_number').eq('property_id', propiedadId.value).is('anonymized_at', null).order('full_name'),
      ])

      const estados = new Map<number, { fraction: number | null, confirmedAt: string | null, releasedAt: string | null, releaseReason: ReleaseReason | null }>()
      for (const fila of asignaciones.data ?? []) {
        const semana = (fila.calendar_weeks as unknown as { index: number } | null)?.index
        const numero = (fila.fractions as unknown as { number: number } | null)?.number ?? null
        if (semana !== undefined) {
          estados.set(semana, {
            fraction: numero,
            confirmedAt: fila.confirmed_at,
            releasedAt: fila.released_at,
            releaseReason: fila.release_reason as ReleaseReason | null,
          })
        }
      }

      const bloqueadas = new Set((bloqueos.data ?? [])
        .map(fila => (fila.calendar_weeks as unknown as { index: number } | null)?.index)
        .filter((indice): indice is number => indice !== undefined))

      // D-32 · mientras haya turnos sin elegir, las semanas libres no son bolsa.
      const activas = new Set((copropietarios.data ?? []).filter(f => f.calendar_active).map(f => f.fraction_number))
      const elegidas = new Map<number, number>()
      for (const estado of estados.values()) {
        if (estado.fraction !== null) {
          elegidas.set(estado.fraction, (elegidas.get(estado.fraction) ?? 0) + 1)
        }
      }
      const selectionComplete = (turnos.data ?? [])
        .map(fila => (fila.fractions as unknown as { number: number } | null)?.number)
        .filter((numero): numero is number => numero !== undefined && activas.has(numero))
        .every(numero => (elegidas.get(numero) ?? 0) > 0)

      const rentadas = new Set((reservas.data ?? [])
        .filter(fila => fila.status === 'confirmed')
        .map(fila => (fila.calendar_weeks as unknown as { index: number } | null)?.index)
        .filter((indice): indice is number => indice !== undefined))

      // RF-39.2 · CA-39.1 · la bolsa, decidida por el dominio y no por la vista.
      const disponibles = (semanas.data ?? []).flatMap<SemanaDeBolsa>((fila) => {
        const estado = estados.get(fila.index) ?? null
        const contexto: EstadoDeSemanaParaRenta = {
          week: fila.index,
          startsOn: fila.starts_on,
          fraction: estado?.fraction ?? null,
          confirmedAt: estado?.confirmedAt ?? null,
          releasedAt: estado?.releasedAt ?? null,
          releaseReason: estado?.releaseReason ?? null,
          blocked: bloqueadas.has(fila.index),
          alreadyRented: rentadas.has(fila.index),
          selectionComplete,
        }

        if (!puedeRentarseAUnTercero(contexto).ok) {
          return []
        }

        const origen = origenDeSemanaRentada(contexto)
        return [{
          week: fila.index,
          startsOn: fila.starts_on,
          endsOn: fila.ends_on,
          originReason: origen.reason,
          originFraction: origen.fraction,
        }]
      })

      // HU-40 · el ingreso vigente de cada reserva, tal como la base lo repartió.
      const ids = (reservas.data ?? []).map(fila => fila.id)
      const ingresos = ids.length === 0
        ? { data: [] }
        : await client.from('movements').select('id, booking_id, amount, commission_amount, commission_basis_points').in('booking_id', ids).is('voided_at', null)
      const ingresoPorReserva = new Map((ingresos.data ?? []).map(fila => [fila.booking_id ?? '', fila]))

      return {
        propiedad: {
          id: propiedad.data.id,
          name: propiedad.data.name,
          comisionPuntosBasicos: propiedad.data.rental_commission_basis_points,
        },
        semanas: disponibles,
        reservas: (reservas.data ?? []).flatMap<ReservaListada>((fila) => {
          const semana = fila.calendar_weeks as unknown as { index: number, starts_on: string } | null
          if (!semana) {
            return []
          }
          const ingreso = ingresoPorReserva.get(fila.id) ?? null

          return [{
            id: fila.id,
            week: semana.index,
            startsOn: semana.starts_on,
            guestName: (fila.third_parties as unknown as { full_name: string } | null)?.full_name ?? '',
            originReason: fila.origin_reason as OrigenDeSemana,
            originFraction: (fila.fractions as unknown as { number: number } | null)?.number ?? null,
            status: fila.status as ReservaListada['status'],
            cancelReason: fila.cancel_reason,
            incomeId: ingreso?.id ?? null,
            incomeAmount: (ingreso?.amount ?? null) as CopAmount | null,
            commissionAmount: (ingreso?.commission_amount ?? null) as CopAmount | null,
            commissionBasisPoints: ingreso?.commission_basis_points ?? null,
          }]
        }),
        huespedes: (huespedes.data ?? []).map<HuespedRegistrado>(fila => ({
          id: fila.id,
          fullName: fila.full_name,
          documentKind: fila.document_kind,
          documentNumber: fila.document_number,
        })),
      }
    },
    { watch: [propiedadId, anio] },
  )

  const calendarioDelAnio = async () => {
    const { data } = await client.from('season_calendars').select('id').eq('property_id', propiedadId.value).eq('year', anio.value).maybeSingle()
    return data?.id ?? ''
  }

  /** RF-39.1 · RF-39.2 · registra al huésped si hace falta y renta la semana. */
  async function rentar(solicitud: SolicitudDeReserva): Promise<ResultadoDeEscritura> {
    const calendario = await calendarioDelAnio()
    if (calendario === '') {
      return { ok: false, clave: 'rentals.errors.save_failed' }
    }

    let tercero = solicitud.guestId
    if (!tercero && solicitud.guest) {
      const { data, error } = await client.rpc('registrar_tercero', {
        propiedad: propiedadId.value,
        nombre: solicitud.guest.fullName,
        tipo_documento: solicitud.guest.documentKind,
        documento: solicitud.guest.documentNumber,
        correo: solicitud.guest.email ?? undefined,
        telefono: solicitud.guest.phone ?? undefined,
        consentimiento: solicitud.guest.consentAccepted,
      })
      if (error || !data) {
        return { ok: false, clave: 'rentals.errors.guest_failed' }
      }
      tercero = (data as unknown as { id: string }[])[0]?.id ?? (data as unknown as { id: string }).id
    }

    if (!tercero) {
      return { ok: false, clave: 'rentals.errors.guest_failed' }
    }

    const { error } = await client.rpc('rentar_semana', {
      calendario,
      indice_de_semana: solicitud.week,
      tercero,
    })

    if (error) {
      return { ok: false, clave: 'rentals.errors.save_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-39.4 · CA-39.4 · cancelación con motivo; la semana vuelve a la bolsa. */
  async function cancelar(reserva: string, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('cancelar_reserva_a_tercero', { reserva, motivo })
    if (error) {
      return { ok: false, clave: 'rentals.errors.cancel_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /**
   * RF-40.1 · RF-40.2 · registra el ingreso. El reparto y la comisión los deriva la
   * base del origen de la semana: aquí solo viaja el bruto.
   */
  async function registrarIngreso(reserva: string, bruto: CopAmount): Promise<ResultadoDeEscritura> {
    const [categoria, medio, cuenta] = await Promise.all([
      client.from('expense_categories').select('id').eq('kind', 'income').eq('scope', 'property').eq('active', true).order('name').limit(1).maybeSingle(),
      client.from('payment_methods').select('id').eq('active', true).order('name').limit(1).maybeSingle(),
      client.from('ledger_accounts').select('id').eq('active', true).order('name').limit(1).maybeSingle(),
    ])

    if (!categoria.data || !medio.data || !cuenta.data) {
      return { ok: false, clave: 'rentals.errors.income_failed' }
    }

    const { error } = await client.rpc('registrar_ingreso_de_renta', {
      reserva,
      monto: bruto,
      categoria: categoria.data.id,
      medio: medio.data.id,
      cuenta: cuenta.data.id,
    })

    if (error) {
      // CA-40.5 · la base rechaza el ingreso atribuido sin comisión configurada.
      return { ok: false, clave: /CA-40\.5/.test(error.message) ? 'rentals.income.missingCommission' : 'rentals.errors.income_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-40.4 · el Superadmin fija la comisión de gestión de la propiedad. */
  async function fijarComision(puntos: number): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('fijar_comision_de_renta', {
      propiedad: propiedadId.value,
      puntos_basicos: puntos,
    })

    if (error) {
      return { ok: false, clave: 'rentals.errors.commission_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  return {
    propiedad: computed(() => consulta.data.value?.propiedad ?? null),
    semanas: computed(() => consulta.data.value?.semanas ?? []),
    reservas: computed(() => consulta.data.value?.reservas ?? []),
    huespedes: computed(() => consulta.data.value?.huespedes ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    rentar,
    cancelar,
    registrarIngreso,
    fijarComision,
  }
}
