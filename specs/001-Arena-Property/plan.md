# Arena Property — Plan de implementación (001-MVP)

Plan técnico derivado de [constitution.md](../../docs/constitution.md), [specs.md](./specs.md),
[decisions.md](../../docs/decisions.md) y [stack.md](../../docs/stack.md).
Cubre **55 historias + 3 requisitos transversales**, respetando el orden de los 4 sprints.

> Este documento no contiene código. Define estructura, modelo de datos, orden, decisiones técnicas y pruebas.

---

## 1. Estructura de módulos

Deriva del principio 3 de la constitución: el dominio no puede vivir en la interfaz.

```
arena-property/
├─ shared/                    ← DOMINIO PURO. Sin Nuxt, sin Supabase, sin I/O. Todo testeable en aislamiento.
│  ├─ money/                  TR-02 · importes, prorrateo, formatos
│  ├─ scheduling/             HU-12,14,59,60 · rejilla, temporadas, rotación, cupos, mínimos
│  ├─ sales/                  HU-06,58 · estados de plan de pagos e interruptor de calendario
│  ├─ finance/                HU-19,23,24,25,40 · maestra, cuotas, agregaciones, CSV
│  ├─ referrals/              HU-51,52,53,54,55,56 · atribución, vigencias, saldos, retiros
│  ├─ permissions/            HU-07 · mapa de capacidades por rol y por estado
│  ├─ notifications/          TR-03 · resolución de destinatarios por tipo de evento
│  ├─ audit/                  TR-01 · construcción de la entrada de auditoría
│  ├─ content/                E1 · manifiestos tipados de secciones, rutas y claves i18n
│  └─ types/                  tipos generados de Supabase + tipos de dominio
│
├─ app/                       ← INTERFAZ. Presenta y emite eventos; nunca calcula reglas.
│  ├─ pages/                  rutas públicas (E1) y privadas (dashboards)
│  ├─ components/             presentación pura, sin acceso a datos
│  ├─ composables/            orquestación: llama a `shared/` y a Supabase
│  ├─ middleware/             guardas de rol (HU-07) y de estado (D-31)
│  └─ layouts/                público, dashboard
│
├─ server/                    ← NITRO. Lo que no puede vivir en el cliente.
│  ├─ api/                    envío de correo, exportación CSV, tareas programadas
│  └─ utils/                  cliente de servicio de Supabase, cliente REST de correo
│
├─ supabase/
│  ├─ migrations/             único lugar donde cambia el esquema (principio 5)
│  └─ tests/                  pruebas de RLS y de restricciones
│
├─ i18n/locales/{en,es}.json  paridad obligatoria (RT-05)
└─ tests/{unit,db,integration,contract}
```

### Módulos de dominio y su cobertura

| Módulo `shared/` | HU y TR que cubre | RF nucleares |
|---|---|---|
| `money` | TR-02 | RF-D.1…RF-D.7 |
| `audit` | TR-01 | RF-A.1…RF-A.7 |
| `notifications` | TR-03, HU-16, HU-29, HU-30, HU-31, HU-57 | RF-N.1…RF-N.6 |
| `permissions` | HU-07, HU-05, HU-10, HU-33 | RF-07.2, RF-07.2b |
| `sales` | HU-06, HU-58, HU-09 (traspaso) | RF-06.2, RF-58.3, RF-58.7 |
| `scheduling` | HU-12, HU-13, HU-14, HU-15, HU-17, HU-39, HU-59, HU-60 | RF-12.1…12.9, RF-14.1…14.10, RF-59.1…59.8, RF-60.1…60.8 |
| `finance` | HU-19, HU-23, HU-24, HU-25, HU-27, HU-40 | RF-23.1…23.7, RF-25.1…25.5 |
| `referrals` | HU-49…HU-57 | RF-51.1…51.7, RF-52.1…52.5, RF-54.1…54.7 |
| `content` | HU-00, HU-41, HU-42, HU-43, HU-44, HU-48 | RF-00.2, RF-41.4, RF-43.4, RF-44.4 |

---

## 2. Modelo de datos en Supabase

Convenciones que aplican a **todas** las tablas: identificador `uuid`, marcas `created_at` / `updated_at`,
**RLS habilitada desde la migración que las crea** (principio 5), importes en `bigint` de pesos (TR-02 RF-D.1),
y ninguna eliminación física donde la spec exige histórico.

