# HU-23 — Gastos comunes con prorrateo y maestra de categorías

Épica E7 · Sprint 3 · SP 13 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).
⚠️ Define la maestra de categorías/cuentas que consumen HU-24, HU-25, HU-27, HU-40 y E11: diseñarla primero.

## Historia
Como Administrador de Propiedad, quiero registrar gastos comunes de una propiedad (mantención, servicios, limpieza), para que se prorrateen automáticamente entre las 8 fracciones.

## Requisitos funcionales
- **RF-23.1** — **Maestra contable**: catálogo administrable de categorías de ingreso/egreso, tipos de pago y cuentas contables; todo movimiento financiero referencia obligatoriamente entradas de la maestra.
- **RF-23.2** — Alta de gasto con monto (> 0, COP), categoría, tipo de pago, cuenta, fecha y descripción, sobre propiedades administradas.
- **RF-23.3** — **Prorrateo automático**: al registrar el gasto se generan las 8 cuotas aplicando la función canónica de [TR-02](./TR02-dinero-formatos-spec.md) RF-D.2 (entero COP, residuo a las primeras fracciones por número ascendente); la suma de las cuotas es exactamente igual al monto original y la cuota con residuo queda marcada (RF-D.3).
- **RF-23.4** — Un gasto no se elimina: se anula con motivo, revirtiendo sus cuotas de forma auditable.
- **RF-23.5** — **Las comisiones a Embajadores NO pertenecen a esta maestra (D-01):** son costo de plataforma de Arena, se registran en el libro de plataforma de HU-25 y jamás se prorratean entre las fracciones.
- **RF-23.6** — **Fracciones sin calendario activo (D-08, D-31):** el prorrateo es siempre 1/8 fijo; la cuota de cada fracción **no vendida o vendida con calendario inactivo** se imputa al **titular del inventario** (Arena o el vendedor), que figura como su pagador. El Propietario empieza a asumirla desde la primera causación posterior a la activación de su calendario. Ninguna cuota queda sin pagador ni se redistribuye entre los propietarios actuales.
- **RF-23.7** — Todo movimiento se imputa al periodo de su **fecha de causación**, no a la de su pago (D-09).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-23.1** — Dado un gasto de $100.000, entonces se generan 8 cuotas cuya suma es exactamente $100.000 y cada una vale $12.500.
- **CA-23.2** — Dado un monto no divisible ($100.001), entonces el reparto es el de TR-02 CA-D.2: 12.501 para la fracción 1/8, 12.500 para las demás, suma exacta y residuo marcado.
- **CA-23.3** — Dado un gasto sin categoría de la maestra o con monto ≤ 0, entonces se rechaza.
- **CA-23.4** — Dada la anulación de un gasto, entonces sus 8 cuotas quedan revertidas y el movimiento de anulación auditado.
- **CA-23.5** — Dada una propiedad con 3 fracciones de calendario activo y un gasto de $80.000, entonces se generan igualmente 8 cuotas de $10.000: 3 a cargo de esos propietarios y 5 a cargo del titular del inventario.
- **CA-23.7** — Dada una fracción vendida con calendario inactivo, entonces su cuota se imputa al titular del inventario; activado el calendario, la siguiente causación se imputa al Propietario.
- **CA-23.6** — Dado un intento de registrar una comisión de Embajador en esta maestra, entonces se rechaza por categoría no permitida.

## Dependencias
- HU-09 (fracciones) · alimenta HU-19, HU-24, HU-25, HU-27, HU-40, HU-54.
