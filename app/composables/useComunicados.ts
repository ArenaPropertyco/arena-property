import { esRolSegmentable } from '#shared/notifications/comunicados'
import type { Comunicado, NuevoComunicado, SegmentoDeComunicado } from '#shared/notifications/comunicados'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-31 · RF-31.1, RF-31.3, RF-31.4 — los comunicados globales del Superadmin.
 *
 * Orquesta, no decide: enviar es un `insert` con el segmento declarado; la base
 * lo resuelve a cuentas, lo emite por TR-03 y deja registrado cuántas fueron
 * (RF-31.2, RF-31.3). Que solo el Superadmin pueda hacerlo lo garantiza la RLS
 * (RF-31.4): aquí solo se traduce el rechazo.
 */
export function useComunicados() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()
  const { propiedades } = usePropiedades()

  const consulta = useAsyncData<Comunicado[]>('comunicados', async () => {
    if (!user.value) {
      return []
    }
    const { data } = await client
      .from('broadcasts')
      .select('*, properties:segment_property_id(name)')
      .order('created_at', { ascending: false })

    const autores = [...new Set((data ?? []).map(fila => fila.created_by).filter((valor): valor is string => valor !== null))]
    const perfiles = autores.length === 0
      ? { data: [] }
      : await client.from('profiles').select('id, email, full_name').in('id', autores)
    const etiquetaPorCuenta = new Map((perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]))

    return (data ?? []).map<Comunicado>((fila) => {
      const propiedad = fila.properties as unknown as { name: string } | null
      return {
        id: fila.id,
        title: fila.title,
        body: fila.body,
        segment: segmentoDe(fila.segment_kind, fila.segment_roles, fila.segment_property_id),
        propertyName: propiedad?.name ?? null,
        recipientCount: fila.recipient_count,
        createdAt: fila.created_at,
        createdByLabel: fila.created_by ? etiquetaPorCuenta.get(fila.created_by) ?? null : null,
      }
    })
  }, { watch: [user] })

  const comunicados = computed(() => consulta.data.value ?? [])
  const propiedadesSegmentables = computed(() => propiedades.value.map(propiedad => ({ id: propiedad.id, name: propiedad.name })))

  async function enviar(nuevo: NuevoComunicado): Promise<ResultadoDeEscritura> {
    const segmento = nuevo.segment
    const { error } = await client.from('broadcasts').insert({
      title: nuevo.title,
      body: nuevo.body,
      segment_kind: segmento.kind,
      segment_roles: segmento.kind === 'roles' ? segmento.roles : null,
      segment_property_id: segmento.kind === 'property' ? segmento.propertyId : null,
    })
    if (error) {
      return { ok: false, clave: error.code === '42501' ? 'broadcasts.errors.only_superadmin' : 'broadcasts.errors.send_failed' }
    }
    await consulta.refresh()
    return { ok: true }
  }

  return {
    comunicados,
    propiedadesSegmentables,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    enviar,
  }
}

/** El segmento tal como se guardó, de vuelta al vocabulario del dominio. */
function segmentoDe(kind: string, roles: string[] | null, propertyId: string | null): SegmentoDeComunicado {
  if (kind === 'roles') {
    return { kind: 'roles', roles: (roles ?? []).filter(esRolSegmentable) }
  }
  if (kind === 'property') {
    return { kind: 'property', propertyId: propertyId ?? '' }
  }
  return { kind: 'all' }
}
