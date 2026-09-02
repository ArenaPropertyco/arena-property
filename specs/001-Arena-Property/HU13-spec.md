# HU-13 — Propietario visualiza el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Propietario, quiero ver el calendario de agendamiento de cada propiedad donde tengo fracción, para saber qué semanas puedo usar.

## Requisitos funcionales
- **RF-13.1** — Vista de calendario por propiedad accesible solo a propietarios de alguna fracción de esa propiedad, **con calendario activo o inactivo** (D-31).
- **RF-13.1b** — Con el calendario **inactivo**, la vista es de solo lectura: se ven las noches asignadas, las de los copropietarios y las de renta, sin acciones de declarar, cancelar ni reubicar, y con un aviso permanente del saldo pendiente (HU-58).
- **RF-13.2** — La vista es **por noches**: se resaltan las noches del cupo propio y su estado (disponible / con estadía declarada / usada), y se muestra el cupo restante por temporada (7/7/7/21 menos lo consumido). Las noches de **Fechas Especiales** (HU-60) se distinguen visualmente del cupo regular, indicando a qué fracción corresponden ese año.
- **RF-13.3** — Las noches de otras fracciones son visibles y no editables, mostrando **nombre y número de fracción** del copropietario pero **nunca sus datos de contacto** (D-16); los bloqueos del Administrador (HU-15), la bolsa institucional y las rentas a terceros se distinguen con su motivo.
- **RF-13.4** — La proyección del calendario (qué pinta cada celda según rol y fracción) es lógica pura en composable.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-13.1** — Dado un Propietario de la fracción 3/8, cuando se proyecta el calendario, entonces solo sus noches se marcan como propias/accionables y el cupo restante por temporada es correcto.
- **CA-13.2** — Dadas noches de otra fracción, entonces se proyectan con nombre y fracción del copropietario y sin ningún dato de contacto (correo o teléfono).
- **CA-13.3** — Dado un usuario sin fracción en la propiedad, entonces el acceso al calendario es denegado (RLS).

## Dependencias
- HU-12 (calendario y asignación) · HU-15 (bloqueos visibles).
