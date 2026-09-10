import type { CopAmount } from '#shared/money/importe'
import { activeTypes, defaultType, typeForAmbassador } from '#shared/referrals/commission'
import type { CommissionAssignment, CommissionKind, CommissionType, CommissionTypeDraft } from '#shared/referrals/commission'
import type { AmbassadorCommissionListed } from '#shared/referrals/views'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-52 · RF-52.1…RF-52.5 · D-37 — el catálogo de tipos de comisión y a qué
 * Embajador se le aplica cada uno.
 *
 * El catálogo completo solo lo lee el Superadmin (RLS); el predeterminado sale de
 * `default_commission_type()`, que también alimenta la página pública (HU-48).
 * Aquí no vive ninguna regla: qué tipo le toca a cada Embajador lo resuelve
 * `shared/referrals/commission`, y la base repite lo mismo al escribir.
 */
export function useComision() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData('comision-tipos', async () => {
    const [catalogo, asignaciones, embajadores] = await Promise.all([
      client.from('commission_types')
        .select('id, name, kind, amount, basis_points, is_default, active, created_by, created_at')
        .order('name'),
      client.from('ambassador_commissions')
        .select('ambassador_id, commission_type_id, assigned_at'),
      client.from('ambassadors')
        .select('id, status, profiles!inner(email, full_name)')
        .eq('status', 'approved'),
    ])

    const tipos = (catalogo.data ?? []).map<CommissionType>(fila => ({
      id: fila.id,
      name: fila.name,
      kind: fila.kind as CommissionKind,
      amount: fila.amount === null ? null : (fila.amount as CopAmount),
      basisPoints: fila.basis_points,
      isDefault: fila.is_default,
      active: fila.active,
      createdBy: fila.created_by,
      createdAt: fila.created_at,
    }))

    const asignados = (asignaciones.data ?? []).map<CommissionAssignment>(fila => ({
      ambassadorId: fila.ambassador_id,
      commissionTypeId: fila.commission_type_id,
    }))

    const fechas = new Map((asignaciones.data ?? []).map(fila => [fila.ambassador_id, fila.assigned_at]))

    const asignaciones_ = (embajadores.data ?? []).map<AmbassadorCommissionListed>((fila) => {
      const perfil = fila.profiles as unknown as { email: string | null, full_name: string | null } | null
      const propio = asignados.find(asignacion => asignacion.ambassadorId === fila.id) ?? null

      return {
        ambassadorId: fila.id,
        email: perfil?.email ?? '',
        fullName: perfil?.full_name ?? null,
        assignedTypeId: propio?.commissionTypeId ?? null,
        effectiveTypeName: typeForAmbassador(tipos, asignados, fila.id)?.name ?? null,
        assignedAt: fechas.get(fila.id) ?? null,
      }
    })

    return { tipos, asignaciones: asignaciones_ }
  })

  const tipos = computed(() => consulta.data.value?.tipos ?? [])
  const asignaciones = computed(() => consulta.data.value?.asignaciones ?? [])
  const disponibles = computed(() => activeTypes(tipos.value))
  const predeterminado = computed(() => defaultType(tipos.value))

  async function crear(draft: CommissionTypeDraft): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('create_commission_type', {
      name: draft.name.trim(),
      kind: draft.kind,
      amount: draft.amount ?? undefined,
      basis_points: draft.basisPoints ?? undefined,
      make_default: draft.makeDefault ?? false,
    })
    if (error) {
      return { ok: false, clave: 'referrals.commission.errors.create_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function marcarPredeterminado(commissionTypeId: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('set_default_commission_type', { commission_type: commissionTypeId })
    if (error) {
      return { ok: false, clave: 'referrals.commission.errors.default_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function activar(commissionTypeId: string, activo: boolean): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('set_commission_type_active', {
      commission_type: commissionTypeId,
      active: activo,
    })
    if (error) {
      return { ok: false, clave: 'referrals.commission.errors.active_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-52.4 · `null` retira la asignación y devuelve al Embajador al predeterminado. */
  async function asignar(ambassadorId: string, commissionTypeId: string | null): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('assign_commission_type', {
      ambassador: ambassadorId,
      commission_type: commissionTypeId ?? undefined,
    })
    if (error) {
      return { ok: false, clave: 'referrals.commission.errors.assign_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    tipos,
    disponibles,
    predeterminado,
    asignaciones,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    crear,
    marcarPredeterminado,
    activar,
    asignar,
  }
}
