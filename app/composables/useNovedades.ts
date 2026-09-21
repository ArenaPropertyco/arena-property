import { cambiarVisibilidad as cambiarVisibilidadEnMemoria, esUrgencia, estadoDeNovedad, filtrarNovedades, filtroDeNovedadesVacio, ordenarNovedades, resolverNovedad } from '#shared/notifications/novedades'
import type { FiltroDeNovedades, FraccionDestinataria, Novedad, NuevaNovedad } from '#shared/notifications/novedades'
import { propiedadesGestionadas } from '#shared/properties/asignaciones'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-29 · RF-29.1, RF-29.3, RF-29.5, RF-29.6 · HU-30 · RF-30.1, RF-30.3 — el
 * historial de novedades de quien mira, y publicar, resolver y activar para quien
 * gestiona.
 *
 * Orquesta, no decide: la RLS entrega a cada cuenta las novedades de las
 * propiedades que gestiona, o las activas de las que es copropietaria y que le
 * van dirigidas (D-46); publicar es un `insert` y la base notifica a quien toque
 * (RF-29.2, RF-29.5); resolver pasa por `resolve_announcement` y el estado por
 * `set_announcement_active`, que la base reserva al Superadmin (RF-29.6). Orden,
 * filtro y estado son funciones puras de `shared/`.
 */
