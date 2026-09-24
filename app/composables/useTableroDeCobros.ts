import { hoy } from '#shared/dates/formato'
import { periodoAnterior } from '#shared/finance/billetera'
import { BUCKET_DE_COMPROBANTES_DE_PROPIETARIO, rutaDeComprobanteDePropietario } from '#shared/finance/cobros'
import { mesDe } from '#shared/finance/estado-de-cuenta'
import type { Mes } from '#shared/finance/estado-de-cuenta'
import { filasDelTablero, filtrarFilasDelTablero, filtroDeTableroVacio, resumenDelTablero } from '#shared/finance/tablero-de-cobros'
import type { CobroDelTablero, CorteDelTablero, EntradaDelTablero, FiltroDeTablero, FilaDelTablero, FraccionDelTablero, PagoDelTablero, RetiroDelTablero, SaldoDelTablero } from '#shared/finance/tablero-de-cobros'
import { pesos } from '#shared/money/importe'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Segundos de vigencia de la URL firmada de un comprobante. */
const VIGENCIA_DE_FIRMA = 3600

type Cliente = ReturnType<typeof useSupabaseClient<Database>>

/** Un mes `AAAA-MM-01` de la base como `AAAA-MM`. */
function mesDePeriodo(period: string): Mes {
  return period.slice(0, 7)
}

/**
 * Lo que la base sabe de una propiedad para armar su tablero en un mes: las
 * fracciones con su titular, los cortes del mes (del Propietario o, en el mes
 * en curso, sus cuotas vivas), las cuotas del titular del inventario, los
 * saldos, los cobros con sus pagos y las solicitudes de retiro abiertas.
 * Lo comparten el tablero de una propiedad y la vista global del Superadmin.
 */
export async function cargarEntradaDelTablero(client: Cliente, propertyId: string, mes: Mes, estimated: boolean): Promise<EntradaDelTablero> {
  const periodo = `${mes}-01`
  const [fracciones, cortes, cuotas, saldos, cobros, retiros] = await Promise.all([
    client.from('fractions').select('id, number, owner_id, status, calendar_active').eq('property_id', propertyId).order('number'),
    client.from('owner_statements').select('fraction_number, income, expenses, net').eq('property_id', propertyId).eq('period', periodo),
    client.from('property_board_shares').select('fraction_number, responsible, income, expenses, net').eq('property_id', propertyId).eq('period', periodo),
    client.from('owner_wallet_balances').select('owner_id, balance').eq('property_id', propertyId),
    client.from('owner_charges').select('*, owner_payments(*, payment_methods(name))').eq('property_id', propertyId).order('period', { ascending: false }),
    client.from('owner_withdrawals').select('*').eq('property_id', propertyId).eq('status', 'requested'),
  ])

  const titulares = [...new Set((fracciones.data ?? []).map(fila => fila.owner_id).filter((id): id is string => id !== null))]
  const perfiles = titulares.length === 0 ? { data: [] } : await client.from('profiles').select('id, email, full_name').in('id', titulares)
  const etiquetaDe = new Map((perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]))

  // RF-63.1 · en un mes cerrado el neto del Propietario es el de su corte; en el mes en
  // curso, sus cuotas vivas. Las del titular del inventario siempre salen de las cuotas.
  const delPropietario: CorteDelTablero[] = estimated
    ? (cuotas.data ?? []).filter(fila => fila.responsible === 'owner').map(fila => ({ fractionNumber: fila.fraction_number!, responsible: 'owner', income: pesos(fila.income ?? 0), expenses: pesos(fila.expenses ?? 0), net: pesos(fila.net ?? 0) }))
    : (cortes.data ?? []).map(fila => ({ fractionNumber: fila.fraction_number, responsible: 'owner', income: pesos(fila.income), expenses: pesos(fila.expenses), net: pesos(fila.net) }))
  const delTitular: CorteDelTablero[] = (cuotas.data ?? [])
    .filter(fila => fila.responsible === 'inventory_holder')
    .map(fila => ({ fractionNumber: fila.fraction_number!, responsible: 'inventory_holder', income: pesos(fila.income ?? 0), expenses: pesos(fila.expenses ?? 0), net: pesos(fila.net ?? 0) }))

  return {
    period: mes,
    estimated,
    fractions: (fracciones.data ?? []).map<FraccionDelTablero>(fila => ({
      id: fila.id,
      number: fila.number,
      ownerId: fila.owner_id,
      ownerLabel: fila.owner_id ? etiquetaDe.get(fila.owner_id) ?? null : null,
      status: fila.status,
      calendarActive: fila.calendar_active,
    })),
    statements: [...delPropietario, ...delTitular],
    balances: (saldos.data ?? []).filter(fila => fila.owner_id).map<SaldoDelTablero>(fila => ({ ownerId: fila.owner_id!, balance: pesos(fila.balance ?? 0) })),
    charges: (cobros.data ?? []).map<CobroDelTablero>(fila => ({
      id: fila.id,
      ownerId: fila.owner_id,
      period: mesDePeriodo(fila.period),
      amount: pesos(fila.amount),
      paidAmount: pesos(fila.paid_amount),
      status: fila.status as CobroDelTablero['status'],
      payments: ((fila.owner_payments as unknown as (Database['public']['Tables']['owner_payments']['Row'] & { payment_methods: { name: string } | null })[] | null) ?? [])
        .map<PagoDelTablero>(pago => ({
          id: pago.id,
          chargeId: pago.charge_id,
          amount: pesos(pago.amount),
          paidOn: pago.paid_on,
          paymentMethodName: pago.payment_methods?.name ?? '',
          description: pago.description,
          receiptPath: pago.receipt_path,
          channel: pago.channel as PagoDelTablero['channel'],
          provider: pago.provider,
          externalReference: pago.external_reference,
          status: pago.status as PagoDelTablero['status'],
          rejectionReason: pago.rejection_reason,
        }))
        .sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
    })),
    withdrawals: (retiros.data ?? []).map<RetiroDelTablero>(fila => ({
      id: fila.id,
      ownerId: fila.owner_id,
      amount: pesos(fila.amount),
      status: fila.status as RetiroDelTablero['status'],
      requestedOn: fila.requested_on,
      bank: fila.bank,
      accountKind: fila.account_kind as RetiroDelTablero['accountKind'],
      accountNumber: fila.account_number,
      holder: fila.holder,
      receiptPath: fila.receipt_path,
    })),
  }
}

