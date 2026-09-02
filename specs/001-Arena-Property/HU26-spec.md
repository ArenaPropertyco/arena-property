# HU-26 — Gestión de inventario por propiedad

Épica E8 · Sprint 4 · SP 8 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero gestionar el inventario de cada propiedad (mobiliario, equipamiento, insumos), para llevar control de los activos.

## Requisitos funcionales
- **RF-26.1** — CRUD de ítems de inventario asociados a una propiedad específica, con categoría, estado (p. ej. nuevo/bueno/regular/dañado) y cantidad (entero ≥ 0).
- **RF-26.2** — La baja de un ítem es lógica (histórico conservado), coherente con el principio de no-eliminación (HU-11).
- **RF-26.3** — Solo el Administrador asignado gestiona el inventario; el Propietario accede en solo lectura (HU-28) — reflejado en RLS.
- **RF-26.4** — Los cambios de estado/cantidad quedan historizados para trazabilidad.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-26.1** — Dado un ítem con cantidad negativa o sin categoría, entonces la validación lo rechaza.
- **CA-26.2** — Dada la baja lógica de un ítem, entonces deja de listarse como activo pero su histórico persiste.
- **CA-26.3** — Dado un Propietario, cuando intenta crear/editar un ítem, entonces la operación es rechazada (RLS).

## Dependencias
- HU-08 (propiedad) · HU-27 (gastos vinculables a ítems) · HU-28 (lectura).
