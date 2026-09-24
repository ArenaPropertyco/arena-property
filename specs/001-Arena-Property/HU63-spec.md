# HU-63 — Tablero de cobros mensuales por propiedad

Épica E7 · Sprint por asignar · SP 8 · Prioridad **Should** · Rol: Administrador de Propiedad / Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Se apoya en [D-08](../../docs/decisions.md), [D-09](../../docs/decisions.md), [D-10](../../docs/decisions.md) y [D-40](../../docs/decisions.md).
🆕 Historia nueva: es la cara operativa de [HU-62](./HU62-spec.md). HU-62 define el corte mensual, el cobro, el pago y el retiro desde el lado del Propietario; esta historia le da al Administrador y al Superadmin el tablero para cobrar lo que se debe y pagar lo que se debe a cada fracción. Esta historia no crea otro modelo de cobro: usa el de HU-62.

## Historia
Como Superadmin o Administrador de Propiedad, quiero ver por cada propiedad el estado de los pagos mensuales de cada fracción, cuánto debe y cuánto se le debe, para cubrir los gastos del mes y pagar las rentas que se generen.

## Requisitos funcionales
- **RF-63.1** — **Un tablero por propiedad y mes.** Para una propiedad y un mes ya cortado (RF-62.3), el tablero muestra las **8 fracciones** en una tabla, cada una con:
  - su número;
  - quién responde por ella: el Propietario o, si está sin vender o con el calendario inactivo, el **titular del inventario** (D-08), rotulado como tal;
  - el **saldo** de su billetera en esa propiedad (RF-62.2), en IBM Plex Mono;
  - la **naturaleza** del saldo;
  - el **estado** del cobro o del retiro;
  - si hay **comprobante enviado**.
  Las fracciones sin movimientos aparecen con saldo $0: no quedan huecos (CA-19.3).
- **RF-63.2** — **Cobro o pago según el signo.** Una función pura clasifica cada saldo:
  - negativo → **Cobro**: la fracción debe ese importe. Va en rojo.
  - positivo → **Pago**: la propiedad le debe ese importe a la fracción, por ejemplo por las rentas de sus semanas liberadas (D-39). Va en verde.
  - cero → **Al día**, en color neutro.
  Rojo y verde se reservan para cortes cerrados. El mes en curso se muestra como estimado y sin esos colores (RF-62.10).
- **RF-63.3** — **Resumen de la propiedad.** Sobre la tabla, el tablero muestra en IBM Plex Mono:
  - los ingresos y los gastos causados en el mes (D-09);
  - el **total por cobrar**;
  - lo **cobrado y confirmado**;
  - lo **en revisión**;
  - el **total por pagar** a las fracciones;
  - el **neto de caja** de la propiedad.
  Todas las cifras salen de la misma función pura que las filas, así que la suma de las 8 filas cuadra exactamente con el resumen (TR-02). Nunca se suma lo que está en revisión a lo confirmado (RT-08).
- **RF-63.4** — **Estado del comprobante.** En cada fila de Cobro se ve si el Propietario reportó un pago (RF-62.7). Si lo reportó, se ven el monto, la fecha, el medio de pago, la descripción y un enlace firmado y temporal al comprobante. Si no lo reportó, la fila dice «sin comprobante» y no ofrece confirmar nada.
- **RF-63.5** — **Botón de confirmación de pago.** Un pago reportado se **confirma** con un botón y un diálogo de confirmación que repite el monto, el medio y la fracción. Solo después de confirmar, el pago suma al saldo y el cobro queda `Pagado`, o sigue `Pendiente` por la diferencia si el pago fue parcial (RF-62.8).
  - La misma fila ofrece **Rechazar**, con motivo obligatorio.
  - La confirmación la valida la base, no el botón: se rechaza si el pago ya no está `Reportado`. Por eso dos clics o dos personas a la vez no confirman el mismo pago dos veces.
- **RF-63.6** — **Pagar lo que se debe a una fracción.** En las filas de Pago, el tablero muestra si el Propietario pidió el retiro (RF-62.9). El Administrador o el Superadmin registran el pago adjuntando el comprobante (Supabase Storage, bucket privado). Registrar el pago baja el saldo de la fracción, y ese pago no genera un egreso nuevo en la maestra (RF-56.5).
- **RF-63.7** — **Titular del inventario.** Las cuotas del titular del inventario se ven en su fila para que la propiedad cuadre, pero no generan un cobro al Propietario ni aparecen en ninguna billetera de Propietario (CA-62.4). Se saldan como una operación interna de Arena, y el tablero las muestra aparte, rotuladas.
- **RF-63.8** — **Quién ve qué (RLS).**
  - El Administrador ve y opera solo los tableros de sus propiedades asignadas.
  - El Superadmin ve todos y tiene además una **vista global**: una fila por propiedad con por cobrar, cobrado, en revisión y por pagar, que enlaza al tablero de cada una. En esa vista puede filtrar por propiedad, por mes y por naturaleza (cobro o pago).
  - Confirmar o rechazar pagos y registrar pagos a fracciones son capacidades nuevas del mapa de permisos: Superadmin `sí`, Administrador `solo sus propiedades`, Propietario `no`.
