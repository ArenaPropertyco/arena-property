import { BUCKET_DE_ADJUNTOS, rutaDeAdjunto } from '#shared/finance/mantenimiento'
import type { NuevoMovimiento } from '#shared/finance/movimientos'
import type { MovimientoListado } from '#shared/finance/vistas'
import type { CopAmount } from '#shared/money/importe'
import type { CategoriaDeInventario, EntradaDeHistorial, EstadoDeItem, ItemDeInventario, NuevoItem } from '#shared/properties/inventario'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/** Una hora: la factura se abre desde la pantalla, no se archiva el enlace. */
const VIGENCIA_DE_FIRMA = 3600

/**
 * HU-26 · RF-26.1…RF-26.4 · HU-27 · RF-27.1…RF-27.3 · HU-28 · RF-28.1 — el
 * inventario de una propiedad, su histórico y sus mantenimientos.
 *
 * Orquesta, no decide: la RLS entrega todo el inventario a quien gestiona la
 * propiedad —Superadmin o Administrador asignado (D-45)— y al copropietario solo
 * lo activo (CA-28.3); el histórico lo escribe la base en cada
 * cambio (RF-26.4); dar de baja pasa por `retire_inventory_item`, que exige el
 * motivo (RF-26.2). Un mantenimiento se registra como cualquier gasto de HU-23,
 * con su ítem y su factura, y la base genera las 8 cuotas (RF-27.2).
 */
