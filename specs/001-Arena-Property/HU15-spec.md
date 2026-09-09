# HU-15 — Admin bloquea semanas en el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).
> **Revisión 2026-09-09 (D-33):** los bloqueos son por semanas completas de la rejilla.

## Historia
Como Administrador de Propiedad, quiero marcar semanas como bloqueadas en el calendario de una propiedad, para evitar su uso en esas fechas.

## Requisitos funcionales
- **RF-15.1** — Bloqueo manual **por semanas** (una o más semanas de la rejilla) con motivo obligatorio, solo sobre propiedades administradas.
- **RF-15.2** — Un bloqueo impide confirmar la semana a su fracción (HU-14) y rentarla a terceros (HU-39) mientras esté vigente.
- **RF-15.3** — El bloqueo es visible con su motivo para todos los propietarios de esa propiedad (HU-13).
- **RF-15.4** — Si la semana bloqueada ya estaba confirmada por su fracción, el bloqueo no la elimina: se registra el conflicto para el flujo de reasignación de HU-17.
- **RF-15.5** — Crear y levantar bloqueos queda auditado (quién, cuándo, motivo).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-15.1** — Dado un bloqueo sin motivo, entonces la validación lo rechaza.
- **CA-15.2** — Dada una semana bloqueada, cuando su Propietario intenta confirmarla, entonces se rechaza.
- **CA-15.3** — Dado un bloqueo sobre una semana ya confirmada, entonces la confirmación persiste y se genera el conflicto para HU-17, indicando la semana.
- **CA-15.4** — Dado un Administrador sin la propiedad asignada, entonces no puede bloquear (RLS).

## Dependencias
- HU-12 (calendario) · interactúa con HU-14, HU-17, HU-39.
