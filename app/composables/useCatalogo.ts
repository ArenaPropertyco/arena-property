import type { CopAmount } from '#shared/money/importe'
import type { PropiedadPublica } from '#shared/properties/catalogo-publico'
import type { EstadoComercial, Visibilidad } from '#shared/properties/estados'
import { BUCKET_DE_PROPIEDADES } from '#shared/properties/medios'
import type { Database } from '#shared/types/database.types'

/**
 * HU-01 · RF-01.1, RF-01.2, RF-01.5 — el catálogo público.
 *
 * Se lee sin sesión: la RLS de `properties` solo entrega lo publicado (RF-01.5), así
 * que aquí no se filtra por visibilidad, se confía en la frontera. La foto principal
 * es la primera del orden de la galería, firmada porque el bucket es privado y la
 * política deja firmar lo publicado.
 */

const VIGENCIA_DE_FIRMA = 3600

export function useCatalogo() {
  const client = useSupabaseClient<Database>()

  const consulta = useAsyncData<PropiedadPublica[]>('catalogo-publico', async () => {
    const [vista, fotos] = await Promise.all([
      client.from('property_overview').select('*').order('created_at', { ascending: false }),
      client.from('property_media').select('property_id, path, sort_order').eq('kind', 'photo').order('sort_order'),
    ])

    const portadaPorPropiedad = new Map<string, string>()
    for (const foto of fotos.data ?? []) {
      if (!portadaPorPropiedad.has(foto.property_id)) {
        portadaPorPropiedad.set(foto.property_id, foto.path)
      }
    }

    const rutas = [...portadaPorPropiedad.values()]
    const firmas = rutas.length === 0
      ? { data: [] }
      : await client.storage.from(BUCKET_DE_PROPIEDADES).createSignedUrls(rutas, VIGENCIA_DE_FIRMA)
    const urlPorRuta = new Map((firmas.data ?? []).map(firma => [firma.path ?? '', firma.signedUrl ?? '']))

    return (vista.data ?? [])
      .filter(fila => fila.id && fila.slug)
      .map<PropiedadPublica>((fila) => {
        const portada = portadaPorPropiedad.get(fila.id!)
        return {
          id: fila.id!,
          slug: fila.slug!,
          name: fila.name ?? '',
          region: fila.region ?? '',
          city: fila.city ?? '',
          country: fila.country ?? '',
          visibility: (fila.visibility ?? 'published') as Visibilidad,
          commercial: (fila.commercial_status ?? 'coming_soon') as EstadoComercial,
          lowestPrice: fila.lowest_available_price === null || fila.lowest_available_price === undefined
            ? null
            : Number(fila.lowest_available_price) as CopAmount,
          availableFractions: Number(fila.available_fractions ?? 0),
          fractionCount: Number(fila.fraction_count ?? 0),
          photoUrl: portada ? urlPorRuta.get(portada) ?? null : null,
          areaM2: Number(fila.area_m2 ?? 0),
          bedrooms: Number(fila.bedrooms ?? 0),
          bathrooms: Number(fila.bathrooms ?? 0),
          parkingSpots: Number(fila.parking_spots ?? 0),
        }
      })
  })

  return {
    propiedades: computed(() => consulta.data.value ?? []),
    pendiente: consulta.pending,
    recargar: consulta.refresh,
  }
}
