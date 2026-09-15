# HU-17 — Permisos completos del Admin sobre el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

> **Revisión 2026-09-09 (D-33):** la unidad de reserva es la semana completa; «reserva» aquí significa semana confirmada. Las excepciones a la regla de temporada alta se refieren a los intercambios de HU-12 RF-12.6.
> **Revisión 2026-09-15 (D-43):** el Administrador tiene además una bolsa de renta operable, donde ve las semanas disponibles y por qué lo están.

## Historia
Como Administrador de Propiedad, quiero tener permisos completos sobre el calendario de cada propiedad que administro (crear, editar, bloquear, reasignar), para resolver conflictos de agendamiento.

## Requisitos funcionales
- **RF-17.1** — El Administrador puede crear, editar, bloquear y reasignar reservas en los calendarios de sus propiedades; sus acciones priman sobre reservas de propietarios.
- **RF-17.2** — Toda acción que modifique o mueva una reserva de un Propietario dispara automáticamente el aviso previo al afectado (vía HU-16) antes o junto con el cambio — nunca un cambio silencioso.
- **RF-17.3** — La reasignación mantiene las invariantes del motor (HU-12): sin solapamientos y respetando la regla de temporada alta (HU-14) salvo decisión explícita del Administrador, que queda registrada con motivo.
- **RF-17.4** — Toda acción administrativa sobre el calendario queda auditada (acción, motivo, reserva afectada, autor, fecha).
- **RF-17.5** — **La bolsa de renta es una lista operable (D-43).** El Administrador ve, por propiedad y año, las semanas disponibles para renta con su temporada, su sábado de entrada y **por qué están ahí**: liberada por la fracción N, cancelada, caducada a 60 días, reubicada (HU-59) o no elegida por nadie. Desde esa lista renta a un tercero (HU-39). Las liberadas se distinguen de las demás porque su renta no es de la propiedad sino de la fracción que las soltó (D-39), y esa diferencia debe ser visible antes de colocarlas.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-17.1** — Dada una reasignación de la reserva del Propietario P, entonces se emite el aviso a P y queda el registro de auditoría.
- **CA-17.2** — Dada una reasignación que generaría solapamiento, entonces se rechaza.
- **CA-17.3** — Dada una excepción a la regla de temporada alta sin motivo, entonces se rechaza; con motivo, procede y queda auditada.
- **CA-17.4** — Dado un Administrador sin la propiedad asignada, entonces ninguna acción de calendario le es permitida.
- **CA-17.5** — Dada una propiedad con una semana liberada por la fracción 3/8 y otra caducada a 60 días, entonces la bolsa de renta del Administrador lista ambas con su motivo y su fracción de origen, marcando la liberada como atribuible a la 3/8 y la caducada como prorrateable entre las ocho.

## Dependencias
- HU-12/HU-14/HU-15 (motor y reglas) · HU-16 (avisos) · HU-39/HU-40 (renta a terceros e ingreso) · HU-21 (alerta de semanas por colocar).
