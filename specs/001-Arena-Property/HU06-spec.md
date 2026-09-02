# HU-06 — Invitar comprador como Propietario de una fracción

Épica E2 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero invitar a un comprador como Propietario de una fracción específica, para darle acceso a su dashboard una vez cerrada la compra.

## Requisitos funcionales
- **RF-06.1** — La invitación por correo vincula al Usuario invitado con la fracción X de la propiedad Y; solo sobre propiedades que el Administrador administra y fracciones en estado `disponible` o `reservada` (HU-09).
- **RF-06.2** — **Titularidad al cerrar la compra (D-31):** al aceptar la invitación y cerrarse la compra, la fracción pasa a `vendida`, queda asignada a su titular y el Usuario obtiene el rol `Propietario` de inmediato. El **derecho de uso no se activa aquí**: depende del interruptor de calendario de HU-58.
- **RF-06.3** — Al cerrarse la compra se crea el **plan de pagos** de HU-58, que es quien deriva los estados `Reservada` → `En proceso de pago` → `Pago completado` y emite el evento que dispara HU-54 (D-10). Esta historia no marca estados de pago a mano.
- **RF-06.4** — Si el comprador tiene atribución de referido (HU-51), la atribución se arrastra a la compra.
- **RF-06.5** — Una fracción `vendida` no admite nueva invitación.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-06.1** — Dado un Administrador sin la propiedad Y asignada, cuando invita sobre Y, entonces se rechaza.
- **CA-06.2** — Dada una compra cerrada sobre la fracción X, entonces el rol del comprador incluye `Propietario`, la fracción queda `vendida`, su vínculo apunta al comprador y su calendario queda **inactivo**.
- **CA-06.3** — Dado el cierre de compra de la fracción X, entonces se crea su plan de pagos (HU-58) con el precio pactado, y el calendario de la fracción permanece inactivo hasta que ese plan derive `Pago completado`.
- **CA-06.4** — Dada una fracción `vendida`, cuando se intenta invitar de nuevo, entonces se rechaza.

## Dependencias
- HU-09 (estados de fracción) · HU-05 (asignación) · **HU-58 (plan de pagos)** · HU-51/HU-54 (atribución y comisión).
