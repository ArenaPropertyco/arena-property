# HU-53 — Listado de referidos con estado

Épica E11 · Sprint 3 · SP 5 · Prioridad **Must** · Rol: Embajador
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Embajador, quiero listar mis referidos y ver el estado de cada uno, para hacer seguimiento de mis ganancias.

## Requisitos funcionales
- **RF-53.1** — Listado de referidos propios con: nombre, fecha de referencia, propiedad/fracción de interés (si existe) y estado.
- **RF-53.2** — Estados posibles exactamente: **Registrado**, **En proceso de pago** (compró la fracción pero no completa el pago) y **Pago completado** (ciclo de HU-51).
- **RF-53.3** — Un referido `Registrado` **no muestra comisión** porque aún no existe compra ni precio pactado sobre el cual calcularla; desde `En proceso de pago` muestra el monto según la vigencia de su atribución (HU-52) y su estado de saldo: pendiente, en gracia (con fecha de habilitación) o disponible (HU-54).
- **RF-53.4** — Filtros por estado y periodo, y totalizadores de referidos por estado; filtrado y totalización como lógica pura.
- **RF-53.5** — El Embajador solo ve sus propios referidos (RLS); el Superadmin puede ver todos.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-53.1** — Dados referidos en los 3 estados, entonces los totalizadores por estado suman el total del listado.
- **CA-53.2** — Dado un filtro estado + periodo, entonces el resultado cumple ambos criterios.
- **CA-53.3** — Dado un referido atribuido bajo la vigencia V1 y ya en proceso de pago, entonces la comisión mostrada es la de V1 sobre el precio pactado; dado uno en estado `Registrado`, no se muestra monto alguno.
- **CA-53.4** — Dados referidos de otro Embajador, entonces no aparecen en el listado.

## Dependencias
- HU-51 (referidos y estados) · HU-52 (comisión por vigencia) · HU-54 (liberación).
