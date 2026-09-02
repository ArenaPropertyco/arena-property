# HU-32 — Dashboard global de métricas (Superadmin)

Épica E2 · Sprint 4 · SP 8 · Prioridad **Should** · Rol: Superadmin
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md).

## Historia
Como Superadmin, quiero ver un dashboard global con métricas de toda la plataforma, para tomar decisiones de negocio.

## Requisitos funcionales
- **RF-32.1** — KPIs: total de propiedades, fracciones vendidas (y % sobre el total), administradores activos, propietarios, embajadores activos y comisiones generadas (pendientes + liberadas + pagadas).
- **RF-32.2** — Gráficos por periodo (mensual/trimestral/anual) de fracciones vendidas y comisiones, renderizados con `@unovis/vue` (complemento aprobado en [docs/stack.md](../../docs/stack.md), estilizado con las variables CSS de los tokens de marca). La agregación de las series es lógica pura testeable sobre datos tipados; el componente de gráfico solo recibe la serie ya calculada (RT-02).
- **RF-32.3** — Solo accesible al Superadmin; los KPIs se calculan sobre todas las propiedades sin filtro de asignación.
- **RF-32.4** — Cifras monetarias e importes según TR-02 (entero COP, formato de RF-D.5, IBM Plex Mono); ninguna métrica estimada sin su condición (RF-D.6).

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-32.1** — Dado un conjunto de datos conocido, cuando se calculan los KPIs, entonces cada valor coincide con el cálculo manual (incluye % de fracciones vendidas).
- **CA-32.2** — Dado un periodo seleccionado, cuando se agrega la serie, entonces los buckets y totales son correctos y la suma de buckets iguala el total.
- **CA-32.3** — Dado un rol no Superadmin, entonces el acceso al dashboard es denegado.

## Dependencias
- HU-09 (fracciones) · HU-54/HU-56 (comisiones) · HU-05 (administradores) · HU-49 (embajadores).
