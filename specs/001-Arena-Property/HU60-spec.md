# HU-60 — Fechas Especiales (bolsa comodín)

Épica E4 · Sprint 3 · SP 5 · Prioridad **Should** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-30](../../docs/decisions.md).
🆕 Historia nueva: cierra el hueco de las noches que quedaban fuera de la rejilla, sin semana, sin temporada y sin dueño.

## Historia
Como Propietario, quiero disponer de una bolsa comodín de Fechas Especiales para escapadas cortas, para aprovechar las noches que no caben en la rejilla sin obtener más tiempo de temporada alta del que me corresponde.

## Requisitos funcionales
- **RF-60.1** — **Composición de la bolsa.** La integran las noches que quedan fuera de la rejilla de HU-12: las que van del 1 de enero al primer sábado y las que van de la última semana completa al 31 de diciembre. Su tamaño es de **1 a 9 noches** según el año y el cálculo es una función pura sobre el año.
- **RF-60.2** — **Temporada heredada.** Cada noche de la bolsa toma la temporada de la semana contigua de la rejilla: las de cabeza, la de la primera semana del año; las de cola, la de la última. Ninguna noche del año queda sin temporada.
- **RF-60.3** — **Reparto por rotación estricta.** La bolsa se asigna **completa a una sola fracción por año**, con un desplazamiento determinista independiente del de HU-12: en 8 años cada fracción la recibe exactamente una vez. El cupo es igual **por ciclo de 8 años**, no por año, porque la bolsa es menor que 8 noches en la mayoría de los años.
- **RF-60.4** — **Estadías comodín.** De **1 a 3 noches**, sin mínimo de temporada, divisibles en varias estadías dentro de la bolsa. El tope de 3 noches se aplica por estadía.
- **RF-60.5** — **Respeto del cupo de temporada.** Una noche comodín que caiga en temporada alta **descuenta del cupo alto** (7 noches) de esa fracción; si no le queda cupo alto, la noche no se puede usar. Las de temporada baja descuentan del cupo bajo, y así por temporada.
- **RF-60.6** — **Bloques pico ajenos.** Una noche comodín nunca puede caer dentro de un bloque pico asignado a otra fracción (D-27), aunque la bolsa le pertenezca ese año.
- **RF-60.7** — **Elección y caducidad.** Las fechas concretas se eligen durante el turno de esa fracción en la ventana anual (HU-59). Las noches comodín sin estadía declarada a **60 días** de su fecha pasan a la bolsa de renta a terceros (D-15, HU-39). Si la fracción que recibe la bolsa ese año tiene el calendario inactivo (D-31), la bolsa completa fluye a renta sin reasignarse a otra fracción: la rotación no se altera.
- **RF-60.8** — La asignación de la bolsa y cada estadía comodín se auditan (TR-01) y se notifican (TR-03). El calendario del Propietario (HU-13) muestra la bolsa como tal, distinguiéndola de su cupo regular.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-60.1** — Dado cualquier año, entonces la unión de las noches de la rejilla y las de la bolsa cubre **todas** las noches del año, sin huecos ni solapamientos.
- **CA-60.2** — Dado un año que empieza en sábado, entonces la bolsa tiene 1 noche; dado uno que empieza en domingo, tiene el máximo del rango, y en ningún caso supera 9.
- **CA-60.3** — Dadas las noches de cabeza y de cola, entonces heredan la temporada de la primera y la última semana de la rejilla respectivamente.
- **CA-60.4** — Dados 8 años consecutivos, entonces cada fracción recibe la bolsa exactamente una vez.
- **CA-60.5** — Dada una estadía comodín de 4 noches, entonces se rechaza por exceder el tope; de 1 noche en temporada alta, se acepta si hay cupo alto disponible.
- **CA-60.6** — Dada una fracción con su cupo de 7 noches altas ya consumido, cuando intenta usar una noche comodín de temporada alta, entonces se rechaza por cupo agotado.
- **CA-60.7** — Dada una noche comodín que cae dentro del bloque pico asignado a otra fracción, entonces se rechaza.
- **CA-60.8** — Dadas noches comodín sin estadía a 59 días de su fecha, entonces ya figuran en la bolsa de renta a terceros.

## Dependencias
- TR-01, TR-03 (habilitadores) · HU-12 (rejilla, temporadas, cupo y bloques pico) · HU-59 (ventana y turnos) · HU-14 (estadías) · HU-39 (bolsa de renta) · HU-13 (visualización).
