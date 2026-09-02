# Arena Property — Registro de decisiones

Decisiones de negocio que resuelven los hallazgos del QA sobre las specs.
Cada una es la fuente de verdad de las specs que la implementan; cambiarlas exige actualizar este archivo primero.

## Dinero y programa de referidos

- **D-01 · La comisión es costo de Arena, no de la propiedad.** Vive en un **libro contable de plataforma** separado del libro de cada inmueble y **nunca** se prorratea a los copropietarios. Se contabiliza **una sola vez**, por devengo, al completarse el pago del referido; el pago del retiro solo mueve tesorería y no genera un segundo egreso. → HU-23, HU-25, HU-32, HU-54, HU-56.
- **D-02 · Periodo de gracia de 30 días.** La comisión liberada queda **en gracia** 30 días desde el pago completo y luego pasa a **disponible** para retiro. Si la compra se anula dentro de la gracia, se reversa con contra-asiento; si se anula después, Arena asume la pérdida y el Embajador conserva lo cobrado. → HU-54, HU-55.
- **D-03 · Ventana de atribución: 90 días.** El código atribuye si el prospecto se registra dentro de los 90 días del primer clic. Fuera de la ventana no hay atribución. Sigue vigente: primera atribución gana y nadie se auto-refiere. → HU-51.
- **D-04 · Una comisión por prospecto.** Solo la **primera** compra de fracción de un referido genera comisión; sus compras posteriores, no. → HU-51, HU-53, HU-54.
- **D-05 · Comisión porcentual sobre el precio pactado.** Si la vigencia es porcentual, se calcula sobre el **precio pactado en la compra** (el registrado en el plan de pagos), no sobre el precio de lista vigente hoy. La vigencia aplicable sigue siendo la de la fecha de atribución. → HU-52, HU-58.
- **D-06 · Retiros: mínimo $200.000 y retiro parcial.** El mínimo lo configura el Superadmin (valor inicial $200.000) y el Embajador elige cuánto retirar de su saldo disponible. → HU-56.
- **D-07 · Suspensión del Embajador según el motivo.** Administrativa: conserva todo su saldo y puede retirarlo. Fraude o incumplimiento: pierde lo que esté en gracia y lo pendiente, y el Superadmin decide sobre lo disponible dejando constancia. El motivo ya es obligatorio en HU-33. → HU-33, HU-55.

## Finanzas de la propiedad

- **D-08 · Las fracciones sin calendario activo las paga el titular del inventario.** El prorrateo es siempre 1/8 fijo; las cuotas de las fracciones aún no vendidas **y de las vendidas cuyo calendario sigue inactivo** (D-31) las asume Arena o el vendedor, de modo que toda cuota tiene pagador y la contabilidad cuadra. Simétrico para los ingresos por renta a terceros. → HU-23, HU-40, TR-02.
- **D-09 · Imputación por devengo.** Un movimiento se imputa al periodo de su **fecha de causación** (emisión del gasto o del ingreso), no a la de su pago. → HU-19, HU-24, HU-25, HU-40.

## Titularidad y activación

- **D-31 · Dos ejes independientes: titularidad e interruptor de calendario.** Al cerrarse la compra (HU-06) la fracción pasa a `vendida`, queda **asignada a su titular** y el comprador obtiene el rol `Propietario` de inmediato. El **derecho de uso** es un interruptor aparte, **derivado del plan de pagos** (HU-58) y nunca marcado a mano: `calendario inactivo` mientras el pago no esté completo, `calendario activo` al derivar `Pago completado`. Reglas asociadas:
  - **Con calendario inactivo:** el Propietario ve su dashboard, la ficha de su fracción, el calendario de la propiedad, las noches que le asignó el motor y a sus copropietarios, con un aviso permanente del saldo pendiente; **no** puede declarar estadías, reubicar noches ni participar en la ventana anual. Las noches de su fracción siguen su curso normal y pasan a renta a terceros a los 60 días (D-15), generando ingreso prorrateado.
  - **Gastos comunes:** mientras el calendario esté inactivo, la cuota de esa fracción la asume el titular del inventario (D-08); el Propietario empieza a pagarla desde la primera causación posterior a la activación. Sin derecho de uso no hay gasto común.
  - **Primer año:** al activarse a mitad de año, el Propietario recibe únicamente las noches de su asignación **aún no transcurridas**; las ya pasadas se perdieron y su renta fue prorrateada. Desde el 1 de enero siguiente entra con las 42 noches completas y su turno en la rotación.
  - **Anulación de la compra (HU-58 RF-58.7):** desactiva el calendario, revierte la titularidad, devuelve la fracción a `disponible`, cancela sus estadías futuras y manda sus noches a la bolsa de renta.
  → HU-06, HU-58, HU-12, HU-13, HU-14, HU-59, HU-60, HU-23, HU-07.

