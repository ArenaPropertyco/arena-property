# Arena Property — Especificación 001 (MVP)

Documento maestro de la metodología SDD. Toda tarea de desarrollo nace de una spec `HUXX-spec.md`
de esta carpeta y debe cumplir [docs/constitution.md](../../docs/constitution.md) y
[.claude/AGENTS.md](../../.claude/AGENTS.md). Fuente de negocio:
[docs/arena-property-VSM-Historias-Usuario-Specs.md](../../docs/arena-property-VSM-Historias-Usuario-Specs.md).

**Alcance:** 55 historias de usuario (52 del VSM + HU-58, HU-59 y HU-60) · 3 requisitos transversales habilitadores · 11 épicas · 4 sprints · **326 SP** · sin backlog post-MVP.

Las reglas de negocio que el VSM dejaba abiertas están resueltas en [docs/decisions.md](../../docs/decisions.md) (D-01…D-30); cada spec referencia las decisiones que implementa.

## Roles

| Rol | Alcance |
|---|---|
| Superadmin | Global: todas las propiedades, roles, comisiones, reportes, cuentas |
| Administrador de Propiedad | Solo sus propiedades asignadas: CRUD (sin eliminar), calendario, inventario, gastos, novedades, reservas a terceros |
| Propietario | Sus fracciones: dashboard, reserva de semanas, finanzas prorrateadas, lectura de inventario |
| Embajador | Rol adicional sobre Usuario o Propietario: código de referido, atribución, billetera, retiros |
| Usuario | Cuenta registrada sin fracciones; se convierte en Propietario al cerrar compra (HU-06) |
| Visitante | Sitio público: home, catálogo, ficha, páginas institucionales, contacto, lista de espera |

La matriz de permisos completa vive en la sección 2 del documento VSM y es la referencia
obligatoria para las políticas RLS y los middleware de rol.

## Requisitos transversales (RT)

Aplican a **todas** las specs; cada `HUXX-spec.md` los referencia y no los repite.

- **RT-01 Stack cerrado.** Solo el stack y módulos del principio 1 de la constitución.
- **RT-02 Dominio antes que interfaz.** Reglas de negocio en `app/composables/`, `shared/` y SQL; los `.vue` solo presentan y emiten eventos. Ningún `.vue` consulta Supabase ni calcula reglas.
- **RT-03 Todo criterio de aceptación se prueba.** Los CA de cada spec son la base de los tests. Las reglas de dominio se prueban con test unitario en Vitest + `@nuxt/test-utils`; las pantallas de contenido (HU-00, HU-41…HU-44, HU-48) se prueban con **test de contrato** sobre su manifiesto tipado de secciones, rutas e i18n — nunca contra el marcado renderizado. La apariencia no se prueba; ninguna spec queda sin test. Bug = test rojo primero.
- **RT-04 Supabase única fuente de verdad.** Esquema solo por migraciones en `supabase/migrations/`; toda tabla nace con RLS y políticas alineadas a la matriz de permisos; tipos generados.
- **RT-05 i18n.** Código en inglés; todo texto visible por claves en `i18n/locales/en.json` y `es.json` con paridad de claves. Cero strings hardcodeados.
- **RT-06 Responsive y bitema.** Toda vista funciona de 320px a desktop, en tema claro y oscuro, desde el primer commit.
- **RT-07 Marca.** Colores y tipografías solo desde los tokens de `@nuxt/ui` derivados del manual de marca (Oro Arena `#CB9E4E`, Café Arena `#593824`, Carbón `#0D0D0B`, Tinta `#1C1C1A`, Arena `#F7F2E4`; verde `#2D6A4F` solo confirmado, rojo `#C0392B` solo alerta/sin confirmar; Cormorant Garamond / DM Sans / IBM Plex Mono). Diseño luxury minimalista.
- **RT-08 Honestidad en los datos.** Ninguna cifra estimada se muestra como confirmada; prorrateos sin redondeo silencioso; todo movimiento financiero y de agenda deja registro auditable.
- **RT-09 Idioma de trabajo.** Comentarios y documentación en español con buena ortografía.
- **RT-10 Dinero y formatos.** Todo importe, prorrateo, porcentaje y formato numérico sigue [TR-02](./TR02-dinero-formatos-spec.md): entero COP, reparto determinista de residuos, porcentajes en puntos básicos.
- **RT-11 Auditoría.** Toda mención de "auditado", "auditable" o "queda registrado" en cualquier spec se implementa según [TR-01](./TR01-auditoria-spec.md): registro append-only, escrito en la misma transacción que la operación.
- **RT-12 Uso de los módulos aprobados.** Cada módulo de [docs/stack.md](../../docs/stack.md) tiene un uso obligatorio asignado y verificable: `nuxt-aos` (animación de entrada de las secciones de E1), `nuxt-gtag` (analítica del embudo público: vistas y activación de CTA en HU-00 y HU-41…HU-48), `@tresjs/nuxt` (visor 3D del plano elevado, HU-02), `@formkit/auto-animate` (transiciones de listas en HU-18, HU-21, HU-53, HU-55), `@nuxt/image` (galerías de HU-01/HU-02/HU-08), `@nuxtjs/seo` (todas las rutas públicas de E1) y `@unovis/vue` (gráficos de HU-32). Ningún módulo aprobado queda sin historia que lo exija.