### 2.1 Identidad y permisos — HU-04, HU-05, HU-07, HU-33

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `profiles` | Extiende `auth.users` | nombre, teléfono, idioma, estado de cuenta, motivo y tipo de suspensión | Propia; Superadmin todo |
| `user_roles` | Roles acumulables (D-31 exige rol y estado por separado) | usuario, rol, otorgado por, fecha | Lectura propia; escritura Superadmin |
| `property_admins` | Asignación administrador ↔ propiedad | administrador, propiedad, activo desde/hasta | Superadmin; el admin lee la suya |

**Cubre:** RF-04.3, RF-05.1…05.4, RF-07.1…07.4, RF-33.1…33.6.

### 2.2 Propiedades e inventario — HU-08…HU-11, HU-26…HU-28

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `properties` | Ficha e estados | ficha técnica, ubicación, `visibility` (borrador/publicada/inactiva), `commercial_manual` (próximamente) | Pública si `publicada`; admin asignado; Superadmin |
| `property_media` | Fotos, video, plano | tipo, orden, ruta en Storage | Igual que la propiedad |
| `fractions` | Las 8 fracciones | número 1..8, precio de lista, estado, titular, **`calendar_active`** (D-31) | Pública en agregado; titular ve la suya |
| `inventory_items` | Inventario | categoría, estado, cantidad, baja lógica | Admin escribe; propietarios leen |
| `inventory_history` | Trazabilidad de cambios | ítem, campo, antes, después | Lectura admin y propietarios |

**Cubre:** RF-08.1…08.6, RF-09.1…09.5, RF-10.1…10.3, RF-11.1…11.4, RF-26.1…26.4, RF-28.1…28.2.
El estado comercial derivado (D-18) se calcula en `shared/` y se expone por vista, no se almacena duplicado.

### 2.3 Venta y pagos — HU-06, HU-58

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `purchase_invitations` | Invitación a comprar | fracción, invitado, estado, código de atribución arrastrado | Admin de la propiedad; invitado |
| `payment_plans` | Plan por fracción | fracción, titular, **precio pactado congelado**, estado derivado, anulación | Titular lee; admin y Superadmin |
| `payments` | Abonos | plan, monto, fecha, medio de pago, comprobante, anulado con motivo | Admin escribe; titular lee |

**Cubre:** RF-06.1…06.5, RF-58.1…58.9. El estado del plan y el interruptor `calendar_active` se **derivan**
de la suma de abonos por función de base de datos; ninguna ruta permite marcarlos a mano (RF-58.3, RF-58.7).

### 2.4 Agendamiento — HU-12…HU-17, HU-39, HU-59, HU-60

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `season_calendars` | Calendario por propiedad y año | propiedad, año, parámetros vigentes (schedule.md §2), publicado | Admin asignado; propietarios leen |
| `calendar_weeks` | Rejilla sábado→sábado | calendario, índice, rango de fechas, temporada, `is_peak`, bloque pico | Igual |
| `night_pool` | Fechas Especiales (D-30) | calendario, rango de noches, temporada heredada, fracción asignada del año | Igual |
| `allocations` | Reparto anual por fracción | calendario, fracción, semana, tipo (regular / comodín) | Igual |
| `stays` | Estadías del propietario | fracción, `daterange` de noches, temporada(s), estado, origen | Titular escribe; copropietarios ven nombre y fracción (D-16) |
| `blocks` | Bloqueos del administrador | propiedad, `daterange`, motivo | Admin escribe; todos leen |
| `third_parties` | Terceros no propietarios | datos personales, consentimiento, fecha de anonimización (D-25) | Solo admin y Superadmin |
| `third_party_bookings` | Renta a terceros | propiedad, tercero, `daterange`, ingreso asociado | Admin escribe; propietarios ven ocupación |
| `selection_windows` | Ventana anual y turnos | calendario, apertura, duración, orden de turno del año | Admin; propietarios leen |

**Invariante clave:** `stays`, `blocks` y `third_party_bookings` comparten una **restricción de exclusión GIST**
sobre `(propiedad, daterange)` que hace imposible en la base de datos que dos ocupaciones compartan una noche
(RF-14.10, I-04 de `schedule.md`).