export function useInventario(propiedadId: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData(
    () => `inventario-${propiedadId.value}`,
    async () => {
      if (!propiedadId.value) {
        return null
      }

      const [propiedad, items, historial, movimientos] = await Promise.all([
        client.from('properties').select('id, name').eq('id', propiedadId.value).maybeSingle(),
        client.from('inventory_items').select('*').eq('property_id', propiedadId.value)
          .order('retired_at', { ascending: true, nullsFirst: true }).order('name'),
        client.from('inventory_history').select('*').eq('property_id', propiedadId.value)
          .order('changed_at', { ascending: false }),
        client.from('movements')
          .select('*, expense_categories(name), payment_methods(name), ledger_accounts(name), fractions(number), inventory_items(name)')
          .eq('property_id', propiedadId.value)
          .eq('maintenance', true)
          .order('incurred_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (!propiedad.data) {
        return null
      }

      const cuentas = [...new Set((historial.data ?? []).map(fila => fila.changed_by).filter((valor): valor is string => valor !== null))]
      const perfiles = cuentas.length === 0
        ? { data: [] }
        : await client.from('profiles').select('id, email, full_name').in('id', cuentas)
      const etiquetaPorCuenta = new Map((perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]))

      // CA-27.3 · la factura se sirve con URL firmada de una hora; sin ella, sin enlace.
      const rutas = (movimientos.data ?? []).map(fila => fila.attachment_path).filter((ruta): ruta is string => ruta !== null)
      const firmadas = rutas.length === 0
        ? { data: [] }
        : await client.storage.from(BUCKET_DE_ADJUNTOS).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
      const urlPorRuta = new Map((firmadas.data ?? []).map(firma => [firma.path ?? '', firma.signedUrl]))

      return {
        propiedad: { id: propiedad.data.id, name: propiedad.data.name },
        items: (items.data ?? []).map<ItemDeInventario>(fila => ({
          id: fila.id,
          propertyId: fila.property_id,
          name: fila.name,
          category: fila.category as CategoriaDeInventario,
          condition: fila.condition as EstadoDeItem,
          quantity: fila.quantity,
          location: fila.location,
          notes: fila.notes,
          createdAt: fila.created_at,
          updatedAt: fila.updated_at,
          retiredAt: fila.retired_at,
          retireReason: fila.retire_reason,
        })),
        historial: (historial.data ?? []).map<EntradaDeHistorial>(fila => ({
          id: fila.id,
          itemId: fila.item_id,
          field: fila.field as EntradaDeHistorial['field'],
          previous: fila.previous,
          next: fila.next,
          changedAt: fila.changed_at,
          changedByLabel: fila.changed_by ? etiquetaPorCuenta.get(fila.changed_by) ?? null : null,
          note: fila.note,
        })),
        mantenimientos: (movimientos.data ?? []).map<MovimientoListado>(fila => ({
          id: fila.id,
          propertyId: fila.property_id,
          kind: fila.kind,
          amount: fila.amount as CopAmount,
          categoryName: fila.expense_categories?.name ?? '',
          paymentMethodName: fila.payment_methods?.name ?? '',
          accountName: fila.ledger_accounts?.name ?? '',
          incurredOn: fila.incurred_on,
          description: fila.description,
          allocation: fila.allocation,
          fractionNumber: fila.fractions?.number ?? null,
          commissionBasisPoints: fila.commission_basis_points,
          commissionAmount: fila.commission_amount as CopAmount | null,
          weekIndex: null,
          weekStartsOn: null,
          createdAt: fila.created_at,
          voidedAt: fila.voided_at,
          voidReason: fila.void_reason,
          maintenance: fila.maintenance,
          inventoryItemId: fila.inventory_item_id,
          inventoryItemName: fila.inventory_items?.name ?? null,
          attachmentPath: fila.attachment_path,
          attachmentUrl: fila.attachment_path ? urlPorRuta.get(fila.attachment_path) ?? null : null,
        })),
      }
    },
    { watch: [propiedadId] },
  )

  const items = computed(() => consulta.data.value?.items ?? [])
  const historial = computed(() => consulta.data.value?.historial ?? [])
  const mantenimientos = computed(() => consulta.data.value?.mantenimientos ?? [])

  /** RF-26.4 · el histórico de un ítem, tal como la base lo dejó. */
  function historialDe(item: string): EntradaDeHistorial[] {
    return historial.value.filter(entrada => entrada.itemId === item)
  }

  async function registrarItem(nuevo: NuevoItem): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('inventory_items').insert({
      property_id: nuevo.propertyId,
      name: nuevo.name,
      category: nuevo.category,
      condition: nuevo.condition,
      quantity: nuevo.quantity,
      location: nuevo.location,
      notes: nuevo.notes,
    })
    if (error) {
      return { ok: false, clave: 'inventory.errors.save_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-26.4 · cambiar estado o cantidad deja rastro en el histórico; lo escribe la base. */
  async function actualizarItem(item: string, cambios: NuevoItem): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('inventory_items').update({
      name: cambios.name,
      category: cambios.category,
      condition: cambios.condition,
      quantity: cambios.quantity,
      location: cambios.location,
      notes: cambios.notes,
    }).eq('id', item)
    if (error) {
      return { ok: false, clave: 'inventory.errors.save_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-26.2 · baja lógica con motivo; el histórico se conserva y todo queda auditado. */
  async function darDeBaja(item: string, motivo: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('retire_inventory_item', { item, reason: motivo })
    if (error) {
      return { ok: false, clave: 'inventory.errors.retire_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  /**
   * RF-27.1 · RF-27.2 · registra el mantenimiento como un gasto de HU-23, con su
   * ítem y su factura. Si el gasto no entra, la factura recién subida no queda
   * huérfana.
   */
  async function registrarMantenimiento(nuevo: NuevoMovimiento, archivo: File | null): Promise<ResultadoDeEscritura & { id?: string }> {
    let ruta: string | null = null
    if (archivo) {
      ruta = rutaDeAdjunto(nuevo.propertyId, archivo.name, crypto.randomUUID())
      const subida = await client.storage.from(BUCKET_DE_ADJUNTOS).upload(ruta, archivo)
      if (subida.error) {
        return { ok: false, clave: 'finance.errors.attachment_failed' }
      }
    }

    const { data, error } = await client
      .from('movements')
      .insert({
        property_id: nuevo.propertyId,
        kind: nuevo.kind,
        amount: nuevo.amount,
        category_id: nuevo.categoryId,
        payment_method_id: nuevo.paymentMethodId,
        account_id: nuevo.accountId,
        incurred_on: nuevo.incurredOn,
        description: nuevo.description,
        allocation: nuevo.allocation,
        fraction_id: nuevo.fractionId,
        maintenance: true,
        inventory_item_id: nuevo.inventoryItemId ?? null,
        attachment_path: ruta,
      })
      .select('id')
      .single()

    if (error || !data) {
      if (ruta) {
        await client.storage.from(BUCKET_DE_ADJUNTOS).remove([ruta])
      }
      const mensaje = error?.message ?? ''
      return {
        ok: false,
        clave: /CA-23\.[36]/.test(mensaje)
          ? 'finance.errors.category_rejected'
          : /RF-27\.1/.test(mensaje) ? 'finance.validation.item_not_in_property' : 'finance.errors.save_failed',
      }
    }

    await consulta.refresh()
    return { ok: true, id: data.id }
  }

  return {
    propiedad: computed(() => consulta.data.value?.propiedad ?? null),
    items,
    historialDe,
    mantenimientos,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    registrarItem,
    actualizarItem,
    darDeBaja,
    registrarMantenimiento,
  }
}
