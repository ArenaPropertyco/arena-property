# HU-19 — Utilidades y gastos prorrateados del Propietario

Épica E5 · Sprint 3 · SP 8 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero ver mis utilidades y gastos prorrateados por propiedad dentro de mi dashboard, para entender el rendimiento y costo de mi inversión.

## Requisitos funcionales
- **RF-19.1** — Desglose por propiedad de gastos comunes e ingresos prorrateados a la fracción (1/8 de cada movimiento de HU-23/HU-40), agrupado por categoría de la maestra.
- **RF-19.2** — Histórico mensual navegable: total de ingresos, total de gastos y neto por mes; la agregación mensual es una función pura.
- **RF-19.3** — Cada línea enlaza al detalle del cálculo (HU-24).
- **RF-19.4** — Cifras en IBM Plex Mono; ningún valor estimado sin etiqueta (RT-08); el Propietario solo ve sus fracciones (RLS).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-19.1** — Dado un conjunto de movimientos del mes, cuando se agrega, entonces ingresos, gastos y neto coinciden con el cálculo manual y neto = ingresos − gastos.
- **CA-19.2** — Dado un gasto de $80.000 en la propiedad, entonces la línea del Propietario muestra $10.000 (1/8) exactos.
- **CA-19.3** — Dado un mes sin movimientos, entonces el histórico muestra ceros, no huecos.

## Dependencias
- HU-23 (gastos y maestra) · HU-40 (ingresos por terceros) · HU-24 (detalle).