**Cubre:** RF-12.1…12.9, RF-13.1…13.4, RF-14.1…14.10, RF-15.1…15.5, RF-17.1…17.4, RF-39.1…39.5, RF-59.1…59.8, RF-60.1…60.8.

### 2.5 Finanzas — HU-19, HU-23…HU-25, HU-27, HU-40

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `expense_categories`, `payment_methods`, `ledger_accounts` | Maestra contable (RF-23.1) | tipo ingreso/egreso, activa | Admin lee; Superadmin escribe |
| `movements` | Gasto o ingreso de una propiedad | propiedad, tipo, monto, categoría, medio, cuenta, **fecha de causación** (D-09), adjunto, anulación | Admin de la propiedad; Superadmin |
| `movement_shares` | Las 8 cuotas de cada movimiento | movimiento, fracción, monto, `has_remainder`, **pagador** (propietario o titular del inventario, D-08/D-31) | Propietario ve las suyas |
| `platform_ledger` | Libro de plataforma, separado (D-01) | tipo, monto, categoría (comisiones), origen, fecha de devengo | Solo Superadmin |

**Cubre:** RF-19.1…19.4, RF-23.1…23.7, RF-24.1…24.4, RF-25.1…25.5, RF-27.1…27.3, RF-40.1…40.3.

### 2.6 Programa de referidos — HU-49…HU-57

| Tabla | Propósito | Campos relevantes | RLS |
|---|---|---|---|
| `ambassadors` | Inscripción | usuario, términos aceptados y versión, datos bancarios, estado | Propia; Superadmin todo |
| `referral_codes` | Código único e inmutable | embajador, código (único), habilitado | Lectura pública del código; escritura del sistema |
| `attributions` | Prospecto ↔ embajador | prospecto, embajador, fecha de clic, **caduca a 90 días** (D-03), estado del ciclo | Embajador ve las suyas |
| `commission_rates` | Vigencias (RF-52.2) | tipo (fijo / puntos básicos), valor, vigente desde, autor | Lectura de la vigente; escritura Superadmin |
| `commissions` | Comisión por atribución | atribución, vigencia aplicada, monto, estado (pendiente / en gracia / disponible / retirada / reversada), fin de gracia | Embajador la suya; Superadmin todas |
| `wallet_movements` | Histórico del que se derivan los saldos (RF-55.2) | embajador, tipo, monto, referencia | Igual |
| `withdrawal_requests` | Retiros | embajador, monto, estado, motivo de rechazo, comprobante | Igual |

**Cubre:** RF-49.1…49.6, RF-50.1…50.4, RF-51.1…51.7, RF-52.1…52.5, RF-53.1…53.5, RF-54.1…54.7, RF-55.1…55.5, RF-56.1…56.6, RF-57.1…57.4.

### 2.7 Comunicación, captación y auditoría — TR-01, TR-03, HU-03, HU-29…HU-31, HU-46, HU-47

| Tabla | Propósito | RLS |
|---|---|---|
| `announcements` | Novedades por propiedad, con urgencia y estado | Admin escribe; propietarios leen |
| `notifications` + `notification_recipients` | Modelo único de TR-03, leído/no leído por destinatario | Cada quien la suya |
| `contact_requests` | HU-03 y HU-46, con intención de compra y código de referido | Solo Superadmin y admin |
| `waitlist_entries` | HU-47, con orden de inscripción y consentimiento | Solo Superadmin y admin |
| `audit_log` | TR-01: append-only, sin UPDATE ni DELETE para ningún rol | Superadmin todo; admin lo de sus propiedades |

**Cubre:** RF-03.1…03.5, RF-29.1…29.4, RF-30.1…30.3, RF-31.1…31.4, RF-46.1…46.6, RF-47.1…47.5, RF-N.1…N.6, RF-A.1…A.7.

---

## 3. Orden de ejecución por sprint

Se respeta el plan de [specs.md](./specs.md). Dentro de cada sprint el orden es de dependencia, no de prioridad.

### Sprint 1 — Fundación · 87 SP

