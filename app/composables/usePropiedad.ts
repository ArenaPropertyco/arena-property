import type { CopAmount } from '#shared/money/importe'
import type { EstadoDeFraccion } from '#shared/properties/fracciones'
import type { TipoDeMedio } from '#shared/properties/medios'
import { BUCKET_DE_PROPIEDADES, rutaDeMedio, siguienteOrden } from '#shared/properties/medios'
import type { SolicitudDeTraspaso } from '#shared/properties/traspaso'
import type { FraccionListada, MedioConUrl, PropiedadDetallada } from '#shared/properties/vistas'
import type { Database } from '#shared/types/database.types'
import type { ResultadoDeEscritura } from './usePropiedades'

/**
 * HU-08 · RF-08.5 y HU-09 · RF-09.1…RF-09.5 — una propiedad con sus fracciones y
 * sus medios, y las operaciones que caben sobre ellas.
 *
 * Dos cosas que este composable resuelve y ninguna vista debería repetir:
 *
 * 1. **Las URL de los medios son firmadas.** El bucket es privado (RF-08.5), así que
 *    una ruta de Storage no se puede pegar en un `src`. Se piden firmas de una hora;
 *    poder firmarlas ya depende de la política, que es la frontera de verdad.
 *
 * 2. **El traspaso pasa por la función de la base.** `traspasar_fraccion` valida,
 *    mueve al titular y escribe la entrada de auditoría con el destino de reservas y
 *    cuotas en una sola transacción (RF-09.5). Hacerlo desde el cliente en tres pasos
 *    dejaría la auditoría fuera de la operación, contra RF-A.5.
 */

/** Una hora: lo que dura una sesión de trabajo con la galería abierta. */
const VIGENCIA_DE_FIRMA = 3600

