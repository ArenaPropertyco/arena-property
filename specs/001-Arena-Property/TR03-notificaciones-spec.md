# TR-03 — Canal de notificaciones y bandeja

Requisito transversal · Sprint 2 (habilitador) · Rol: sistema
Implementa [D-19](../../docs/decisions.md) y [D-21](../../docs/decisions.md).
**Toda notificación de cualquier `HUXX-spec.md` se emite y se lee según esta spec.** Sustituye al modelo de bandeja que vivía dentro de HU-30.

## Necesidad
Seis historias emiten notificaciones (HU-16, HU-29, HU-30, HU-31, HU-54, HU-57) y ocho envían correo, pero ninguna era dueña del canal. La bandeja vivía dentro de una historia del Propietario y la usan también administradores y embajadores.

## Requisitos funcionales
- **RF-N.1** — Modelo único de notificación: tipo, destinatario, propiedad relacionada (si aplica), entidad de origen, carga tipada, fecha y estado leído/no leído **por destinatario**.
- **RF-N.2** — Doble canal: in-app siempre, y correo cuando el tipo lo exige. El correo sale por la API REST de **Resend** invocada desde Nitro con `$fetch` (sin SDK), con plantilla i18n en el idioma del destinatario.
- **RF-N.3** — **Resolución de destinatarios como función pura**, una por tipo de evento: fracción propia (HU-16), todos los propietarios de una propiedad (HU-29), segmento de comunicado (HU-31), embajador dueño del referido o del retiro (HU-54, HU-57).
- **RF-N.4** — **Idempotencia:** cada evento de negocio genera como máximo una notificación por destinatario, aunque el evento se reprocese.
- **RF-N.5** — La bandeja es accesible a **cualquier rol autenticado** y solo muestra las notificaciones dirigidas a esa cuenta (RLS); incluye contador de no leídas, marcar una, marcar todas y filtro por propiedad y por tipo.
- **RF-N.6** — Un fallo de envío de correo **no** revierte la operación de negocio ni la notificación in-app: queda registrado y se reintenta; la notificación in-app es la fuente de verdad.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-N.1** — Dado un evento de fracción propia, entonces el conjunto de destinatarios es exactamente el propietario de esa fracción.
- **CA-N.2** — Dada una propiedad con 5 propietarios, uno de ellos con 2 fracciones, entonces una novedad de propiedad produce 5 destinatarios, sin duplicados.
- **CA-N.3** — Dado el mismo evento procesado dos veces, entonces existe una sola notificación por destinatario.
- **CA-N.4** — Dadas 3 no leídas, cuando el destinatario marca una, entonces su contador baja a 2 y el de los demás destinatarios no cambia.
- **CA-N.5** — Dada una cuenta con rol solo Embajador (sin fracciones), entonces accede a su bandeja y ve sus notificaciones.
- **CA-N.6** — Dado un fallo del proveedor de correo, entonces la notificación in-app persiste y el fallo queda registrado.

## Dependencias
- Habilitador de HU-16, HU-29, HU-30, HU-31, HU-54 y HU-57.
