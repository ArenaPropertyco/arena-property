import type { CopAmount } from '#shared/money/importe'
import type { ReferralStage } from '#shared/referrals/attribution'
import type { CommissionStatus } from '#shared/referrals/ledger'
import { emptyReferralFilter, filterReferrals, referralTotals, sortReferrals } from '#shared/referrals/listing'
import type { ReferralFilter, ReferralRow } from '#shared/referrals/listing'
import type { Database } from '#shared/types/database.types'

/**
 * HU-53 · RF-53.1…RF-53.5 · D-20 — los referidos de quien mira.
 *
 * La vista `referral_listing` corre con los permisos de quien consulta: al
 * Embajador le devuelve los suyos y al Superadmin todos (RF-53.5). Llega cada
 * referido con su etapa y, si compró, la comisión que HU-54 congeló sobre el
 * precio pactado. Filtrar, totalizar y ordenar son funciones puras de
 * `shared/referrals/listing`; aquí no se decide nada.
 */
export function useReferidos() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta } = useCuenta()

  const consulta = useAsyncData<ReferralRow[]>('referidos', async () => {
    if (!idDeCuenta.value) {
      return []
    }
    const { data } = await client
      .from('referral_listing')
      .select('*')
      .order('referred_on', { ascending: false })

    return (data ?? [])
      .filter(fila => fila.id && fila.referred_on)
      .map<ReferralRow>(fila => ({
        id: fila.id!,
        prospectName: fila.prospect_name,
        prospectEmail: fila.prospect_email ?? '',
        referredOn: fila.referred_on!,
        propertyName: fila.property_name,
        fractionNumber: fila.fraction_number,
        stage: (fila.stage ?? 'registered') as ReferralStage,
        commission: fila.commission_amount === null || fila.commission_status === null
          ? null
          : {
              amount: fila.commission_amount as CopAmount,
              status: fila.commission_status as CommissionStatus,
              graceEndsOn: fila.grace_ends_on,
            },
      }))
  }, { watch: [idDeCuenta] })

  const filtro = ref<ReferralFilter>(emptyReferralFilter())

  const todos = computed(() => sortReferrals(consulta.data.value ?? []))
  const referidos = computed(() => filterReferrals(todos.value, filtro.value))
  // CA-53.1 · los totales son los del listado completo, no los del filtro.
  const totales = computed(() => referralTotals(todos.value))

  function limpiarFiltro() {
    filtro.value = emptyReferralFilter()
  }

  return {
    referidos,
    todos,
    totales,
    filtro,
    limpiarFiltro,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
