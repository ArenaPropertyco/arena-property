import { hoy, formatearMes } from '#shared/dates/formato'
import { emptyOwnerWalletFilter, filterOwnerStatements, filterOwnerWalletEntries, saldoConsolidado, saldoEstimadoDelMes, saldosPorPropiedad, sortOwnerWalletEntries } from '#shared/finance/billetera'
import type { OwnerWalletEntry, OwnerWalletEntryKind, OwnerWalletFilter } from '#shared/finance/billetera'
import { BUCKET_DE_COMPROBANTES_DE_PROPIETARIO, rutaDeComprobanteDePropietario } from '#shared/finance/cobros'
import { mesDe } from '#shared/finance/estado-de-cuenta'
import type { NuevoRetiroDePropietario } from '#shared/finance/retiros-propietario'
import type { OwnerChargeListed, OwnerPaymentListed, OwnerStatementListed, OwnerWithdrawalListed } from '#shared/finance/vistas'
import type { CopAmount } from '#shared/money/importe'
import { pesos } from '#shared/money/importe'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Segundos de vigencia de la URL firmada de un comprobante. */
const VIGENCIA_DE_FIRMA = 3600

/** Lo que el Propietario reporta de un pago; el archivo sube antes de registrarlo. */
export interface ReporteDePago {
  amount: CopAmount
  paidOn: string
  paymentMethodId: string
  description: string
  file: File
}

/** Un mes `AAAA-MM-01` de la base como `AAAA-MM`. */
function mesDePeriodo(period: string): string {
  return period.slice(0, 7)
}

/**
 * HU-62 · RF-62.1, RF-62.2, RF-62.7, RF-62.9, RF-62.14 · D-51 — la billetera del
 * Propietario que mira.
 *
 * Orquesta, no calcula: trae el histórico de `owner_wallet_listing`, los cortes,
 * los cobros con sus pagos, las solicitudes de retiro y las cuotas vivas del mes
 * en curso (HU-19), y se lo pasa a `shared/finance/billetera`, que deriva los
 * saldos por propiedad, ordena y filtra. Reportar un pago y solicitar un retiro
 * son funciones de la base, que vuelven a validar lo mismo que el formulario.
 * La RLS ya acotó todo a lo propio (RF-62.12).
 */
