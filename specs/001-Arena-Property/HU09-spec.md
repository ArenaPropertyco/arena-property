# HU-09 — Dividir propiedad en 8 fracciones

Épica E3 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Administrador de Propiedad
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Administrador de Propiedad, quiero dividir una propiedad en 8 fracciones y definir su precio individual, para reflejar el modelo de copropiedad.

## Requisitos funcionales
- **RF-09.1** — Toda propiedad tiene exactamente 8 fracciones, numeradas 1/8 a 8/8; la numeración es única por propiedad y no editable.
- **RF-09.2** — Cada fracción tiene precio individual (> 0, en COP) y estado: `disponible` → `reservada` → `vendida` (con vuelta `reservada` → `disponible`; `vendida` es terminal salvo acción del Superadmin).
- **RF-09.3** — La creación de las 8 fracciones es atómica al fraccionar la propiedad; no pueden existir 7 ni 9.
- **RF-09.4** — El estado agregado de las fracciones alimenta el estado comercial de la propiedad (HU-08) y el conteo de disponibles del detalle (HU-02).
- **RF-09.5** — **Traspaso de titular (D-17):** el Superadmin puede cambiar el titular de una fracción `vendida` (reventa, herencia, cesión) como operación auditada, resolviendo explícitamente qué ocurre con las semanas ya confirmadas y las cuotas pendientes. No existe mercado secundario en el MVP.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-09.1** — Dado el fraccionamiento de una propiedad, entonces resultan exactamente 8 fracciones numeradas 1/8…8/8 sin duplicados.
- **CA-09.2** — Dado un precio ≤ 0, entonces la validación lo rechaza.
- **CA-09.3** — Dada la tabla de transiciones de estado de fracción, entonces las válidas pasan y las inválidas (p. ej. `vendida` → `disponible` sin Superadmin) se rechazan.
- **CA-09.4** — Dado un cambio de estado de fracción, entonces el estado comercial derivado de la propiedad se recalcula correctamente.
- **CA-09.5** — Dado un traspaso de titular por el Superadmin, entonces el nuevo titular queda vinculado, el anterior pierde acceso y existe el registro de auditoría con el destino de reservas y cuotas.

## Dependencias
- HU-08 (propiedad) · alimenta HU-02, HU-06, HU-12.
