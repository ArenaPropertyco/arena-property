# TR-01 — Registro de auditoría

Requisito transversal · Sprint 1 (habilitador) · Rol: sistema
Da cumplimiento al principio 9 de [la constitución](../../docs/constitution.md).
**Toda mención de "auditado", "auditable" o "queda registrado" en cualquier `HUXX-spec.md` se implementa según esta spec.**

## Necesidad
La plataforma administra dinero y derechos de uso de terceros: cada operación sensible debe poder reconstruirse después, con autor, momento y motivo.

## Requisitos funcionales
- **RF-A.1** — Existe una tabla única de auditoría con: identificador, marca de tiempo (UTC), autor (cuenta y rol efectivo al momento), acción, entidad afectada (tipo + identificador), propiedad relacionada (si aplica), motivo (texto), y estado anterior/posterior como JSON.
- **RF-A.2** — El registro es **append-only**: sin UPDATE ni DELETE para ningún rol, garantizado por políticas RLS y por la ausencia de esas rutas en la API.
- **RF-A.3** — Son operaciones auditables obligatorias: cambios de rol (HU-07), invitación y cierre de compra de fracción incluido el evento `Pago completado` (HU-06), transiciones de estado de propiedad y fracción (HU-08, HU-09, HU-11), bloqueos y acciones administrativas de calendario (HU-15, HU-17), reservas a terceros y su cancelación (HU-39), alta y anulación de movimientos financieros (HU-23, HU-27, HU-40), atribución de referido (HU-51), cambios de vigencia de comisión (HU-52), liberación de comisión (HU-54), transiciones de retiro (HU-56) y suspensión/reactivación de cuentas (HU-33).
- **RF-A.4** — Cuando la spec de origen exige motivo (HU-15, HU-17, HU-33, HU-56), el registro no se crea sin él.
- **RF-A.5** — La escritura del registro es parte de la **misma transacción** que la operación auditada: si falla la auditoría, la operación se revierte.
- **RF-A.6** — Lectura: el Superadmin ve todo el registro; el Administrador solo el de sus propiedades asignadas; ningún otro rol accede.
- **RF-A.7** — El armado de la entrada (acción, entidad, diff de estados) es una función pura sobre el par (estado anterior, estado posterior).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-A.1** — Dada cada operación de RF-A.3, cuando se ejecuta, entonces existe exactamente una entrada de auditoría con autor, acción y entidad correctos.
- **CA-A.2** — Dado cualquier rol, cuando intenta actualizar o borrar una entrada, entonces RLS lo rechaza.
- **CA-A.3** — Dada una operación que exige motivo y se envía sin él, entonces se rechaza y no queda ni operación ni registro.
- **CA-A.4** — Dado un fallo forzado al escribir la auditoría, entonces la operación de negocio queda revertida (test de atomicidad).
- **CA-A.5** — Dado un Administrador, cuando consulta el registro, entonces solo obtiene entradas de sus propiedades asignadas.
- **CA-A.6** — Dado un par (estado anterior, posterior), entonces la función de diff produce la entrada esperada, sin incluir campos no modificados.

## Dependencias
- Habilitador de HU-06, HU-07, HU-08, HU-09, HU-11, HU-15, HU-17, HU-23, HU-27, HU-33, HU-39, HU-40, HU-51, HU-52, HU-54 y HU-56: debe existir antes que la primera de ellas.