export function useBilleteraDePropietario() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta } = useCuenta()
  const { fracciones, pendiente: cargandoFracciones } = useFraccionesPropias()
  const { lineas } = useEstadoDeCuenta()

  const consulta = useAsyncData('billetera-de-propietario', async () => {
    const cuenta = idDeCuenta.value
    if (!cuenta) {
      return null
    }

    const [listado, cortes, cobros, retiros] = await Promise.all([
      client.from('owner_wallet_listing').select('*').eq('owner_id', cuenta),
      client.from('owner_statements').select('*, properties(name), owner_statement_lines(adjustment)').eq('owner_id', cuenta).order('period', { ascending: false }),
      client.from('owner_charges').select('*, properties(name), owner_payments(*, payment_methods(name))').eq('owner_id', cuenta).order('period', { ascending: false }),
      client.from('owner_withdrawals').select('*, properties(name)').eq('owner_id', cuenta).order('created_at', { ascending: false }),
    ])

    const movimientos = (listado.data ?? [])
      .filter(fila => fila.id && fila.kind && fila.occurred_on && fila.created_at && fila.property_id)
      .map<OwnerWalletEntry>(fila => ({
        id: fila.id!,
        kind: fila.kind as OwnerWalletEntryKind,
        amount: pesos(fila.amount ?? 0),
        occurredOn: fila.occurred_on!,
        createdAt: fila.created_at!,
        propertyId: fila.property_id!,
        propertyName: fila.property_name ?? '',
        fractionNumber: fila.fraction_number,
        period: fila.period ? mesDePeriodo(fila.period) : null,
        statementId: fila.statement_id,
        paymentId: fila.payment_id,
        withdrawalId: fila.withdrawal_id,
      }))

    const cortesListados = (cortes.data ?? []).map<OwnerStatementListed>(fila => ({
      id: fila.id,
      propertyId: fila.property_id,
      propertyName: (fila.properties as unknown as { name: string } | null)?.name ?? '',
      fractionNumber: fila.fraction_number,
      period: mesDePeriodo(fila.period),
      income: pesos(fila.income),
      expenses: pesos(fila.expenses),
      net: pesos(fila.net),
      hasAdjustments: ((fila.owner_statement_lines as unknown as { adjustment: boolean }[] | null) ?? []).some(linea => linea.adjustment),
      closedAt: fila.closed_at,
    }))

    const cobrosListados = (cobros.data ?? []).map<OwnerChargeListed>(fila => ({
      id: fila.id,
      ownerId: fila.owner_id,
      propertyId: fila.property_id,
      propertyName: (fila.properties as unknown as { name: string } | null)?.name ?? '',
      period: mesDePeriodo(fila.period),
      amount: pesos(fila.amount),
      paidAmount: pesos(fila.paid_amount),
      status: fila.status as OwnerChargeListed['status'],
      payments: ((fila.owner_payments as unknown as (Database['public']['Tables']['owner_payments']['Row'] & { payment_methods: { name: string } | null })[] | null) ?? [])
        .map<OwnerPaymentListed>(pago => ({
          id: pago.id,
          chargeId: pago.charge_id,
          amount: pesos(pago.amount),
          paidOn: pago.paid_on,
          paymentMethodName: pago.payment_methods?.name ?? '',
          description: pago.description,
          receiptPath: pago.receipt_path,
          channel: pago.channel as OwnerPaymentListed['channel'],
          provider: pago.provider,
          externalReference: pago.external_reference,
          status: pago.status as OwnerPaymentListed['status'],
          reportedAt: pago.reported_at,
          resolvedOn: pago.resolved_at ? hoy(new Date(pago.resolved_at)) : null,
          rejectionReason: pago.rejection_reason,
        }))
        .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)),
    }))

    const retirosListados = (retiros.data ?? []).map<OwnerWithdrawalListed>(fila => ({
      id: fila.id,
      ownerId: fila.owner_id,
      propertyId: fila.property_id,
      propertyName: (fila.properties as unknown as { name: string } | null)?.name ?? '',
      amount: pesos(fila.amount),
      status: fila.status as OwnerWithdrawalListed['status'],
      requestedOn: fila.requested_on,
      resolvedOn: fila.paid_at ? hoy(new Date(fila.paid_at)) : fila.rejected_at ? hoy(new Date(fila.rejected_at)) : null,
      rejectionReason: fila.rejection_reason,
      receiptPath: fila.receipt_path,
      bank: fila.bank,
      accountKind: fila.account_kind as OwnerWithdrawalListed['accountKind'],
      accountNumber: fila.account_number,
      holder: fila.holder,
    }))

    // RF-62.7 · RF-62.9 · el comprobante de cada pago y de cada retiro pagado, con URL firmada de corta vida.
    const conComprobante = [
      ...cobrosListados.flatMap(cobro => cobro.payments).map(pago => ({ id: pago.id, ruta: pago.receiptPath })),
      ...retirosListados.map(retiro => ({ id: retiro.id, ruta: retiro.receiptPath })),
    ].filter((item): item is { id: string, ruta: string } => item.ruta !== null)
    const firmadas = conComprobante.length === 0
      ? { data: [] as { path: string | null, signedUrl: string }[] }
      : await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).createSignedUrls(conComprobante.map(item => item.ruta), VIGENCIA_DE_FIRMA)
    const urlDeRuta = new Map((firmadas.data ?? []).map(firma => [firma.path, firma.signedUrl]))
    const comprobantes = Object.fromEntries(conComprobante
      .filter(item => urlDeRuta.has(item.ruta))
      .map(item => [item.id, urlDeRuta.get(item.ruta)!]))

    return { movimientos, cortes: cortesListados, cobros: cobrosListados, retiros: retirosListados, comprobantes }
  }, { watch: [idDeCuenta] })

  const filtro = ref<OwnerWalletFilter>(emptyOwnerWalletFilter())

  const propiedades = computed(() => {
    const vistas = new Map<string, string>()
    for (const fraccion of fracciones.value) {
      vistas.set(fraccion.propertyId, fraccion.propertyName)
    }
    return [...vistas.entries()].map(([id, name]) => ({ id, name }))
  })

  const todos = computed(() => sortOwnerWalletEntries(consulta.data.value?.movimientos ?? []))
  const movimientos = computed(() => filterOwnerWalletEntries(todos.value, filtro.value))
  // CA-62.11 · los saldos salen del histórico completo, no del filtro.
  const saldos = computed(() => saldosPorPropiedad(todos.value, propiedades.value))
  const consolidado = computed(() => saldoConsolidado(todos.value))
  const cortes = computed(() => filterOwnerStatements(consulta.data.value?.cortes ?? [], filtro.value))
  const cobros = computed(() => consulta.data.value?.cobros ?? [])
  const retiros = computed(() => consulta.data.value?.retiros ?? [])
  const comprobantes = computed(() => consulta.data.value?.comprobantes ?? {})

  // CA-62.12 · el mes en curso, estimado por propiedad sobre las cuotas vivas de HU-19.
  const mesEnCurso = mesDe(hoy())
  const estimados = computed(() => Object.fromEntries(propiedades.value.map(propiedad => [
    propiedad.id,
    saldoEstimadoDelMes(lineas.value.filter(linea => linea.propertyId === propiedad.id), mesEnCurso),
  ])))

  /** RF-62.7 · el mensaje de la base dice qué regla se incumplió; se traduce a su clave. */
  function claveDeErrorDePago(mensaje: string): string {
    if (/supera/.test(mensaje)) {
      return 'ownerWallet.payment.validation.above_charge'
    }
    if (/comprobante/.test(mensaje)) {
      return 'ownerWallet.payment.validation.receipt_required'
    }
    if (/medio de pago/.test(mensaje)) {
      return 'ownerWallet.payment.validation.method_required'
    }
    if (/ya está pagado/.test(mensaje)) {
      return 'ownerWallet.payment.validation.charge_closed'
    }
    return 'ownerWallet.payment.errors.report_failed'
  }

  /** RF-62.7 · sube el comprobante y reporta el pago; si el reporte no entra, el archivo no queda huérfano. */
  async function reportarPago(cobro: OwnerChargeListed, reporte: ReporteDePago): Promise<ResultadoDeEscritura> {
    const cuenta = idDeCuenta.value
    if (!cuenta) {
      return { ok: false, clave: 'ownerWallet.payment.errors.report_failed' }
    }
    const ruta = rutaDeComprobanteDePropietario(cobro.propertyId, cuenta, `${cobro.id}-${crypto.randomUUID()}`, reporte.file.name)
    const subida = await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).upload(ruta, reporte.file)
    if (subida.error) {
      return { ok: false, clave: 'ownerWallet.payment.errors.receipt_failed' }
    }

    const { error } = await client.rpc('report_owner_payment', {
      charge: cobro.id,
      amount: reporte.amount,
      paid_on: reporte.paidOn,
      payment_method: reporte.paymentMethodId,
      description: reporte.description,
      receipt_path: ruta,
    })
    if (error) {
      await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).remove([ruta])
      return { ok: false, clave: claveDeErrorDePago(error.message) }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-62.9 · el mensaje de la base dice qué regla se incumplió; se traduce a su clave. */
  function claveDeErrorDeRetiro(mensaje: string): string {
    if (/abierta/.test(mensaje)) {
      return 'ownerWallet.withdrawal.validation.open_request'
    }
    if (/supera/.test(mensaje)) {
      return 'ownerWallet.withdrawal.validation.above_balance'
    }
    return 'ownerWallet.withdrawal.errors.request_failed'
  }

  async function solicitarRetiro(propertyId: string, retiro: NuevoRetiroDePropietario & { amount: CopAmount }): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('request_owner_withdrawal', {
      property: propertyId,
      amount: retiro.amount,
      bank: retiro.bank,
      account_kind: retiro.accountKind,
      account_number: retiro.accountNumber,
      holder: retiro.holder,
    })
    if (error) {
      return { ok: false, clave: claveDeErrorDeRetiro(error.message) }
    }
    await consulta.refresh()
    return { ok: true }
  }

  function limpiarFiltro() {
    filtro.value = emptyOwnerWalletFilter()
  }

  return {
    propiedades,
    saldos,
    consolidado,
    estimados,
    mesEnCurso,
    etiquetaDelMesEnCurso: (idioma: 'es' | 'en') => formatearMes(mesEnCurso, idioma),
    movimientos,
    todos,
    cortes,
    cobros,
    retiros,
    comprobantes,
    filtro,
    limpiarFiltro,
    pendiente: computed(() => cargandoFracciones.value || consulta.pending.value),
    recargar: consulta.refresh,
    reportarPago,
    solicitarRetiro,
  }
}
