import type { LineaDelPropietario } from '#shared/finance/estado-de-cuenta'
import type { Reparto } from '#shared/finance/cuotas'
import type { ClaseDeMovimiento } from '#shared/finance/maestra'
import type { CopAmount } from '#shared/money/importe'
import type { Database } from '#shared/types/database.types'

/**
 * HU-19 · RF-19.1, RF-19.4 · HU-18 · RF-18.2 — las cuotas del Propietario con su
 * movimiento, de todas sus fracciones.
 *
 * Orquesta, no calcula: la RLS de `movement_shares` entrega solo las cuotas de
 * fracciones propias (RF-19.4), y aquí se leen tal como la base las dejó, con el
 * movimiento, su categoría y, si vino de una renta, la semana de origen. Agrupar,
 * sumar por mes y explicar cada línea es cosa de `shared/finance/estado-de-cuenta`.
 */

interface MovimientoEmbebido {
  kind: ClaseDeMovimiento
  allocation: Reparto
  amount: number
  incurred_on: string
  description: string
  commission_basis_points: number | null
  commission_amount: number | null
  expense_categories: { name: string } | null
  third_party_bookings: { calendar_weeks: { index: number, starts_on: string } | null } | null
  properties: { name: string } | null
}

export function useEstadoDeCuenta() {
  const client = useSupabaseClient<Database>()
  const { fracciones } = useFraccionesPropias()

  const ids = computed(() => fracciones.value.map(fraccion => fraccion.id))

  const consulta = useAsyncData<LineaDelPropietario[]>(
    'estado-de-cuenta',
    async () => {
      if (ids.value.length === 0) {
        return []
      }
      const { data } = await client
        .from('movement_shares')
        .select('id, movement_id, property_id, fraction_number, amount, has_remainder, reversed_at, movements!inner(kind, allocation, amount, incurred_on, description, commission_basis_points, commission_amount, expense_categories(name), third_party_bookings(calendar_weeks(index, starts_on)), properties(name))')
        .in('fraction_id', ids.value)
        .order('created_at', { ascending: false })

      return (data ?? []).flatMap<LineaDelPropietario>((fila) => {
        const movimiento = fila.movements as unknown as MovimientoEmbebido | null
        if (!movimiento) {
          return []
        }
        return [{
          shareId: fila.id,
          movementId: fila.movement_id,
          propertyId: fila.property_id,
          propertyName: movimiento.properties?.name ?? '',
          fraction: fila.fraction_number,
          kind: movimiento.kind,
          allocation: movimiento.allocation,
          amount: fila.amount as CopAmount,
          movementAmount: movimiento.amount as CopAmount,
          categoryName: movimiento.expense_categories?.name ?? '',
          incurredOn: movimiento.incurred_on,
          description: movimiento.description,
          hasRemainder: fila.has_remainder,
          commissionBasisPoints: movimiento.commission_basis_points,
          commissionAmount: movimiento.commission_amount as CopAmount | null,
          weekIndex: movimiento.third_party_bookings?.calendar_weeks?.index ?? null,
          weekStartsOn: movimiento.third_party_bookings?.calendar_weeks?.starts_on ?? null,
          reversedAt: fila.reversed_at,
        }]
      })
    },
    { watch: [ids] },
  )

  return {
    lineas: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
