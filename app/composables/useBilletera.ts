import { hoy } from '#shared/dates/formato'
import type { CopAmount } from '#shared/money/importe'
import { pesos } from '#shared/money/importe'
import type { AccountKind } from '#shared/referrals/signup'
import type { WithdrawalListed } from '#shared/referrals/views'
import { emptyWalletFilter, filterWalletEntries, sortWalletEntries, walletBalances } from '#shared/referrals/wallet'
import type { PendingCommission, WalletEntry, WalletEntryKind, WalletFilter } from '#shared/referrals/wallet'
import { BUCKET_DE_COMPROBANTES, withdrawalMinimum } from '#shared/referrals/withdrawals'
import type { WithdrawalStatus } from '#shared/referrals/withdrawals'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Segundos de vigencia de la URL firmada de un comprobante. */
const VIGENCIA_DE_FIRMA = 3600

/**
 * HU-55 · RF-55.1…RF-55.4 · HU-56 · RF-56.1 · D-20 — la billetera de quien mira.
 *
 * Orquesta, no calcula: trae el histórico de `wallet_listing` (que la RLS acota
 * a lo propio), las comisiones aún pendientes, las solicitudes de retiro y el
 * mínimo vigente, y se lo pasa a `shared/referrals/wallet`, que deriva los
 * cuatro saldos, ordena y filtra. Solicitar el retiro es una función de la
 * base, que vuelve a validar lo mismo que el formulario.
 */
export function useBilletera() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta, perfil } = useCuenta()

  const consulta = useAsyncData('billetera', async () => {
    if (!idDeCuenta.value) {
      return null
    }
    const { data: embajador } = await client
      .from('ambassadors')
      .select('id, status, bank, account_kind, account_number, holder')
      .eq('user_id', idDeCuenta.value)
      .maybeSingle()
    if (!embajador) {
      return { embajador: null, movimientos: [], pendientes: [], solicitudes: [], comprobantes: {}, minimo: withdrawalMinimum(null) }
    }

    const [listado, pendientes, solicitudes, minimo] = await Promise.all([
      client.from('wallet_listing').select('*').eq('ambassador_id', embajador.id),
      client.from('commissions').select('id, amount').eq('ambassador_id', embajador.id).eq('status', 'pending'),
      client.from('withdrawal_requests').select('*').eq('ambassador_id', embajador.id).order('created_at', { ascending: false }),
      client.rpc('withdrawal_minimum'),
    ])

    const movimientos = (listado.data ?? [])
      .filter(fila => fila.id && fila.kind && fila.occurred_on && fila.created_at)
      .map<WalletEntry>(fila => ({
        id: fila.id!,
        kind: fila.kind as WalletEntryKind,
        amount: pesos(fila.amount ?? 0),
        occurredOn: fila.occurred_on!,
        createdAt: fila.created_at!,
        commissionId: fila.commission_id,
        withdrawalId: fila.withdrawal_id,
        referralLabel: fila.referral_label,
        propertyName: fila.property_name,
        fractionNumber: fila.fraction_number,
        graceEndsOn: fila.grace_ends_on,
        note: fila.note,
      }))

    const listadas = (solicitudes.data ?? []).map<WithdrawalListed>(fila => ({
      id: fila.id,
      ambassadorId: fila.ambassador_id,
      amount: pesos(fila.amount),
      status: fila.status as WithdrawalStatus,
      requestedOn: fila.requested_on,
      resolvedOn: fila.approved_at ? hoy(new Date(fila.approved_at)) : fila.rejected_at ? hoy(new Date(fila.rejected_at)) : null,
      paidOn: fila.paid_at ? hoy(new Date(fila.paid_at)) : null,
      rejectionReason: fila.rejection_reason,
      receiptPath: fila.receipt_path,
      ambassadorEmail: perfil.value?.email ?? '',
      ambassadorName: perfil.value?.full_name ?? null,
      bank: embajador.bank,
      accountKind: embajador.account_kind as AccountKind,
      accountNumber: embajador.account_number,
      holder: embajador.holder,
      available: null,
    }))

    // RF-56.4 · el comprobante de cada retiro pagado, con URL firmada de corta vida.
    const rutas = listadas.map(solicitud => solicitud.receiptPath).filter((ruta): ruta is string => ruta !== null)
    const firmadas = rutas.length === 0
      ? { data: [] as { path: string | null, signedUrl: string }[] }
      : await client.storage.from(BUCKET_DE_COMPROBANTES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
    const urlDeRuta = new Map((firmadas.data ?? []).map(firma => [firma.path, firma.signedUrl]))
    const comprobantes = Object.fromEntries(listadas
      .filter(solicitud => solicitud.receiptPath && urlDeRuta.has(solicitud.receiptPath))
      .map(solicitud => [solicitud.id, urlDeRuta.get(solicitud.receiptPath!)!]))

    return {
      embajador: { id: embajador.id, status: embajador.status },
      movimientos,
      pendientes: (pendientes.data ?? []).map<PendingCommission>(fila => ({ id: fila.id, amount: pesos(fila.amount) })),
      solicitudes: listadas,
      comprobantes,
      minimo: withdrawalMinimum(minimo.data === null || minimo.data === undefined ? null : pesos(minimo.data)),
    }
  }, { watch: [idDeCuenta] })

  const filtro = ref<WalletFilter>(emptyWalletFilter())

  const embajador = computed(() => consulta.data.value?.embajador ?? null)
  const todos = computed(() => sortWalletEntries(consulta.data.value?.movimientos ?? []))
  const movimientos = computed(() => filterWalletEntries(todos.value, filtro.value))
  // CA-55.1 · los saldos salen del histórico completo, no del filtro.
  const saldos = computed(() => walletBalances(todos.value, consulta.data.value?.pendientes ?? []))
  const solicitudes = computed(() => consulta.data.value?.solicitudes ?? [])
  const comprobantes = computed(() => consulta.data.value?.comprobantes ?? {})
  const minimo = computed(() => consulta.data.value?.minimo ?? withdrawalMinimum(null))

  /** RF-56.1 · el mensaje de la base dice qué regla se incumplió; se traduce a su clave. */
  function claveDeError(mensaje: string): string {
    if (/CA-56\.5/.test(mensaje)) {
      return 'wallet.withdrawal.validation.open_request'
    }
    if (/mínimo/.test(mensaje)) {
      return 'wallet.withdrawal.validation.below_minimum'
    }
    if (/supera/.test(mensaje)) {
      return 'wallet.withdrawal.validation.above_available'
    }
    return 'wallet.withdrawal.errors.request_failed'
  }

  async function solicitar(amount: CopAmount): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('request_withdrawal', { amount })
    if (error) {
      return { ok: false, clave: claveDeError(error.message) }
    }
    await consulta.refresh()
    return { ok: true }
  }

  function limpiarFiltro() {
    filtro.value = emptyWalletFilter()
  }

  return {
    embajador,
    saldos,
    movimientos,
    todos,
    filtro,
    limpiarFiltro,
    solicitudes,
    comprobantes,
    minimo,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    solicitar,
  }
}
