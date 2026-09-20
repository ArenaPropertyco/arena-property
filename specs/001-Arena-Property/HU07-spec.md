# HU-07 — Gestión de roles y permisos

Épica E2 · Sprint 1 · SP 8 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero definir y gestionar los roles y permisos del sistema, para controlar qué puede hacer cada tipo de usuario.

## Requisitos funcionales
- **RF-07.1** — El sistema implementa los 6 roles del specs.md (Superadmin, Administrador, Propietario, Embajador, Usuario, Visitante); Embajador es acumulable con Usuario o Propietario.
- **RF-07.2** — La matriz de permisos (VSM §2) se materializa en: políticas RLS por tabla + middleware de rutas + un mapa de permisos tipado por módulo en `shared/` como única fuente para la UI.
- **RF-07.2b** — **El rol no basta para reservar (D-31):** la capacidad "reservar dentro de su fracción" se gobierna además por el **interruptor de calendario** de esa fracción. El mapa de permisos distingue capacidades de rol de capacidades condicionadas por estado.
- **RF-07.2c** — **El Superadmin registra gastos en cualquier propiedad (D-40):** enmienda la fila «Registrar gastos de mantenimiento» de la matriz VSM §2, que se la negaba. Su alcance es `todas`; el del Administrador sigue acotado a las propiedades que tiene asignadas. La frontera la hace cumplir la RLS de `movements` (HU-23), no solo el mapa de permisos.
- **RF-07.2d** — **El Superadmin gestiona el inventario de cualquier propiedad (D-45):** enmienda la fila «Gestionar inventario de la propiedad» de la matriz VSM §2, que se la negaba, y extiende al activo lo que RF-07.2c hizo con su gasto. Su alcance es `todas`; el del Administrador sigue acotado a las que tiene asignadas y el del Propietario sigue siendo de solo lectura. La frontera la hacen cumplir las políticas de `inventory_items` e `inventory_history` (HU-26), que se apoyan en la misma comprobación que `movements`.
- **RF-07.3** — Pantalla de gestión de roles: ver permisos por módulo y asignar/retirar roles a cuentas (solo Superadmin).
- **RF-07.4** — Todo cambio de rol queda auditado (quién, a quién, qué rol, cuándo).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-07.1** — Dado el mapa de permisos tipado, entonces cada capacidad de la matriz VSM tiene el valor correcto por rol (test tabla-completa).
- **CA-07.5** — Dado el Superadmin y una propiedad que **no** administra, cuando registra un gasto común, entonces la base lo acepta y genera sus 8 cuotas; el Administrador no asignado sigue sin poder (D-40).
- **CA-07.6** — Dado el Superadmin y una propiedad que **no** administra, cuando registra o da de baja un ítem de inventario, entonces la base lo acepta; el Administrador no asignado sigue sin poder (D-45).
- **CA-07.2** — Dado un rol sin cierta capacidad, cuando el middleware evalúa la ruta protegida, entonces deniega; con la capacidad, permite.
- **CA-07.3** — Dado un cambio de rol, entonces existe el registro de auditoría correspondiente.
- **CA-07.4** — Dada una cuenta Propietario que se inscribe como Embajador, entonces conserva ambos roles.

## Dependencias
- Base de todas las historias con restricción por rol; HU-49 (rol acumulable).