| # | Entregable | HU/TR | Por qué va aquí |
|---|---|---|---|
| 1 | `shared/money` + migración de tipos monetarios | TR-02 | Todo importe posterior depende de él |
| 2 | `audit_log` + disparadores append-only | TR-01 | Ninguna operación auditable puede escribirse antes |
| 3 | Identidad, roles y `permissions` | HU-04, HU-05, HU-07 | Frontera de seguridad de todo lo demás |
| 4 | Propiedades y fracciones | HU-08, HU-09, HU-10, HU-11 | Objeto central del producto |
| 5 | Venta y plan de pagos | HU-06, HU-58 | Define titularidad e interruptor (D-31) |
| 6 | Sitio público del embudo | HU-00, HU-01, HU-02, HU-03, HU-46 | Depende de propiedades publicadas |

### Sprint 2 — Contenido, calendario y alta de Embajadores · 89 SP

| # | Entregable | HU/TR | Por qué va aquí |
|---|---|---|---|
| 1 | Canal y bandeja de notificaciones | TR-03 | Lo consumen calendario y referidos |
| 2 | Motor de calendario y rejilla | HU-12 | Máximo riesgo técnico: primero y con spike |
| 3 | Vista, estadías y bloqueos | HU-13, HU-14, HU-15 | Sobre el motor ya probado |
| 4 | Ventana de reubicación | HU-59 | Requiere estadías funcionando |
| 5 | Vigencia de comisión y alta de embajadores | HU-52, HU-49, HU-50, HU-51 | HU-52 antes que HU-48, que publica el monto |
| 6 | Subpáginas institucionales | HU-41…HU-44, HU-47, HU-48 | HU-43 y HU-48 dependen de 2 y 5 |

### Sprint 3 — Operación, dashboards, finanzas y comisiones · 84 SP

| # | Entregable | HU/TR | Por qué va aquí |
|---|---|---|---|
| 1 | Maestra contable y prorrateo | HU-23 | Base de todo el resto de finanzas |
| 2 | Detalle de prorrateo e ingresos por renta | HU-24, HU-40, HU-39 | Consumen la maestra |
| 3 | Fechas Especiales | HU-60 | Cierra el calendario; usa HU-59 |
| 4 | Operación del administrador | HU-16, HU-17, HU-21 | Requiere calendario y notificaciones |
| 5 | Dashboard del propietario | HU-18, HU-19, HU-20 | Requiere finanzas y estadías |
| 6 | Motor de comisiones | HU-53, HU-54 | Requiere HU-58, HU-52 y el libro de plataforma |

### Sprint 4 — Inventario, comunicación, panel y billetera · 66 SP

| # | Entregable | HU/TR | Por qué va aquí |
|---|---|---|---|
| 1 | Inventario y mantenimiento | HU-26, HU-27, HU-28 | HU-27 se apoya en el modelo de gasto de HU-23 |
| 2 | Comunicación | HU-29, HU-30, HU-31 | Sobre TR-03 |
| 3 | Panel Superadmin | HU-25, HU-32, HU-33, HU-22 | Consolida datos de los tres sprints previos |
| 4 | Billetera y retiros | HU-55, HU-56, HU-57 | Cierra E11 con saldos ya generados |

---

## 4. Decisiones técnicas

