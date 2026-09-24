import { hoy } from '#shared/dates/formato'
import { periodoAnterior } from '#shared/finance/billetera'
import { resumenesGlobales } from '#shared/finance/tablero-de-cobros'
import type { FilaGlobal } from '#shared/finance/tablero-de-cobros'
import { propiedadesGestionadas } from '#shared/properties/asignaciones'
import type { Database } from '#shared/types/database.types'
import { cargarEntradaDelTablero } from './useTableroDeCobros'

/**
 * HU-63 · RF-63.8 · CA-63.13 — la vista global de cobros: una fila por
 * propiedad gestionada con el mismo resumen que su tablero.
 *
 * Orquesta, no calcula: carga la entrada del último mes cerrado de cada
 * propiedad con la misma función que usa el tablero, y `resumenesGlobales`
 * arma cada fila con la misma agregación. El Superadmin las ve todas; el
 * Administrador, las suyas (`propiedadesGestionadas`, y la RLS lo repite).
 */
export function useCobrosGlobales() {
  const client = useSupabaseClient<Database>()
  const { propiedades, pendiente: cargandoPropiedades } = usePropiedades()
  const { roles, idDeCuenta } = useCuenta()

  const mes = periodoAnterior(hoy())
  const gestionadas = computed(() => propiedadesGestionadas(propiedades.value, { id: idDeCuenta.value, esSuperadmin: roles.value.includes('superadmin') }))
  const ids = computed(() => gestionadas.value.map(propiedad => propiedad.id))

  const consulta = useAsyncData<FilaGlobal[]>('cobros-globales', async () => {
    if (ids.value.length === 0) {
      return []
    }
    const entradas = await Promise.all(gestionadas.value.map(async propiedad => ({
      propertyId: propiedad.id,
      propertyName: propiedad.name,
      entrada: await cargarEntradaDelTablero(client, propiedad.id, mes, false),
    })))
    return resumenesGlobales(entradas)
  }, { watch: [ids] })

  return {
    mes,
    filas: computed(() => consulta.data.value ?? []),
    pendiente: computed(() => cargandoPropiedades.value || consulta.pending.value),
    recargar: consulta.refresh,
  }
}
