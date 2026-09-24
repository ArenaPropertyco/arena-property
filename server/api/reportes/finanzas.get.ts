/**
 * HU-25 · RF-25.1, RF-25.5 — las entradas del reporte financiero, para la vista.
 *
 * Solo el Superadmin llega aquí (`exigirSuperadmin`, 403 para el resto). Se lee
 * con su propio cliente, bajo RLS: el libro de plataforma solo lo ve él y los
 * movimientos le llegan de todas las propiedades. La agregación no se hace aquí:
 * la vista filtra y suma con `shared/finance/reportes`, igual que el archivo.
 */
export default defineEventHandler(async (event) => {
  const { comoSuperadmin } = await exigirSuperadmin(event)
  return cargarEntradasDeReporte(comoSuperadmin)
})
