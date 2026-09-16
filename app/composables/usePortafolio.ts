import { hoy as hoyDe } from '#shared/dates/formato'
import { tarjetasDelPortafolio } from '#shared/finance/portafolio'
import type { Copropietario, TarjetaDeFraccion } from '#shared/finance/portafolio'
import type { Database } from '#shared/types/database.types'

/**
 * HU-18 · RF-18.1…RF-18.5 — el portafolio del Propietario: una tarjeta por
 * fracción con lo que otras historias ya saben de ella.
 *
 * Orquesta: junta las fracciones propias (HU-13), sus planes de pago (HU-58), su
 * estado de cuenta (HU-19), sus semanas (HU-20) y los copropietarios de cada
 * propiedad (D-16), y se lo pasa a `shared/finance/portafolio`, que arma las
 * tarjetas. Cada dato lo acota la RLS de su tabla: aquí no se decide quién ve qué.
 */
export function usePortafolio() {
  const client = useSupabaseClient<Database>()
  const { fracciones, pendiente: cargandoFracciones } = useFraccionesPropias()
  const { planes } = usePlanesPropios()
  const { lineas } = useEstadoDeCuenta()
  const { semanas } = useHistorialDeSemanas()

  const hoy = computed(() => hoyDe())
  const propiedades = computed(() => [...new Set(fracciones.value.map(fraccion => fraccion.propertyId))])

  const copropietarios = useAsyncData<(Copropietario & { propertyId: string })[]>(
    'portafolio-copropietarios',
    async () => {
      const listas = await Promise.all(propiedades.value.map(async (propiedad) => {
        const { data } = await client.rpc('copropietarios_de', { propiedad })
        return (data ?? []).map(fila => ({ propertyId: propiedad, fraction: fila.fraction_number, name: fila.owner_name }))
      }))
      return listas.flat()
    },
    { watch: [propiedades] },
  )

  const tarjetas = computed<TarjetaDeFraccion[]>(() => tarjetasDelPortafolio(
    fracciones.value.map(fraccion => ({
      id: fraccion.id,
      number: fraccion.number,
      propertyId: fraccion.propertyId,
      propertyName: fraccion.propertyName,
      calendarActive: fraccion.calendarActive,
    })),
    {
      semanas: semanas.value,
      lineas: lineas.value,
      planes: planes.value.map(plan => ({ fractionId: plan.fractionId, id: plan.id, status: plan.status, balance: plan.balance })),
      copropietarios: copropietarios.data.value ?? [],
      hoy: hoy.value,
    },
  ))

  return {
    tarjetas,
    pendiente: cargandoFracciones,
  }
}
