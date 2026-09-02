# HU-31 — Comunicados globales del Superadmin

Épica E9 · Sprint 4 · SP 5 · Prioridad **Could** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero enviar comunicados globales a todos los administradores, propietarios o embajadores, para anuncios institucionales.

## Requisitos funcionales
- **RF-31.1** — Creación de comunicado con título/cuerpo y **segmentación** de destinatarios: todos, por rol (Administrador/Propietario/Embajador) o por propiedad.
- **RF-31.2** — La resolución del segmento a destinatarios concretos es una función pura sobre roles y vínculos; sin duplicados cuando una cuenta cumple varios criterios.
- **RF-31.3** — El envío usa el canal transversal TR-03 (D-19) y queda registrado con su segmento y fecha.
- **RF-31.4** — Solo el Superadmin puede crear comunicados globales.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-31.1** — Dado el segmento "rol Propietario", entonces los destinatarios son todas las cuentas con ese rol y ninguna más.
- **CA-31.2** — Dado el segmento "propiedad P", entonces los destinatarios son los propietarios de P y su administrador.
- **CA-31.3** — Dada una cuenta Propietario+Embajador con segmento "Propietarios y Embajadores", entonces recibe el comunicado una sola vez.

## Dependencias
- HU-07 (roles) · HU-30 (bandeja).
