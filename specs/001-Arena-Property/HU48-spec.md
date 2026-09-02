# HU-48 — Página pública del Programa de Embajadores

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver una página pública del Programa de Embajadores que explique cómo ganar dinero refiriendo clientes, para decidir si quiero inscribirme.

## Requisitos funcionales
- **RF-48.1** — Explica el flujo del programa: refiero → mi referido compra → mi referido paga la totalidad → se libera mi comisión.
- **RF-48.2** — Muestra el monto de comisión vigente leído de la configuración del Superadmin (HU-52), nunca hardcodeado; formateado con IBM Plex Mono.
- **RF-48.3** — Publica las condiciones del programa (términos resumidos).
- **RF-48.4** — CTA hacia el registro/inscripción como Embajador (HU-49; si no hay sesión, primero HU-04).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-48.1** — Dada una comisión vigente configurada (fija o porcentual), cuando se renderiza la página, entonces se muestra ese valor con su formato correcto.
- **CA-48.2** — Dado un visitante sin sesión, cuando activa el CTA, entonces el destino es el registro; con sesión, la inscripción de HU-49.
- **CA-48.3** — Claves i18n en paridad es/en.

## Dependencias
- HU-52 (monto vigente) · HU-49 (destino del CTA) · HU-04 (registro previo).
