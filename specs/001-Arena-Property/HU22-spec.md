# HU-22 — Buscador de propiedades del Administrador

Épica E6 · Sprint 2 · SP 2 · Prioridad **Could** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero filtrar y buscar entre las propiedades que administro, para encontrar rápidamente la que necesito gestionar.

## Requisitos funcionales
- **RF-22.1** — Buscador por texto (nombre/ubicación) sobre las propiedades asignadas, insensible a mayúsculas y acentos.
- **RF-22.2** — Filtros por región y estado (visibilidad y comercial), combinables con el texto; reutiliza el composable de filtrado de HU-01/HU-10.
- **RF-22.3** — La búsqueda nunca retorna propiedades no asignadas.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-22.1** — Dado el término "cartagena", entonces coincide con "Cartagena" y "CARTAGENA" (normalización).
- **CA-22.2** — Dado texto + región + estado, entonces el resultado cumple los tres criterios.
- **CA-22.3** — Dado un término que coincide con una propiedad no asignada, entonces esta no aparece.

## Dependencias
- HU-21 (contenedor) · HU-05 (asignación).
