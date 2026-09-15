# HU-21 — Dashboard del Administrador

Épica E6 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

> **Revisión 2026-09-15 (D-43):** entre las alertas del día a día están las semanas liberadas que siguen sin colocar.

## Historia
Como Administrador de Propiedad, quiero un dashboard con todas las propiedades que administro, su estado de ocupación y alertas pendientes, para operar el día a día.

## Requisitos funcionales
- **RF-21.1** — Vista resumen por propiedad administrada: % de fracciones vendidas, próximas reservas y novedades sin resolver.
- **RF-21.1b** — **Semanas por colocar (D-43).** Entre las alertas figuran las semanas de la bolsa de renta que siguen sin tercero, ordenadas por cercanía de su sábado de entrada, indicando su motivo de origen y marcando las **liberadas voluntariamente**, cuya renta pertenece a la fracción que las soltó (D-39). La alerta desaparece cuando la semana se renta, se bloquea (HU-15) o pasa su fecha.
- **RF-21.2** — Los indicadores se calculan en composables puros: % vendidas = fracciones `vendida` / 8; próximas reservas = las N más cercanas; alertas = conflictos de calendario (HU-15/HU-17) y novedades abiertas (HU-29).
- **RF-21.3** — Solo aparecen propiedades asignadas (HU-05, RLS).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-21.1** — Dada una propiedad con 3 fracciones vendidas, entonces el indicador muestra `37,5 %` en español y `37.5%` en inglés, con el formato de porcentaje de TR-02 RF-D.5.
- **CA-21.2** — Dado un conjunto de reservas, entonces "próximas" contiene solo futuras, ordenadas ascendentemente.
- **CA-21.3** — Dado un Administrador con 2 propiedades asignadas de 5 existentes, entonces el dashboard arma exactamente 2 resúmenes.
- **CA-21.4** — Dada una propiedad con dos semanas liberadas sin rentar, entonces el tablero las lista como alerta por orden de entrada; rentada una de ellas, la alerta queda en una sola.

## Dependencias
- HU-05 (asignación) · HU-09 (fracciones) · HU-12–HU-17 (calendario) · HU-39 (bolsa de renta) · HU-29 (novedades).
