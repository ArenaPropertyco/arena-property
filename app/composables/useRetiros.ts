import { hoy } from '#shared/dates/formato'
import type { CopAmount } from '#shared/money/importe'
import { pesos } from '#shared/money/importe'
import type { AccountKind } from '#shared/referrals/signup'
import type { WithdrawalListed } from '#shared/referrals/views'
import { BUCKET_DE_COMPROBANTES, rutaDeComprobante, withdrawalMinimum } from '#shared/referrals/withdrawals'
import type { WithdrawalStatus } from '#shared/referrals/withdrawals'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Segundos de vigencia de la URL firmada de un comprobante. */
const VIGENCIA_DE_FIRMA = 3600

interface PerfilEmbebido {
  email: string | null
  full_name: string | null
}

interface EmbajadorEmbebido {
  id: string
  user_id: string
  bank: string
  account_kind: string
  account_number: string
  holder: string
  profiles: PerfilEmbebido | null
}

/**
 * HU-56 · RF-56.2…RF-56.4 · HU-55 · RF-55.4 · D-06 · D-20 — la bandeja de retiros
 * del Superadmin.
 *
 * Trae cada solicitud con quién la pide y sus datos bancarios (HU-49), el
 * disponible de cada Embajador desde `wallet_balances` (D-20) y el mínimo
 * vigente. Aprobar, rechazar y pagar son funciones de la base que repiten la
 * máquina de estados; el comprobante sube a Storage antes de registrar el pago
 * y se retira si el pago no entra.
 */
export function useRetiros() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData('retiros', async () => {
    const [solicitudes, saldos, minimo] = await Promise.all([
      client
        .from('withdrawal_requests')
        .select('*, ambassadors!inner(id, user_id, bank, account_kind, account_number, holder, profiles:user_id(email, full_name))')
        .order('created_at', { ascending: false }),
      client.from('wallet_balances').select('ambassador_id, available'),
      client.rpc('withdrawal_minimum'),
    ])

    const disponibleDe = new Map((saldos.data ?? []).map(fila => [fila.ambassador_id, fila.available]))

    const listadas = (solicitudes.data ?? []).map<WithdrawalListed>((fila) => {
      const embajador = fila.ambassadors as unknown as EmbajadorEmbebido
      return {
        id: fila.id,
        ambassadorId: fila.ambassador_id,
        amount: pesos(fila.amount),
        status: fila.status as WithdrawalStatus,
        requestedOn: fila.requested_on,
        resolvedOn: fila.approved_at ? hoy(new Date(fila.approved_at)) : fila.rejected_at ? hoy(new Date(fila.rejected_at)) : null,
        paidOn: fila.paid_at ? hoy(new Date(fila.paid_at)) : null,
        rejectionReason: fila.rejection_reason,
        receiptPath: fila.receipt_path,
        ambassadorEmail: embajador.profiles?.email ?? '',
        ambassadorName: embajador.profiles?.full_name ?? null,
        bank: embajador.bank,
        accountKind: embajador.account_kind as AccountKind,
        accountNumber: embajador.account_number,
        holder: embajador.holder,
        available: disponibleDe.has(fila.ambassador_id) ? pesos(disponibleDe.get(fila.ambassador_id) ?? 0) : null,
      }
    })

    const rutas = listadas.map(solicitud => solicitud.receiptPath).filter((ruta): ruta is string => ruta !== null)
    const firmadas = rutas.length === 0
      ? { data: [] as { path: string | null, signedUrl: string }[] }
      : await client.storage.from(BUCKET_DE_COMPROBANTES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
    const urlDeRuta = new Map((firmadas.data ?? []).map(firma => [firma.path, firma.signedUrl]))
    const comprobantes = Object.fromEntries(listadas
      .filter(solicitud => solicitud.receiptPath && urlDeRuta.has(solicitud.receiptPath))
      .map(solicitud => [solicitud.id, urlDeRuta.get(solicitud.receiptPath!)!]))

    return {
      solicitudes: listadas,
      comprobantes,
      minimo: withdrawalMinimum(minimo.data === null || minimo.data === undefined ? null : pesos(minimo.data)),
    }
  })

  async function aprobar(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('approve_withdrawal', { request: id })
    if (error) {
      return { ok: false, clave: 'withdrawals.errors.approve_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function rechazar(id: string, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('reject_withdrawal', { request: id, reason: motivo })
    if (error) {
      return { ok: false, clave: 'withdrawals.errors.reject_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-56.4 · sube el comprobante y registra el pago; si el pago no entra, el archivo no queda huérfano. */
  async function pagar(solicitud: WithdrawalListed, archivo: File): Promise<ResultadoDeEscritura> {
    const ruta = rutaDeComprobante(solicitud.ambassadorId, solicitud.id, archivo.name)
    const subida = await client.storage.from(BUCKET_DE_COMPROBANTES).upload(ruta, archivo, { upsert: true })
    if (subida.error) {
      return { ok: false, clave: 'withdrawals.errors.receipt_failed' }
    }

    const { error } = await client.rpc('pay_withdrawal', { request: solicitud.id, receipt_path: ruta })
    if (error) {
      await client.storage.from(BUCKET_DE_COMPROBANTES).remove([ruta])
      return { ok: false, clave: 'withdrawals.errors.pay_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function fijarMinimo(amount: CopAmount): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('set_withdrawal_minimum', { amount })
    if (error) {
      return { ok: false, clave: 'withdrawals.minimum.failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    solicitudes: computed(() => consulta.data.value?.solicitudes ?? []),
    comprobantes: computed(() => consulta.data.value?.comprobantes ?? {}),
    minimo: computed(() => consulta.data.value?.minimo ?? withdrawalMinimum(null)),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    aprobar,
    rechazar,
    pagar,
    fijarMinimo,
  }
}
