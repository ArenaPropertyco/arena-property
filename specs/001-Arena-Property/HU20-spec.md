# HU-20 — Historial de reservas del Propietario

Épica E5 · Sprint 3 · SP 3 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero acceder al historial de mis reservas pasadas y futuras por propiedad, para planificar mis próximas estadías.

## Requisitos funcionales
- **RF-20.1** — Listado de estadías propias, pasadas y futuras, con propiedad, fracción, fechas de entrada y salida, número de noches, temporada y estado.
- **RF-20.2** — Filtros combinables por propiedad y rango de fechas; orden cronológico (futuras primero).
- **RF-20.3** — El filtrado/orden es lógica pura en composable; el Propietario solo ve reservas de sus fracciones (RLS).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-20.1** — Dado un filtro propiedad + rango de fechas, entonces el resultado cumple ambos criterios.
- **CA-20.2** — Dadas reservas mixtas, entonces el orden es: futuras ascendentes, luego pasadas descendentes.
- **CA-20.3** — Dadas reservas de otro propietario en la misma propiedad, entonces no aparecen en el listado.

## Dependencias
- HU-14 (reservas) · HU-13 (vista de calendario).