export function usePropiedad(id: Ref<string>) {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData(
    () => `propiedad-${id.value}`,
    async () => {
      if (!id.value) {
        return null
      }

      const [propiedad, fracciones, medios, asignaciones] = await Promise.all([
        client.from('properties').select('*').eq('id', id.value).maybeSingle(),
        client.from('fractions').select('*').eq('property_id', id.value).order('number'),
        client.from('property_media').select('*').eq('property_id', id.value).order('sort_order'),
        // HU-05 · RF-05.4 · quién la administra hoy; el formulario las trae marcadas.
        client.from('property_admins').select('admin_id').eq('property_id', id.value).is('revoked_at', null),
      ])

      if (!propiedad.data) {
        return null
      }

      const derivado = await client.rpc('estado_comercial', { propiedad: id.value })

      const administradores = (asignaciones.data ?? []).map(fila => fila.admin_id)

      // Titulares de fracción y administradores asignados se resuelven de una vez:
      // los dos necesitan el mismo nombre visible y son la misma tabla.
      const cuentas = [...new Set([
        ...(fracciones.data ?? [])
          .map(fraccion => fraccion.owner_id)
          .filter((valor): valor is string => valor !== null),
        ...administradores,
      ])]

      const perfiles = cuentas.length === 0
        ? { data: [] }
        : await client.from('profiles').select('id, email, full_name').in('id', cuentas)

      const etiquetaPorCuenta = new Map(
        (perfiles.data ?? []).map(perfil => [perfil.id, perfil.full_name ?? perfil.email ?? perfil.id]),
      )

      const rutas = (medios.data ?? []).map(medio => medio.path)
      const firmas = rutas.length === 0
        ? { data: [] }
        : await client.storage.from(BUCKET_DE_PROPIEDADES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)

      const urlPorRuta = new Map(
        (firmas.data ?? []).map(firma => [firma.path ?? '', firma.signedUrl ?? '']),
      )

      const ficha: PropiedadDetallada = {
        id: propiedad.data.id,
        name: propiedad.data.name,
        region: propiedad.data.region,
        visibility: propiedad.data.visibility,
        commercial: (derivado.data ?? 'coming_soon') as PropiedadDetallada['commercial'],
        commercialDerived: (derivado.data as PropiedadDetallada['commercialDerived']) ?? null,
        adminIds: administradores,
        adminLabel: administradores.map(cuenta => etiquetaPorCuenta.get(cuenta)).find(Boolean) ?? null,
        adminLabels: administradores.map(cuenta => etiquetaPorCuenta.get(cuenta) ?? cuenta),
        fractionCount: (fracciones.data ?? []).length,
        availableFractions: (fracciones.data ?? []).filter(f => f.status === 'available').length,
        description: propiedad.data.description,
        areaM2: Number(propiedad.data.area_m2),
        bedrooms: propiedad.data.bedrooms,
        bathrooms: propiedad.data.bathrooms,
        parkingSpots: propiedad.data.parking_spots,
        amenities: propiedad.data.amenities,
        country: propiedad.data.country,
        city: propiedad.data.city,
        address: propiedad.data.address,
        videoUrl: propiedad.data.video_url,
        comingSoon: propiedad.data.coming_soon,
      }

      return {
        ficha,
        fracciones: (fracciones.data ?? []).map<FraccionListada>(fraccion => ({
          id: fraccion.id,
          propertyId: fraccion.property_id,
          number: fraccion.number,
          listPrice: fraccion.list_price as CopAmount,
          status: fraccion.status,
          ownerId: fraccion.owner_id,
          ownerLabel: fraccion.owner_id ? etiquetaPorCuenta.get(fraccion.owner_id) ?? null : null,
          calendarActive: fraccion.calendar_active,
        })),
        medios: (medios.data ?? []).map<MedioConUrl>(medio => ({
          id: medio.id,
          kind: medio.kind,
          path: medio.path,
          position: medio.sort_order,
          url: urlPorRuta.get(medio.path) ?? '',
        })),
      }
    },
    { watch: [id] },
  )

  const medios = computed(() => consulta.data.value?.medios ?? [])

  /** RF-09.3 · las 8 de una vez, por la función atómica de la base. */
  async function fraccionar(precio: CopAmount): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('fraccionar_propiedad', {
      propiedad: id.value,
      precios: [precio],
    })

    if (error) {
      return { ok: false, clave: 'properties.errors.invalid_fractioning' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  async function cambiarEstadoDeFraccion(
    fraccion: string,
    estado: EstadoDeFraccion,
  ): Promise<ResultadoDeEscritura> {
    // Devolver una vendida a disponible la deja sin titular: la restricción de la
    // base no admite titular sin venta, y arrastrarlo sería un dato falso.
    const cambios = estado === 'available'
      ? { status: estado, owner_id: null }
      : { status: estado }

    const { error } = await client.from('fractions').update(cambios).eq('id', fraccion)
    if (error) {
      return { ok: false, clave: 'properties.errors.invalid_fraction_transition' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-09.5 · D-17 · traspaso auditado, en una sola transacción de la base. */
  async function traspasar(solicitud: SolicitudDeTraspaso): Promise<ResultadoDeEscritura> {
    const { error } = await client.rpc('traspasar_fraccion', {
      fraccion: solicitud.fractionId,
      nuevo_titular: solicitud.newOwnerId,
      destino_reservas: solicitud.bookings ?? '',
      destino_cuotas: solicitud.installments ?? '',
      motivo: solicitud.reason,
    })

    if (error) {
      return { ok: false, clave: 'properties.errors.not_allowed' }
    }

    await consulta.refresh()
    return { ok: true }
  }

  /** RF-08.5 · sube al bucket y registra el medio; si falla el registro, no queda huérfano. */
  async function subirMedios(tipo: TipoDeMedio, archivos: File[]): Promise<ResultadoDeEscritura> {
    let orden = siguienteOrden(medios.value, tipo)

    for (const archivo of archivos) {
      const ruta = rutaDeMedio(id.value, tipo, archivo.name, crypto.randomUUID())

      const subida = await client.storage.from(BUCKET_DE_PROPIEDADES).upload(ruta, archivo)
      if (subida.error) {
        return { ok: false, clave: 'properties.errors.save_failed' }
      }

      const { error } = await client.from('property_media').insert({
        property_id: id.value,
        kind: tipo,
        path: ruta,
        sort_order: orden,
      })

      if (error) {
        // El objeto ya está arriba pero nadie lo referencia: se retira para no dejar
        // basura pagada en el bucket.
        await client.storage.from(BUCKET_DE_PROPIEDADES).remove([ruta])
        return { ok: false, clave: 'properties.errors.save_failed' }
      }

      orden += 1
    }

    await consulta.refresh()
    return { ok: true }
  }

  async function quitarMedio(medioId: string): Promise<ResultadoDeEscritura> {
    const medio = medios.value.find(candidato => candidato.id === medioId)
    if (!medio) {
      return { ok: false, clave: 'properties.errors.save_failed' }
    }

    const { error } = await client.from('property_media').delete().eq('id', medioId)
    if (error) {
      return { ok: false, clave: 'properties.errors.not_allowed' }
    }

    await client.storage.from(BUCKET_DE_PROPIEDADES).remove([medio.path])
    await consulta.refresh()
    return { ok: true }
  }

  return {
    ficha: computed(() => consulta.data.value?.ficha ?? null),
    fracciones: computed(() => consulta.data.value?.fracciones ?? []),
    medios,
    pendiente: consulta.pending,
    recargar: consulta.refresh,
    fraccionar,
    cambiarEstadoDeFraccion,
    traspasar,
    subirMedios,
    quitarMedio,
  }
}
