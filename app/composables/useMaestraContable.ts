import type { CategoriaContable, CuentaContable, MaestraContable, MedioDePago } from '#shared/finance/maestra'
import type { Database } from '#shared/types/database.types'

/**
 * HU-23 · RF-23.1 — la maestra contable tal como la ofrece la base.
 *
 * Se trae completa, con las entradas inactivas incluidas: un movimiento antiguo
 * puede referenciar una categoría ya retirada y la lista tiene que poder nombrarla.
 * Qué se ofrece para un gasto nuevo lo filtra `shared/finance/maestra`, no aquí.
 */
export function useMaestraContable() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<MaestraContable>('maestra-contable', async () => {
    const [categorias, medios, cuentas] = await Promise.all([
      client.from('expense_categories').select('id, name, kind, scope, active').order('name'),
      client.from('payment_methods').select('id, code, name, active').order('name'),
      client.from('ledger_accounts').select('id, code, name, active').order('name'),
    ])

    return {
      categorias: (categorias.data ?? []).map<CategoriaContable>(fila => ({
        id: fila.id,
        name: fila.name,
        kind: fila.kind,
        scope: fila.scope,
        active: fila.active,
      })),
      medios: (medios.data ?? []).map<MedioDePago>(fila => ({
        id: fila.id,
        code: fila.code,
        name: fila.name,
        active: fila.active,
      })),
      cuentas: (cuentas.data ?? []).map<CuentaContable>(fila => ({
        id: fila.id,
        code: fila.code,
        name: fila.name,
        active: fila.active,
      })),
    }
  })

  return {
    maestra: computed<MaestraContable>(() => consulta.data.value ?? { categorias: [], medios: [], cuentas: [] }),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
