# HU-39 — Reserva a terceros (no propietarios)

Épica E4 · Sprint 2 · SP 8 · Prioridad **Should** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-25](../../docs/decisions.md), [D-39](../../docs/decisions.md), [D-42](../../docs/decisions.md) y [D-43](../../docs/decisions.md).

> **Revisión 2026-09-09 (D-33):** la renta a terceros es por semanas completas de la bolsa de renta (semanas liberadas, canceladas, caducadas o no elegidas).
> **Revisión 2026-09-15 (D-42, D-43):** no hay renta por noches sueltas —HU-60 queda eliminada y esas noches son de la bolsa del Administrador— y cada semana liberada se le anuncia al Administrador.

## Historia
Como Administrador de Propiedad, quiero crear una reserva en el calendario de una propiedad para un tercero (no propietario), para generar rentabilidad adicional del inmueble en semanas sin uso.

## Requisitos funcionales
- **RF-39.1** — El Administrador registra al tercero (nombre, documento, contacto) en una base de datos de terceros asociada; un tercero es reutilizable entre reservas.
- **RF-39.2** — La reserva a tercero solo procede sobre **semanas completas de la bolsa de renta**: liberadas voluntariamente, canceladas a más de 30 días, sin confirmar a 60 días (D-14, D-15), liberadas en la ventana de reubicación (HU-59) o no elegidas por nadie. Nunca sobre una semana confirmada por un Propietario ni sobre una bloqueada (HU-15). **No se rentan noches sueltas** (D-42): la unidad es la semana entera, y las noches que caen fuera de la rejilla no se ofrecen.
- **RF-39.2b** — **La semana rentada conserva su origen (D-39).** La reserva a tercero guarda, por la semana que ocupa, de qué fracción salía y **con qué motivo** entró a la bolsa: liberada voluntariamente, cancelada, caducada a 60 días, reubicada (HU-59) o sobrante de la rejilla. Ese par —fracción y motivo— es el único dato con el que HU-40 decide a quién pertenece el ingreso, y se fija al crear la reserva: no se recalcula después.
- **RF-39.5** — Los datos del tercero se guardan con consentimiento explícito y se conservan 5 años, tras los cuales se anonimizan (D-25).
- **RF-39.3** — La reserva a tercero queda tipada como tal (distinta de reserva de propietario y de bloqueo) y enlaza con el ingreso financiero de HU-40.
- **RF-39.4** — Cancelar una reserva a tercero libera la semana y queda auditado.
- **RF-39.6** — **La bolsa se anuncia (D-43).** Cada semana que entra a la bolsa por liberación voluntaria genera el aviso al Administrador (HU-16 RF-16.5) y figura en su lista de semanas disponibles (HU-17 RF-17.5) y en la alerta de su tablero (HU-21 RF-21.1b) hasta que se renta, se bloquea o pasa su fecha.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-39.1** — Dada una semana confirmada por su Propietario, cuando se intenta rentarla a un tercero, entonces se rechaza; dada una semana de la bolsa de renta, se acepta **entera**, sin fraccionar en noches (D-42).
- **CA-39.2** — Dada una reserva a tercero creada, entonces la semana aparece ocupada en la proyección del calendario de HU-13.
- **CA-39.3** — Dado un tercero ya registrado, cuando se crea otra reserva, entonces se reutiliza su registro (sin duplicar por documento).
- **CA-39.4** — Dada la cancelación, entonces la semana vuelve a estar disponible y existe el registro de auditoría.
- **CA-39.5** — Dada una semana que la fracción 3/8 liberó voluntariamente, cuando se crea la reserva a tercero, entonces queda registrada con esa fracción y el motivo «liberada»; dada una semana sobrante de la rejilla, queda sin fracción de origen.
- **CA-39.6** — Dada una semana recién liberada, entonces figura como disponible en la bolsa de renta de esa propiedad con su fracción de origen; rentada o bloqueada, deja de figurar como disponible.

## Dependencias
- HU-12/HU-15 (calendario y bloqueos) · HU-14 (liberación voluntaria) · HU-16/HU-17/HU-21 (aviso, lista y alerta al Administrador) · HU-40 (ingreso asociado) · D-39, D-42, D-43.
