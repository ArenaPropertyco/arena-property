# HU-57 — Notificaciones al Embajador

Épica E11 · Sprint 4 · SP 3 · Prioridad **Should** · Rol: Embajador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Embajador, quiero recibir notificaciones cuando un referido cambia de estado o cuando se libera un saldo a mi favor, para estar al tanto de mis ganancias sin revisar la plataforma.

## Requisitos funcionales
- **RF-57.1** — Se notifica in-app + correo en exactamente estos eventos: referido pasa a **En proceso de pago**; referido pasa a **Pago completado** (con el monto acreditado y la fecha en que saldrá de gracia); comisión **pasa a disponible** al cumplirse los 30 días; solicitud de retiro **Aprobada**; solicitud de retiro **Pagada**.
- **RF-57.2** — **Acotamiento estricto:** las notificaciones aplican únicamente a referidos y solicitudes propios del Embajador.
- **RF-57.3** — El mapeo evento → destinatario + plantilla es una función pura de TR-03 (D-19), con plantillas i18n en el idioma del Embajador.
- **RF-57.4** — Cada evento notifica una sola vez (idempotencia compartida con HU-54).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-57.1** — Dado el paso a `Pago completado` de un referido del Embajador E, entonces se genera para E una notificación que incluye el monto liberado.
- **CA-57.2** — Dado un cambio de estado de un referido del Embajador F, entonces E no recibe nada.
- **CA-57.3** — Dado un rechazo de retiro, entonces no se genera notificación de este módulo (solo Aprobada y Pagada notifican; el rechazo se ve en la bandeja de solicitudes).
- **CA-57.4** — Dado el mismo evento procesado dos veces, entonces la notificación se emite una sola vez.

## Dependencias
- HU-51/HU-54 (eventos de referido) · HU-56 (eventos de retiro) · HU-30 (bandeja).
