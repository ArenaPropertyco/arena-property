import type { CopAmount } from '#shared/money/importe'
import { pesos } from '#shared/money/importe'
import type { EstadoDePlan } from '#shared/payments/plan'
import type { PlanDePagosListado } from '#shared/payments/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-58 · RF-58.9 — los planes de pago de las fracciones de quien mira.
 *
 * La RLS de `payment_plans` deja al titular leer los suyos; la vista ya trae el
 * estado, el saldo y el interruptor derivados (DT-04). Aquí no se suma nada.
 */
export function usePlanesPropios() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()

  const consulta = useAsyncData<PlanDePagosListado[]>('planes-propios', async () => {
    const cuenta = user.value?.id
    if (!cuenta) {
      return []
    }

    const vista = await client
      .from('payment_plan_overview')
      .select('*')
      .eq('owner_id', cuenta)
      .is('voided_at', null)
      .order('closed_at', { ascending: false })

    const etiqueta = user.value?.email ?? cuenta

    return (vista.data ?? [])
      .filter(fila => fila.id)
      .map<PlanDePagosListado>(fila => ({
        id: fila.id!,
        fractionId: fila.fraction_id ?? '',
        fractionNumber: fila.fraction_number ?? 0,
        propertyId: fila.property_id ?? '',
        propertyName: fila.property_name ?? '',
        ownerId: cuenta,
        ownerLabel: etiqueta,
        agreedPrice: pesos(Number(fila.agreed_price ?? 0)),
        paidTotal: pesos(Number(fila.paid_total ?? 0)),
        balance: pesos(Number(fila.balance ?? 0)) as CopAmount,
        status: (fila.status ?? 'reserved') as EstadoDePlan,
        calendarActive: fila.calendar_active ?? false,
        referralCode: fila.referral_code,
        closedAt: fila.closed_at ?? '',
        voidedAt: fila.voided_at,
        voidReason: fila.void_reason,
      }))
  }, { watch: [user] })

  return {
    planes: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
