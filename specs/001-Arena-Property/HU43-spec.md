# HU-43 — Página Sistema de Agendamiento

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Visitante, quiero ver una página que explique cómo funciona el sistema de agendamiento (distribución del tiempo de uso), para tener transparencia total antes de comprar.

## Requisitos funcionales
- **RF-43.1** — Página pública que explica las 4 temporadas y el cupo anual por fracción: **42 noches (7 altas, 7 media-altas, 7 medias y 21 bajas)**, reservables desde 1 noche con los mínimos de temporada (D-29).
- **RF-43.2** — Explica las reglas visibles al comprador: rotación anual del reparto, rotación estricta de los bloques pico (Navidad, Año Nuevo, Semana Santa), ventana anual de reubicación por turnos, estadía mínima por temporada y la bolsa de **Fechas Especiales** con su rotación de 8 años (HU-60).
- **RF-43.3** — Incluye CTA hacia el flujo de registro/compra.
- **RF-43.4** — El contenido se declara en un **manifiesto tipado** en `shared/` que incluye la tabla de temporadas y la distribución de referencia como datos, no como texto suelto; los CA se prueban contra él (RT-03).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-43.1** — Dado el manifiesto, entonces declara las 4 temporadas y un cupo cuyas noches por fracción suman exactamente 42, con el desglose 7/7/7/21.
- **CA-43.2** — Dado el cupo publicado y los mínimos de estadía, entonces coinciden con el criterio por defecto de HU-12 y con D-29 (test de coherencia: la página pública no puede prometer algo distinto al motor).
- **CA-43.3** — Dado el CTA del manifiesto, entonces su destino resuelve a la ruta de registro; claves i18n en paridad es/en.

## Dependencias
- HU-00 (enlace de origen) · coherencia de contenido con HU-12 y HU-14.
