# HU-05 — Superadmin crea Administradores de Propiedad

Épica E2 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero crear cuentas de Administrador de Propiedad y asignarles propiedades, para delegar la operación diaria.

## Requisitos funcionales
- **RF-05.1** — Solo el Superadmin puede dar de alta Administradores (invitación por correo) y asignarles una o más propiedades.
- **RF-05.2** — La asignación admin↔propiedad es una relación explícita en base de datos; puede agregarse o retirarse sin borrar histórico.
- **RF-05.3** — Las políticas RLS garantizan que un Administrador solo lee/escribe las propiedades asignadas.
- **RF-05.4** — La pantalla lista administradores con sus propiedades asignadas y estado de cuenta (activo/suspendido, HU-33).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-05.1** — Dado un rol distinto de Superadmin, cuando intenta crear un Administrador o asignar propiedades, entonces la operación es rechazada (RLS/guard).
- **CA-05.2** — Dado un Administrador con propiedades A y B asignadas, cuando consulta propiedades, entonces obtiene exactamente A y B.
- **CA-05.3** — Dado que se retira la asignación de B, entonces el Administrador deja de ver B sin pérdida del histórico de B.

## Dependencias
- HU-07 (definición de roles) · HU-08 (propiedades a asignar).
