# HU-20 — Historial de semanas del Propietario

Épica E5 · Sprint 3 · SP 3 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

> **Revisión 2026-09-15 (D-42, D-43):** el historial es de **semanas**, no de estadías por noches, e incluye el destino de las que se soltaron.

## Historia
Como Propietario, quiero acceder al historial de mis semanas pasadas y futuras por propiedad, para planificar las próximas y saber qué pasó con las que solté.

## Requisitos funcionales
- **RF-20.1** — Listado de **semanas** propias, pasadas y futuras, con propiedad, fracción, número de semana, sábado de entrada y de salida, temporada y estado: elegida, confirmada, cancelada, liberada, caducada o rentada a un tercero (D-42).
- **RF-20.2** — Filtros combinables por propiedad y rango de fechas; orden cronológico (futuras primero).
- **RF-20.3** — El filtrado/orden es lógica pura en composable; el Propietario solo ve semanas de sus fracciones (RLS).
- **RF-20.4** — **El destino de lo soltado (D-43).** Una semana liberada figura con su estado real: en la bolsa de renta o rentada a un tercero, y en ese caso con el ingreso atribuido a la fracción (HU-40). Sin renta no se muestra importe.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-20.1** — Dado un filtro propiedad + rango de fechas, entonces el resultado cumple ambos criterios.
- **CA-20.2** — Dadas semanas mixtas, entonces el orden es: futuras ascendentes, luego pasadas descendentes.
- **CA-20.3** — Dadas semanas de otro propietario en la misma propiedad, entonces no aparecen en el listado.

## Dependencias
- HU-14 (uso de semanas) · HU-13 (vista de calendario) · HU-39/HU-40 (renta de la semana liberada).
