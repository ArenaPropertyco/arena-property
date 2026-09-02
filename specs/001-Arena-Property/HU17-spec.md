# HU-17 — Permisos completos del Admin sobre el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero tener permisos completos sobre el calendario de cada propiedad que administro (crear, editar, bloquear, reasignar), para resolver conflictos de agendamiento.

## Requisitos funcionales
- **RF-17.1** — El Administrador puede crear, editar, bloquear y reasignar reservas en los calendarios de sus propiedades; sus acciones priman sobre reservas de propietarios.
- **RF-17.2** — Toda acción que modifique o mueva una reserva de un Propietario dispara automáticamente el aviso previo al afectado (vía HU-16) antes o junto con el cambio — nunca un cambio silencioso.
- **RF-17.3** — La reasignación mantiene las invariantes del motor (HU-12): sin solapamientos y respetando la regla de temporada alta (HU-14) salvo decisión explícita del Administrador, que queda registrada con motivo.
- **RF-17.4** — Toda acción administrativa sobre el calendario queda auditada (acción, motivo, reserva afectada, autor, fecha).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-17.1** — Dada una reasignación de la reserva del Propietario P, entonces se emite el aviso a P y queda el registro de auditoría.
- **CA-17.2** — Dada una reasignación que generaría solapamiento, entonces se rechaza.
- **CA-17.3** — Dada una excepción a la regla de temporada alta sin motivo, entonces se rechaza; con motivo, procede y queda auditada.
- **CA-17.4** — Dado un Administrador sin la propiedad asignada, entonces ninguna acción de calendario le es permitida.

## Dependencias
- HU-12/HU-14/HU-15 (motor y reglas) · HU-16 (avisos).
