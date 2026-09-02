# HU-55 — Billetera del Embajador

Épica E11 · Sprint 4 · SP 5 · Prioridad **Must** · Rol: Embajador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-02](../../docs/decisions.md) y [D-20](../../docs/decisions.md).

## Historia
Como Embajador, quiero ver mi billetera con lo que tengo pendiente, en gracia, disponible y ganado, para saber cuánto he ganado y cuánto puedo retirar hoy.

## Requisitos funcionales
- **RF-55.1** — Dashboard con **cuatro cifras** claramente diferenciadas (D-02): **saldo pendiente** (referidos en proceso de pago), **saldo en gracia** (comisión liberada, aún no retirable, con la fecha en que se habilita), **saldo disponible** para retiro y **total ganado histórico**. Nunca se presenta lo pendiente ni lo en gracia como disponible (RT-08).
- **RF-55.2** — Los cuatro saldos se **derivan** del histórico de movimientos (comisión acreditada, paso a disponible, reversa, retiro solicitado, retiro pagado, ajuste auditado) con una función pura de agregación; no se almacenan como contadores editables.
- **RF-55.3** — Listado de movimientos con tipo, fecha, referido asociado y monto, orden descendente, con filtro por tipo y periodo.
- **RF-55.4** — Acceso desde el menú principal para cualquier cuenta con rol Embajador; cada Embajador ve solo su billetera. El **Superadmin ve la billetera de cualquier Embajador** en modo lectura, porque debe aprobar sus retiros (D-20).
- **RF-55.5** — Importes según TR-02 (entero COP, formato de RF-D.5, IBM Plex Mono).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-55.1** — Dado un histórico conocido, entonces los cuatro saldos coinciden con el cálculo manual y se cumple: disponible = acreditado − en gracia − retirado − reversado.
- **CA-55.2** — Dada una comisión acreditada hoy, entonces suma al saldo **en gracia** y no al disponible, y la UI muestra la fecha en que pasará a disponible.
- **CA-55.3** — Dada una reversa dentro de la gracia, entonces el saldo en gracia baja y el total ganado histórico se ajusta en consecuencia.
- **CA-55.4** — Dado un retiro pagado, entonces aparece como movimiento y el disponible baja en ese monto.
- **CA-55.5** — Dada la billetera de otro Embajador, entonces un Embajador no accede y el Superadmin sí, en modo lectura.

## Dependencias
- TR-02 (habilitador) · HU-54 (acreditaciones y gracia) · HU-56 (retiros) · HU-49 (rol).