## Convenciones de las specs

- Archivo por historia: `HUXX-spec.md` (numeración del VSM; no existen HU34–HU38 ni HU45).
- Archivo por requisito transversal habilitador: `TRXX-*-spec.md`. Son specs completas, con sus propios RF y CA, y se implementan **antes** que las historias que dependen de ellas.
- **RF-XX.n**: requisito funcional verificable — insumo directo de las pruebas unitarias.
- **CA-XX.n**: criterio de aceptación en formato Dado / Cuando / Entonces — se traduce 1:1 a tests.
- Las dependencias entre historias se declaran al final de cada spec y ordenan la implementación.

## Índice de especificaciones

| Épica | Historias |
|---|---|
| E1 Catálogo y Descubrimiento | [HU00](./HU00-spec.md) · [HU01](./HU01-spec.md) · [HU02](./HU02-spec.md) · [HU03](./HU03-spec.md) · [HU41](./HU41-spec.md) · [HU42](./HU42-spec.md) · [HU43](./HU43-spec.md) · [HU44](./HU44-spec.md) · [HU46](./HU46-spec.md) · [HU47](./HU47-spec.md) · [HU48](./HU48-spec.md) |
| E2 Onboarding y Roles | [HU04](./HU04-spec.md) · [HU05](./HU05-spec.md) · [HU06](./HU06-spec.md) · [HU07](./HU07-spec.md) · [HU32](./HU32-spec.md) · [HU58 🆕](./HU58-spec.md) |
| E3 Gestión de Propiedades | [HU08](./HU08-spec.md) · [HU09](./HU09-spec.md) · [HU10](./HU10-spec.md) · [HU11](./HU11-spec.md) |
| E4 Calendario y Agendamiento | [HU12](./HU12-spec.md) · [HU13](./HU13-spec.md) · [HU14](./HU14-spec.md) · [HU15](./HU15-spec.md) · [HU16](./HU16-spec.md) · [HU17](./HU17-spec.md) · [HU39](./HU39-spec.md) · [HU59 🆕](./HU59-spec.md) · [HU60 🆕](./HU60-spec.md) |
| E5 Dashboard del Propietario | [HU18](./HU18-spec.md) · [HU19](./HU19-spec.md) · [HU20](./HU20-spec.md) |
| E6 Dashboard del Administrador | [HU21](./HU21-spec.md) · [HU22](./HU22-spec.md) |
| E7 Finanzas prorrateadas | [HU23](./HU23-spec.md) · [HU24](./HU24-spec.md) · [HU25](./HU25-spec.md) · [HU40](./HU40-spec.md) |
| E8 Inventario y Mantenimiento | [HU26](./HU26-spec.md) · [HU27](./HU27-spec.md) · [HU28](./HU28-spec.md) |
| E9 Notificaciones y Comunicación | [HU29](./HU29-spec.md) · [HU30](./HU30-spec.md) · [HU31](./HU31-spec.md) |
| E10 Panel Superadmin | [HU33](./HU33-spec.md) |
| **Transversales (habilitadores)** | [TR-01 Auditoría](./TR01-auditoria-spec.md) · [TR-02 Dinero y formatos](./TR02-dinero-formatos-spec.md) · [TR-03 Notificaciones](./TR03-notificaciones-spec.md) |
| E11 Programa de Referidos | [HU49](./HU49-spec.md) · [HU50](./HU50-spec.md) · [HU51](./HU51-spec.md) · [HU52](./HU52-spec.md) · [HU53](./HU53-spec.md) · [HU54](./HU54-spec.md) · [HU55](./HU55-spec.md) · [HU56](./HU56-spec.md) · [HU57](./HU57-spec.md) |

