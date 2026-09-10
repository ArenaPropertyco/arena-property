# Arena Property — Reglas de agendamiento

Fuente única y legible de las reglas del calendario. Está escrito para **cambiarse**: los valores de la
sección 2 se modifican sin tocar el motor; los de la sección 3 no se cambian sin una decisión nueva en
[docs/decisions.md](../../docs/decisions.md).

Specs que lo implementan: [HU-12](./HU12-spec.md), [HU-13](./HU13-spec.md), [HU-14](./HU14-spec.md),
[HU-15](./HU15-spec.md), [HU-17](./HU17-spec.md), [HU-39](./HU39-spec.md), [HU-59](./HU59-spec.md), [HU-60](./HU60-spec.md).

---

## 1. Vocabulario

| Término | Definición |
|---|---|
| **Semana** | Unidad de uso (D-33). Va del sábado a las 15:00 al sábado siguiente a las 11:00, en `America/Bogota`. |
| **Noche** | Unidad de la rejilla y del check-in/check-out; por ahora no se reserva suelta (D-33). |
| **Rejilla** | Conjunto de semanas completas sábado→sábado que caben dentro del año (51 o 52), anclada al primer sábado. |
| **Temporada** | Clasificación de cada semana de la rejilla: `alta`, `media_alta`, `media`, `baja`. Toda noche hereda la de su semana. |
| **Bloque pico** | Semana alta marcada como especialmente disputada: Navidad, Año Nuevo, Semana Santa. |
| **Cupo** | Derecho anual de una fracción: 42 noches (7 altas, 7 media-altas, 7 medias, 21 bajas). |
| **Bolsa del Administrador** | Las 3 o 4 semanas de la rejilla que no se reparten; mantenimiento y uso institucional. |
| **Fechas Especiales** | Noches del año que quedan fuera de la rejilla (1 a 9). Aplazadas (D-33): por ahora van a la bolsa del Administrador. |
| **Bolsa de renta** | Semanas liberadas, canceladas, caducadas o no elegidas, disponibles para renta a terceros. |
| **Semana confirmada** | Semana elegida que el Propietario confirmó como uso propio antes de 60 días (D-33). |
| **Ventana** | Periodo anual en que las fracciones, por turnos rotativos, reubican semanas elegidas a otras libres de la misma temporada (D-36). |
| **Calendario activo** | Interruptor derivado del plan de pagos; sin él la fracción no puede reservar. |

---

## 2. Parámetros configurables

Se cambian por configuración, sin tocar el motor ni las specs.

| # | Parámetro | Valor por defecto | Ámbito | Quién lo cambia | Spec |
|---|---|---|---|---|---|
| P-01 | Ancla de la rejilla | Primer sábado del año | Global | Superadmin | HU-12 RF-12.1 |
| P-02 | Hora de check-in / check-out | 15:00 / 11:00 | Propiedad | Administrador | HU-12 RF-12.1 |
| P-03 | Zona horaria | `America/Bogota` | Global | Superadmin | HU-12 RF-12.1 |
| P-04 | Reparto por fracción | 1 alta, 1 media-alta, 1 media, 3 bajas | Propiedad | Administrador | HU-12 RF-12.3 |
| P-05 | Clasificación de temporada por semana | Definida cada año | Propiedad / año | Administrador | HU-12 RF-12.2 |
| P-06 | Bloques pico | Navidad, Año Nuevo, Semana Santa | Propiedad / año | Administrador | HU-12 RF-12.2 |
| P-07 | Orden de selección de semanas | Primer año: orden de compra; después, el que fije el Administrador (sugerido: rotar el anterior) | Propiedad / año | Administrador | HU-12 RF-12.4, RF-12.5 |
| P-08 | Estadía mínima por temporada | Suspendido (D-33) | Propiedad | Superadmin | HU-14 RF-14.2 |
| P-09 | Tope de estadía comodín | Aplazado (D-33) | Propiedad | Superadmin | HU-60 RF-60.4 |
| P-10 | Plazo de cancelación de una semana confirmada | 30 días antes de su entrada | Propiedad | Superadmin | HU-14 RF-14.6 |
| P-11 | Plazo para confirmar una semana elegida | 60 días antes de su entrada | Propiedad | Superadmin | HU-14 RF-14.7 |
| P-12 | Apertura de la ventana de reubicación | 1 de octubre del año anterior, 00:00 | Propiedad / año | Superadmin | HU-59 RF-59.1 |
| P-13 | Duración de la ventana | 16 días | Propiedad | Superadmin | HU-59 RF-59.1 |
| P-14 | Duración del turno | 48 horas por fracción | Propiedad | Superadmin | HU-59 RF-59.1 |

