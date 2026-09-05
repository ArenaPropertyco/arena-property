import type { CopAmount } from '#shared/money/importe'
import { puede } from '#shared/permissions/mapa'
import type { EstadoComercial, Visibilidad } from '#shared/properties/estados'
import { resolverDetalle } from '#shared/properties/detalle'
import type { PropiedadPublicada, ResolucionDeDetalle } from '#shared/properties/detalle'
import { BUCKET_DE_PROPIEDADES, esModelo3D } from '#shared/properties/medios'
import type { MedioConUrl } from '#shared/properties/vistas'
import type { Database } from '#shared/types/database.types'

/**
 * HU-02 · RF-02.1…RF-02.6 — la ficha pública de una propiedad por su slug.
 *
 * La RLS decide si la fila llega: al Visitante no le llega un borrador y la página
 * responde 404; a quien la administra sí, y se muestra como vista previa (RF-02.1).
 * `resolverDetalle` traduce eso a un estado; aquí solo se consulta y se firma.
 */

const VIGENCIA_DE_FIRMA = 3600

export function usePropiedadPublica(slug: Ref<string>) {
  const client = useSupabaseClient<Database>()
  const { roles } = useCuenta()

  const puedeGestionar = computed(() => puede(roles.value, 'gestionar_propiedades'))

  const consulta = useAsyncData<PropiedadPublicada | null>(
    () => `propiedad-publica-${slug.value}`,
    async () => {
      if (!slug.value) {
        return null
      }

      const vista = await client.from('property_overview').select('*').eq('slug', slug.value).maybeSingle()
      if (!vista.data?.id) {
        return null
      }
      const id = vista.data.id

      const [ficha, medios] = await Promise.all([
        client.from('properties').select('description, amenities, address, video_url').eq('id', id).maybeSingle(),
        client.from('property_media').select('*').eq('property_id', id).order('sort_order'),
      ])

      const rutas = (medios.data ?? []).map(medio => medio.path)
      const firmas = rutas.length === 0
        ? { data: [] }
        : await client.storage.from(BUCKET_DE_PROPIEDADES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
      const urlPorRuta = new Map((firmas.data ?? []).map(firma => [firma.path ?? '', firma.signedUrl ?? '']))

      const conUrl = (medios.data ?? []).map<MedioConUrl>(medio => ({
        id: medio.id,
        kind: medio.kind,
        path: medio.path,
        position: medio.sort_order,
        url: urlPorRuta.get(medio.path) ?? '',
      }))
      const fotos = conUrl.filter(medio => medio.kind === 'photo')

      return {
        id,
        slug: vista.data.slug ?? slug.value,
        name: vista.data.name ?? '',
        region: vista.data.region ?? '',
        city: vista.data.city ?? '',
        country: vista.data.country ?? '',
        visibility: (vista.data.visibility ?? 'draft') as Visibilidad,
        commercial: (vista.data.commercial_status ?? 'coming_soon') as EstadoComercial,
        lowestPrice: vista.data.lowest_available_price === null || vista.data.lowest_available_price === undefined
          ? null
          : Number(vista.data.lowest_available_price) as CopAmount,
        availableFractions: Number(vista.data.available_fractions ?? 0),
        fractionCount: Number(vista.data.fraction_count ?? 0),
        soldFractions: Number(vista.data.sold_fractions ?? 0),
        photoUrl: fotos[0]?.url ?? null,
        areaM2: Number(vista.data.area_m2 ?? 0),
        bedrooms: Number(vista.data.bedrooms ?? 0),
        bathrooms: Number(vista.data.bathrooms ?? 0),
        parkingSpots: Number(vista.data.parking_spots ?? 0),
        description: ficha.data?.description ?? '',
        amenities: ficha.data?.amenities ?? [],
        address: ficha.data?.address ?? null,
        videoUrl: ficha.data?.video_url ?? null,
        fotos,
        plano: conUrl.find(medio => medio.kind === 'floor_plan' && !esModelo3D(medio.path)) ?? null,
        modelo: conUrl.find(medio => medio.kind === 'floor_plan' && esModelo3D(medio.path)) ?? null,
        video: conUrl.find(medio => medio.kind === 'video') ?? null,
      }
    },
    { watch: [slug] },
  )

  const resolucion = computed<ResolucionDeDetalle>(() =>
    resolverDetalle(consulta.data.value ?? null, { puedeGestionar: puedeGestionar.value }))

  return {
    resolucion,
    propiedad: computed(() => resolucion.value.estado === 'no_encontrada' ? null : resolucion.value.propiedad),
    pendiente: consulta.pending,
    /** La página lo espera en su setup para poder responder 404 de verdad (CA-02.2). */
    esperar: async () => {
      await consulta
    },
  }
}
