import type { AccountKind } from '#shared/referrals/signup'
import type { AmbassadorListed, AmbassadorStatus } from '#shared/referrals/views'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-49 · RF-49.4, RF-49.5 — las inscripciones al Programa de Referidos que
 * gestiona el Superadmin. Resolver es una función de la base: al aprobar suma el
 * rol Embajador y genera el código; al rechazar exige motivo.
 */
export function useEmbajadores() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<AmbassadorListed[]>('embajadores', async () => {
    const [inscripciones, codigos] = await Promise.all([
      client
        .from('ambassadors')
        .select('id, user_id, status, terms_version, bank, account_kind, account_number, holder, created_at, approved_at, profiles:user_id(email, full_name)')
        .order('created_at', { ascending: false }),
      client.from('referral_codes').select('ambassador_id, code, enabled'),
    ])

    const codigoDe = new Map((codigos.data ?? []).map(fila => [fila.ambassador_id, fila]))

    return (inscripciones.data ?? []).map<AmbassadorListed>((fila) => {
      const perfil = fila.profiles as unknown as { email: string, full_name: string | null } | null
      const codigo = codigoDe.get(fila.id)
      return {
        id: fila.id,
        userId: fila.user_id,
        email: perfil?.email ?? '',
        fullName: perfil?.full_name ?? null,
        status: fila.status as AmbassadorStatus,
        code: codigo?.code ?? null,
        codeEnabled: codigo?.enabled ?? false,
        bank: fila.bank,
        accountKind: fila.account_kind as AccountKind,
        accountNumber: fila.account_number,
        holder: fila.holder,
        termsVersion: fila.terms_version,
        enrolledAt: fila.created_at,
        approvedAt: fila.approved_at,
      }
    })
  })

  async function resolver(id: string, aprobar: boolean, motivo: string | null): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('approve_ambassador', { ambassador: id, approve: aprobar, reason: motivo ?? undefined })
    if (error) {
      return { ok: false, clave: 'referrals.ambassadors.errors.resolve_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    embajadores: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    resolver,
  }
}