> **Regla de oro:** cambiar un parámetro **no** puede alterar cupos ni asignaciones de un año ya publicado.
> Un cambio rige desde el siguiente año calendario, salvo P-02, P-08, P-09, P-10 y P-11, que rigen desde su fecha de vigencia.

---

## 3. Reglas invariantes

No se cambian por configuración. Cambiarlas exige decisión nueva en `docs/decisions.md`, actualizar la spec y los tests.

| # | Invariante | Decisión | Verificado por |
|---|---|---|---|
| I-01 | Ninguna noche del año queda sin temporada ni sin dueño: rejilla ∪ noches sobrantes (bolsa del Administrador mientras HU-60 esté aplazada) = año completo | D-30, D-33 | CA-60.1, CA-12.9 |
| I-02 | El cupo por temporada de una fracción es 1/1/1/3 semanas (7/7/7/21 noches) y no cambia por reubicar | D-12, D-28, D-36 | CA-59.2 |
| I-03 | Una semana solo se reubica dentro de su misma temporada, y solo si sigue elegida sin confirmar | D-28, D-36 | CA-59.1, CA-59.4 |
| I-04 | Una semana pertenece a lo sumo a una fracción y a lo sumo a una ocupación (confirmación, bloqueo o renta) | D-33 | CA-12.3, CA-14.9 |
| I-05 | Cada fracción elige exactamente 1 alta, 1 media-alta, 1 media y 3 bajas, y elige solo cuando le llega el turno | D-12, D-32 | CA-12.2, CA-12.5 |
| I-06 | Una semana se intercambia solo por otra de la misma temporada y sin estadías encima; la bolsa comodín rota entre las 8 fracciones | D-28, D-32, D-30 | CA-12.10, CA-60.4 |
| I-07 | (Aplazada con HU-60) Una noche comodín en temporada alta descuenta del cupo alto y nunca cae en bloque pico ajeno | D-30, D-33 | CA-60.6, CA-60.7 |
| I-08 | Sin calendario activo no se elige, confirma, cancela ni libera ninguna semana | D-31 | CA-14.0 |
| I-09 | Las semanas no usadas no se acumulan al año siguiente | D-15 | CA-14.7 |
| I-10 | El orden de turnos es determinista y auditado: el primer año sale del orden de compra y los siguientes de una sugerencia rotada que el Administrador confirma | D-32 | CA-12.4, CA-12.6 |

---

## 4. Ciclo anual

```
  Oct (año N-1)        Ene (año N)                                    Todo el año N
  ─────────────        ───────────                                    ─────────────
  1. El Administrador  2. Cada Propietario elige sus 6 semanas        4. Cada Propietario confirma sus
     clasifica el año     por turnos (orden de compra el primer          semanas; libera las que no use
     y fija el orden      año; después el que fije el Administrador)
                       3. Intercambios de semanas (RF-12.6)          5. A 60 días: semana sin confirmar
                       3b. Ventana de reubicación por turnos             → bolsa de renta
                           rotativos de 48 h (HU-59, D-36)            6. A 30 días: se cierra la cancelación
```

---

## 5. Cómo modificar una regla

1. **Parámetro (sección 2):** cambiarlo en la configuración de la propiedad. No requiere PR ni cambio de spec.
2. **Invariante (sección 3):** en este orden — (a) nueva decisión `D-nn` en `docs/decisions.md` con su justificación;
   (b) actualizar la spec y sus `CA`; (c) actualizar este documento; (d) actualizar los tests que citan esos `CA`;
   (e) recién entonces tocar el motor.
3. Nunca al revés: el motor no es la fuente de verdad de una regla (principio 2 de la constitución).
