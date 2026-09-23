import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntradaDeReporte } from '#shared/finance/reportes'
import { importeDeBase } from '#shared/finance/reportes'
import type { ClaseDeMovimiento } from '#shared/finance/maestra'
import type { Database } from '#shared/types/database.types'

/**
 * HU-25 · RF-25.1, RF-25.3 · D-01 — las entradas del reporte, leídas bajo la RLS
 * del Superadmin.
 *
 * Una sola carga sirve a la vista (JSON) y al archivo (CSV) para que los dos
 * salgan de las mismas filas (CA-25.4). Los dos libros vienen de dos tablas y
 * llegan marcados: `movements` es el libro de cada propiedad y
 * `platform_ledger` el de Arena; ninguno se mezcla con el otro. Lo anulado y lo
 * reversado no entra: no es dinero que haya quedado.
 */

export interface ReporteCargado {
  entradas: EntradaDeReporte[]
  propiedades: { id: string, name: string }[]
  administradores: { id: string, label: string }[]
}

interface Nombre {
  name: string | null
}

export async function cargarEntradasDeReporte(client: SupabaseClient<Database>): Promise<ReporteCargado> {
  const [movimientos, libro, asignaciones, propiedades] = await Promise.all([
    client
      .from('movements')
      .select('id, property_id, kind, amount, incurred_on, expense_categories(name), payment_methods(name), properties(name)')
      .is('voided_at', null)
      .order('incurred_on', { ascending: false }),
    client
      .from('platform_ledger')
      .select('id, property_id, kind, amount, accrued_on, expense_categories(name), properties(name)')
      .is('reversed_at', null)
      .order('accrued_on', { ascending: false }),
    client.from('property_admins').select('admin_id, property_id').is('revoked_at', null),
    client.from('properties').select('id, name').order('name'),
  ])

  const adminsPorPropiedad = new Map<string, string[]>()
  for (const fila of asignaciones.data ?? []) {
    adminsPorPropiedad.set(fila.property_id, [...(adminsPorPropiedad.get(fila.property_id) ?? []), fila.admin_id])
  }
  const adminIds = [...new Set((asignaciones.data ?? []).map(fila => fila.admin_id))]
  const perfiles = adminIds.length === 0
    ? { data: [] }
    : await client.from('profiles').select('id, email, full_name').in('id', adminIds)
  const administradores = (perfiles.data ?? [])
    .map(perfil => ({ id: perfil.id, label: perfil.full_name ?? perfil.email ?? perfil.id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

  const nombre = (relacion: unknown): string | null => (relacion as Nombre | null)?.name ?? null

  const entradas: EntradaDeReporte[] = [
    ...(movimientos.data ?? []).map<EntradaDeReporte>(fila => ({
      id: fila.id,
      libro: 'property',
      propertyId: fila.property_id,
      propertyName: nombre(fila.properties),
      adminIds: adminsPorPropiedad.get(fila.property_id) ?? [],
      kind: fila.kind as ClaseDeMovimiento,
      amount: importeDeBase(fila.amount),
      categoryName: nombre(fila.expense_categories) ?? '',
      paymentMethodName: nombre(fila.payment_methods),
      incurredOn: fila.incurred_on,
    })),
    ...(libro.data ?? []).map<EntradaDeReporte>(fila => ({
      id: fila.id,
      libro: 'platform',
      propertyId: fila.property_id,
      propertyName: nombre(fila.properties),
      adminIds: fila.property_id ? adminsPorPropiedad.get(fila.property_id) ?? [] : [],
      kind: fila.kind as ClaseDeMovimiento,
      amount: importeDeBase(fila.amount),
      categoryName: nombre(fila.expense_categories) ?? '',
      paymentMethodName: null,
      incurredOn: fila.accrued_on,
    })),
  ]

  return {
    entradas,
    propiedades: (propiedades.data ?? []).map(fila => ({ id: fila.id, name: fila.name })),
    administradores,
  }
}
