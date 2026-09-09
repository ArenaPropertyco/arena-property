# HU-12 — Motor de calendario: temporadas, cupo de noches y selección por turnos

Épica E4 · Sprint 2 · SP 13 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-11](../../docs/decisions.md), [D-12](../../docs/decisions.md), [D-32](../../docs/decisions.md) (que sustituye a D-13 y D-27), [D-28](../../docs/decisions.md) y [D-15](../../docs/decisions.md).
> **Revisión 2026-09-09 (D-32):** se elimina la asignación automática con rotación. Cada Propietario elige sus semanas por turnos; el orden del primer año es el de compra y los siguientes los fija el Administrador.
> **Revisión 2026-09-09 (D-33):** la semana es la única unidad de uso. Las noches fuera de la rejilla quedan en la bolsa del Administrador hasta retomar HU-60.

## Historia
Como Administrador de Propiedad, quiero configurar el calendario de cada propiedad con sus temporadas y abrir la selección de semanas por turnos, para que cada Propietario elija su cupo anual en un orden justo y conocido.

## Requisitos funcionales
- **RF-12.1** — **Unidad de reserva: la noche (D-11).** Check-in 15:00, check-out 11:00, zona horaria `America/Bogota`. La rejilla de semanas **sábado a sábado** se ancla al primer sábado del año y contiene las **semanas completas que caben dentro del año (51 o 52)**; cada noche de la rejilla hereda la temporada de su semana. Las noches que quedan fuera —de enero al primer sábado y de la última semana al 31 de diciembre— quedan por ahora en la **bolsa del Administrador** (D-33; la bolsa de Fechas Especiales de HU-60 se retomará después). El cálculo de rejilla y noches sobrantes es una función pura sobre el año.
- **RF-12.2** — El Administrador clasifica cada semana de la rejilla en `alta`, `media_alta`, `media` o `baja`, y marca dentro de la alta los **bloques pico**: Navidad, Año Nuevo y Semana Santa.
- **RF-12.3** — **Cupo (D-12) elegido por el Propietario (D-32):** cada fracción elige 6 semanas concretas —1 alta, 1 media-alta, 1 media y 3 bajas— que constituyen su cupo anual de **42 noches (7 altas, 7 media-altas, 7 medias, 21 bajas)**. La elección es atómica: las 6 semanas juntas, con esa composición exacta, entre las semanas que sigan libres. Las **3 o 4 semanas que nadie elige** quedan en la bolsa del Administrador y se comportan como bloqueos (HU-15). El criterio es configurable por propiedad, con ese reparto por defecto.
- **RF-12.4** — **Turnos en orden de compra (D-32):** el primer año elige primero la fracción cuya compra se cerró primero (HU-06), después la segunda entre lo que quedó, y así hasta la octava. Una fracción sin titular no tiene turno y no bloquea a las siguientes. Cada Propietario ve de quién es el turno y qué semanas siguen libres.
- **RF-12.5** — **Orden de los años siguientes (D-32):** al abrir el calendario de un año posterior, el Administrador fija el orden de selección. La plataforma le sugiere rotar el orden del año anterior (quien eligió primero pasa al final) y él puede reordenarlo libremente antes de abrir; el orden queda auditado. Los bloques pico se marcan como información, no se asignan.
- **RF-12.6** — **Intercambios (D-32, D-28):** el Administrador asignado o el Superadmin pueden intercambiar una semana de una fracción por una semana de otra, siempre de la **misma temporada** y sin estadías declaradas sobre ninguna de las dos, con motivo obligatorio. Un Propietario puede **solicitar** un intercambio de una semana suya por una de otra fracción; el Administrador lo aprueba (y se aplica) o lo rechaza con motivo. Ambos titulares reciben aviso (TR-03). Las reglas de composición, turno e intercambio son funciones puras en `shared/`.
- **RF-12.7** — Si la rejilla no permite cumplir el criterio (menos de 8 semanas de alguna temporada, o menos de 24 bajas), la configuración se **rechaza** con un error explicativo antes de persistir.
- **RF-12.8** — **Sin acumulación (D-15, D-33):** el cupo es anual y las semanas no usadas no se arrastran. Una semana elegida que siga **sin confirmar a 60 días** de su sábado de entrada pasa a la bolsa de renta a terceros (HU-39), previo aviso al Propietario (TR-03). Las semanas de una fracción con calendario inactivo (D-31) no se eligen; las que nadie elige quedan en la bolsa del Administrador.
- **RF-12.9** — Reclasificar la rejilla de un calendario ya abierto no borra las semanas elegidas ni las estadías: si una semana elegida cambia de temporada y la composición de esa fracción deja de cumplirse, el conflicto se lista para que el Administrador lo resuelva con intercambios (HU-17).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-12.1** — Dado un año cualquiera, entonces la rejilla arranca el primer sábado, cada semana cubre 7 noches consecutivas y no hay huecos ni solapamientos.
- **CA-12.2** — Dada una elección de 6 semanas que no sea exactamente 1 alta, 1 media-alta, 1 media y 3 bajas (o que no sean 6), entonces se rechaza indicando la temporada que sobra o falta; dada una elección correcta, la fracción queda con 7/7/7/21 noches.
- **CA-12.3** — Dada una semana ya elegida por otra fracción, entonces una segunda elección sobre ella se rechaza; terminados los turnos, las semanas que nadie eligió quedan en la bolsa del Administrador.
- **CA-12.4** — Dadas las fechas de cierre de compra de las fracciones, entonces el orden de selección del primer año va de la compra más antigua a la más reciente y las fracciones sin titular quedan fuera.
- **CA-12.5** — Dado el orden de turnos, entonces la segunda fracción no puede elegir hasta que la primera haya elegido sus 6 semanas; una fracción sin titular se salta y no bloquea a la siguiente.
- **CA-12.6** — Dado el orden de un año, entonces la sugerencia para el siguiente es el mismo orden rotado (la primera pasa al final), y el Administrador puede reemplazarla por cualquier permutación de las fracciones con titular.
- **CA-12.7** — Dada una rejilla con solo 7 semanas altas, entonces el motor retorna error de imposibilidad y no persiste nada.
- **CA-12.8** — Dado cualquier año, entonces la rejilla contiene 51 o 52 semanas completas, se reparten 48 y las restantes quedan en la bolsa del Administrador.
- **CA-12.9** — Dado cualquier año, entonces la unión de las noches de la rejilla y las de la bolsa de Fechas Especiales (HU-60) cubre todas las noches del año, sin huecos ni solapamientos.
- **CA-12.10** — Dado un intercambio entre dos fracciones, entonces se rechaza si las semanas son de distinta temporada, si alguna tiene estadías declaradas o si falta el motivo; si procede, cada semana queda con la otra fracción y ambos titulares reciben aviso.
- **CA-12.11** — Dada una solicitud de intercambio de un Propietario, entonces solo puede ofrecer una semana propia por una de otra fracción de la misma temporada; el Administrador la aprueba (aplicando el intercambio) o la rechaza con motivo, y el solicitante recibe aviso en ambos casos.

## Dependencias
- TR-02 (habilitador) · HU-09 (fracciones) · base de HU-13, HU-14, HU-15, HU-17, HU-39, HU-43, HU-59 y HU-60.
