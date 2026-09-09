import {
  filtrarBandeja,
  filtroDeBandejaVacio,
  marcarLeida as marcarLeidaEnMemoria,
  marcarTodasLeidas as marcarTodasEnMemoria,
  noLeidas,
  propiedadesDe,
} from '#shared/notifications/bandeja'
import type { FiltroDeBandeja, ItemDeBandeja } from '#shared/notifications/bandeja'
import { esTipoDeNotificacion } from '#shared/notifications/tipos'
import type { CargaDeNotificacion } from '#shared/notifications/tipos'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * TR-03 · RF-N.5 — la bandeja de quien mira. La RLS de `notification_inbox`
 * entrega solo lo dirigido a la cuenta; marcar pasa por las funciones de la base,
 * que solo tocan la fila propia (CA-N.4). El contador y el filtro son funciones
 * puras de `shared/`; aquí solo se consulta y se refleja.
 */
export function useNotificaciones() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()

  const consulta = useAsyncData<ItemDeBandeja[]>('bandeja', async () => {
    if (!user.value) {
      return []
    }
    const { data } = await client
      .from('notification_inbox')
      .select('*')
      .order('created_at', { ascending: false })

    return (data ?? [])
      .filter(fila => fila.id && esTipoDeNotificacion(fila.kind))
      .map<ItemDeBandeja>(fila => ({
        id: fila.id!,
        notificationId: fila.notification_id ?? '',
        kind: fila.kind as ItemDeBandeja['kind'],
        propertyId: fila.property_id,
        propertyName: fila.property_name,
        payload: (fila.payload ?? {}) as CargaDeNotificacion,
        createdAt: fila.created_at ?? '',
        readAt: fila.read_at,
      }))
  }, { watch: [user] })

  const items = computed(() => consulta.data.value ?? [])
  const filtro = ref<FiltroDeBandeja>(filtroDeBandejaVacio())
  const filtradas = computed(() => filtrarBandeja(items.value, filtro.value))
  const propiedades = computed(() => propiedadesDe(items.value))
  const pendientes = computed(() => noLeidas(items.value))

  async function marcarLeida(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('marcar_leida', { destinatario: id })
    if (error) {
      return { ok: false, clave: 'notifications.messages.failed' }
    }
    // Se refleja al instante con la misma regla pura y se confirma con la base.
    consulta.data.value = marcarLeidaEnMemoria(items.value, id, new Date().toISOString())
    await consulta.refresh()
    return { ok: true }
  }

  async function marcarTodas(): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('marcar_todas_leidas')
    if (error) {
      return { ok: false, clave: 'notifications.messages.failed' }
    }
    consulta.data.value = marcarTodasEnMemoria(items.value, new Date().toISOString())
    await consulta.refresh()
    return { ok: true }
  }

  function limpiarFiltro() {
    filtro.value = filtroDeBandejaVacio()
  }

  return {
    items,
    filtradas,
    filtro,
    propiedades,
    noLeidas: pendientes,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    marcarLeida,
    marcarTodas,
    limpiarFiltro,
  }
}
