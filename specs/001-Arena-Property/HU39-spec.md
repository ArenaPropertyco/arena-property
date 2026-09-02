# HU-39 — Reserva a terceros (no propietarios)

Épica E4 · Sprint 2 · SP 8 · Prioridad **Should** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero crear una reserva en el calendario de una propiedad para un tercero (no propietario), para generar rentabilidad adicional del inmueble en semanas sin uso.

## Requisitos funcionales
- **RF-39.1** — El Administrador registra al tercero (nombre, documento, contacto) en una base de datos de terceros asociada; un tercero es reutilizable entre reservas.
- **RF-39.2** — La reserva a tercero solo procede sobre **noches de la bolsa de renta**: liberadas voluntariamente, canceladas a más de 30 días, sin estadía declarada a 60 días (D-14, D-15), liberadas en la ventana de reubicación (HU-59) o sobrantes de la rejilla. Nunca sobre noches con estadía declarada por un Propietario.
- **RF-39.5** — Los datos del tercero se guardan con consentimiento explícito y se conservan 5 años, tras los cuales se anonimizan (D-25).
- **RF-39.3** — La reserva a tercero queda tipada como tal (distinta de reserva de propietario y de bloqueo) y enlaza con el ingreso financiero de HU-40.
- **RF-39.4** — Cancelar una reserva a tercero libera la semana y queda auditado.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-39.1** — Dadas noches con estadía declarada, cuando se intenta rentarlas a un tercero, entonces se rechaza; dadas noches de la bolsa de renta, se acepta con la estadía mínima de su temporada (D-29).
- **CA-39.2** — Dada una reserva a tercero creada, entonces la semana aparece ocupada en la proyección del calendario de HU-13.
- **CA-39.3** — Dado un tercero ya registrado, cuando se crea otra reserva, entonces se reutiliza su registro (sin duplicar por documento).
- **CA-39.4** — Dada la cancelación, entonces la semana vuelve a estar disponible y existe el registro de auditoría.

## Dependencias
- HU-12/HU-15 (calendario y bloqueos) · HU-40 (ingreso asociado).
