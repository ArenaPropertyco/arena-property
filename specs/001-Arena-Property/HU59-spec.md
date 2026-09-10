# HU-59 — Ventana anual de reubicación de semanas

Épica E4 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Propietario / Administrador / Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-28](../../docs/decisions.md) y [D-36](../../docs/decisions.md).
🆕 Historia nueva: nace de la decisión de reservar por noches individuales.

> **Revisada el 2026-09-09 (D-33, D-36):** la reubicación es **por semanas completas**. Cada Propietario mueve, durante su turno de la ventana anual, una semana elegida (HU-12) a otra libre de la **misma temporada**. Las estadías por noches, los mínimos (D-29) y las Fechas Especiales (RF-59.7, HU-60) siguen aplazados.

## Historia
Como Propietario, quiero mover alguna de mis semanas elegidas a otra fecha libre de la misma temporada dentro de una ventana anual con turnos, para adaptar mi cupo a mis planes sin que nadie acapare las mejores fechas.

## Requisitos funcionales
- **RF-59.1** — El Superadmin configura por propiedad y año la **ventana anual** (`selection_windows`): instante de apertura (P-12, por defecto el 1 de octubre del año anterior), duración total (P-13, 16 días) y duración del turno de cada fracción (P-14, 48 horas). Los turnos quedan persistidos con su franja horaria.
- **RF-59.2** — **Turno rotativo:** el orden en que las fracciones acceden a la ventana rota cada año de forma determinista: la plataforma sugiere el orden de la ventana anterior con la primera fracción al final (el mismo mecanismo de la selección, RF-12.5); el primer año parte del orden de selección del calendario. En 8 años cada fracción abre la ventana una vez. El Superadmin puede ajustar la sugerencia.
- **RF-59.3** — Durante su turno, el Propietario **con calendario activo** (D-31) puede mover una semana propia **elegida y todavía sin confirmar** a otra semana **libre** del calendario. Una fracción con calendario inactivo conserva su turno pero no puede operar en él. El Administrador asignado puede reubicar por cualquier fracción mientras la ventana esté abierta (HU-17).
- **RF-59.4** — **Regla dura de temporada:** una semana solo se reubica dentro de **su misma temporada** (una baja no se convierte en alta). El cupo por temporada es invariante: antes y después de reubicar, la fracción conserva 1/1/1/3.
- **RF-59.5** — Toda reubicación respeta las ocupaciones: la semana de destino no puede estar elegida por otra fracción, bloqueada (HU-15) ni en la bolsa de renta (HU-39), ni ser una semana ya pasada.
- **RF-59.6** — Fuera de su turno, el Propietario ve la ventana en modo lectura. Terminados todos los turnos y hasta el cierre, la ventana queda abierta **por orden de llegada** para cualquier fracción con calendario activo. Cerrada la ventana —por el Superadmin, el Administrador o la tarea programada al vencer— las semanas no reubicadas quedan en sus fechas y las semanas liberadas por las reubicaciones figuran disponibles en la bolsa del Administrador y para la renta (HU-39).
- **RF-59.7** — *(Aplazado con HU-60, D-33.)* La fracción que tenga asignada la bolsa de Fechas Especiales elegirá durante su turno las fechas concretas de sus estadías comodín.
- **RF-59.8** — El motor de validación de reubicación es una función pura (entrada: semanas de la fracción, calendario ocupado, turno y movimiento propuesto; salida: aceptado o motivo de rechazo). Cada movimiento se audita con motivo (TR-01) y se notifica al Propietario (TR-03).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-59.1** — Dado un intento de mover una semana baja a una semana libre de temporada alta, entonces se rechaza por cambio de temporada.
- **CA-59.2** — Dada una reubicación válida, entonces el cupo por temporada de la fracción sigue siendo 1/1/1/3 y la semana de origen queda libre.
- **CA-59.3** — Dado un movimiento hacia una semana ya elegida por otra fracción, bloqueada por el Administrador o en la bolsa de renta, entonces se rechaza.
- **CA-59.4** — Dado un movimiento de una semana ya confirmada o ya liberada, entonces se rechaza: solo se mueven semanas elegidas pendientes de confirmar.
- **CA-59.5** — Dado un Propietario fuera de su turno (antes de que abra, con la ventana sin abrir o con el calendario inactivo), cuando intenta reubicar, entonces se rechaza y solo puede consultar.
- **CA-59.6** — Dados 8 años consecutivos, entonces cada fracción ocupa el primer turno exactamente una vez.
- **CA-59.7** — Cerrada la ventana, entonces ninguna reubicación se acepta, las semanas no reubicadas siguen asignadas a su fracción y las semanas liberadas figuran disponibles.

## Dependencias
- TR-01, TR-03 (habilitadores) · HU-12 (selección por turnos e intercambios) · HU-14 (confirmación de semanas) · HU-15 (bloqueos) · HU-39 (bolsa de renta) · HU-60 (aplazada).