export function useNovedades() {
  const client = useSupabaseClient<Database>()
  const { user, roles, idDeCuenta } = useCuenta()
  const { propiedades: todas } = usePropiedades()

  const consulta = useAsyncData<Novedad[]>('novedades', async () => {
    if (!user.value) {
      return []
    }
    const { data } = await client
      .from('announcements')
      .select('*, properties(name), fractions(number)')
      .order('created_at', { ascending: false })

    const autores = [...new Set((data ?? []).map(fila => fila.created_by).filter((valor): valor is string => valor !== null))]
    const perfiles = autores.length === 0
      ? { data: [] }
      : await client.from('profiles').select('id, email, full_name').in('id', autores)
    const etiquetaPorCuenta = new Map((perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]))

    return (data ?? []).flatMap<Novedad>((fila) => {
      if (!esUrgencia(fila.urgency)) {
        return []
      }
      const propiedad = fila.properties as unknown as { name: string } | null
      const fraccion = fila.fractions as unknown as { number: number } | null
      return [{
        id: fila.id,
        propertyId: fila.property_id,
        propertyName: propiedad?.name ?? null,
        fractionId: fila.fraction_id,
        fractionNumber: fraccion?.number ?? null,
        active: fila.active,
        title: fila.title,
        body: fila.body,
        urgency: fila.urgency,
        createdAt: fila.created_at,
        createdByLabel: fila.created_by ? etiquetaPorCuenta.get(fila.created_by) ?? null : null,
        resolvedAt: fila.resolved_at,
        status: estadoDeNovedad({ resolvedAt: fila.resolved_at }),
      }]
    })
  }, { watch: [user] })

  const novedades = computed(() => ordenarNovedades(consulta.data.value ?? []))
  const filtro = ref<FiltroDeNovedades>(filtroDeNovedadesVacio())
  const filtradas = computed(() => filtrarNovedades(novedades.value, filtro.value))

  /** RF-29.1 · sobre cuáles puede publicar quien mira: las que gestiona de verdad (CA-05.2). */
  const propiedadesGestionables = computed(() => propiedadesGestionadas(todas.value, {
    id: idDeCuenta.value,
    esSuperadmin: roles.value.includes('superadmin'),
  }).map(propiedad => ({ id: propiedad.id, name: propiedad.name })))

  /** RF-29.5 · las fracciones vendidas de las propiedades gestionadas, con su titular, para dirigir una novedad. */
  const fracciones = useAsyncData<FraccionDestinataria[]>(
    () => `novedades-fracciones-${propiedadesGestionables.value.map(propiedad => propiedad.id).join(',')}`,
    async () => {
      const ids = propiedadesGestionables.value.map(propiedad => propiedad.id)
      if (ids.length === 0) {
        return []
      }
      const { data } = await client
        .from('fractions')
        .select('id, property_id, number, owner_id')
        .in('property_id', ids)
        .eq('status', 'sold')
        .order('number')
      const titulares = [...new Set((data ?? []).map(fila => fila.owner_id).filter((valor): valor is string => valor !== null))]
      const perfiles = titulares.length === 0
        ? { data: [] }
        : await client.from('profiles').select('id, email, full_name').in('id', titulares)
      const etiquetaPorCuenta = new Map((perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]))

      return (data ?? []).map<FraccionDestinataria>(fila => ({
        id: fila.id,
        propertyId: fila.property_id,
        number: fila.number,
        ownerId: fila.owner_id,
        ownerLabel: fila.owner_id ? etiquetaPorCuenta.get(fila.owner_id) ?? null : null,
      }))
    },
    { watch: [propiedadesGestionables] },
  )

  /** RF-30.3 · para el filtro: las gestionadas y las que aparecen en el historial, sin repetir. */
  const propiedadesDelFiltro = computed(() => {
    const vistas = new Map<string, string>(propiedadesGestionables.value.map(propiedad => [propiedad.id, propiedad.name]))
    for (const novedad of novedades.value) {
      if (!vistas.has(novedad.propertyId)) {
        vistas.set(novedad.propertyId, novedad.propertyName ?? novedad.propertyId)
      }
    }
    return [...vistas].map(([id, name]) => ({ id, name }))
  })

  async function publicar(nueva: NuevaNovedad): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('announcements').insert({
      property_id: nueva.propertyId,
      fraction_id: nueva.fractionId,
      title: nueva.title,
      body: nueva.body,
      urgency: nueva.urgency,
      active: nueva.active,
    })
    if (error) {
      return { ok: false, clave: claveDeError(error.code, error.message, 'announcements.errors.publish_failed') }
    }
    await consulta.refresh()
    return { ok: true }
  }

  async function resolver(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('resolve_announcement', { announcement: id })
    if (error) {
      return { ok: false, clave: 'announcements.errors.resolve_failed' }
    }
    // Se refleja al instante con la misma regla pura y se confirma con la base.
    const ahora = new Date().toISOString()
    consulta.data.value = (consulta.data.value ?? []).map(novedad => novedad.id === id ? resolverNovedad(novedad, ahora) : novedad)
    await consulta.refresh()
    return { ok: true }
  }

  /** RF-29.6 · activar o desactivar; la base rechaza a quien no sea Superadmin. */
  async function cambiarVisibilidad(id: string, active: boolean): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('set_announcement_active', { announcement: id, active })
    if (error) {
      return { ok: false, clave: claveDeError(error.code, error.message, 'announcements.errors.visibility_failed') }
    }
    consulta.data.value = (consulta.data.value ?? []).map(novedad => novedad.id === id ? cambiarVisibilidadEnMemoria(novedad, active) : novedad)
    await consulta.refresh()
    return { ok: true }
  }

  return {
    novedades,
    filtradas,
    filtro,
    propiedadesGestionables,
    propiedadesDelFiltro,
    fracciones: computed(() => fracciones.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    publicar,
    resolver,
    cambiarVisibilidad,
  }
}

/** El rechazo de la base, traducido: quién no puede, qué regla no se cumplió. */
function claveDeError(codigo: string | undefined, mensaje: string, porDefecto: string): string {
  if (codigo === '42501') {
    return 'announcements.errors.not_allowed'
  }
  if (mensaje.includes('RF-29.6')) {
    return 'announcements.errors.only_superadmin_sets_state'
  }
  if (mensaje.includes('RF-29.5')) {
    return 'announcements.validation.fraction_not_in_property'
  }
  return porDefecto
}
