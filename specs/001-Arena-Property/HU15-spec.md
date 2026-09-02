# HU-15 — Admin bloquea días en el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero marcar días como "ocupado" o "bloqueado" en el calendario de una propiedad, para evitar reservas en esas fechas.

## Requisitos funcionales
- **RF-15.1** — Bloqueo manual **por noches** (una o más, la misma unidad del calendario) con motivo obligatorio, solo sobre propiedades administradas. Al operar todo en noches desaparece la ambigüedad de bloquear parte de una semana.
- **RF-15.2** — Un bloqueo impide nuevas reservas de propietarios (HU-14) y de terceros (HU-39) en ese rango.
- **RF-15.3** — El bloqueo es visible con su motivo para todos los propietarios de esa propiedad (HU-13).
- **RF-15.4** — Si el rango colisiona con una reserva existente, el bloqueo no la elimina: se gestiona por el flujo de reasignación de HU-17.
- **RF-15.5** — Crear y levantar bloqueos queda auditado (quién, cuándo, motivo).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-15.1** — Dado un bloqueo sin motivo, entonces la validación lo rechaza.
- **CA-15.2** — Dado un rango bloqueado, cuando un Propietario intenta reservar dentro, entonces se rechaza.
- **CA-15.3** — Dado un bloqueo que solapa noches de una estadía declarada, entonces la estadía persiste y se genera el conflicto para HU-17, indicando exactamente qué noches colisionan.
- **CA-15.4** — Dado un Administrador sin la propiedad asignada, entonces no puede bloquear (RLS).

## Dependencias
- HU-12 (calendario) · interactúa con HU-14, HU-17, HU-39.
