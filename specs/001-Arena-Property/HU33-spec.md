# HU-33 — Suspender/reactivar cuentas

Épica E10 · Sprint 4 · SP 3 · Prioridad **Should** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero suspender o reactivar cuentas de administradores, propietarios o embajadores, para mantener el control de acceso a la plataforma.

## Requisitos funcionales
- **RF-33.1** — Suspensión con motivo obligatorio; el usuario suspendido pierde acceso inmediato a toda ruta privada (middleware + RLS evalúan el estado de la cuenta).
- **RF-33.2** — Si el suspendido es Embajador, su código queda inhabilitado y no genera nuevas atribuciones (HU-51).
- **RF-33.3** — **La suspensión se tipifica (D-07):** `administrativa` (conserva todo su saldo y puede retirarlo) o `por incumplimiento o fraude` (pierde lo pendiente y lo en gracia, y el Superadmin resuelve sobre lo disponible dejando constancia). El tipo es obligatorio junto con el motivo.
- **RF-33.4** — Suspender a un Propietario no cancela sus semanas ya confirmadas; el Administrador decide caso por caso y la decisión queda auditada.
- **RF-33.5** — La reactivación restaura el acceso y, si aplica, rehabilita el código de referido.
- **RF-33.6** — Suspensión y reactivación quedan auditadas (TR-01); solo el Superadmin ejecuta estas acciones.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-33.1** — Dada una suspensión sin motivo, entonces se rechaza.
- **CA-33.2** — Dada una cuenta suspendida, cuando accede a una ruta privada, entonces es denegada/redirigida.
- **CA-33.3** — Dado un código de referido de un Embajador suspendido, cuando un prospecto ingresa con él, entonces no se crea atribución.
- **CA-33.4** — Dada la reactivación, entonces el acceso y el código vuelven a operar y la auditoría registra ambos eventos.
- **CA-33.5** — Dada una suspensión administrativa, entonces el Embajador conserva sus cuatro saldos; dada una por fraude, pierde pendiente y en gracia y queda constancia de la decisión sobre lo disponible.

## Dependencias
- HU-07 (roles) · HU-51 (atribución) · HU-05/HU-49 (cuentas alcanzadas).