/**
 * HU-63 · RF-63.1…RF-63.6, RF-63.9, RF-63.10 — el tablero de cobros de una
 * propiedad en un mes.
 *
 * Orquesta, no calcula: trae lo que la base sabe del mes elegido —por omisión
 * el último cerrado— y se lo pasa a `shared/finance/tablero-de-cobros`, que
 * arma las 8 filas, el resumen y el filtro. Confirmar, rechazar y pagar son
 * funciones de la base que vuelven a comprobar el permiso y el estado; el
 * comprobante del retiro sube a Storage antes de registrar el pago y se retira
 * si el pago no entra. La RLS ya acotó todo a lo gestionado (RF-63.8).
 */
export function useTableroDeCobros(propertyId: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const mesEnCurso = mesDe(hoy())
  const mes = ref<Mes>(periodoAnterior(hoy()))
  const filtro = ref<FiltroDeTablero>(filtroDeTableroVacio())

  const consulta = useAsyncData(() => `tablero-de-cobros-${propertyId.value}-${mes.value}`, async () => {
    if (!propertyId.value) {
      return null
    }
    const propiedad = await client.from('properties').select('id, name').eq('id', propertyId.value).maybeSingle()
    if (!propiedad.data) {
      return null
    }
    const entrada = await cargarEntradaDelTablero(client, propertyId.value, mes.value, mes.value >= mesEnCurso)

    // RF-63.4 · el comprobante de cada pago en revisión, con URL firmada de corta vida.
    const rutas = entrada.charges.flatMap(cobro => cobro.payments).filter(pago => pago.receiptPath).map(pago => ({ id: pago.id, ruta: pago.receiptPath! }))
    const firmadas = rutas.length === 0
      ? { data: [] as { path: string | null, signedUrl: string }[] }
      : await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).createSignedUrls(rutas.map(item => item.ruta), VIGENCIA_DE_FIRMA)
    const urlDeRuta = new Map((firmadas.data ?? []).map(firma => [firma.path, firma.signedUrl]))
    const comprobantes = Object.fromEntries(rutas.filter(item => urlDeRuta.has(item.ruta)).map(item => [item.id, urlDeRuta.get(item.ruta)!]))

    return { propiedad: { id: propiedad.data.id, name: propiedad.data.name }, entrada, comprobantes }
  }, { watch: [propertyId, mes] })

  const propiedad = computed(() => consulta.data.value?.propiedad ?? null)
  const filas = computed<FilaDelTablero[]>(() => consulta.data.value ? filasDelTablero(consulta.data.value.entrada) : [])
  const filasFiltradas = computed(() => filtrarFilasDelTablero(filas.value, filtro.value))
  // CA-63.2 · el resumen sale de las 8 filas, no de las filtradas.
  const resumen = computed(() => resumenDelTablero(filas.value))
  const comprobantes = computed(() => consulta.data.value?.comprobantes ?? {})
  const estimado = computed(() => consulta.data.value?.entrada.estimated ?? false)

  async function confirmar(pago: PagoDelTablero): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('confirm_owner_payment', { payment: pago.id })
    if (error) {
      return { ok: false, clave: 'collections.errors.confirm_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function rechazar(pago: PagoDelTablero, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('reject_owner_payment', { payment: pago.id, reason: motivo })
    if (error) {
      return { ok: false, clave: 'collections.errors.reject_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-63.6 · sube el comprobante y paga el retiro; si el pago no entra, el archivo no queda huérfano. */
  async function pagar(fila: FilaDelTablero, archivo: File): Promise<ResultadoDeEscritura> {
    if (!fila.withdrawal || !fila.ownerId || !propiedad.value) {
      return { ok: false, clave: 'collections.errors.pay_failed' }
    }
    const ruta = rutaDeComprobanteDePropietario(propiedad.value.id, fila.ownerId, `${fila.withdrawal.id}-${crypto.randomUUID()}`, archivo.name)
    const subida = await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).upload(ruta, archivo)
    if (subida.error) {
      return { ok: false, clave: 'collections.errors.receipt_failed' }
    }
    const { error } = await client.rpc('pay_owner_withdrawal', { request: fila.withdrawal.id, receipt_path: ruta })
    if (error) {
      await client.storage.from(BUCKET_DE_COMPROBANTES_DE_PROPIETARIO).remove([ruta])
      return { ok: false, clave: 'collections.errors.pay_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    propiedad,
    mes,
    mesEnCurso,
    estimado,
    filtro,
    filas: filasFiltradas,
    resumen,
    comprobantes,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    confirmar,
    rechazar,
    pagar,
  }
}
