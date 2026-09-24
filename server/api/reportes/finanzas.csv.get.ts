import { agregarReporte, csvDelReporte, filtroDesdeQuery } from '#shared/finance/reportes'

/**
 * HU-25 · RF-25.2, RF-25.5 · DT-11 — la exportación del reporte a CSV.
 *
 * Misma guarda y misma carga que la vista (CA-25.4): el archivo contiene
 * exactamente las filas del reporte con los filtros de la query, serializadas
 * por la función pura de `shared/`. El BOM va delante para que las hojas de
 * cálculo lean bien los acentos; no forma parte del dato.
 */
export default defineEventHandler(async (event) => {
  const { comoSuperadmin } = await exigirSuperadmin(event)
  const { entradas } = await cargarEntradasDeReporte(comoSuperadmin)
  const filtro = filtroDesdeQuery(getQuery(event))
  const csv = csvDelReporte(agregarReporte(entradas, filtro))

  const sufijo = [filtro.desde, filtro.hasta].filter(Boolean).join('_')
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="reporte-financiero${sufijo ? `-${sufijo}` : ''}.csv"`)
  setHeader(event, 'Cache-Control', 'no-store')
  // El BOM se construye por código para que ningún editor ni linter lo confunda con un espacio.
  return `${String.fromCodePoint(0xFEFF)}${csv}`
})
