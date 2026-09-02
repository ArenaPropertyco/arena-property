# HU-28 — Inventario y mantenimiento en solo lectura (Propietario)

Épica E8 · Sprint 4 · SP 3 · Prioridad **Could** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero ver el inventario y el historial de mantenimientos de mi propiedad en modo solo lectura, para estar al tanto del estado del activo.

## Requisitos funcionales
- **RF-28.1** — Vista de solo lectura dentro del dashboard del Propietario con los ítems activos (categoría, estado, cantidad) y el historial de mantenimientos de la propiedad.
- **RF-28.2** — Solo propiedades donde el Propietario tiene fracción; sin acciones de escritura en la UI ni políticas de escritura en RLS.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-28.1** — Dado un Propietario de la propiedad P, entonces ve inventario y mantenimientos de P; de otra propiedad, acceso denegado.
- **CA-28.2** — Dado cualquier intento de escritura de inventario por un Propietario, entonces RLS lo rechaza.
- **CA-28.3** — Dado un ítem dado de baja lógica, entonces no aparece en la vista del Propietario.

## Dependencias
- HU-26/HU-27 (datos) · HU-18 (contenedor).
