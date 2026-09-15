# HU-43 — Página Sistema de Agendamiento

Épica E1 · Sprint 1 · SP 3 · Prioridad **Should** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

> **Revisión 2026-09-09 (D-32, D-33):** la página explica la selección de semanas por turnos y el uso por semanas completas; no menciona reservas por noches.
> **Revisión 2026-09-15 (D-42, D-43):** la página tampoco publica estadías cortas ni Fechas Especiales, y explica qué pasa con la semana que no se usa.

## Historia
Como Visitante, quiero ver una página que explique cómo funciona el sistema de agendamiento (distribución del tiempo de uso), para tener transparencia total antes de comprar.

## Requisitos funcionales
- **RF-43.1** — Página pública que explica las 4 temporadas y el cupo anual por fracción: **6 semanas completas —1 alta, 1 media-alta, 1 media y 3 bajas—, equivalentes a 42 noches (7/7/7/21)**. La unidad de uso es la semana de sábado a sábado: la página **no ofrece estadías más cortas** (D-42).
- **RF-43.2** — Explica las reglas visibles al comprador: la selección de semanas por turnos y cómo rota cada año, los bloques pico (Navidad, Año Nuevo, Semana Santa) como información, la ventana anual de reubicación por turnos, el plazo de confirmación (60 días) y el de cancelación (30 días), y qué pasa con la semana que no se usa: pasa a la bolsa de renta, y **solo si se liberó voluntariamente** su renta es del Propietario, neta de la comisión de gestión (D-39, D-43).
- **RF-43.3** — Incluye CTA hacia el flujo de registro/compra.
- **RF-43.4** — El contenido se declara en un **manifiesto tipado** en `shared/` que incluye la tabla de temporadas y la distribución de referencia como datos, no como texto suelto; los CA se prueban contra él (RT-03).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-43.1** — Dado el manifiesto, entonces declara las 4 temporadas y un cupo de **6 semanas** por fracción con el desglose 1/1/1/3, equivalente a 42 noches (7/7/7/21).
- **CA-43.2** — Dado el cupo publicado, entonces coincide con el criterio por defecto de HU-12 y el manifiesto no declara ninguna unidad de uso menor que la semana (test de coherencia: la página pública no puede prometer algo distinto al motor).
- **CA-43.3** — Dado el CTA del manifiesto, entonces su destino resuelve a la ruta de registro; claves i18n en paridad es/en.

## Dependencias
- HU-00 (enlace de origen) · coherencia de contenido con HU-12 y HU-14.
