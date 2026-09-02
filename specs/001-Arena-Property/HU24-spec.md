# HU-24 — Detalle del cálculo prorrateado (gasto e ingreso)

Épica E7 · Sprint 3 · SP 5 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero ver el detalle de cómo se calculó mi cuota prorrateada tanto de un gasto como de un ingreso, para tener transparencia total.

## Requisitos funcionales
- **RF-24.1** — Para cualquier cuota (gasto o ingreso), el detalle muestra: movimiento original (monto, categoría, fecha, propiedad), fórmula aplicada (monto ÷ 8) y monto final de la fracción.
- **RF-24.2** — Si la cuota recibió residuo de división (HU-23), el detalle lo hace explícito.
- **RF-24.3** — El Propietario solo accede al detalle de cuotas de sus propias fracciones (RLS).
- **RF-24.4** — El armado del detalle es una función pura sobre el movimiento y la cuota persistidos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-24.1** — Dada una cuota de gasto, entonces el detalle contiene monto original, fórmula y monto final coherentes (original ÷ 8 ± residuo documentado).
- **CA-24.2** — Dada una cuota de ingreso (renta a terceros, HU-40), entonces el detalle se arma con la misma estructura.
- **CA-24.3** — Dada una cuota de otra fracción, entonces el acceso es denegado.

## Dependencias
- HU-23 (cuotas y maestra) · HU-40 (ingresos) · HU-19 (punto de entrada).
