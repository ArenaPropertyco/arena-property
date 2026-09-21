# HU-29 — Publicar novedad a los propietarios

Épica E9 · Sprint 4 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero publicar una novedad (corte de agua, reparación, cambio de reglas) en la plataforma, para notificar a todos los propietarios de esa propiedad.

## Requisitos funcionales
- **RF-29.1** — Creación de aviso con título, descripción y urgencia (informativa/importante/urgente), sobre una propiedad administrada.
- **RF-29.2** — Al publicar se notifica por TR-03 a **todos los propietarios de esa propiedad** (a diferencia de HU-16, cuyo alcance es una sola fracción); la resolución de destinatarios es la función pura de TR-03 RF-N.3.
- **RF-29.3** — La novedad queda en el historial de la propiedad (HU-30) con estado abierta/resuelta; las abiertas alimentan las alertas del dashboard del Admin (HU-21).
- **RF-29.4** — La urgencia usa la semántica de color de marca: rojo solo para urgente (RT-07/RT-08).
- **RF-29.5** — **Destinatario: toda la propiedad o una fracción (D-46).** La novedad se dirige a todos los titulares de la propiedad (RF-29.2) o a **una fracción concreta**, que debe ser de esa propiedad; dirigida a una fracción, solo su titular la recibe y la ve, con el acotamiento de HU-16 RF-16.2. Sus destinatarios los resuelve la función pura de TR-03 según el caso.
- **RF-29.6** — **Estado activa/inactiva (D-46).** Inactiva, ningún Propietario la ve en su historial ni se le notifica; quien gestiona la propiedad la sigue viendo, marcada. Nace activa salvo que el Superadmin la publique inactiva; se notifica la primera vez que está activa y reactivarla no repite el aviso (TR-03 RF-N.4). La publican por igual el Superadmin y el Administrador asignado; **el estado lo cambia únicamente el Superadmin**, reflejado en RLS y disparador.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-29.1** — Dada una propiedad con 5 propietarios (de 8 fracciones), entonces el conjunto de destinatarios son exactamente esos 5, sin duplicados aunque uno tenga 2 fracciones.
- **CA-29.2** — Dado un aviso sin título o sin urgencia, entonces la validación lo rechaza.
- **CA-29.3** — Dada la publicación, entonces cada destinatario recibe una notificación in-app y un email, una sola vez.
- **CA-29.4** — Dada una novedad dirigida a la fracción 3/8, entonces el único destinatario es su titular, y otro copropietario de la misma propiedad ni la recibe ni la ve en su historial (D-46).
- **CA-29.5** — Dada una novedad inactiva, entonces ningún Propietario la ve; el Superadmin la activa o desactiva y el Administrador que la publicó no puede cambiar su estado (D-46).

## Dependencias
- HU-05 (asignación) · HU-30 (historial) · HU-21 (alertas).
