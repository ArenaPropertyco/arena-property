# HU-54 — Liberación de la comisión y periodo de gracia

Épica E11 · Sprint 3 · SP 8 · Prioridad **Must** · Rol: Embajador (beneficiario) / sistema
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-01](../../docs/decisions.md), [D-02](../../docs/decisions.md), [D-04](../../docs/decisions.md) y [D-10](../../docs/decisions.md).

## Historia
Como Embajador, quiero que se libere automáticamente mi comisión cuando mi referido completa el pago de su fracción, para recibirla sin tener que reclamarla.

## Requisitos funcionales
- **RF-54.1** — **Ciclo del saldo:** `pendiente` (el referido está en proceso de pago, HU-58) → `en gracia` (se completó el pago) → `disponible` (pasaron 30 días desde el pago completo, D-02) → `retirado` (HU-56). Cada transición es un movimiento de billetera auditado (TR-01) y notificado (TR-03).
- **RF-54.2** — Al emitirse el evento `Pago completado` de HU-58 sobre la compra de un referido atribuido, el sistema acredita el monto de la vigencia aplicable a la **fecha de atribución** (HU-52), calculado sobre el **precio pactado** del plan de pagos (D-05), y lo deja **en gracia**.
- **RF-54.3** — **Una sola comisión por prospecto (D-04):** solo la primera compra de fracción de un referido genera comisión; una segunda compra del mismo referido no acredita nada.
- **RF-54.4** — **Idempotencia:** el mismo evento de pago completado no acredita dos veces, aunque se reprocese.
- **RF-54.5** — **Reversa (D-02):** si la compra se anula mientras la comisión está `en gracia`, se reversa con contra-asiento y el saldo vuelve a cero. Si se anula después de la gracia, **no** se reversa: Arena asume la pérdida y queda registrada como tal.
- **RF-54.6** — **Contabilidad (D-01):** la comisión se registra **una sola vez**, por devengo, en el **libro de plataforma** al acreditarse; nunca en la maestra contable de la propiedad y nunca prorrateada a los copropietarios. El pago del retiro (HU-56) solo mueve tesorería y no genera un segundo egreso.
- **RF-54.7** — **Suspensión (D-07):** si el Embajador es suspendido por causa administrativa conserva todo su saldo; si es por fraude o incumplimiento pierde lo `pendiente` y lo `en gracia`, y el Superadmin resuelve sobre lo `disponible` dejando constancia del motivo.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-54.1** — Dado un referido con vigencia V1 que completa el pago, entonces se acredita exactamente el monto de V1 calculado sobre el precio pactado, en estado `en gracia`, y el saldo pendiente baja en ese monto.
- **CA-54.2** — Dado que han pasado 30 días desde el pago completo, entonces el saldo pasa a `disponible`; a los 29 días sigue `en gracia` y no es retirable.
- **CA-54.3** — Dado el mismo evento de pago procesado dos veces, entonces la acreditación ocurre una sola vez.
- **CA-54.4** — Dada una anulación de compra al día 10, entonces la comisión se reversa y el saldo del Embajador vuelve al estado previo; dada una anulación al día 45, el saldo `disponible` no se toca.
- **CA-54.5** — Dada la acreditación, entonces existe exactamente un egreso en el libro de plataforma y **ninguna** cuota prorrateada en la propiedad.
- **CA-54.6** — Dado un referido que compra una segunda fracción, entonces no se acredita una segunda comisión.
- **CA-54.7** — Dado un referido en estado `Registrado` (sin compra), entonces no existe saldo pendiente, en gracia ni disponible por él.
- **CA-54.8** — Dada una suspensión por fraude, entonces se cancelan lo pendiente y lo en gracia y queda el registro con motivo; dada una administrativa, el saldo se conserva íntegro.

## Dependencias
- TR-01, TR-02 (habilitadores) · HU-58 (evento de pago y anulación) · HU-51 (atribución) · HU-52 (vigencia) · HU-55 (billetera) · HU-25 (libro de plataforma) · HU-33 (suspensión).
