# HU-12 — Motor de calendario: temporadas, cupo de noches y rotación

Épica E4 · Sprint 2 · SP 13 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-11](../../docs/decisions.md), [D-12](../../docs/decisions.md), [D-13](../../docs/decisions.md), [D-27](../../docs/decisions.md) y [D-15](../../docs/decisions.md).
⚠️ Historia de mayor riesgo técnico del MVP: hacer spike del motor antes de comprometer.

## Historia
Como Administrador de Propiedad, quiero configurar el calendario de cada propiedad con sus temporadas y su reparto, para que las 8 fracciones reciban un cupo de noches equitativo año tras año.

## Requisitos funcionales
- **RF-12.1** — **Unidad de reserva: la noche (D-11).** Check-in 15:00, check-out 11:00, zona horaria `America/Bogota`. La rejilla de semanas **sábado a sábado** se ancla al primer sábado del año y contiene las **semanas completas que caben dentro del año (51 o 52)**; cada noche de la rejilla hereda la temporada de su semana. Las noches que quedan fuera —de enero al primer sábado y de la última semana al 31 de diciembre— forman la bolsa de **Fechas Especiales** (HU-60), de modo que **ninguna noche del año queda sin temporada ni sin dueño**. El cálculo de rejilla y bolsa es una función pura sobre el año.
- **RF-12.2** — El Administrador clasifica cada semana de la rejilla en `alta`, `media_alta`, `media` o `baja`, y marca dentro de la alta los **bloques pico**: Navidad, Año Nuevo y Semana Santa.
- **RF-12.3** — **Cupo (D-12):** el motor asigna a cada fracción 6 semanas concretas —1 alta, 1 media-alta, 1 media y 3 bajas— que constituyen su cupo anual de **42 noches (7 altas, 7 media-altas, 7 medias, 21 bajas)**. Las **3 o 4 semanas sobrantes** de la rejilla quedan en la bolsa del Administrador y se comportan como bloqueos (HU-15). El criterio es configurable por propiedad, con ese reparto por defecto.
- **RF-12.4** — **Rotación anual (D-13):** el reparto rota con un desplazamiento determinista (`año − año base` módulo 8), de modo que ninguna fracción repite posición dos años seguidos y en 8 años pasa por todas. La no repetición de temporada alta consecutiva es **invariante del motor**, no una validación de reserva.
- **RF-12.5** — **Bloques pico (D-27):** los bloques pico se asignan por rotación estricta e independiente, de forma que ninguna fracción recibe el mismo bloque dos años seguidos y, en 8 años, cada fracción pasa por cada bloque exactamente una vez.
- **RF-12.6** — El motor es una función pura en `shared/` (entrada: año, rejilla clasificada, criterio, año base; salida: cupo y noches asignadas por fracción) — determinista, repetible y testeable sin base de datos.
- **RF-12.7** — Si la rejilla no permite cumplir el criterio (menos de 8 semanas de alguna temporada, o menos de 24 bajas), la configuración se **rechaza** con un error explicativo antes de persistir.
- **RF-12.8** — **Sin acumulación (D-15):** el cupo es anual y las noches no usadas no se arrastran. Una noche sin estadía declarada a **60 días** de su fecha pasa a la bolsa de renta a terceros (HU-39), previo aviso al Propietario (TR-03). El motor asigna noches a las 8 fracciones **con independencia del interruptor de calendario** (D-31): las de una fracción inactiva simplemente fluyen a renta y su ingreso se prorratea.
- **RF-12.9** — Reconfigurar un calendario con estadías existentes exige confirmación y no las elimina: los conflictos se listan en la bandeja que resuelve el Administrador (HU-17).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-12.1** — Dado un año cualquiera, entonces la rejilla arranca el primer sábado, cada semana cubre 7 noches consecutivas y no hay huecos ni solapamientos.
- **CA-12.2** — Dada una rejilla válida y el criterio por defecto, entonces cada fracción recibe un cupo de exactamente 7 noches altas, 7 media-altas, 7 medias y 21 bajas.
- **CA-12.3** — Dada la asignación, entonces ninguna noche pertenece a dos fracciones y las no asignadas quedan en la bolsa del Administrador.
- **CA-12.4** — Dados dos años consecutivos, entonces ninguna fracción recibe la misma posición de reparto ni el mismo bloque pico.
- **CA-12.5** — Dados 8 años consecutivos, entonces cada fracción ocupa las 8 posiciones exactamente una vez y pasa por cada bloque pico exactamente una vez.
- **CA-12.6** — Dado el mismo año, rejilla y criterio ejecutados dos veces, entonces el resultado es idéntico.
- **CA-12.7** — Dada una rejilla con solo 7 semanas altas, entonces el motor retorna error de imposibilidad y no persiste nada.
- **CA-12.8** — Dado cualquier año, entonces la rejilla contiene 51 o 52 semanas completas, se reparten 48 y las restantes quedan en la bolsa del Administrador.
- **CA-12.9** — Dado cualquier año, entonces la unión de las noches de la rejilla y las de la bolsa de Fechas Especiales (HU-60) cubre todas las noches del año, sin huecos ni solapamientos.

## Dependencias
- TR-02 (habilitador) · HU-09 (fracciones) · base de HU-13, HU-14, HU-15, HU-17, HU-39, HU-43, HU-59 y HU-60.
