import { comisionPublicada } from '#shared/content/embajadores'
import type { Idioma } from '#shared/money/formato'
import type { CopAmount } from '#shared/money/importe'
import type { CommissionKind, CommissionType } from '#shared/referrals/commission'
import type { Database } from '#shared/types/database.types'

/**
 * HU-48 · RF-48.2 · CA-48.1 · D-37 — el tipo de comisión predeterminado que
 * publica la página del programa. Lo devuelve `default_commission_type()`, que
 * cualquiera puede llamar sin exponer el resto del catálogo (HU-52). La cifra
 * la formatea el dominio; aquí solo se consulta.
 */
export function useComisionPublica() {
  const client = useSupabaseClient<Database>()
  const { locale } = useI18n()

  const consulta = useAsyncData<CommissionType | null>('comision-publica', async () => {
    const { data } = await client.rpc('default_commission_type')
    const fila = data?.[0]
    if (!fila) {
      return null
    }
    return {
      id: fila.id,
      name: fila.name,
      kind: fila.kind as CommissionKind,
      amount: fila.amount === null ? null : (fila.amount as CopAmount),
      basisPoints: fila.basis_points,
      isDefault: fila.is_default,
      active: true,
      createdBy: null,
      createdAt: '',
    }
  })

  const tipo = computed(() => consulta.data.value ?? null)
  const comision = computed(() => comisionPublicada(tipo.value, locale.value as Idioma))

  return { tipo, comision, pendiente: consulta.pending }
}
