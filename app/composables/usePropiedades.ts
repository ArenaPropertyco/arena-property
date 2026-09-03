import { cambiosDeAsignacion, hayCambios } from '#shared/properties/asignaciones'
import type { FichaTecnica } from '#shared/properties/ficha'
import type { Visibilidad } from '#shared/properties/estados'
import type { PropiedadDelPanel } from '#shared/properties/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-08 · RF-08.1, RF-08.2 y HU-10 · RF-10.1 — listado y alta de propiedades.
 *
 * Orquesta: consulta, escribe y deja el resultado en la forma que la interfaz
 * espera. No decide quién ve qué —eso es de la RLS (DT-05)— ni valida la ficha
 * —eso es de `shared/properties/ficha.ts`—.
 *
 * Se lee de `property_overview` y no de `properties`: la vista trae el estado
 * comercial ya derivado y los conteos de fracciones, de modo que ninguna pantalla
 * tiene que recomponerlos ni puede equivocarse al hacerlo (DT-04).
 */

export type ResultadoDeEscritura = { ok: true } | { ok: false, clave: string }

export function usePropiedades() {
  const client = useSupabaseClient<Database>()
  const { user } = useCuenta()

  const consulta = useAsyncData<PropiedadDelPanel[]>('propiedades', async () => {
    const [vista, asignaciones] = await Promise.all([
      client.from('property_overview').select('*').order('name'),
      client.from('property_admins').select('admin_id, property_id').is('revoked_at', null),
    ])

    const adminsPorPropiedad = new Map<string, string[]>()
    for (const fila of asignaciones.data ?? []) {
      adminsPorPropiedad.set(
        fila.property_id,
        [...(adminsPorPropiedad.get(fila.property_id) ?? []), fila.admin_id],
      )
    }

    const idsDeAdmin = [...new Set([...adminsPorPropiedad.values()].flat())]
    const perfiles = idsDeAdmin.length === 0
      ? { data: [] }
      : await client.from('profiles').select('id, email, full_name').in('id', idsDeAdmin)

    const etiquetaPorAdmin = new Map(
      (perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? null]),
    )

    return (vista.data ?? []).map((fila) => {
      const admins = adminsPorPropiedad.get(fila.id ?? '') ?? []

      return {
        id: fila.id ?? '',
        name: fila.name ?? '',
        region: fila.region ?? '',
        visibility: (fila.visibility ?? 'draft') as Visibilidad,
        // `commercial_status` es null mientras no esté fraccionada; la interfaz lo
        // dice, no lo rellena (principio 9).
        commercial: (fila.commercial_status ?? 'coming_soon') as PropiedadDelPanel['commercial'],
        adminIds: admins,
        adminLabel: admins.map(id => etiquetaPorAdmin.get(id)).find(Boolean) ?? null,
        fractionCount: Number(fila.fraction_count ?? 0),
        availableFractions: Number(fila.available_fractions ?? 0),
      }
    })
  })

  function aFila(ficha: FichaTecnica) {
    return {
      name: ficha.name,
      description: ficha.description,
      area_m2: ficha.areaM2,
      bedrooms: ficha.bedrooms,
      bathrooms: ficha.bathrooms,
      parking_spots: ficha.parkingSpots,
      amenities: ficha.amenities,
      country: ficha.location.country,
      region: ficha.location.region,
      city: ficha.location.city,
      address: ficha.location.address,
      video_url: ficha.videoUrl,
    }
  }

  /**
   * RF-08.6 · el vínculo con el Administrador creador lo hace un disparador de la
   * base, dentro de la misma orden que el `insert`.
   *
   * De ahí que el identificador lo ponga el cliente y no se pida la fila de vuelta:
   * la política de lectura de `properties` depende de esa asignación, y la
   * proyección de un `returning` todavía no la ve, así que Postgres rechazaría la
   * orden entera. La fila se inserta perfectamente; solo no se puede leer en el
   * mismo viaje. Un `uuid` v4 generado aquí es tan válido como el de la base y
   * evita el segundo viaje sin tocar ninguna política.
   */
  async function crear(
    ficha: FichaTecnica,
    administradores: string[] | null = null,
  ): Promise<{ ok: true, id: string } | { ok: false, clave: string }> {
    const id = crypto.randomUUID()

    const { error } = await client.from('properties').insert({ id, ...aFila(ficha) })
    if (error) {
      return { ok: false, clave: 'properties.errors.save_failed' }
    }

    const asignacion = await sincronizarAdministradores(id, administradores)
    if (!asignacion.ok) {
      return asignacion
    }

    await consulta.refresh()
    return { ok: true, id }
  }

  async function actualizar(
    id: string,
    ficha: FichaTecnica,
    administradores: string[] | null = null,
  ): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('properties').update(aFila(ficha)).eq('id', id)
    if (error) {
      return { ok: false, clave: 'properties.errors.save_failed' }
    }

    const asignacion = await sincronizarAdministradores(id, administradores)
    if (!asignacion.ok) {
      return asignacion
    }

    await consulta.refresh()
    return { ok: true }
  }

  /**
   * HU-05 · RF-05.1 y RF-05.2 — deja las asignaciones de la propiedad en la lista
   * que pide el Superadmin.
   *
   * `null` significa «quien llama no gestiona asignaciones»: no se toca nada. Es la
   * diferencia entre un Superadmin que dejó la lista vacía a propósito —y quiere
   * retirar a todos— y un Administrador que ni siquiera vio el control, a quien una
   * lista vacía le retiraría la asignación que le acaba de dar RF-08.6.
   *
   * Se otorga y se retira solo lo que cambió: volver a otorgar una asignación que
   * seguía vigente dejaría en el histórico un retiro que nunca ocurrió.
   */
  async function sincronizarAdministradores(
    propertyId: string,
    deseados: string[] | null,
  ): Promise<ResultadoDeEscritura> {
    if (deseados === null) {
      return { ok: true }
    }

    const vigentes = await client
      .from('property_admins')
      .select('admin_id')
      .eq('property_id', propertyId)
      .is('revoked_at', null)

    const cambio = cambiosDeAsignacion((vigentes.data ?? []).map(fila => fila.admin_id), deseados)
    if (!hayCambios(cambio)) {
      return { ok: true }
    }

    const autor = user.value?.id ?? null

    if (cambio.otorgar.length > 0) {
      const { error } = await client.from('property_admins').insert(
        cambio.otorgar.map(adminId => ({
          admin_id: adminId,
          property_id: propertyId,
          assigned_by: autor,
        })),
      )
      if (error) {
        return { ok: false, clave: 'properties.errors.not_allowed' }
      }
    }

    // RF-05.2 · retirar es marcar la fila vigente; nunca se borra.
    if (cambio.retirar.length > 0) {
      const { error } = await client
        .from('property_admins')
        .update({ revoked_at: new Date().toISOString(), revoked_by: autor })
        .eq('property_id', propertyId)
        .in('admin_id', cambio.retirar)
        .is('revoked_at', null)
      if (error) {
        return { ok: false, clave: 'properties.errors.not_allowed' }
      }
    }

    return { ok: true }
  }

  /**
   * RF-08.2 · el cambio de visibilidad. La transición válida ya la filtró la
   * interfaz y la vuelve a comprobar el disparador de la base: si aun así llega una
   * inválida, se traduce a la clave de error del dominio en vez de mostrar el
   * mensaje de Postgres.
   */
  async function cambiarVisibilidad(id: string, destino: Visibilidad): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('properties').update({ visibility: destino }).eq('id', id)
    if (error) {
      return { ok: false, clave: 'properties.errors.invalid_transition' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-08.3 · sale de «Próximamente» y la derivación toma el mando. */
  async function ponerALaVenta(id: string): Promise<ResultadoDeEscritura> {
    const { error } = await client.from('properties').update({ coming_soon: false }).eq('id', id)
    if (error) {
      return { ok: false, clave: 'properties.errors.invalid_transition' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  return {
    propiedades: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    crear,
    actualizar,
    sincronizarAdministradores,
    cambiarVisibilidad,
    ponerALaVenta,
  }
}