- **RF-63.9** — **Filtros del tablero.** El tablero de una propiedad filtra por mes (los cortes cerrados más el mes en curso como estimado), por naturaleza (cobro, pago o al día) y por estado (pendiente, en revisión, pagado).
- **RF-63.10** — **Preparado para una pasarela de pagos.** El tablero muestra el **canal** de cada pago (`manual` o `pasarela`, RF-62.11).
  - El botón de confirmación aplica solo a los pagos manuales. Un pago de pasarela llegará confirmado o rechazado por la notificación del proveedor y el tablero lo mostrará en modo lectura, con su referencia externa.
  - Hoy solo existe el canal manual (D-10), y esta historia no instala ninguna dependencia de pasarela.
- **RF-63.11** — **Auditoría y avisos.** Toda confirmación, todo rechazo y todo pago a una fracción se auditan (TR-01) con quién lo hizo y el motivo, cuando lo hay. El Propietario recibe aviso (TR-03) de la confirmación, del rechazo y del pago de su saldo (RF-62.13).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-63.1** — Dada una propiedad con saldos −$50.000 (fracción 1), +$630.000 (fracción 3), $0 (fracción 5) y sin movimientos en el resto, entonces el tablero muestra 8 filas:
  - fracción 1: Cobro, $50.000, en rojo;
  - fracción 3: Pago, $630.000, en verde;
  - fracción 5 y las demás: Al día, $0.
- **CA-63.2** — Dados esos mismos saldos, entonces el resumen da $50.000 por cobrar y $630.000 por pagar, y la suma de las filas coincide al peso con el resumen.
- **CA-63.3** — Dado un cobro sin pago reportado, entonces la fila dice «sin comprobante» y no ofrece confirmar. Dado un pago reportado, entonces muestra el monto, el medio, la descripción y el enlace al comprobante, y ofrece confirmar y rechazar.
- **CA-63.4** — Dado un pago reportado de $50.000 sobre un cobro de $50.000, cuando el Administrador de la propiedad lo confirma, entonces el cobro queda `Pagado`, el saldo de la fracción queda en $0, lo cobrado y confirmado sube $50.000 y queda un registro de auditoría con su autor.
- **CA-63.5** — Dado un pago ya confirmado, cuando se intenta confirmarlo otra vez, entonces la base lo rechaza y el saldo no cambia.
- **CA-63.6** — Dado un rechazo sin motivo, entonces no procede. Con motivo, el cobro vuelve a `Pendiente` y el saldo no cambia.
- **CA-63.7** — Dado un pago reportado por $20.000 sobre un cobro de $50.000 y confirmado, entonces el cobro sigue `Pendiente` por $30.000.
- **CA-63.8** — Dada una fracción con saldo +$630.000, cuando se registra su pago sin comprobante, entonces se rechaza. Con comprobante, el saldo de la fracción baja en ese monto.
- **CA-63.9** — Dada una fracción con el calendario inactivo, entonces su fila aparece rotulada como del titular del inventario y no genera un cobro al Propietario.
- **CA-63.10** — Dado un Administrador, entonces no puede leer ni operar el tablero de una propiedad que no tiene asignada. El Superadmin sí puede, y un Propietario no accede a ningún tablero.
- **CA-63.11** — Dados pagos en revisión, entonces aparecen en su propia cifra y no se suman a lo cobrado y confirmado.
- **CA-63.12** — Dado un pago con canal `pasarela`, entonces el tablero no ofrece el botón de confirmación y muestra su referencia externa.
- **CA-63.13** — Dada la vista global del Superadmin con dos propiedades, entonces cada fila coincide con el resumen del tablero de esa propiedad.

## Dependencias
- **HU-62** (corte, cobro, pago, retiro y el puerto `PaymentProvider`, que se implementa primero) · TR-01, TR-02 y TR-03 · HU-21 (dashboard del Administrador, punto de entrada) · HU-25 (reportes consolidados del Superadmin) · HU-07 (mapa de permisos) · D-08, D-09, D-10, D-39, D-40.
