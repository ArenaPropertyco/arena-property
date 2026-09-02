# HU-11 — Editar/inactivar propiedad (sin eliminación)

Épica E3 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero editar o inactivar una propiedad que administro, para mantener la información actualizada.

## Requisitos funcionales
- **RF-11.1** — El Administrador edita la ficha completa (HU-08) solo de propiedades que administra.
- **RF-11.2** — **No existe eliminación física** de propiedades: ni endpoint, ni política RLS de DELETE para el Administrador. La baja es lógica (`Inactiva`).
- **RF-11.3** — Inactivar conserva íntegro el histórico de reservas, gastos e inventario, y retira la propiedad del catálogo público.
- **RF-11.4** — Una propiedad `Inactiva` puede reactivarse (`Publicada`) por el mismo flujo de estados de HU-08.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-11.1** — Dado un intento de DELETE de una propiedad por un Administrador, entonces la operación es rechazada por RLS.
- **CA-11.2** — Dada una propiedad inactivada con reservas y gastos históricos, entonces esos registros siguen consultables tras la inactivación.
- **CA-11.3** — Dado un Administrador sin la propiedad asignada, cuando intenta editarla, entonces se rechaza.

## Dependencias
- HU-08 (máquina de visibilidad) · HU-05 (asignación).
