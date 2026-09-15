# HU-16 — Notificación de reserva acotada a mi fracción

Épica E4 · Sprint 2 · SP 3 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

> **Revisión 2026-09-15 (D-43):** liberar una semana también avisa, y su destinatario no es un Propietario sino el Administrador que tiene que colocarla.

## Historia
Como Propietario, quiero recibir una notificación cuando mi reserva sea confirmada o cuando haya un cambio en el calendario de mi propiedad, para estar siempre informado.

## Requisitos funcionales
- **RF-16.1** — Se notifica in-app + email al confirmarse una reserva propia y ante cambios que afecten reservas o semanas de la fracción propia (reasignación HU-17, bloqueo HU-15 que la toque).
- **RF-16.2** — **Acotamiento estricto:** la notificación aplica únicamente a movimientos de la propia fracción; la actividad de otras fracciones no notifica.
- **RF-16.3** — El cálculo de destinatarios de un evento de calendario es una función pura (entrada: evento + fracciones afectadas + propietarios; salida: destinatarios).
- **RF-16.4** — Las notificaciones se emiten y se leen por el canal transversal **TR-03** (D-19), con su garantía de idempotencia.
- **RF-16.5** — **El aviso de semana liberada va al Administrador (D-43).** Liberar una semana (HU-14 RF-14.7c) emite un aviso dirigido al **Administrador de la propiedad** —al Superadmin si no hay ninguno asignado— con la propiedad, la semana, su temporada y la fracción de origen. No es una excepción al acotamiento de RF-16.2: ese acotamiento rige **entre Propietarios**, y el Administrador no recibe el aviso por ser copropietario sino por ser quien debe colocar la semana.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-16.1** — Dado un evento sobre la fracción 2/8, entonces el conjunto de destinatarios es exactamente el propietario de 2/8.
- **CA-16.2** — Dado un evento sobre la fracción 5/8, entonces el propietario de 2/8 no recibe notificación.
- **CA-16.3** — Dada una reserva confirmada, entonces se emiten una notificación in-app y un email, una sola vez.
- **CA-16.4** — Dada la liberación de una semana de la fracción 3/8, entonces el destinatario del aviso es el Administrador de esa propiedad y ningún otro Propietario; sin Administrador asignado, el destinatario es el Superadmin.

## Dependencias
- HU-14 (eventos de semana, incluida la liberación) · HU-17/HU-15 (eventos de cambio) · HU-39 (bolsa de renta) · HU-30 (bandeja).