## Pagos de la fracción

- **D-10 · Plan de pagos manual, sin pasarela.** El Administrador registra abonos contra el precio pactado y el sistema **deriva** los estados: `Reservada` (sin abonos) → `En proceso de pago` (abonos > 0 y < precio) → `Pago completado` (suma de abonos = precio). Cada abono lleva fecha, monto, medio y comprobante. Ninguna pasarela entra al MVP. → nueva **HU-58**, HU-06, HU-53, HU-54.

## Calendario y uso

> **Revisado:** el Propietario reserva por **noches individuales, desde 1 noche**. La semana deja de ser la unidad de reserva y pasa a ser solo la unidad de clasificación y reparto.

- **D-11 · La noche es la unidad de reserva.** Check-in 15:00, check-out 11:00, zona horaria `America/Bogota`. La rejilla de semanas **sábado a sábado**, anclada al primer sábado del año, se conserva únicamente para clasificar temporadas y repartir el cupo: cada noche hereda la temporada de la semana a la que pertenece. → HU-12, HU-14, HU-43.
- **D-12 · Cupo anual de 42 noches por fracción.** Equivalente al reparto original de 6 semanas: **7 noches en alta, 7 en media-alta, 7 en media y 21 en baja**. La rejilla contiene las semanas completas sábado a sábado que caben en el año (**51 o 52**): 48 se reparten y las **3 o 4 sobrantes** quedan como bolsa de mantenimiento y uso institucional del Administrador. → HU-12, HU-15, HU-43.
- **D-30 · Fechas Especiales (bolsa comodín).** Las noches que quedan **fuera de la rejilla** —entre el 1 de enero y el primer sábado, y entre la última semana completa y el 31 de diciembre, **de 1 a 9 noches según el año**— no quedan huérfanas: forman la bolsa de **Fechas Especiales**, pensada para escapadas cortas. Reglas:
  - **Temporada.** Cada noche de la bolsa hereda la temporada de la semana contigua de la rejilla (la primera del año para las de cabeza, la última para las de cola). En la práctica el 31 de diciembre y el 1 de enero son temporada alta.
  - **Reparto por rotación estricta.** La bolsa es demasiado pequeña para dividirla entre 8 cada año, así que se asigna **completa a una fracción por año**, rotando: en 8 años cada fracción la recibe exactamente una vez, incluido el fin de año. El cupo es igual por ciclo, no por año.
  - **Uso.** Estadías de **1 a 3 noches**, sin mínimo, divisibles.
  - **Respeto del derecho de temporada alta.** Una noche comodín en temporada alta **descuenta del cupo alto** de esa fracción y nunca puede caer dentro de un bloque pico asignado a otra fracción (D-27). Nadie obtiene más tiempo alto del que le toca ese año.
  - **Elección y caducidad.** Las fechas concretas se eligen durante el turno de esa fracción en la ventana anual (HU-59); lo no usado a 60 días pasa a la bolsa de renta a terceros (D-15).
  → nueva **HU-60**, HU-12, HU-14, HU-59, HU-43.
