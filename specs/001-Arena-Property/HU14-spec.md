# HU-14 — Estadías por noches: declarar, cancelar y liberar

Épica E4 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-11](../../docs/decisions.md), [D-29](../../docs/decisions.md), [D-14](../../docs/decisions.md) y [D-15](../../docs/decisions.md).

## Historia
Como Propietario, quiero reservar mis noches en las estadías que necesite —desde una sola noche—, para usar la propiedad como me conviene sin perder mi cupo.

## Requisitos funcionales
- **RF-14.1** — El Propietario declara **estadías de 1 o más noches consecutivas** consumiendo el cupo de su fracción (HU-12). Cada noche descuenta del cupo de **su propia temporada**: una noche alta no se paga con cupo bajo.
- **RF-14.1b** — **Requiere calendario activo (D-31):** una fracción con el calendario inactivo no puede declarar, cancelar ni liberar estadías; sus noches siguen su curso y pasan a la bolsa de renta a los 60 días. La validación es de servidor, no solo de UI.
- **RF-14.1c** — **Primer año tras la activación (D-31):** al activarse a mitad de año, el Propietario dispone únicamente de las noches de su asignación **aún no transcurridas**; las ya pasadas no se compensan.
- **RF-14.2** — **Estadía mínima por temporada (D-29):** alta 3 noches, media-alta 2, media y baja 1. Una estadía que cruza temporadas debe cumplir el mínimo de la temporada más alta que toca.
- **RF-14.3** — Las noches deben estar en las fechas asignadas a su fracción o en fechas libres obtenidas en la ventana de reubicación (HU-59) o por orden de llegada una vez cerrada.
- **RF-14.4** — Validación de cero solapamiento a nivel de **noche**: no se declara una estadía sobre noches bloqueadas (HU-15), de la bolsa institucional, de otra fracción o ya rentadas a terceros (HU-39).
- **RF-14.5** — **La regla de no repetir temporada alta consecutiva es invariante del motor** (HU-12 RF-12.4 y RF-12.5), no una validación de esta historia.
- **RF-14.6** — **Cancelación (D-14):** una estadía se cancela hasta **30 días antes** de su inicio y sus noches pasan a la bolsa de renta a terceros; dentro de los 30 días se rechaza. Cancelación parcial permitida siempre que el remanente siga cumpliendo el mínimo de su temporada.
- **RF-14.7** — **Liberación (D-15):** el Propietario puede liberar noches en cualquier momento, y las que sigan sin estadía declarada a **60 días** de su fecha pasan automáticamente a la bolsa de renta, previo aviso (TR-03).
- **RF-14.8** — Las estadías sobre la bolsa de **Fechas Especiales** siguen las reglas propias de HU-60: tope de 3 noches, sin mínimo de temporada, y descuento del cupo de la temporada que corresponda.
- **RF-14.9** — Al declarar una estadía, el sistema **advierte** si deja noches huérfanas (una o dos noches sueltas entre ocupaciones) que serán difíciles de usar o rentar; es una advertencia, no un bloqueo.
- **RF-14.10** — Toda declaración, cancelación y liberación se audita (TR-01), se notifica (TR-03) y se valida también en el servidor, con restricción de exclusión por rango de noches que impide dos ocupaciones simultáneas.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-14.0** — Dada una fracción con calendario inactivo, cuando intenta declarar una estadía, entonces se rechaza; activado el calendario, la misma declaración se acepta.
- **CA-14.0b** — Dada una activación en julio, entonces el cupo disponible de ese año son solo las noches asignadas posteriores a la fecha de activación.
- **CA-14.1** — Dada una estadía de 1 noche en temporada baja, entonces se acepta; dada una de 1 noche en alta, se rechaza por mínimo de temporada; dada una de 3 noches en alta, se acepta.
- **CA-14.2** — Dada una estadía de 4 noches que cruza de baja a alta, entonces se le aplica el mínimo de la temporada alta.
- **CA-14.3** — Dado un cupo de 7 noches altas y estadías que suman 7, cuando intenta declarar una octava noche alta, entonces se rechaza por cupo agotado, aunque le sobren noches bajas.
- **CA-14.4** — Dadas noches bloqueadas, de otra fracción o rentadas, entonces la declaración se rechaza con motivo traducido.
- **CA-14.5** — Dada una estadía a 45 días de su inicio, cuando se cancela, entonces se acepta y sus noches quedan en la bolsa de renta; a 20 días, se rechaza.
- **CA-14.6** — Dada una cancelación parcial que dejaría 2 noches en temporada alta, entonces se rechaza por incumplir el mínimo.
- **CA-14.7** — Dadas noches sin estadía a 59 días de su fecha, entonces ya están en la bolsa de renta y el Propietario fue avisado.
- **CA-14.8** — Dada una estadía que deja una noche huérfana entre dos ocupaciones, entonces se acepta y se emite la advertencia.
- **CA-14.9** — Dadas dos declaraciones simultáneas sobre la misma noche, entonces la restricción de exclusión permite exactamente una.

## Dependencias
- TR-01, TR-03 (habilitadores) · HU-12 (cupo) · HU-59 (reubicación) · **HU-60 (Fechas Especiales)** · HU-13 (vista) · HU-15/HU-39 (colisiones y bolsa de renta) · HU-16 (avisos).
