# HU-59 — Ventana anual de reubicación de noches

Épica E4 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Propietario / Administrador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-28](../../docs/decisions.md).
🆕 Historia nueva: nace de la decisión de reservar por noches individuales.

## Historia
Como Propietario, quiero mover parte de mis noches a otras fechas libres dentro de una ventana anual con turnos, para adaptar mi cupo a mis planes sin que nadie acapare las mejores fechas.

## Requisitos funcionales
- **RF-59.1** — El Superadmin configura por propiedad la **ventana anual**: fecha de apertura, duración total y duración del turno de cada fracción.
- **RF-59.2** — **Turno rotativo:** el orden en que las 8 fracciones acceden a la ventana rota cada año, de forma determinista e independiente de la rotación de asignación (HU-12), de modo que en 8 años cada fracción elige primera una vez.
- **RF-59.3** — Durante su turno, el Propietario **con calendario activo** (D-31) puede mover noches de su cupo a otras fechas **libres** del calendario y dividirlas en las estadías que quiera. Una fracción con calendario inactivo conserva su turno pero no puede operar en él.
- **RF-59.4** — **Regla dura de temporada:** una noche solo se reubica dentro de **su misma temporada** (una noche baja no puede convertirse en alta). El cupo por temporada es invariante: antes y después de reubicar, la fracción conserva 7/7/7/21.
- **RF-59.5** — Toda reubicación respeta la estadía mínima por temporada (D-29, HU-14) y no puede solapar con estadías de otras fracciones, bloqueos ni rentas a terceros.
- **RF-59.6** — Fuera de su turno, el Propietario ve la ventana en modo lectura; cerrada la ventana, las noches no reubicadas quedan en sus fechas asignadas y las fechas liberadas se abren por orden de llegada y a la bolsa de renta (HU-39).
- **RF-59.7** — La fracción que tiene asignada la bolsa de **Fechas Especiales** ese año (HU-60) elige durante su turno las fechas concretas de sus estadías comodín.
- **RF-59.8** — El motor de validación de reubicación es una función pura (entrada: cupo, calendario ocupado, movimiento propuesto; salida: aceptado o motivo de rechazo). Cada movimiento se audita (TR-01) y se notifica (TR-03).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-59.1** — Dado un intento de mover una noche baja a una fecha de temporada alta, entonces se rechaza por cambio de temporada.
- **CA-59.2** — Dada una reubicación válida, entonces el cupo por temporada de la fracción sigue siendo 7/7/7/21 y las fechas de origen quedan libres.
- **CA-59.3** — Dado un movimiento sobre una fecha ya ocupada por otra fracción, un bloqueo o una renta a terceros, entonces se rechaza.
- **CA-59.4** — Dado un movimiento que dejaría una estadía por debajo del mínimo de su temporada, entonces se rechaza.
- **CA-59.5** — Dado un Propietario fuera de su turno, cuando intenta reubicar, entonces se rechaza y solo puede consultar.
- **CA-59.6** — Dados 8 años consecutivos, entonces cada fracción ocupa el primer turno exactamente una vez.
- **CA-59.7** — Cerrada la ventana, entonces las noches no reubicadas siguen asignadas a su fracción y las fechas liberadas figuran disponibles.

## Dependencias
- TR-01, TR-03 (habilitadores) · HU-12 (cupo y asignación) · HU-14 (estadías y mínimos) · **HU-60 (Fechas Especiales)** · HU-39 (bolsa de renta).
