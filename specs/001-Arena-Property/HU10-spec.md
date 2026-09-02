# HU-10 — Vista global de propiedades (Superadmin)

Épica E3 · Sprint 1 · SP 3 · Prioridad **Must** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero ver todas las propiedades del sistema sin importar qué administrador las gestiona, para tener visibilidad global.

## Requisitos funcionales
- **RF-10.1** — Listado global de propiedades en cualquier estado de visibilidad/comercial, con su administrador asignado.
- **RF-10.2** — Filtros combinables por administrador, estado (visibilidad y comercial) y región; el filtrado es lógica pura en composable (reutiliza el de HU-01 donde aplique).
- **RF-10.3** — Solo el Superadmin accede; la política RLS del Superadmin no restringe por asignación.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-10.1** — Dado un Superadmin, cuando consulta el listado, entonces obtiene también propiedades `En borrador` e `Inactiva` de todos los administradores.
- **CA-10.2** — Dado un filtro administrador + estado + región, entonces el resultado cumple los tres criterios.
- **CA-10.3** — Dado un rol no Superadmin, entonces el acceso a la vista global es denegado.

## Dependencias
- HU-08 (propiedades) · HU-05 (relación admin↔propiedad).
