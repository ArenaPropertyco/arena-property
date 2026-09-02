# HU-27 — Gastos de mantenimiento

Épica E8 · Sprint 4 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero registrar gastos de mantenimiento asociados a un ítem o a la propiedad en general, para llevar trazabilidad de costos.

## Requisitos funcionales
- **RF-27.1** — Gasto de mantenimiento con categoría (de la maestra HU-23), monto, fecha y foto/factura opcional (Supabase Storage); asociable a un ítem de inventario (HU-26) o a la propiedad en general.
- **RF-27.2** — Todo gasto de mantenimiento **es** un gasto del módulo financiero (HU-23): se prorratea entre las 8 fracciones y aparece en HU-19/HU-24/HU-25 — un solo modelo de gasto, no dos.
- **RF-27.3** — Desde el ítem se consulta su historial de mantenimientos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-27.1** — Dado un gasto de mantenimiento de $80.000, entonces genera las 8 cuotas de HU-23 y aparece en el desglose del Propietario.
- **CA-27.2** — Dado un gasto asociado al ítem I, entonces el historial de I lo incluye; uno general no aparece en ningún ítem.
- **CA-27.3** — Dado un adjunto de factura, entonces queda vinculado al gasto y accesible solo a roles permitidos.

## Dependencias
- HU-23 (modelo de gasto y maestra) · HU-26 (ítems).
