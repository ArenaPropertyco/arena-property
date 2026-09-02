# HU-56 — Solicitud y aprobación de retiro

Épica E11 · Sprint 4 · SP 8 · Prioridad **Should** · Rol: Embajador / Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-01](../../docs/decisions.md), [D-06](../../docs/decisions.md) y [D-20](../../docs/decisions.md).

## Historia
Como Embajador, quiero solicitar el retiro de mi saldo disponible y que el Superadmin lo apruebe y registre el pago, para cobrar efectivamente mis ganancias.

## Requisitos funcionales
- **RF-56.1** — **Retiro parcial (D-06):** el Embajador indica cuánto retirar; el monto debe ser mayor o igual al **mínimo configurable** por el Superadmin (valor inicial **$200.000**) y menor o igual a su saldo **disponible**. El saldo `en gracia` nunca es retirable.
- **RF-56.2** — Ciclo: `Solicitada` → `Aprobada` → `Pagada`, o `Solicitada` → `Rechazada` (con motivo obligatorio). Máquina de estados pura con transiciones explícitas.
- **RF-56.3** — El saldo disponible se descuenta **al aprobarse**; el rechazo no descuenta. No pueden coexistir dos solicitudes abiertas del mismo Embajador (restricción en base de datos, no solo validación de UI).
- **RF-56.4** — Al registrar el pago, el Superadmin adjunta el comprobante (Supabase Storage) y la solicitud pasa a `Pagada`; el pago usa los datos bancarios de HU-49.
- **RF-56.5** — **El pago no genera egreso nuevo (D-01):** el egreso ya se devengó al acreditarse la comisión (HU-54 RF-54.6); esta transición solo registra el movimiento de tesorería y el de billetera (HU-55).
- **RF-56.6** — Todas las transiciones se auditan (TR-01) y notifican al Embajador (TR-03, HU-57).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-56.1** — Dado un monto por debajo del mínimo, o mayor que el disponible, entonces la solicitud se rechaza con mensaje traducido.
- **CA-56.2** — Dado un saldo disponible de $1.000.000, cuando el Embajador solicita $300.000, entonces la solicitud se acepta y al aprobarse el disponible queda en $700.000.
- **CA-56.3** — Dada la tabla de transiciones, entonces las inválidas (`Pagada` → `Solicitada`, o `Pagada` sin `Aprobada`) se rechazan.
- **CA-56.4** — Dado un rechazo, entonces el disponible no cambia y el motivo queda registrado.
- **CA-56.5** — Dada una solicitud abierta, cuando se intenta crear otra, entonces se rechaza.
- **CA-56.6** — Dado el paso a `Pagada` sin comprobante, entonces se rechaza.
- **CA-56.7** — Dado un retiro pagado, entonces **no** existe un segundo egreso en el libro de plataforma por ese mismo dinero.

## Dependencias
- TR-01, TR-02, TR-03 (habilitadores) · HU-55 (saldos) · HU-49 (datos bancarios) · HU-54 (devengo) · HU-57 (notificaciones).
