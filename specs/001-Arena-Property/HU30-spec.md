# HU-30 — Historial de novedades del Propietario

Épica E9 · Sprint 4 · SP 3 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero recibir y ver un historial de las novedades publicadas sobre mis propiedades, para no perder información importante.

## Requisitos funcionales
- **RF-30.1** — La bandeja, su modelo y su canal viven en **TR-03** (D-19), disponible para cualquier rol. Esta historia cubre la **vista del Propietario** sobre esa bandeja: novedades de sus propiedades (HU-29) y avisos de su fracción (HU-16).
- **RF-30.2** — Marcar como leída es por notificación y por usuario; "marcar todas" disponible.
- **RF-30.3** — El Propietario solo ve notificaciones dirigidas a él (RLS); filtro por propiedad.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-30.1** — Dadas 3 notificaciones no leídas, cuando se marca 1 como leída, entonces el contador pasa a 2 solo para ese usuario.
- **CA-30.2** — Dado el filtro por propiedad P, entonces solo aparecen notificaciones ligadas a P.
- **CA-30.3** — Dada una notificación dirigida a otro propietario, entonces no es visible ni marcable.

## Dependencias
- HU-16/HU-29/HU-57 (fuentes de notificaciones).
