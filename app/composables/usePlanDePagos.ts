import type { CopAmount } from '#shared/money/importe'
import { pesos } from '#shared/money/importe'
import type { NuevoAbono } from '#shared/payments/abonos'
import { BUCKET_DE_COMPROBANTES, rutaDeComprobante } from '#shared/payments/comprobantes'
import type { EstadoDePlan } from '#shared/payments/plan'
import type { AbonoListado, PlanDePagosListado } from '#shared/payments/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-58 · RF-58.2…RF-58.9 — un plan de pagos con sus abonos.
 *
 * Todo lo derivado —estado, abonado, saldo, calendario— llega ya calculado por la
 * vista `payment_plan_overview` (DT-04). Aquí no se suma nada: si la interfaz
 * recompusiera el saldo podría contradecir a la base, que es la única verdad.
 *
 * Los comprobantes viven en un bucket privado; se sirven con URL firmada de una
 * hora, y poder firmarla ya lo decide la política de Storage.
 */

const VIGENCIA_DE_FIRMA = 3600

export interface AbonoConArchivo {
  abono: Omit<NuevoAbono, 'receiptPath'>
  archivo: File
}

export function usePlanDePagos(planId: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData(
    () => `plan-${planId.value}`,
    async () => {
      if (!planId.value) {
        return null
      }

      const [vista, abonos] = await Promise.all([
        client.from('payment_plan_overview').select('*').eq('id', planId.value).maybeSingle(),
        client
          .from('payments')
          .select('*')
          .eq('plan_id', planId.value)
          .order('paid_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (!vista.data || !vista.data.id) {
        return null
      }

      // El nombre del titular: su perfil si la sesión puede leerlo (Superadmin), y
      // si no, el correo con el que se le invitó, que el Administrador sí ve.
      const [perfil, invitacion] = await Promise.all([
        client.from('profiles').select('email, full_name').eq('id', vista.data.owner_id ?? '').maybeSingle(),
        client.from('purchase_invitations').select('invitee_email').eq('id', vista.data.invitation_id ?? '').maybeSingle(),
      ])

      const rutas = (abonos.data ?? []).map(abono => abono.receipt_path)
      const firmas = rutas.length === 0
        ? { data: [] }
        : await client.storage.from(BUCKET_DE_COMPROBANTES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
      const urlPorRuta = new Map((firmas.data ?? []).map(firma => [firma.path ?? '', firma.signedUrl ?? '']))

      const plan: PlanDePagosListado = {
        id: vista.data.id,
        fractionId: vista.data.fraction_id ?? '',
        fractionNumber: vista.data.fraction_number ?? 0,
        propertyId: vista.data.property_id ?? '',
        propertyName: vista.data.property_name ?? '',
        ownerId: vista.data.owner_id ?? '',
        ownerLabel: perfil.data?.full_name ?? perfil.data?.email ?? invitacion.data?.invitee_email ?? vista.data.owner_id ?? '',
        agreedPrice: pesos(Number(vista.data.agreed_price ?? 0)),
        paidTotal: pesos(Number(vista.data.paid_total ?? 0)),
        balance: pesos(Number(vista.data.balance ?? 0)),
        status: (vista.data.status ?? 'reserved') as EstadoDePlan,
        calendarActive: vista.data.calendar_active ?? false,
        referralCode: vista.data.referral_code,
        closedAt: vista.data.closed_at ?? '',
        voidedAt: vista.data.voided_at,
        voidReason: vista.data.void_reason,
      }

      return {
        plan,
        abonos: (abonos.data ?? []).map<AbonoListado>(abono => ({
          id: abono.id,
          amount: abono.amount as CopAmount,
          paidOn: abono.paid_on,
          method: abono.payment_method,
          note: abono.note,
          receiptPath: abono.receipt_path,
          receiptUrl: urlPorRuta.get(abono.receipt_path) ?? '',
          voidedAt: abono.voided_at,
          voidReason: abono.void_reason,
        })),
      }
    },
    { watch: [planId] },
  )

  const plan = computed(() => consulta.data.value?.plan ?? null)

  /** RF-58.2 · sube el comprobante y registra el abono; si el registro falla, no queda huérfano. */
  async function registrarAbono({ abono, archivo }: AbonoConArchivo): Promise<ResultadoDeEscritura> {
    const actual = plan.value
    if (!actual) {
      return { ok: false, clave: 'payments.errors.save_failed' }
    }

    const ruta = rutaDeComprobante(actual.propertyId, actual.id, archivo.name, crypto.randomUUID())

    const subida = await client.storage.from(BUCKET_DE_COMPROBANTES).upload(ruta, archivo)
    if (subida.error) {
      return { ok: false, clave: 'payments.errors.save_failed' }
    }

    const { error } = await client.from('payments').insert({
      plan_id: actual.id,
      property_id: actual.propertyId,
      amount: abono.amount,
      paid_on: abono.paidOn,
      payment_method: abono.method,
      receipt_path: ruta,
      note: abono.note,
    })

    if (error) {
      await client.storage.from(BUCKET_DE_COMPROBANTES).remove([ruta])
      // El sobrepago lo rechaza la base aunque el formulario lo haya dejado pasar.
      return { ok: false, clave: /precio pactado/.test(error.message) ? 'payments.validation.overpayment' : 'payments.errors.save_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-58.5 · anulación con motivo; el estado y el calendario se recalculan en la base. */
  async function anularAbono(id: string, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('anular_abono', { abono: id, motivo })
    if (error) {
      return { ok: false, clave: 'payments.errors.void_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-58.8 · D-31 · anulación de la compra, con todos sus efectos, por el Superadmin. */
  async function anularCompra(motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('anular_compra', { plan: planId.value, motivo })
    if (error) {
      return { ok: false, clave: 'payments.errors.void_purchase_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  return {
    plan,
    abonos: computed(() => consulta.data.value?.abonos ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    registrarAbono,
    anularAbono,
    anularCompra,
  }
}
