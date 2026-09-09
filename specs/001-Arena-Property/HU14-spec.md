# HU-14 — Uso de semanas: confirmar, cancelar y liberar

Épica E4 · Sprint 2 · SP 8 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-33](../../docs/decisions.md), [D-14](../../docs/decisions.md) y [D-15](../../docs/decisions.md).
> **Revisión 2026-09-09 (D-33):** desaparecen las estadías por noches y el mínimo por temporada. La unidad es la semana completa elegida en HU-12.

## Historia
Como Propietario, quiero confirmar las semanas que voy a usar, cancelar las que no y liberar las que no necesito, para que mi cupo se aproveche y las semanas sobrantes puedan rentarse.

## Requisitos funcionales
- **RF-14.1** — El Propietario **confirma** como uso propio cada semana que eligió (HU-12), una a una. Confirmar consume la semana de su temporada; no se confirma una semana que no sea suya, ya pasada, bloqueada (HU-15) o ya liberada.
- **RF-14.1b** — **Requiere calendario activo (D-31):** una fracción con el calendario inactivo no puede confirmar, cancelar ni liberar; sus semanas siguen su curso y pasan a la bolsa de renta a los 60 días si nadie las confirma. La validación es de servidor, no solo de UI.
- **RF-14.1c** — **Primer año tras la activación (D-31):** al activarse a mitad de año, el Propietario solo puede confirmar las semanas elegidas cuyo sábado de entrada sea **posterior a la activación**; las anteriores no se compensan.
- **RF-14.2** — **Sin mínimo por temporada (D-33):** la semana completa es la unidad; la regla de estadía mínima (D-29) queda suspendida.
- **RF-14.3** — Solo se confirman semanas elegidas por la propia fracción en la selección de HU-12 o recibidas por intercambio (RF-12.6).
- **RF-14.4** — Validación de cero solapamiento a nivel de **semana**: una semana pertenece a lo sumo a una fracción, y una semana bloqueada (HU-15), de la bolsa del Administrador o ya en renta (HU-39) no se confirma.
- **RF-14.5** — La composición 1 alta, 1 media-alta, 1 media y 3 bajas es invariante de la selección (HU-12 RF-12.3), no una validación de esta historia.
- **RF-14.6** — **Cancelación (D-14):** una semana confirmada se cancela hasta **30 días antes** de su sábado de entrada y pasa a la bolsa de renta; dentro de los 30 días se rechaza. No hay cancelación parcial: la semana es indivisible.
- **RF-14.7** — **Liberación y caducidad (D-15, D-33):** el Propietario puede liberar cualquier semana suya en cualquier momento antes de su entrada, y la semana elegida que siga **sin confirmar a 60 días** de su entrada pasa automáticamente a la bolsa de renta, previo aviso (TR-03). Una semana liberada o caducada no vuelve a la fracción.
- **RF-14.8** — Las Fechas Especiales (HU-60) quedan aplazadas (D-33): mientras tanto esas noches son de la bolsa del Administrador.
- **RF-14.9** — Al confirmar, el sistema **advierte** de las semanas propias que aún faltan por confirmar y de cuándo vence cada una; es información, no un bloqueo.
- **RF-14.10** — Toda confirmación, cancelación y liberación se audita (TR-01), se notifica (TR-03) y se valida también en el servidor; la unicidad de la semana por fracción la garantiza la base.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-14.0** — Dada una fracción con calendario inactivo, cuando intenta confirmar una semana, entonces se rechaza; activado el calendario, la misma confirmación se acepta.
- **CA-14.0b** — Dada una activación en julio, entonces solo se pueden confirmar las semanas elegidas con entrada posterior a la fecha de activación.
- **CA-14.1** — Dada una semana propia elegida y futura, cuando se confirma, entonces queda confirmada; dada una semana de otra fracción, se rechaza.
- **CA-14.2** — Dada una semana ya confirmada, cuando se intenta confirmar de nuevo, entonces se rechaza; dada una semana ya liberada o cancelada, también.
- **CA-14.3** — Dado el cupo por temporada, entonces la suma de semanas elegidas, confirmadas y liberadas de cada temporada nunca supera lo que dicta el criterio (1/1/1/3).
- **CA-14.4** — Dada una semana bloqueada por el Administrador, de otra fracción o ya en renta, entonces la confirmación se rechaza con motivo traducido.
- **CA-14.5** — Dada una semana confirmada a 45 días de su entrada, cuando se cancela, entonces se acepta y la semana queda en la bolsa de renta; a 20 días, se rechaza.
- **CA-14.6** — Dada una semana cancelada, entonces no puede volver a confirmarse ni figura como cupo disponible de la fracción.
- **CA-14.7** — Dada una semana elegida sin confirmar a 59 días de su entrada, entonces ya está en la bolsa de renta y el Propietario fue avisado.
- **CA-14.8** — Dada una semana propia liberada voluntariamente, entonces queda en la bolsa de renta con su motivo y el Propietario tiene constancia.
- **CA-14.9** — Dadas dos confirmaciones simultáneas de la misma semana, entonces exactamente una queda registrada.

## Dependencias
- TR-01, TR-03 (habilitadores) · HU-12 (selección y cupo) · HU-13 (vista) · HU-15/HU-39 (colisiones y bolsa de renta) · HU-16 (avisos).