- **D-13 · Asignación rotativa anual (fase 1).** El motor asigna a cada fracción 6 semanas concretas —origen de sus 42 noches— y rota el reparto cada año, de modo que ninguna fracción repite posición dos años seguidos y en 8 años pasa por todas. La no repetición de temporada alta consecutiva sigue siendo **invariante del motor**. → HU-12.
- **D-27 · Rotación estricta de bloques pico.** Navidad, Año Nuevo y Semana Santa se marcan como **bloques pico** dentro de la temporada alta y se asignan por rotación estricta: ninguna fracción recibe el mismo bloque pico dos años seguidos y, en 8 años, cada fracción pasa por cada bloque. Es la regla que evita el conflicto real entre copropietarios. → HU-12.
- **D-28 · Ventana anual de reubicación por turno rotativo (fase 2).** Cerrada la asignación se abre una ventana en la que, **por turnos que rotan cada año**, cada Propietario puede mover parte de sus noches a otras fechas libres y dividirlas en las estadías que quiera. Regla dura: **una noche solo se reubica dentro de su misma temporada**, para que nadie convierta noches bajas en altas. Cerrada la ventana, lo no reubicado queda en sus fechas asignadas y las noches libres se abren por orden de llegada (fase 3). → nueva **HU-59**, HU-12, HU-14.
- **D-29 · Estadía mínima por temporada.** Alta: 3 noches. Media-alta: 2 noches. Media y baja: 1 noche. Evita trocear la temporada alta en noches sueltas imposibles de rentar y deja libre el uso corto en temporada baja. → HU-14, HU-39.
- **D-14 · Cancelación hasta 30 días antes.** Una estadía confirmada se cancela hasta 30 días antes de su inicio y sus noches pasan a la bolsa de renta a terceros; dentro de los 30 días la cancelación se rechaza. Plazo configurable por el Superadmin. → HU-14, HU-39.
- **D-15 · Noches sin estadía declarada van a renta.** Una noche del cupo que siga sin estadía declarada a **60 días** de su fecha pasa automáticamente a la bolsa de renta a terceros, previo aviso. Las noches no usadas **no se acumulan** al año siguiente. → HU-12, HU-14, HU-39.
- **D-16 · Los copropietarios se ven entre sí.** En el calendario, un Propietario ve **nombre y fracción** de los otros siete y qué noches ocupan, pero **no** sus datos de contacto. → HU-13, HU-18.

## Ciclo de vida y operación

- **D-17 · Traspaso de fracción: operación manual del Superadmin.** No hay mercado secundario en el MVP, pero el Superadmin puede cambiar el titular de una fracción como operación auditada, decidiendo explícitamente qué ocurre con las reservas futuras y las cuotas pendientes. → HU-09, HU-33.
- **D-18 · Estados de propiedad, vocabulario único.** Visibilidad: `En borrador` → `Publicada` ↔ `Inactiva`. Comercial: `Próximamente` se marca a mano; `Fracciones disponibles` y `Vendido` se **derivan** de los estados de las 8 fracciones. "Lista de espera" no es un estado: es la condición derivada de no tener fracciones disponibles. → HU-01, HU-02, HU-08, HU-47.
- **D-19 · Bandeja de notificaciones transversal.** El canal de notificaciones (in-app + correo) y la bandeja dejan de vivir dentro de HU-30 y pasan a la spec transversal **TR-03**, que usan propietarios, administradores y embajadores por igual. → TR-03, HU-16, HU-29, HU-30, HU-31, HU-57.
- **D-20 · El Superadmin ve los saldos de los Embajadores.** Corrige la matriz de permisos del VSM, que se lo negaba pese a exigirle aprobar los retiros. → HU-07, HU-53, HU-55, HU-56.

## Plataforma

- **D-21 · Correo transaccional por Resend vía REST**, sin SDK; verificación de cuenta por el SMTP de Supabase Auth. → [stack.md](./stack.md).
- **D-22 · Gráficos con `@unovis/vue`; CSV con función pura propia.** → HU-32, HU-25.
- **D-23 · `motion-v` sustituye a `framer-motion`** (librería de React, no utilizable aquí). → [stack.md](./stack.md).
- **D-24 · Formularios públicos con límite de tasa** por IP y correo, para no convertir el envío de correo en un vector de abuso. → HU-03, HU-46, HU-47.
- **D-25 · Datos de terceros y de lista de espera** se guardan con consentimiento explícito y se conservan 5 años (plazo fiscal); después se anonimizan. → HU-39, HU-47.
- **D-26 · Replanificación dentro de los 4 sprints.** Los habilitadores TR-01, TR-02 y la nueva HU-58 entran al Sprint 1; TR-03 y HU-52 suben al Sprint 2; las cuatro subpáginas institucionales (HU-41 a HU-44), HU-47 y HU-48 bajan al Sprint 2. Total: 313 SP repartidos en 87 / 81 / 81 / 64. → [specs.md](../specs/001-Arena-Property/specs.md).
