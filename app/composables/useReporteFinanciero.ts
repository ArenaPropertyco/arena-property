import { agregarReporte, filasDelReporte, filtroDeReporteVacio, importeDeBase, rutaDeExportacion } from '#shared/finance/reportes'
import type { EntradaDeReporte, FiltroDeReporte } from '#shared/finance/reportes'
import type { ReporteCargado } from '~~/server/utils/reportes'

/**
 * HU-25 · RF-25.1, RF-25.2, RF-25.4, RF-25.5 — el reporte financiero consolidado
 * del Superadmin.
 *
 * Orquesta, no suma: pide las entradas a la ruta Nitro (que ya exigió ser
 * Superadmin y las leyó bajo su RLS), guarda el filtro y deja que
 * `shared/finance/reportes` agregue y arme las filas. La exportación es un
 * enlace a la misma ruta con los mismos filtros, para que archivo y vista no
 * puedan diferir (CA-25.4).
 */
export function useReporteFinanciero() {
  const consulta = useFetch<ReporteCargado>('/api/reportes/finanzas', { key: 'reporte-financiero' })

  const filtro = ref<FiltroDeReporte>(filtroDeReporteVacio())

  // Los importes cruzan la red como números: recuperan su marca de COP aquí, una vez.
  const entradas = computed<EntradaDeReporte[]>(() => (consulta.data.value?.entradas ?? [])
    .map(entrada => ({ ...entrada, amount: importeDeBase(entrada.amount) })))

  const reporte = computed(() => agregarReporte(entradas.value, filtro.value))

  return {
    filtro,
    entradas,
    reporte,
    filas: computed(() => filasDelReporte(reporte.value)),
    propiedades: computed(() => consulta.data.value?.propiedades ?? []),
    administradores: computed(() => consulta.data.value?.administradores ?? []),
    rutaCsv: computed(() => rutaDeExportacion(filtro.value)),
    pendiente: consulta.pending,
    error: computed(() => consulta.error.value !== null && consulta.error.value !== undefined),
    recargar: consulta.refresh,
    limpiar: () => {
      filtro.value = filtroDeReporteVacio()
    },
  }
}
