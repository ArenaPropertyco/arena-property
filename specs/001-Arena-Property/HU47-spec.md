# HU-47 — Lista de espera de una propiedad

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero anotarme en la lista de espera de una propiedad sin fracciones disponibles, para ser notificado cuando se libere una.

## Requisitos funcionales
- **RF-47.1** — El formulario (nombre, email, teléfono) solo se ofrece cuando la propiedad no tiene fracciones disponibles (estado comercial `Vendido` o sin fracciones `disponible`).
- **RF-47.2** — La inscripción se persiste vinculada a la propiedad; un mismo email no puede inscribirse dos veces a la misma propiedad.
- **RF-47.3** — Al inscribirse se envía un correo de confirmación al Visitante, con límite de tasa por IP y correo (D-24).
- **RF-47.4** — **Disparador de liberación:** cuando una fracción de esa propiedad vuelve a `disponible` (venta anulada, HU-58 RF-58.7, o nueva fracción liberada), se notifica a la lista de espera en orden de inscripción a través de TR-03. Es lo que promete la historia y no estaba implementado.
- **RF-47.5** — Los datos se guardan con consentimiento explícito y se conservan 5 años (D-25).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-47.1** — Dada una propiedad con fracciones disponibles, entonces la lista de espera no se ofrece; sin disponibles, sí.
- **CA-47.2** — Dado un email ya inscrito en la propiedad P, cuando intenta inscribirse de nuevo en P, entonces se rechaza con mensaje traducido.
- **CA-47.3** — Dada una inscripción válida, entonces se persiste y se dispara exactamente un correo de confirmación.
- **CA-47.4** — Dada una fracción que vuelve a `disponible`, entonces se notifica a los inscritos de esa propiedad en orden de inscripción, una sola vez por persona.

## Dependencias
- HU-02 (punto de entrada) · HU-09 (estados de fracción).
