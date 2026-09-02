# HU-18 — Dashboard del Propietario

Épica E5 · Sprint 3 · SP 8 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero un dashboard donde vea todas mis propiedades (fracciones) en un solo lugar, incluyendo el detalle de ingresos generados por reservas a terceros, para gestionar mi portafolio.

## Requisitos funcionales
- **RF-18.1** — Tarjeta por propiedad/fracción con: número de fracción, próxima estadía (si existe) y estado de cuenta (saldo del periodo).
- **RF-18.2** — Cuando la propiedad tiene ingresos por reserva a terceros (HU-40), la tarjeta muestra el detalle prorrateado que corresponde a la fracción.
- **RF-18.3** — El armado del resumen (próxima estadía, saldo, ingresos prorrateados) es lógica pura en composables sobre datos tipados.
- **RF-18.4** — El Propietario solo ve sus propias fracciones (RLS); un Propietario con fracciones en varias propiedades las ve todas.
- **RF-18.5** — La tarjeta muestra el estado del **plan de pagos** y del **interruptor de calendario** de la fracción (HU-58, D-31) mientras no esté completado —con el saldo pendiente y qué falta para activarlo—, y el listado de copropietarios de la propiedad con nombre y fracción, sin datos de contacto (D-16).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-18.1** — Dado un Propietario con 2 fracciones en propiedades distintas, entonces el dashboard arma exactamente 2 tarjetas con los datos correctos.
- **CA-18.2** — Dadas reservas futuras y pasadas, entonces "próxima estadía" es la reserva futura más cercana; sin futuras, el estado vacío traducido.
- **CA-18.3** — Dado un ingreso por tercero de $X en la propiedad, entonces la tarjeta muestra $X/8 para la fracción, sin redondeo silencioso (RT-08).

## Dependencias
- HU-09 (fracciones) · HU-14/HU-20 (reservas) · HU-19/HU-40 (finanzas).
