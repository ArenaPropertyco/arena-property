# HU-25 — Reportes financieros consolidados (Superadmin)

Épica E7 · Sprint 3 · SP 8 · Prioridad **Should** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero ver reportes financieros consolidados de todas las propiedades, para tener visión de negocio global.

## Requisitos funcionales
- **RF-25.1** — Reporte agregable por propiedad, administrador y periodo, a nivel de ingresos y egresos, desglosado por categoría y tipo de pago de la maestra (HU-23).
- **RF-25.2** — Exportación del reporte visible a CSV con los mismos filtros aplicados, generada por una **función pura de serialización en `shared/`** servida por una ruta Nitro, sin dependencia externa (ver [docs/stack.md](../../docs/stack.md)); el escapado de separadores, comillas y saltos de línea es parte de la función.
- **RF-25.3** — **Dos libros separados (D-01):** el **libro de propiedad** (gastos e ingresos prorrateables del inmueble) y el **libro de plataforma** (costos de Arena, entre ellos las comisiones de Embajadores, devengadas al acreditarse en HU-54). El reporte los presenta por separado y solo consolida al nivel de negocio global; una comisión nunca aparece como gasto de una propiedad.
- **RF-25.4** — La agregación es lógica pura testeable; totales cuadrados: suma de desgloses = total del periodo.
- **RF-25.5** — Solo accesible al Superadmin.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-25.1** — Dado un conjunto de movimientos, cuando se agrega por propiedad y periodo, entonces cada celda y los totales coinciden con el cálculo manual.
- **CA-25.2** — Dado el desglose por categoría, entonces su suma es igual al total de ingresos/egresos del filtro.
- **CA-25.3** — Dada una comisión acreditada y luego pagada, entonces aparece **una sola vez** en el libro de plataforma, en el periodo de su devengo, y no figura en el libro de ninguna propiedad.
- **CA-25.4** — Dada la exportación, entonces el archivo contiene exactamente las filas del reporte filtrado, con la misma cabecera y orden que la vista.
- **CA-25.5** — Dado un valor con coma, comilla o salto de línea, entonces la función de serialización lo escapa correctamente y el CSV resultante vuelve a parsearse al mismo dato (ida y vuelta).

## Dependencias
- HU-23 (maestra y movimientos) · HU-40 (ingresos) · HU-54/HU-56 (comisiones).
