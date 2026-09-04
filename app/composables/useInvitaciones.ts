import type { CopAmount } from '#shared/money/importe'
import type { SolicitudDeInvitacion } from '#shared/purchases/invitaciones'
import type { InvitacionListada } from '#shared/purchases/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-06 · RF-06.1, RF-06.2 — invitaciones de compra de una propiedad.
 *
 * Invitar pasa por la ruta de servidor porque, si el correo no tiene cuenta, hay que
 * crearla en Supabase Auth (llave de servicio); la fila de la invitación la escribe
 * la propia sesión, bajo RLS y con su autor en la auditoría. Cerrar la compra es una
 * función de la base: titularidad, rol y plan de pagos en una sola transacción.
 *
 * `vincular` encadena las dos: es lo que hace el Superadmin cuando el trato ya está
 * hecho y quiere que alguien sea propietario de una fracción en un solo paso.
 */

export type ResultadoDeInvitacion
  = { ok: true, id: string, inviteeId: string | null }
    | { ok: false, clave: string }

export type ResultadoDeVinculo
  = { ok: true, planId: string | null }
    | { ok: false, clave: string }

export function useInvitaciones(propertyId: Ref<string>) {
  const client = useSupabaseClient<Database>()
  const { locale } = useI18n()

  const consulta = useAsyncData<InvitacionListada[]>(
    () => `invitaciones-${propertyId.value}`,
    async () => {
      if (!propertyId.value) {
        return []
      }

      const [invitaciones, fracciones] = await Promise.all([
        client
          .from('purchase_invitations')
          .select('id, fraction_id, property_id, invitee_email, invitee_id, status, agreed_price, referral_code, created_at')
          .eq('property_id', propertyId.value)
          .order('created_at', { ascending: false }),
        client.from('fractions').select('id, number').eq('property_id', propertyId.value),
      ])

      const numeroPorFraccion = new Map((fracciones.data ?? []).map(f => [f.id, f.number]))

      return (invitaciones.data ?? []).map(fila => ({
        id: fila.id,
        fractionId: fila.fraction_id,
        fractionNumber: numeroPorFraccion.get(fila.fraction_id) ?? 0,
        propertyId: fila.property_id,
        email: fila.invitee_email,
        inviteeId: fila.invitee_id,
        status: fila.status,
        agreedPrice: fila.agreed_price as CopAmount,
        referralCode: fila.referral_code,
        createdAt: fila.created_at,
      }))
    },
    { watch: [propertyId] },
  )

  async function invitar(solicitud: SolicitudDeInvitacion): Promise<ResultadoDeInvitacion> {
    try {
      const creada = await $fetch<{ id: string, inviteeId: string | null }>('/api/compras/invitaciones', {
        method: 'POST',
        body: {
          fractionId: solicitud.fractionId,
          propertyId: solicitud.propertyId,
          email: solicitud.email,
          agreedPrice: solicitud.agreedPrice,
          referralCode: solicitud.referralCode ?? null,
          locale: locale.value,
        },
      })
      await consulta.refresh()
      return { ok: true, id: creada.id, inviteeId: creada.inviteeId }
    }
    catch (error) {
      const clave = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
        ?? (error as { statusMessage?: string })?.statusMessage
        ?? 'purchases.errors.invite_failed'
      return { ok: false, clave }
    }
  }

  async function cancelar(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client
      .from('purchase_invitations')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      return { ok: false, clave: 'purchases.errors.cancel_failed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-06.2 · RF-06.3 · una transacción de la base: fracción, rol y plan. */
  async function cerrarCompra(id: string): Promise<{ ok: true, planId: string } | { ok: false, clave: string }> {
    const { data, error } = await client.rpc('cerrar_compra', { invitacion: id })

    if (error || !data) {
      return { ok: false, clave: 'purchases.errors.close_failed' }
    }

    await consulta.refresh()
    return { ok: true, planId: data.id }
  }

  /**
   * RF-06.1 + RF-06.2 en un paso: invita y, si se pide, cierra la compra en el acto.
   * Si el cierre falla, la invitación ya quedó pendiente y se puede cerrar después.
   */
  async function vincular(
    solicitud: SolicitudDeInvitacion,
    opciones: { cerrarAhora: boolean },
  ): Promise<ResultadoDeVinculo> {
    const invitacion = await invitar(solicitud)
    if (!invitacion.ok) {
      return invitacion
    }
    if (!opciones.cerrarAhora) {
      return { ok: true, planId: null }
    }

    const cierre = await cerrarCompra(invitacion.id)
    return cierre.ok ? { ok: true, planId: cierre.planId } : cierre
  }

  return {
    invitaciones: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    invitar,
    vincular,
    cancelar,
    cerrarCompra,
  }
}
