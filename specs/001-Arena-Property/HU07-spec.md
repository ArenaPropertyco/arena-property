# HU-07 — Gestión de roles y permisos

Épica E2 · Sprint 1 · SP 8 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero definir y gestionar los roles y permisos del sistema, para controlar qué puede hacer cada tipo de usuario.

## Requisitos funcionales
- **RF-07.1** — El sistema implementa los 6 roles del specs.md (Superadmin, Administrador, Propietario, Embajador, Usuario, Visitante); Embajador es acumulable con Usuario o Propietario.
- **RF-07.2** — La matriz de permisos (VSM §2) se materializa en: políticas RLS por tabla + middleware de rutas + un mapa de permisos tipado por módulo en `shared/` como única fuente para la UI.
- **RF-07.2b** — **El rol no basta para reservar (D-31):** la capacidad "reservar dentro de su fracción" se gobierna además por el **interruptor de calendario** de esa fracción. El mapa de permisos distingue capacidades de rol de capacidades condicionadas por estado.
- **RF-07.3** — Pantalla de gestión de roles: ver permisos por módulo y asignar/retirar roles a cuentas (solo Superadmin).
- **RF-07.4** — Todo cambio de rol queda auditado (quién, a quién, qué rol, cuándo).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-07.1** — Dado el mapa de permisos tipado, entonces cada capacidad de la matriz VSM tiene el valor correcto por rol (test tabla-completa).
- **CA-07.2** — Dado un rol sin cierta capacidad, cuando el middleware evalúa la ruta protegida, entonces deniega; con la capacidad, permite.
- **CA-07.3** — Dado un cambio de rol, entonces existe el registro de auditoría correspondiente.
- **CA-07.4** — Dada una cuenta Propietario que se inscribe como Embajador, entonces conserva ambos roles.

## Dependencias
- Base de todas las historias con restricción por rol; HU-49 (rol acumulable).