| # | Decisión | Justificación | Alternativa descartada y por qué |
|---|---|---|---|
| **DT-01** | El dominio vive en `shared/`, sin dependencias de Nuxt ni de Supabase | Cumple el principio 3 y permite probar el motor de calendario y el prorrateo sin base de datos ni navegador | *Lógica en composables de `app/`*: obliga a montar Nuxt para probar una regla de negocio y arrastra la UI a los tests |
| **DT-02** | Noches como `daterange` + restricción de exclusión GIST | La imposibilidad de solapamiento queda garantizada por el motor de base de datos, no por disciplina de código; resuelve la concurrencia de RF-14.10 | *Una fila por noche*: 42 filas por fracción y año, y el solapamiento seguiría dependiendo de la aplicación |
| **DT-03** | Importes en `bigint` de pesos enteros | El COP no opera con centavos; elimina el error de coma flotante y hace exacta la suma de cuotas (TR-02) | *`numeric(14,2)`*: introduce decimales que no existen en el negocio e invita a redondeos silenciosos |
| **DT-04** | Estados derivados por función, nunca columnas marcadas a mano | El plan de pagos, el interruptor de calendario y el estado comercial no pueden desincronizarse de sus hechos (RF-58.3, D-18, D-31) | *Columnas de estado con disparadores*: dos fuentes de verdad y desincronización silenciosa ante correcciones |
| **DT-05** | RLS como frontera de seguridad, con el mapa de permisos de `shared/` solo para la UI | Cumple el principio 5; ninguna consulta puede saltarse el permiso, ni desde el cliente ni por un error de guarda | *Autorización solo en rutas Nitro*: cualquier consulta directa del cliente quedaría expuesta |
| **DT-06** | Auditoría escrita por disparadores en la misma transacción | Cumple RF-A.5 y el principio 9: si falla la auditoría, la operación se revierte; imposible olvidarla | *Escribir la auditoría desde la aplicación*: se olvida en cualquier ruta nueva y no es atómica |
| **DT-07** | El motor de calendario es TypeScript puro; la base de datos guarda su resultado y las invariantes | La rotación de 8 años se prueba en milisegundos y sin base de datos; Postgres protege la integridad | *Motor en PL/pgSQL*: mucho más caro de probar y de iterar en la historia de mayor riesgo del MVP |
| **DT-08** | Correo por API REST del proveedor desde Nitro, con reintento | Evita una dependencia nueva (principio 1) y aísla el fallo de correo del negocio (RF-N.6) | *SDK del proveedor*: dependencia adicional para lo que resuelve una petición HTTP |
| **DT-09** | Tareas de tiempo (liberación a 60 días, paso de gracia a disponible) con `pg_cron` sobre funciones idempotentes | El disparador temporal vive junto al dato; la idempotencia hace inofensiva una ejecución repetida | *Cron externo llamando a una API*: suma un punto de fallo fuera del sistema y complica el entorno local |
| **DT-10** | Contenido institucional en manifiestos tipados + i18n | Hace testeable por contrato lo que de otro modo solo se podría probar contra el marcado (RT-03) | *Contenido en base de datos (CMS)*: alcance y complejidad que ninguna HU pide |
| **DT-11** | CSV por función pura propia | Serializar y escapar es trivial y evita dependencia (RF-25.2) | *Librería de CSV*: dependencia nueva para veinte líneas de lógica |
| **DT-12** | Fechas con `Intl` y funciones puras ancladas a `America/Bogota` | Sin dependencia nueva y con la zona horaria explícita en la frontera (RF-12.1) | *Luxon o date-fns-tz*: no están aprobadas en `stack.md` y el uso real es acotado |

---

## 5. Estrategia de pruebas

Cumple el principio 4: **cada `CA` tiene un test que lo cita por identificador**. Un `CA` sin test es un defecto de la entrega.

### Niveles

| Nivel | Qué prueba | Herramienta | Dónde |
|---|---|---|---|
| **N1 — Dominio** | Funciones puras de `shared/`: motor, prorrateo, rotación, cupos, comisiones, permisos | Vitest, sin base de datos | `tests/unit/` |
| **N2 — Base de datos** | RLS por rol, restricciones de exclusión, disparadores de auditoría, estados derivados | Supabase local + cliente autenticado por rol | `supabase/tests/`, `tests/db/` |
| **N3 — Integración** | Composables y rutas Nitro con Nuxt montado | `@nuxt/test-utils` | `tests/integration/` |
| **N4 — Contrato de contenido** | Manifiestos de E1: secciones, destinos de ruta y paridad `en`/`es` | Vitest | `tests/contract/` |

### Reglas de la suite

1. **Trazabilidad:** el nombre de cada test empieza por su criterio (`CA-12.4 …`). Un informe cruza `CA` declarados contra `CA` probados y falla si falta alguno.
2. **Invariantes sobre ciclos completos:** la equidad no se prueba en un año sino en **ocho** (`CA-12.5`, `CA-60.4`).
3. **Exactitud del dinero:** todo test de prorrateo verifica que la suma de las cuotas iguala el original, incluidos montos no divisibles (`CA-23.2`, `CA-D.2`, `CA-D.3`).
4. **Idempotencia:** todo evento que acredita, notifica o activa se procesa dos veces en el test y debe producir un solo efecto (`CA-54.3`, `CA-58.9`, `CA-N.3`).
5. **Seguridad:** cada tabla tiene al menos un test negativo por rol que no debe acceder; el `audit_log` tiene test de UPDATE y DELETE rechazados (`CA-A.2`).
6. **Regresión:** todo defecto entra con un test que falla antes del arreglo.
7. **Fixture canónico:** una propiedad con 8 fracciones, calendarios de tres años consecutivos, dos embajadores y una maestra contable mínima, compartida por N2 y N3.

