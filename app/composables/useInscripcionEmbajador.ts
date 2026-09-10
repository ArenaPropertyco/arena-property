import { canSignUp, signupErrorKey, TERMS_VERSION } from '#shared/referrals/signup'
import type { SignupDraft } from '#shared/referrals/signup'
import type { AmbassadorStatus } from '#shared/referrals/views'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-49 · RF-49.1, RF-49.6 y HU-50 · RF-50.2 — la inscripción propia al Programa
 * de Referidos y, si está aprobada, el código que le corresponde.
 *
 * La elegibilidad sale de la matriz de permisos (HU-07) a través de
 * `shared/referrals/signup`; la base la vuelve a comprobar en
 * `enroll_as_ambassador`, porque nadie confía en el cliente.
 */
interface InscripcionPropia {
  id: string
  status: AmbassadorStatus
  rejectionReason: string | null
  code: string | null
  codeEnabled: boolean
}

export function useInscripcionEmbajador() {
  const client = useSupabaseClient<Database>()
  const { idDeCuenta, roles, recargar: recargarCuenta } = useCuenta()

  const consulta = useAsyncData<InscripcionPropia | null>('inscripcion-embajador', async () => {
    if (!idDeCuenta.value) {
      return null
    }
    const { data } = await client
      .from('ambassadors')
      .select('id, status, rejection_reason, referral_codes(code, enabled)')
      .eq('user_id', idDeCuenta.value)
      .maybeSingle()
    if (!data) {
      return null
    }
    const codigo = data.referral_codes as unknown as { code: string, enabled: boolean } | null
    return {
      id: data.id,
      status: data.status as AmbassadorStatus,
      rejectionReason: data.rejection_reason,
      code: codigo?.code ?? null,
      codeEnabled: codigo?.enabled ?? false,
    }
  }, { watch: [idDeCuenta] })

  const inscripcion = computed(() => consulta.data.value ?? null)
  const elegibilidad = computed(() => canSignUp(roles.value, inscripcion.value !== null))

  async function inscribir(draft: SignupDraft): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('enroll_as_ambassador', {
      terms_version: draft.termsVersion,
      bank: draft.bank.bank,
      account_kind: draft.bank.accountKind,
      account_number: draft.bank.accountNumber,
      holder: draft.bank.holder,
    })
    if (error) {
      // RF-49.1 · si la base dice por qué, se le repite a la persona; un fallo
      // sin regla reconocida se queda en el mensaje genérico.
      return { ok: false, clave: signupErrorKey(error.message) ?? 'referrals.signup.errors.enroll_failed' }
    }
    await Promise.all([consulta.refresh(), recargarCuenta()])
    return { ok: true }
  }

  return {
    inscripcion,
    elegibilidad,
    versionDeTerminos: TERMS_VERSION,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    inscribir,
  }
}
