# HU-58 — Plan de pagos de la fracción

Épica E2 · Sprint 1 · SP 8 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-10](../../docs/decisions.md) y [D-05](../../docs/decisions.md).
🆕 Historia nueva: cubre el vacío detectado en el QA (el estado `Pago completado` disparaba comisiones sin ningún dato que lo respaldara).

## Historia
Como Administrador de Propiedad, quiero registrar los abonos que hace un comprador contra el precio de su fracción, para que el estado de pago sea un dato trazable y no un interruptor manual.

## Requisitos funcionales
- **RF-58.1** — Al cerrarse una compra (HU-06) se crea un **plan de pagos** con el **precio pactado**, que queda congelado como snapshot: cambios posteriores al precio de lista de la fracción (HU-09) no lo alteran. Es la base de la comisión porcentual (HU-52, D-05).
- **RF-58.2** — El Administrador registra **abonos** con fecha, monto (entero COP, TR-02), medio de pago (maestra de HU-23) y comprobante adjunto en Supabase Storage. El comprobante es obligatorio.
- **RF-58.3** — **Los estados se derivan, no se marcan:** `Reservada` (sin abonos) → `En proceso de pago` (0 < abonado < precio pactado) → `Pago completado` (abonado = precio pactado). La derivación es una función pura sobre el plan y sus abonos.
- **RF-58.4** — Un abono que haría superar el precio pactado se rechaza; la diferencia se resuelve corrigiendo el abono o el plan, nunca con sobrepago silencioso.
- **RF-58.5** — Un abono no se elimina: se anula con motivo, lo que recalcula el estado derivado y queda auditado (TR-01).
- **RF-58.6** — Al alcanzarse `Pago completado` se emite **una sola vez** el evento de pago completado que consumen HU-06 y HU-54; la emisión es idempotente aunque el estado se recalcule muchas veces.
- **RF-58.7** — **Interruptor de calendario (D-31):** el derecho de uso de la fracción es un estado **derivado** del plan, nunca marcado a mano: `inactivo` mientras el plan no esté en `Pago completado`, `activo` en cuanto lo derive. La activación es idempotente, se audita (TR-01) y se notifica al Propietario (TR-03).
- **RF-58.8** — **Anulación de la compra:** el Superadmin puede anular una compra con motivo; el calendario se desactiva, la titularidad se revierte, la fracción vuelve a `disponible`, sus estadías futuras se cancelan y sus noches pasan a la bolsa de renta (HU-39). El plan queda anulado y se emite el evento de reversa que consume HU-54 (dentro de la gracia revierte la comisión; fuera de ella, no — D-02).
- **RF-58.9** — El Propietario ve su propio plan de pagos y sus abonos en modo lectura desde su dashboard (HU-18), con el saldo pendiente y qué falta para activar su calendario; el Superadmin los ve todos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-58.1** — Dado un plan de $100.000.000 sin abonos, entonces el estado derivado es `Reservada`; con un abono de $30.000.000, `En proceso de pago`; con abonos que suman $100.000.000, `Pago completado`.
- **CA-58.2** — Dado un abono que superaría el precio pactado, entonces se rechaza y el estado no cambia.
- **CA-58.3** — Dada la anulación de un abono que había completado el pago, entonces el estado vuelve a `En proceso de pago` y queda el registro de auditoría con motivo.
- **CA-58.4** — Dado que el estado se recalcula tres veces sobre un plan ya completado, entonces el evento de pago completado se emite una sola vez.
- **CA-58.5** — Dado un cambio posterior del precio de lista de la fracción, entonces el precio pactado del plan no cambia.
- **CA-58.6** — Dado un abono sin comprobante, entonces se rechaza.
- **CA-58.7** — Dada la anulación de una compra, entonces el calendario queda inactivo, la fracción vuelve a `disponible`, sus estadías futuras se cancelan, el plan queda anulado y se emite exactamente un evento de reversa.
- **CA-58.8** — Dado un plan que pasa a `Pago completado`, entonces el calendario de la fracción queda `activo`; dado un abono anulado que lo devuelve a `En proceso de pago`, el calendario vuelve a `inactivo`.
- **CA-58.9** — Dado el mismo plan recalculado varias veces estando completo, entonces la activación se emite una sola vez.

## Dependencias
- TR-01 y TR-02 (habilitadores) · HU-06 (cierre de compra) · HU-09 (fracción) · HU-23 (medios de pago) · alimenta HU-52, HU-53, HU-54.
