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

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-29.1** — Dada una propiedad con 5 propietarios (de 8 fracciones), entonces el conjunto de destinatarios son exactamente esos 5, sin duplicados aunque uno tenga 2 fracciones.
- **CA-29.2** — Dado un aviso sin título o sin urgencia, entonces la validación lo rechaza.
- **CA-29.3** — Dada la publicación, entonces cada destinatario recibe una notificación in-app y un email, una sola vez.

## Dependencias
- HU-05 (asignación) · HU-30 (historial) · HU-21 (alertas).
