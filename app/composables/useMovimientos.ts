import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { CuotaListada, FraccionImputableListada, MovimientoListado } from '#shared/finance/vistas'
import type { CopAmount } from '#shared/money/importe'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-23 · RF-23.2…RF-23.7 — los gastos comunes de una propiedad y sus cuotas.
 *
 * Orquesta, no decide: inserta el movimiento y la base genera las 8 cuotas en el
 * mismo instante (RF-23.3); anular pasa por `anular_movimiento`, que exige el
 * motivo y lo lleva a la auditoría en la misma transacción (RF-23.4, RF-A.5). Las
 * cuotas se leen tal como la base las dejó: aquí no se suma ni se reparte un peso.
 */
export function useMovimientos(propiedadId: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData(
    () => `movimientos-${propiedadId.value}`,
    async () => {
      if (!propiedadId.value) {
        return null
      }

      const [propiedad, fracciones, movimientos, cuotas] = await Promise.all([
        client.from('properties').select('id, name').eq('id', propiedadId.value).maybeSingle(),
        // RF-23.9 · a qué fracción se puede imputar un gasto: solo a una vendida.
        client.from('fractions').select('id, number, status, owner_id').eq('property_id', propiedadId.value).order('number'),
        client
          .from('movements')
          .select('*, expense_categories(name), payment_methods(name), ledger_accounts(name), fractions(number), third_party_bookings(calendar_weeks(index, starts_on))')
          .eq('property_id', propiedadId.value)
          .order('incurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
        client
          .from('movement_shares')
          .select('*')
          .eq('property_id', propiedadId.value)
          .order('fraction_number'),
      ])

      if (!propiedad.data) {
        return null
      }

      // Quién paga cada cuota y quién es titular de cada fracción, con nombre: solo
      // los Propietarios; el titular del inventario no es una cuenta.
      const pagadores = [...new Set([
        ...(cuotas.data ?? []).map(cuota => cuota.payer_id),
        ...(fracciones.data ?? []).map(fraccion => fraccion.owner_id),
      ].filter((valor): valor is string => valor !== null))]
      const perfiles = pagadores.length === 0
        ? { data: [] }
        : await client.from('profiles').select('id, email, full_name').in('id', pagadores)
      const etiquetaPorCuenta = new Map(
        (perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]),
      )

      return {
        propiedad: { id: propiedad.data.id, name: propiedad.data.name },
        fracciones: (fracciones.data ?? []).map<FraccionImputableListada>(fila => ({
          id: fila.id,
          number: fila.number,
          status: fila.status,
          ownerId: fila.owner_id,
          ownerLabel: fila.owner_id ? etiquetaPorCuenta.get(fila.owner_id) ?? fila.owner_id : null,
        })),
        movimientos: (movimientos.data ?? []).map<MovimientoListado>(fila => ({
          id: fila.id,
          propertyId: fila.property_id,
          kind: fila.kind,
          amount: fila.amount as CopAmount,
          categoryName: fila.expense_categories?.name ?? '',
          paymentMethodName: fila.payment_methods?.name ?? '',
          accountName: fila.ledger_accounts?.name ?? '',
          incurredOn: fila.incurred_on,
          description: fila.description,
          allocation: fila.allocation,
          fractionNumber: fila.fractions?.number ?? null,
          commissionBasisPoints: fila.commission_basis_points,
          commissionAmount: fila.commission_amount as CopAmount | null,
          weekIndex: fila.third_party_bookings?.calendar_weeks?.index ?? null,
          weekStartsOn: fila.third_party_bookings?.calendar_weeks?.starts_on ?? null,
          createdAt: fila.created_at,
          voidedAt: fila.voided_at,
          voidReason: fila.void_reason,
        })),
        cuotas: (cuotas.data ?? []).map<CuotaListada>(fila => ({
          id: fila.id,
          movementId: fila.movement_id,
          fraction: fila.fraction_number,
          amount: fila.amount as CopAmount,
          hasRemainder: fila.has_remainder,
          payer: fila.payer,
          payerLabel: fila.payer_id ? etiquetaPorCuenta.get(fila.payer_id) ?? fila.payer_id : null,
          reversedAt: fila.reversed_at,
        })),
      }
    },
    { watch: [propiedadId] },
  )

  const movimientos = computed(() => consulta.data.value?.movimientos ?? [])
  const cuotas = computed(() => consulta.data.value?.cuotas ?? [])

  /** Las 8 cuotas de un movimiento, tal como la base las generó. */
  function cuotasDe(movimiento: string): CuotaListada[] {
    return cuotas.value.filter(cuota => cuota.movementId === movimiento)
  }

  /** RF-23.2 · RF-23.3 · registra el gasto; la base genera las cuotas en la misma transacción. */
  async function registrar(nuevo: NuevoMovimiento): Promise<ResultadoDeEscritura & { id?: string }> {
    const { data, error } = await client
      .from('movements')
      .insert({
        property_id: nuevo.propertyId,
        kind: nuevo.kind,
        amount: nuevo.amount,
        category_id: nuevo.categoryId,
        payment_method_id: nuevo.paymentMethodId,
        account_id: nuevo.accountId,
        incurred_on: nuevo.incurredOn,
        description: nuevo.description,
        allocation: nuevo.allocation,
        fraction_id: nuevo.fractionId,
      })
      .select('id')
      .single()

    if (error || !data) {
      // CA-23.6 · la base rechaza la categoría aunque el formulario la dejara pasar.
      const mensaje = error?.message ?? ''
      return {
        ok: false,
        clave: /CA-23\.[36]/.test(mensaje)
          ? 'finance.errors.category_rejected'
          : /CA-23\.9/.test(mensaje) ? 'finance.validation.fraction_not_sold' : 'finance.errors.save_failed',
      }
    }

    await consulta.refresh()
    return { ok: true, id: data.id }
  }

  /** RF-23.4 · anulación con motivo; las cuotas se revierten y todo queda auditado en la base. */
  async function anular(movimiento: string, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('anular_movimiento', { movimiento, motivo })
    if (error) {
      return { ok: false, clave: 'finance.errors.void_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  return {
    propiedad: computed(() => consulta.data.value?.propiedad ?? null),
    fracciones: computed(() => consulta.data.value?.fracciones ?? []),
    movimientos,
    cuotasDe,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    registrar,
    anular,
  }
}