### Compuertas de integración continua

`pnpm lint` · `pnpm test` (N1 + N4, sin infraestructura) · `pnpm test:db` (N2, con Supabase local) · informe de trazabilidad `CA` → test. Todas deben pasar antes de fusionar.

---

## 6. Cobertura: qué parte cubre cada HU y TR

| HU / TR | Módulo de dominio | Tablas principales | Sprint |
|---|---|---|---|
| TR-01 | `audit` | `audit_log` | 1 |
| TR-02 | `money` | — | 1 |
| TR-03 | `notifications` | `notifications`, `notification_recipients` | 2 |
| HU-00, HU-41…HU-44, HU-48 | `content` | — | 1 y 2 |
| HU-01, HU-02 | `content` + consulta pública | `properties`, `fractions`, `property_media` | 1 |
| HU-03, HU-46 | validación compartida | `contact_requests` | 1 |
| HU-04, HU-05, HU-07, HU-33 | `permissions` | `profiles`, `user_roles`, `property_admins` | 1 y 4 |
| HU-06, HU-58 | `sales` | `purchase_invitations`, `payment_plans`, `payments` | 1 |
| HU-08…HU-11 | `properties` | `properties`, `fractions`, `property_media` | 1 |
| HU-12…HU-15, HU-17 | `scheduling` | `season_calendars`, `calendar_weeks`, `allocations`, `stays`, `blocks` | 2 |
| HU-16 | `notifications` | `notifications` | 3 |
| HU-18…HU-20 | `finance` + `scheduling` | `movement_shares`, `stays`, `payment_plans` | 3 |
| HU-21, HU-22 | `properties` + `scheduling` | vistas de agregación | 3 y 4 |
| HU-23, HU-24, HU-27, HU-40 | `finance` | `movements`, `movement_shares`, maestra | 3 y 4 |
| HU-25, HU-32 | `finance` | `platform_ledger`, vistas consolidadas | 4 |
| HU-26, HU-28 | `properties` | `inventory_items`, `inventory_history` | 4 |
| HU-29…HU-31 | `notifications` | `announcements`, `notifications` | 4 |
| HU-39 | `scheduling` | `third_parties`, `third_party_bookings` | 3 |
| HU-47 | `properties` + `notifications` | `waitlist_entries` | 2 |
| HU-49…HU-53 | `referrals` | `ambassadors`, `referral_codes`, `attributions`, `commission_rates` | 2 y 3 |
| HU-54…HU-57 | `referrals` | `commissions`, `wallet_movements`, `withdrawal_requests` | 3 y 4 |
| HU-59, HU-60 | `scheduling` | `selection_windows`, `night_pool` | 2 y 3 |

**Verificación de cobertura:** las 55 historias y los 3 requisitos transversales aparecen en esta tabla; ninguna queda sin módulo, sin tabla y sin sprint.

---

## 7. Cumplimiento de la constitución

| Principio | Cómo lo garantiza este plan |
|---|---|
| 1 · Stack cerrado | Ninguna decisión técnica introduce dependencias fuera de `stack.md`; DT-08, DT-11 y DT-12 las evitan explícitamente |
| 2 · Sin spec no hay código | Cada entregable de la sección 3 cita sus HU; el plan no añade alcance no especificado |
| 3 · Dominio antes que interfaz | DT-01 y la estructura de `shared/` lo hacen estructural, no una convención |
| 4 · Todo CA se prueba | Sección 5, con informe de trazabilidad como compuerta de integración |
| 5 · Supabase única fuente de verdad | Toda tabla nace con RLS en su migración; DT-04 elimina estados paralelos |
| 6 · Un idioma para el código, dos para las personas | `i18n/locales` con paridad verificada en N4 |
| 7 · Responsive y bitema | Requisito de aceptación de cada entregable de interfaz |
| 8 · La marca no se improvisa | Tokens de `@nuxt/ui`; los gráficos de DT usan variables CSS, sin paleta propia |
| 9 · Honestidad en los datos | DT-03 (dinero exacto), DT-06 (auditoría atómica), `movement_shares.pagador` (D-08/D-31) |
