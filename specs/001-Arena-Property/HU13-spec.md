# HU-13 — Propietario visualiza el calendario

Épica E4 · Sprint 2 · SP 5 · Prioridad **Must** · Rol: Propietario
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).
> **Revisión 2026-09-09 (D-33):** la vista es por semanas completas; ya no se pintan noches.
> **Revisión 2026-09-15 (D-42, D-43):** la semana es la unidad definitiva, y la semana liberada se sigue viendo hasta saber si se rentó.

## Historia
Como Propietario, quiero ver el calendario de cada propiedad donde tengo fracción, para saber qué semanas son mías, cuáles debo confirmar y cuáles usan los demás.

## Requisitos funcionales
- **RF-13.1** — Vista de calendario por propiedad accesible solo a propietarios de alguna fracción de esa propiedad, **con calendario activo o inactivo** (D-31).
- **RF-13.1b** — Con el calendario **inactivo**, la vista es de solo lectura: se ven las semanas propias, las de los copropietarios, los bloqueos y las de renta, sin acciones de confirmar, cancelar ni liberar, y con un aviso permanente del saldo pendiente (HU-58).
- **RF-13.2** — La vista es **por semanas**: cada semana de la rejilla muestra su temporada (alta, media-alta, media, baja) y, si es propia, su estado: **elegida** (pendiente de confirmar, con la fecha límite), **confirmada**, **usada** (ya pasó), **liberada** (en la bolsa de renta, todavía sin colocar) o **rentada a un tercero**. Se muestra el cupo por temporada: semanas elegidas, confirmadas y liberadas frente a las que dicta el criterio.
- **RF-13.3** — Las semanas de otras fracciones son visibles y no editables, mostrando **nombre y número de fracción** del copropietario pero **nunca sus datos de contacto** (D-16); los bloqueos del Administrador (HU-15), la bolsa del Administrador y las semanas en renta se distinguen con su motivo o etiqueta. Si un mismo titular posee **varias fracciones**, su nombre **se repite** en cada una (D-44): no se agrupan ni se oculta la repetición.
- **RF-13.2b** — **La semana liberada se sigue viendo (D-43).** Quien libera una semana ve si sigue en la bolsa de renta o si ya se rentó a un tercero, y en ese caso que el ingreso es de su fracción, neto de comisión (HU-40 RF-40.2). Mientras no se rente, la vista **no anticipa ningún importe**: liberar no paga por sí solo.
- **RF-13.4** — La proyección del calendario (qué pinta cada semana según rol y fracción) es lógica pura en `shared/`.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-13.1** — Dado un Propietario de la fracción 3/8, cuando se proyecta el calendario, entonces solo sus semanas se marcan como propias/accionables y el cupo por temporada es correcto.
- **CA-13.2** — Dadas semanas de otra fracción, entonces se proyectan con nombre y fracción del copropietario y sin ningún dato de contacto (correo o teléfono).
- **CA-13.3** — Dado un usuario sin fracción en la propiedad, entonces el acceso al calendario es denegado (RLS).
- **CA-13.4** — Dada una semana liberada por la fracción 3/8 y todavía sin rentar, entonces su Propietario la ve en la bolsa de renta y sin importe asociado; rentada a un tercero, la ve como rentada y con el ingreso atribuido a su fracción.
- **CA-13.5** — Dado un titular que posee las fracciones 2/8 y 5/8, entonces el calendario proyecta las dos por separado, cada una con su número y el mismo nombre, sin agruparlas (D-44).

## Dependencias
- HU-12 (calendario y selección) · HU-15 (bloqueos visibles) · HU-39/HU-40 (renta de la semana liberada e ingreso atribuido).