## Plan de sprints (replanificado, D-26)

Reordenado para que ningún sprint dependa de piezas de sprints posteriores. Total 326 SP (87 + 89 + 84 + 66).

| Sprint | Contenido | SP |
|---|---|---|
| **1 — Fundación** | TR-01, TR-02, HU-58, HU-00, HU-01, HU-02, HU-03, HU-46, HU-04, HU-05, HU-06, HU-07, HU-08, HU-09, HU-10, HU-11 | 87 |
| **2 — Contenido, calendario y alta de Embajadores** | TR-03, HU-41, HU-42, HU-43, HU-44, HU-47, HU-48, HU-49, HU-50, HU-51, HU-52, HU-12, HU-13, HU-14, HU-15, **HU-59** | 89 |
| **3 — Operación, dashboards, finanzas y comisiones** | HU-16, HU-17, HU-39, **HU-60**, HU-18, HU-19, HU-20, HU-21, HU-23, HU-24, HU-40, HU-53, HU-54 | 84 |
| **4 — Inventario, comunicación, panel y billetera** | HU-22, HU-25, HU-26, HU-27, HU-28, HU-29, HU-30, HU-31, HU-32, HU-33, HU-55, HU-56, HU-57 | 66 |

Cambios respecto al VSM: entran TR-01, TR-02, TR-03 y HU-58 (+23 SP); HU-52 y la bandeja suben al Sprint 2 para no bloquear a HU-48 y HU-16; las cuatro subpáginas institucionales (HU-41…HU-44), HU-47 y HU-48 bajan al Sprint 2, conservando en el Sprint 1 el embudo completo (home, catálogo, ficha y contacto).

## Dependencias y riesgos clave (del VSM)

- **HU12** (motor de calendario) y **HU08** (doble máquina de estados de propiedad) son las de mayor riesgo técnico: spike técnico recomendado antes de comprometerlas.
- **HU23** define la maestra de categorías/cuentas que consumen HU24, HU25, HU27, HU40 y las comisiones de E11.
- **HU54** depende del evento "pago completado" de una fracción: ese estado debe existir y ser confiable desde Sprint 2 (definirlo junto a HU51).
- **HU51** (atribución) es la historia de mayor riesgo de negocio de E11: un solo Embajador por prospecto, sin auto-referencia, atribución persistente hasta la compra.
- **TR-01 y TR-02 son habilitadores de Sprint 1:** casi todas las historias de finanzas, calendario y referidos dependen de ellos, así que se implementan antes que HU-06, HU-15 y HU-23.
- **Sin pasarela de pagos en el MVP (D-10):** el estado de pago lo deriva el plan de pagos manual de **HU-58**; integrar una pasarela exige historia nueva y aprobación en [docs/stack.md](../../docs/stack.md).
- **El motor de HU-12 sostiene la equidad del modelo:** la rotación anual (D-13) y la de bloques pico (D-27) son lo que hace cumplir la regla de temporada alta, así que sus invariantes se prueban sobre 8 años, no sobre uno.
- **Ninguna noche del año queda huérfana (D-30):** la rejilla cubre 51 o 52 semanas completas y las noches restantes forman la bolsa de Fechas Especiales de HU-60, con su propia rotación de 8 años.
- **La reserva es por noches (D-11):** la semana solo clasifica temporadas y reparte cupo. HU-59 (ventana de reubicación) es nueva y sube el Sprint 2 a 89 SP: es la primera candidata a recortar si el equipo no absorbe ese volumen.
