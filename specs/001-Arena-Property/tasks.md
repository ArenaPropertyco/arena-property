# Arena Property — Tareas de implementación (001-MVP)

Derivado de [specs.md](./specs.md), [plan.md](./plan.md) y [schedule.md](./schedule.md).
Respeta el orden de los 4 sprints y, dentro de cada uno, el orden de dependencia de `plan.md` §3.

**Convenciones**

- Cada tarea es de **20 a 30 minutos**. Si al ejecutarla se pasa de ahí, se parte en dos.
- `HU-XX · RF-XX.n` indica qué spec y qué requisitos cubre. `RT-nn` son requisitos transversales.
- **Hecho cuando** es la condición verificable de cierre. Si cita un `CA`, la tarea incluye escribir ese test unitario y dejarlo en verde (principio 4 de la constitución).
- Ninguna tarea toca `specs/` ni introduce dependencias fuera de [stack.md](../../docs/stack.md).

---

# Sprint 1 — Fundación · 87 SP

## Paso 0 · Cimientos del repositorio

- [ ] **T-001 · Inicializar Nuxt 4 con TypeScript `strict`** — `RT-01`
  Hecho cuando: `pnpm dev` levanta y `tsc --noEmit` pasa sin errores con `strict` activo.
- [ ] **T-002 · Instalar y configurar los 13 módulos base** — `RT-01` · stack.md
  Hecho cuando: `package.json` no contiene nada fuera de `stack.md` y `pnpm build` pasa.
- [ ] **T-003 · Configurar `@nuxtjs/i18n` con `en.json` y `es.json`** — `RT-05`
  Hecho cuando: existe el test de paridad de claves y pasa con ambos locales.
- [ ] **T-004 · Definir los tokens de marca en `@nuxt/ui`** — `RT-07` · principio 8
  Hecho cuando: los 9 colores y las 3 familias tipográficas resuelven desde tokens y no hay ningún hex suelto en el código.
- [ ] **T-005 · Layouts público y de dashboard, responsive y bitema** — `RT-06`
  Hecho cuando: ambos se ven correctos en 320/768/1280 px y en tema claro y oscuro.
- [ ] **T-006 · Levantar Supabase local y generar tipos** — `RT-04`
  Hecho cuando: `supabase start` levanta y los tipos generados quedan en `shared/types`.
- [ ] **T-007 · Montar la suite de pruebas en 4 niveles** — `RT-03`
  Hecho cuando: `pnpm test` corre en verde con un test trivial en `unit`, `db`, `integration` y `contract`.
- [ ] **T-008 · Informe de trazabilidad CA → test** — principio 4 · plan §5.1
  Hecho cuando: el informe lista los CA declarados en las specs y falla si alguno no tiene test que lo cite.
- [ ] **T-009 · ESLint y compuertas de integración continua** — `RT-01`
  Hecho cuando: `pnpm lint` y `pnpm test` corren en CI y bloquean la fusión si fallan.

## Paso 1 · TR-02 — Dinero y formatos

- [ ] **T-010 · Tipo nominal `CopAmount` y utilidades de entero** — `TR-02 · RF-D.1`
  Hecho cuando: el tipo rechaza en compilación un `number` sin marcar y no existe punto flotante en el módulo.
- [ ] **T-011 · Función canónica de prorrateo con reparto de residuo** — `TR-02 · RF-D.2, RF-D.3`
  Hecho cuando: pasan `CA-D.1`, `CA-D.2`, `CA-D.3` y `CA-D.4`.
- [ ] **T-012 · Cálculo de comisión porcentual en puntos básicos** — `TR-02 · RF-D.4`
  Hecho cuando: pasa `CA-D.5`.
- [ ] **T-013 · Formateo de importes y porcentajes `es-CO` / `en-CO`** — `TR-02 · RF-D.5`
  Hecho cuando: pasa `CA-D.6`.
- [ ] **T-014 · Presentación con condición `confirmado` / `estimado`** — `TR-02 · RF-D.6, RF-D.7`
  Hecho cuando: pasa `CA-D.7` y ninguna vista replica aritmética monetaria.

## Paso 2 · TR-01 — Auditoría

- [ ] **T-015 · Migración de `audit_log`** — `TR-01 · RF-A.1`
  Hecho cuando: la tabla existe con todos los campos de RF-A.1 y con RLS habilitada.
- [ ] **T-016 · Políticas append-only** — `TR-01 · RF-A.2`
  Hecho cuando: pasa `CA-A.2` para todos los roles.
- [ ] **T-017 · Función de diferencia de estados** — `TR-01 · RF-A.7`
  Hecho cuando: pasa `CA-A.6`.
- [ ] **T-018 · Disparador genérico en la misma transacción** — `TR-01 · RF-A.5`
  Hecho cuando: pasa `CA-A.4` con fallo forzado de auditoría.
- [ ] **T-019 · Exigencia de motivo donde la spec lo pide** — `TR-01 · RF-A.4`
  Hecho cuando: pasa `CA-A.3`.
- [ ] **T-020 · Políticas de lectura del registro por rol** — `TR-01 · RF-A.6`
  Hecho cuando: pasa `CA-A.5`.

## Paso 3 · Identidad, roles y permisos

- [ ] **T-021 · Migración de `profiles` y `user_roles`** — `HU-04 · RF-04.3` · `HU-07 · RF-07.1`
  Hecho cuando: ambas existen con RLS y el rol `Usuario` se crea por disparador al registrarse.
- [ ] **T-022 · Esquema de validación del registro** — `HU-04 · RF-04.1`
  Hecho cuando: pasa `CA-04.1`.
- [ ] **T-023 · Verificación de correo y guarda de rutas privadas** — `HU-04 · RF-04.2`
  Hecho cuando: pasa `CA-04.4`.
- [ ] **T-024 · Página de registro con código de referido** — `HU-04 · RF-04.4`
  Hecho cuando: pasa `CA-04.3` con código válido e inválido.
- [ ] **T-025 · Traducción de errores de autenticación** — `HU-04 · RF-04.5`
  Hecho cuando: ningún mensaje expone detalle técnico y las claves están en ambos locales.
- [ ] **T-026 · Mapa de permisos tipado en `shared/permissions`** — `HU-07 · RF-07.2`
  Hecho cuando: pasa `CA-07.1` con la tabla completa de la matriz.
- [ ] **T-027 · Capacidades condicionadas por estado** — `HU-07 · RF-07.2b`
  Hecho cuando: el mapa distingue capacidad de rol de capacidad de estado y "reservar" figura como condicionada.
- [ ] **T-028 · Middleware de rutas por capacidad** — `HU-07 · RF-07.2`
  Hecho cuando: pasa `CA-07.2`.
- [ ] **T-029 · Pantalla de gestión de roles del Superadmin** — `HU-07 · RF-07.3`
  Hecho cuando: solo el Superadmin la abre y puede asignar y retirar roles.
- [ ] **T-030 · Auditoría de cambios de rol** — `HU-07 · RF-07.4`
  Hecho cuando: pasa `CA-07.3`.
- [ ] **T-031 · Acumulación de roles Propietario + Embajador** — `HU-07 · RF-07.1`
  Hecho cuando: pasa `CA-07.4`.
- [ ] **T-032 · Migración de `property_admins`** — `HU-05 · RF-05.2`
  Hecho cuando: existe con RLS y permite alta y baja sin borrar histórico.
- [ ] **T-033 · Alta de Administrador por invitación** — `HU-05 · RF-05.1`
  Hecho cuando: pasa `CA-05.1`.
- [ ] **T-034 · RLS de propiedades por asignación** — `HU-05 · RF-05.3`
  Hecho cuando: pasan `CA-05.2` y `CA-05.3`.
- [ ] **T-035 · Listado de administradores con sus propiedades** — `HU-05 · RF-05.4`
  Hecho cuando: muestra asignaciones y estado de cuenta de cada administrador.

## Paso 4 · Propiedades y fracciones

- [ ] **T-036 · Migración de `properties` y `property_media`** — `HU-08 · RF-08.1, RF-08.5`
  Hecho cuando: existen con RLS y el bucket de Storage tiene políticas por rol.
- [ ] **T-037 · Máquina de estados de visibilidad** — `HU-08 · RF-08.2, RF-08.4`
  Hecho cuando: pasa la parte de visibilidad de `CA-08.1`.
- [ ] **T-038 · Estado comercial derivado** — `HU-08 · RF-08.3` · D-18
  Hecho cuando: pasan `CA-08.2` y la parte comercial de `CA-08.1`.
- [ ] **T-039 · Formulario de ficha técnica con validaciones** — `HU-08 · RF-08.1`
  Hecho cuando: pasa `CA-08.3`.
- [ ] **T-040 · Carga múltiple de fotos, video y plano** — `HU-08 · RF-08.5` · `RT-12`
  Hecho cuando: los archivos se suben a Storage y se sirven con `@nuxt/image`.
- [ ] **T-041 · Vínculo de la propiedad con su administrador creador** — `HU-08 · RF-08.6`
  Hecho cuando: la propiedad creada queda asignada al administrador que la creó.
- [ ] **T-042 · Exclusión de borradores del catálogo** — `HU-08 · RF-08.2`
  Hecho cuando: pasa `CA-08.4`.
- [ ] **T-043 · Migración de `fractions` con `calendar_active`** — `HU-09 · RF-09.1, RF-09.2` · D-31
  Hecho cuando: existe con RLS, numeración única 1..8 y precio mayor que cero.
- [ ] **T-044 · Fraccionamiento atómico en 8** — `HU-09 · RF-09.3`
  Hecho cuando: pasa `CA-09.1`.
- [ ] **T-045 · Máquina de estados de fracción** — `HU-09 · RF-09.2`
  Hecho cuando: pasan `CA-09.2` y `CA-09.3`.
- [ ] **T-046 · Recálculo del estado comercial al cambiar una fracción** — `HU-09 · RF-09.4`
  Hecho cuando: pasa `CA-09.4`.
- [ ] **T-047 · Traspaso de titular por el Superadmin** — `HU-09 · RF-09.5` · D-17
  Hecho cuando: pasa `CA-09.5`.
- [ ] **T-048 · Vista global de propiedades del Superadmin** — `HU-10 · RF-10.1, RF-10.3`
  Hecho cuando: pasan `CA-10.1` y `CA-10.3`.
- [ ] **T-049 · Composable de filtros reutilizable** — `HU-10 · RF-10.2`
  Hecho cuando: pasa `CA-10.2`.
- [ ] **T-050 · Ausencia de borrado físico en RLS y API** — `HU-11 · RF-11.2`
  Hecho cuando: pasa `CA-11.1`.
- [ ] **T-051 · Edición e inactivación conservando histórico** — `HU-11 · RF-11.1, RF-11.3, RF-11.4`
  Hecho cuando: pasan `CA-11.2` y `CA-11.3`.

## Paso 5 · Venta y plan de pagos

- [ ] **T-052 · Migración de `purchase_invitations`** — `HU-06 · RF-06.1`
  Hecho cuando: existe con RLS y valida el estado de la fracción invitada.
- [ ] **T-053 · Invitación por correo del administrador asignado** — `HU-06 · RF-06.1`
  Hecho cuando: pasa `CA-06.1`.
- [ ] **T-054 · Titularidad al cerrar la compra** — `HU-06 · RF-06.2` · D-31
  Hecho cuando: pasa `CA-06.2` (rol Propietario, fracción vendida y calendario inactivo).
- [ ] **T-055 · Arrastre de la atribución de referido a la compra** — `HU-06 · RF-06.4`
  Hecho cuando: la atribución del prospecto queda vinculada a la compra creada.
- [ ] **T-056 · Bloqueo de reinvitación sobre fracción vendida** — `HU-06 · RF-06.5`
  Hecho cuando: pasa `CA-06.4`.
- [ ] **T-057 · Migración de `payment_plans` con precio congelado** — `HU-58 · RF-58.1`
  Hecho cuando: existe con RLS y pasa `CA-58.5`.
- [ ] **T-058 · Migración de `payments` con comprobante obligatorio** — `HU-58 · RF-58.2`
  Hecho cuando: pasa `CA-58.6`.
- [ ] **T-059 · Derivación de los estados del plan** — `HU-58 · RF-58.3`
  Hecho cuando: pasa `CA-58.1`.
- [ ] **T-060 · Rechazo de sobrepago** — `HU-58 · RF-58.4`
  Hecho cuando: pasa `CA-58.2`.
- [ ] **T-061 · Anulación de abono con recálculo de estado** — `HU-58 · RF-58.5`
  Hecho cuando: pasa `CA-58.3`.
- [ ] **T-062 · Evento idempotente de pago completado** — `HU-58 · RF-58.6`
  Hecho cuando: pasa `CA-58.4`.
- [ ] **T-063 · Interruptor de calendario derivado del plan** — `HU-58 · RF-58.7` · D-31
  Hecho cuando: pasan `CA-58.8` y `CA-58.9`.
- [ ] **T-064 · Anulación de compra con todos sus efectos** — `HU-58 · RF-58.8`
  Hecho cuando: pasa `CA-58.7`.
- [ ] **T-065 · Vista de lectura del plan para el Propietario** — `HU-58 · RF-58.9`
  Hecho cuando: muestra el saldo pendiente y qué falta para activar el calendario.

## Paso 6 · Sitio público del embudo

- [ ] **T-066 · Manifiesto tipado de secciones de la home** — `HU-00 · RF-00.2`
  Hecho cuando: pasa `CA-00.1`.
- [ ] **T-067 · Navbar y Footer compartidos con selector de idioma y tema** — `HU-00 · RF-00.6`
  Hecho cuando: ambos se reutilizan en todas las páginas públicas y conmutan idioma y tema.
- [ ] **T-068 · Hero con video de fondo y slogan** — `HU-00 · RF-00.1`
  Hecho cuando: la sección se renderiza desde el manifiesto y es correcta en 320 px.
- [ ] **T-069 · Secciones Modelo de negocio y Beneficios con sus CTA** — `HU-00 · RF-00.3, RF-00.4, RF-00.5`
  Hecho cuando: pasa `CA-00.2`.
- [ ] **T-070 · Animación de entrada con `nuxt-aos`** — `HU-00 · RF-00.7` · `RT-12`
  Hecho cuando: pasa `CA-00.4`.
- [ ] **T-071 · Analítica de CTA con `nuxt-gtag`** — `HU-00 · RF-00.8` · `RT-12`
  Hecho cuando: pasa `CA-00.5`.
- [ ] **T-072 · Claves i18n de la home en paridad** — `HU-00 · RF-00.2` · `RT-05`
  Hecho cuando: pasa `CA-00.3`.
- [ ] **T-073 · Consulta pública del catálogo con RLS anónima** — `HU-01 · RF-01.1, RF-01.5`
  Hecho cuando: pasa `CA-01.1`.
- [ ] **T-074 · Composable de filtros del catálogo** — `HU-01 · RF-01.3` · D-18
  Hecho cuando: pasan `CA-01.2` y `CA-01.3`.
- [ ] **T-075 · Tarjeta de propiedad con imagen optimizada y metadatos** — `HU-01 · RF-01.2, RF-01.4` · `RT-12`
  Hecho cuando: muestra foto, nombre, ubicación, precio y estado, y la ruta expone metadatos de `@nuxtjs/seo`.
- [ ] **T-076 · Detalle por slug con 404 y vista previa de borrador** — `HU-02 · RF-02.1`
  Hecho cuando: pasan `CA-02.1` y `CA-02.2`.
- [ ] **T-077 · Galería, descripción larga y equipamiento** — `HU-02 · RF-02.2, RF-02.6`
  Hecho cuando: las imágenes se sirven con `@nuxt/image` y la galería funciona en móvil.
- [ ] **T-078 · Ficha técnica y conteo de fracciones disponibles** — `HU-02 · RF-02.3`
  Hecho cuando: pasa `CA-02.3`.
- [ ] **T-079 · Visor 3D del plano elevado con respaldo estático** — `HU-02 · RF-02.5` · `RT-12`
  Hecho cuando: pasa `CA-02.4`.
- [ ] **T-080 · Ancla al formulario de contacto de la ficha** — `HU-02 · RF-02.4` · `HU-03 · RF-03.1`
  Hecho cuando: el botón enfoca el formulario dentro de la misma página.
- [ ] **T-081 · Esquema compartido de validación de contacto** — `HU-46 · RF-46.1` · `HU-03 · RF-03.3`
  Hecho cuando: pasan `CA-46.1` y `CA-03.1`.
- [ ] **T-082 · Migración de `contact_requests`** — `HU-46 · RF-46.5` · `HU-03 · RF-03.4`
  Hecho cuando: existe con RLS y guarda la propiedad asociada cuando viene de una ficha.
- [ ] **T-083 · Envío de correo interno por Nitro con límite de tasa** — `HU-46 · RF-46.5` · `HU-03 · RF-03.4` · D-24
  Hecho cuando: pasa `CA-46.2` y el límite de tasa rechaza envíos repetidos.
- [ ] **T-084 · Selecciones del formulario general con opciones exactas** — `HU-46 · RF-46.2, RF-46.3, RF-46.4`
  Hecho cuando: pasa `CA-46.3`.
- [ ] **T-085 · Formulario de contacto de la ficha con intención de compra** — `HU-03 · RF-03.2`
  Hecho cuando: pasan `CA-03.2` y `CA-03.3`.
- [ ] **T-086 · Campo de código de referido prellenado** — `HU-46 · RF-46.6` · `HU-03 · RF-03.5`
  Hecho cuando: el campo se prellena desde la sesión cuando el visitante llegó por un enlace de referido.

---

# Sprint 2 — Contenido, calendario y alta de Embajadores · 89 SP

## Paso 1 · TR-03 — Canal de notificaciones

- [ ] **T-087 · Migración de `notifications` y `notification_recipients`** — `TR-03 · RF-N.1`
  Hecho cuando: existen con RLS y el estado leído es por destinatario, no por notificación.
- [ ] **T-088 · Resolutores puros de destinatarios por tipo de evento** — `TR-03 · RF-N.3`
  Hecho cuando: pasan `CA-N.1` y `CA-N.2`.
- [ ] **T-089 · Idempotencia de emisión** — `TR-03 · RF-N.4`
  Hecho cuando: pasa `CA-N.3`.
- [ ] **T-090 · Envío de correo por API REST desde Nitro con reintento** — `TR-03 · RF-N.2, RF-N.6`
  Hecho cuando: pasa `CA-N.6` y el fallo del proveedor no revierte la operación de negocio.
- [ ] **T-091 · Bandeja accesible a cualquier rol autenticado** — `TR-03 · RF-N.5`
  Hecho cuando: pasan `CA-N.4` y `CA-N.5`.
- [ ] **T-092 · Plantillas de correo en `en` y `es`** — `TR-03 · RF-N.2` · `RT-05`
  Hecho cuando: cada tipo de notificación tiene plantilla en ambos idiomas y se elige por el idioma del destinatario.

## Paso 2 · HU-12 — Motor de calendario

- [ ] **T-093 · Spike del motor de reparto** — `HU-12`
  Hecho cuando: existe un prototipo desechable que demuestra la rotación de 8 años y su costo de cómputo.
- [ ] **T-094 · Función pura de rejilla anual sábado a sábado** — `HU-12 · RF-12.1` · schedule.md P-01, P-02, P-03
  Hecho cuando: pasa `CA-12.1`.
- [ ] **T-095 · Separación de rejilla y noches fuera de rejilla** — `HU-12 · RF-12.1` · D-30
  Hecho cuando: pasa `CA-12.9`.
- [ ] **T-096 · Migración de `season_calendars` y `calendar_weeks`** — `HU-12 · RF-12.2`
  Hecho cuando: existen con RLS y guardan temporada y marca de bloque pico por semana.
- [ ] **T-097 · Pantalla de clasificación de temporadas y bloques pico** — `HU-12 · RF-12.2` · schedule.md P-05, P-06
  Hecho cuando: el administrador clasifica las semanas del año y marca los tres bloques pico.
- [ ] **T-098 · Motor de reparto de cupo por fracción** — `HU-12 · RF-12.3, RF-12.6` · schedule.md P-04
  Hecho cuando: pasan `CA-12.2` y `CA-12.3`.
- [ ] **T-099 · Rotación anual de posiciones** — `HU-12 · RF-12.4` · schedule.md P-07, I-05
  Hecho cuando: pasan `CA-12.4` y `CA-12.6`.
- [ ] **T-100 · Rotación estricta de bloques pico** — `HU-12 · RF-12.5` · D-27
  Hecho cuando: pasa `CA-12.5` sobre 8 años consecutivos.
- [ ] **T-101 · Rechazo de rejilla imposible** — `HU-12 · RF-12.7`
  Hecho cuando: pasan `CA-12.7` y `CA-12.8`.
- [ ] **T-102 · Migración de `allocations` y publicación del calendario** — `HU-12 · RF-12.3`
  Hecho cuando: el resultado del motor se persiste por propiedad y año, y queda auditado.
- [ ] **T-103 · Liberación automática a 60 días con `pg_cron`** — `HU-12 · RF-12.8` · D-15 · DT-09
  Hecho cuando: la tarea es idempotente y mueve a la bolsa de renta las noches sin estadía, avisando al Propietario.
- [ ] **T-104 · Reconfiguración con estadías existentes** — `HU-12 · RF-12.9`
  Hecho cuando: la reconfiguración exige confirmación, no borra estadías y lista los conflictos.

## Paso 3 · HU-13, HU-14, HU-15 — Vista, estadías y bloqueos

- [ ] **T-105 · Migración de `stays` con `daterange` y exclusión GIST** — `HU-14 · RF-14.10` · DT-02
  Hecho cuando: pasa `CA-14.9` con dos escrituras simultáneas sobre la misma noche.
- [ ] **T-106 · Migración de `blocks` con motivo obligatorio** — `HU-15 · RF-15.1, RF-15.5`
  Hecho cuando: pasa `CA-15.1` y la creación queda auditada.
- [ ] **T-107 · Bloqueo por noches que impide reservar** — `HU-15 · RF-15.2`
  Hecho cuando: pasa `CA-15.2`.
- [ ] **T-108 · Conflicto de bloqueo sobre estadía existente** — `HU-15 · RF-15.4`
  Hecho cuando: pasa `CA-15.3` indicando las noches que colisionan.
- [ ] **T-109 · RLS de bloqueos por propiedad asignada** — `HU-15 · RF-15.1`
  Hecho cuando: pasa `CA-15.4`.
- [ ] **T-110 · Proyección pura del calendario por noches** — `HU-13 · RF-13.2, RF-13.4`
  Hecho cuando: pasa `CA-13.1` incluido el cupo restante por temporada.
- [ ] **T-111 · Visibilidad de copropietarios con nombre y fracción** — `HU-13 · RF-13.3` · D-16
  Hecho cuando: pasa `CA-13.2` y no se expone ningún dato de contacto.
- [ ] **T-112 · Acceso al calendario con interruptor inactivo** — `HU-13 · RF-13.1, RF-13.1b` · D-31
  Hecho cuando: pasa `CA-13.3` y la vista inactiva no ofrece ninguna acción.
- [ ] **T-113 · Consumo de cupo por temporada al declarar estadía** — `HU-14 · RF-14.1`
  Hecho cuando: pasa `CA-14.3`.
- [ ] **T-114 · Guarda de calendario activo** — `HU-14 · RF-14.1b` · D-31
  Hecho cuando: pasa `CA-14.0`, validado también en el servidor.
- [ ] **T-115 · Cupo del primer año tras la activación** — `HU-14 · RF-14.1c` · D-31
  Hecho cuando: pasa `CA-14.0b`.
- [ ] **T-116 · Estadía mínima por temporada** — `HU-14 · RF-14.2` · schedule.md P-08
  Hecho cuando: pasan `CA-14.1` y `CA-14.2`.
- [ ] **T-117 · Validación de colisiones al declarar** — `HU-14 · RF-14.4`
  Hecho cuando: pasa `CA-14.4`.
- [ ] **T-118 · Cancelación con plazo y cancelación parcial** — `HU-14 · RF-14.6` · schedule.md P-10
  Hecho cuando: pasan `CA-14.5` y `CA-14.6`.
- [ ] **T-119 · Liberación voluntaria y caducidad a 60 días** — `HU-14 · RF-14.7` · schedule.md P-11
  Hecho cuando: pasa `CA-14.7`.
- [ ] **T-120 · Advertencia de noches huérfanas** — `HU-14 · RF-14.9`
  Hecho cuando: pasa `CA-14.8` y la advertencia no bloquea la declaración.
- [ ] **T-121 · Auditoría y notificación de cada movimiento de estadía** — `HU-14 · RF-14.10` · `TR-01`, `TR-03`
  Hecho cuando: declarar, cancelar y liberar dejan entrada de auditoría y notificación, una sola vez cada una.
- [ ] **T-122 · Interfaz de calendario por noches** — `HU-13 · RF-13.2` · `HU-14 · RF-14.1` · `RT-06`
  Hecho cuando: se opera de 320 px a escritorio, en ambos temas, y las noches propias, ajenas, bloqueadas y rentadas se distinguen.

## Paso 4 · HU-59 — Ventana de reubicación

- [ ] **T-123 · Migración de `selection_windows` y turnos** — `HU-59 · RF-59.1` · schedule.md P-12, P-13, P-14
  Hecho cuando: existe con RLS y guarda apertura, duración y duración de turno por propiedad.
- [ ] **T-124 · Orden de turno rotativo** — `HU-59 · RF-59.2`
  Hecho cuando: pasa `CA-59.6` sobre 8 años.
- [ ] **T-125 · Validador puro de reubicación** — `HU-59 · RF-59.4, RF-59.5, RF-59.8`
  Hecho cuando: pasan `CA-59.1`, `CA-59.2`, `CA-59.3` y `CA-59.4`.
- [ ] **T-126 · Guarda de turno y de calendario activo** — `HU-59 · RF-59.3, RF-59.6`
  Hecho cuando: pasa `CA-59.5`.
- [ ] **T-127 · Cierre de la ventana y apertura por orden de llegada** — `HU-59 · RF-59.6`
  Hecho cuando: pasa `CA-59.7`.
- [ ] **T-128 · Auditoría y aviso de cada reubicación** — `HU-59 · RF-59.8` · `TR-01`, `TR-03`
  Hecho cuando: cada movimiento deja entrada de auditoría y notifica al Propietario.
- [ ] **T-129 · Interfaz de la ventana con estado de turno** — `HU-59 · RF-59.3, RF-59.6` · `RT-06`
  Hecho cuando: muestra si el turno está abierto, cuánto falta y qué noches se pueden mover.

## Paso 5 · Comisión y alta de Embajadores

- [ ] **T-130 · Migración de `commission_rates` con vigencias** — `HU-52 · RF-52.1, RF-52.3`
  Hecho cuando: existe con RLS, histórico inmutable y porcentaje en puntos básicos.
- [ ] **T-131 · Resolución pura de la vigencia aplicable a una fecha** — `HU-52 · RF-52.2, RF-52.5`
  Hecho cuando: pasa `CA-52.1`.
- [ ] **T-132 · Cálculo sobre el precio pactado** — `HU-52 · RF-52.1` · D-05
  Hecho cuando: pasa `CA-52.2`.
- [ ] **T-133 · Validaciones e histórico de cambios de vigencia** — `HU-52 · RF-52.3, RF-52.4`
  Hecho cuando: pasan `CA-52.3` y `CA-52.4`.
- [ ] **T-134 · Migración de `ambassadors` con términos y datos bancarios** — `HU-49 · RF-49.2, RF-49.3`
  Hecho cuando: existe con RLS y guarda la versión de términos aceptada.
- [ ] **T-135 · Formulario de inscripción con validaciones** — `HU-49 · RF-49.1, RF-49.2, RF-49.3`
  Hecho cuando: pasan `CA-49.1` y `CA-49.4`.
- [ ] **T-136 · Acumulación del rol Embajador al aprobar** — `HU-49 · RF-49.4, RF-49.6`
  Hecho cuando: pasan `CA-49.2` y `CA-49.3`.
- [ ] **T-137 · Gestión de embajadores por el Superadmin** — `HU-49 · RF-49.5`
  Hecho cuando: lista inscritos con estado, datos de pago y fecha de alta.
- [ ] **T-138 · Generación del código único e inmutable** — `HU-50 · RF-50.1, RF-50.2`
  Hecho cuando: pasan `CA-50.1` y `CA-50.2`, con restricción de unicidad en base de datos.
- [ ] **T-139 · Enlace compartible y botones de difusión** — `HU-50 · RF-50.3, RF-50.4`
  Hecho cuando: pasan `CA-50.3` y `CA-50.4`.
- [ ] **T-140 · Migración de `attributions` con ventana de 90 días** — `HU-51 · RF-51.1` · D-03
  Hecho cuando: existe con RLS y pasa `CA-51.6`.
- [ ] **T-141 · Persistencia de la atribución hasta el registro** — `HU-51 · RF-51.1, RF-51.2`
  Hecho cuando: el código llega prellenado al registro y al contacto.
- [ ] **T-142 · Primera atribución gana y sin auto-referencia** — `HU-51 · RF-51.3, RF-51.4`
  Hecho cuando: pasan `CA-51.1` y `CA-51.2`.
- [ ] **T-143 · Ciclo de vida del referido** — `HU-51 · RF-51.5`
  Hecho cuando: pasan `CA-51.3` y `CA-51.4`.
- [ ] **T-144 · Código inválido o inhabilitado sin bloquear el flujo** — `HU-51 · RF-51.6`
  Hecho cuando: pasa `CA-51.5`.
- [ ] **T-145 · Una sola comisión por prospecto** — `HU-51 · RF-51.7` · D-04
  Hecho cuando: pasa `CA-51.7`.

## Paso 6 · Subpáginas institucionales

- [ ] **T-146 · Manifiesto y página de Modelo de negocio** — `HU-41 · RF-41.1, RF-41.2, RF-41.4`
  Hecho cuando: pasan `CA-41.1` y `CA-41.3`.
- [ ] **T-147 · CTA de Modelo de negocio hacia el registro** — `HU-41 · RF-41.3`
  Hecho cuando: pasa `CA-41.2`.
- [ ] **T-148 · Estructura tipada del comparativo de Beneficios** — `HU-42 · RF-42.1, RF-42.2`
  Hecho cuando: pasa `CA-42.1`.
- [ ] **T-149 · Marcado de cifras estimadas del comparativo** — `HU-42 · RF-42.3` · `TR-02`
  Hecho cuando: pasan `CA-42.2` y `CA-42.3`.
- [ ] **T-150 · Página de Beneficios con su CTA** — `HU-42 · RF-42.4` · `RT-06`
  Hecho cuando: el comparativo se lee en 320 px y el CTA resuelve al registro.
- [ ] **T-151 · Manifiesto de la página de Agendamiento** — `HU-43 · RF-43.1, RF-43.4`
  Hecho cuando: pasa `CA-43.1` con el cupo 7/7/7/21.
- [ ] **T-152 · Coherencia de la página con el motor** — `HU-43 · RF-43.2`
  Hecho cuando: pasa `CA-43.2`.
- [ ] **T-153 · CTA de la página de Agendamiento** — `HU-43 · RF-43.3`
  Hecho cuando: pasa `CA-43.3`.
- [ ] **T-154 · Manifiesto y secciones de Sobre Nosotros** — `HU-44 · RF-44.1, RF-44.4`
  Hecho cuando: pasa `CA-44.1`.
- [ ] **T-155 · Estructuras de preguntas frecuentes y testimonios** — `HU-44 · RF-44.2`
  Hecho cuando: pasa `CA-44.2` y el acordeón funciona en móvil.
- [ ] **T-156 · CTA e i18n de Sobre Nosotros** — `HU-44 · RF-44.3`
  Hecho cuando: pasa `CA-44.3`.
- [ ] **T-157 · Migración de `waitlist_entries` con consentimiento** — `HU-47 · RF-47.2, RF-47.5` · D-25
  Hecho cuando: existe con RLS, orden de inscripción y unicidad por correo y propiedad.
- [ ] **T-158 · Formulario de lista de espera condicionado** — `HU-47 · RF-47.1`
  Hecho cuando: pasan `CA-47.1` y `CA-47.2`.
- [ ] **T-159 · Correo de confirmación con límite de tasa** — `HU-47 · RF-47.3` · D-24
  Hecho cuando: pasa `CA-47.3`.
- [ ] **T-160 · Disparador de aviso al liberarse una fracción** — `HU-47 · RF-47.4`
  Hecho cuando: pasa `CA-47.4`, en orden de inscripción y una sola vez por persona.
- [ ] **T-161 · Página del Programa de Embajadores** — `HU-48 · RF-48.1, RF-48.3`
  Hecho cuando: explica el flujo completo y las condiciones, con claves en ambos locales.
- [ ] **T-162 · Publicación del monto de comisión vigente** — `HU-48 · RF-48.2` · `TR-02`
  Hecho cuando: pasa `CA-48.1` leyendo la vigencia de HU-52, sin valor fijo en el código.
- [ ] **T-163 · CTA condicionado por sesión** — `HU-48 · RF-48.4`
  Hecho cuando: pasan `CA-48.2` y `CA-48.3`.

---

# Sprint 3 — Operación, dashboards, finanzas y comisiones · 84 SP

## Paso 1 · HU-23 — Maestra contable y prorrateo

- [ ] **T-164 · Migración de la maestra contable** — `HU-23 · RF-23.1`
  Hecho cuando: existen categorías, medios de pago y cuentas con RLS y marca de activa.
- [ ] **T-165 · Migración de `movements` con fecha de causación** — `HU-23 · RF-23.2, RF-23.7` · D-09
  Hecho cuando: existe con RLS, exige categoría de la maestra y monto mayor que cero.
- [ ] **T-166 · Migración de `movement_shares` con pagador** — `HU-23 · RF-23.6` · D-08, D-31
  Hecho cuando: cada cuota registra si la paga el Propietario o el titular del inventario.
- [ ] **T-167 · Generación automática de las 8 cuotas** — `HU-23 · RF-23.3` · `TR-02`
  Hecho cuando: pasan `CA-23.1` y `CA-23.2`.
- [ ] **T-168 · Imputación de fracciones sin calendario activo** — `HU-23 · RF-23.6`
  Hecho cuando: pasan `CA-23.5` y `CA-23.7`.
- [ ] **T-169 · Validaciones de alta de gasto** — `HU-23 · RF-23.2`
  Hecho cuando: pasa `CA-23.3`.
- [ ] **T-170 · Anulación de gasto con reversa de cuotas** — `HU-23 · RF-23.4`
  Hecho cuando: pasa `CA-23.4`.
- [ ] **T-171 · Rechazo de comisiones en la maestra de propiedad** — `HU-23 · RF-23.5` · D-01
  Hecho cuando: pasa `CA-23.6`.
- [ ] **T-172 · Formulario de gasto del Administrador** — `HU-23 · RF-23.2` · `RT-06`
  Hecho cuando: registra un gasto completo desde móvil y muestra las 8 cuotas generadas.

## Paso 2 · HU-24, HU-40, HU-39 — Detalle, ingresos y renta a terceros

- [ ] **T-173 · Armado puro del detalle de prorrateo** — `HU-24 · RF-24.1, RF-24.4`
  Hecho cuando: pasa `CA-24.1`.
- [ ] **T-174 · Detalle de cuota de ingreso y marca de residuo** — `HU-24 · RF-24.2` · `TR-02 RF-D.3`
  Hecho cuando: pasa `CA-24.2` y el residuo aparece explícito.
- [ ] **T-175 · RLS del detalle por fracción propia** — `HU-24 · RF-24.3`
  Hecho cuando: pasa `CA-24.3`.
- [ ] **T-176 · Migración de `third_parties` con consentimiento** — `HU-39 · RF-39.1, RF-39.5` · D-25
  Hecho cuando: existe con RLS, evita duplicar por documento y guarda fecha de anonimización.
- [ ] **T-177 · Migración de `third_party_bookings` sobre la bolsa de renta** — `HU-39 · RF-39.2, RF-39.3`
  Hecho cuando: comparte la restricción de exclusión con `stays` y `blocks`.
- [ ] **T-178 · Validación de renta solo sobre bolsa de renta** — `HU-39 · RF-39.2`
  Hecho cuando: pasan `CA-39.1` y `CA-39.2`.
- [ ] **T-179 · Reutilización de tercero y cancelación** — `HU-39 · RF-39.1, RF-39.4`
  Hecho cuando: pasan `CA-39.3` y `CA-39.4`.
- [ ] **T-180 · Migración del ingreso por renta** — `HU-40 · RF-40.1, RF-40.3`
  Hecho cuando: existe vinculado a la reserva, con un solo ingreso vigente por reserva.
- [ ] **T-181 · Prorrateo del ingreso a las 8 fracciones** — `HU-40 · RF-40.2` · `TR-02`
  Hecho cuando: pasan `CA-40.1` y `CA-40.3`.
- [ ] **T-182 · Rechazo de segundo ingreso sobre la misma reserva** — `HU-40 · RF-40.3`
  Hecho cuando: pasa `CA-40.2`.

## Paso 3 · HU-60 — Fechas Especiales

- [ ] **T-183 · Cálculo puro de la bolsa fuera de rejilla** — `HU-60 · RF-60.1`
  Hecho cuando: pasan `CA-60.1` y `CA-60.2`.
- [ ] **T-184 · Herencia de temporada de las noches de la bolsa** — `HU-60 · RF-60.2`
  Hecho cuando: pasa `CA-60.3`.
- [ ] **T-185 · Migración de `night_pool` y asignación anual** — `HU-60 · RF-60.3`
  Hecho cuando: existe con RLS y pasa `CA-60.4` sobre 8 años.
- [ ] **T-186 · Reglas de la estadía comodín** — `HU-60 · RF-60.4, RF-60.5` · schedule.md P-09
  Hecho cuando: pasan `CA-60.5` y `CA-60.6`.
- [ ] **T-187 · Prohibición de bloque pico ajeno** — `HU-60 · RF-60.6` · D-27
  Hecho cuando: pasa `CA-60.7`.
- [ ] **T-188 · Elección en la ventana y caducidad a 60 días** — `HU-60 · RF-60.7` · `HU-59 · RF-59.7`
  Hecho cuando: pasa `CA-60.8` y la bolsa de una fracción inactiva fluye a renta sin alterar la rotación.
- [ ] **T-189 · Presentación de la bolsa en el calendario** — `HU-60 · RF-60.8` · `HU-13 · RF-13.2`
  Hecho cuando: las noches comodín se distinguen del cupo regular e indican la fracción del año.

## Paso 4 · HU-16, HU-17, HU-21 — Operación del Administrador

- [ ] **T-190 · Acotamiento de la notificación a la fracción propia** — `HU-16 · RF-16.1, RF-16.2, RF-16.3`
  Hecho cuando: pasan `CA-16.1` y `CA-16.2`.
- [ ] **T-191 · Emisión única por evento de calendario** — `HU-16 · RF-16.4` · `TR-03`
  Hecho cuando: pasa `CA-16.3`.
- [ ] **T-192 · Acciones administrativas sobre el calendario** — `HU-17 · RF-17.1`
  Hecho cuando: pasa `CA-17.4` y ninguna acción procede sobre propiedad no asignada.
- [ ] **T-193 · Aviso previo obligatorio al Propietario afectado** — `HU-17 · RF-17.2`
  Hecho cuando: pasa `CA-17.1`.
- [ ] **T-194 · Invariantes en la reasignación** — `HU-17 · RF-17.3`
  Hecho cuando: pasan `CA-17.2` y `CA-17.3`.
- [ ] **T-195 · Auditoría de las acciones de calendario** — `HU-17 · RF-17.4` · `TR-01`
  Hecho cuando: cada acción registra acción, motivo, estadía afectada, autor y fecha.
- [ ] **T-196 · Indicadores del dashboard del Administrador** — `HU-21 · RF-21.1, RF-21.2`
  Hecho cuando: pasan `CA-21.1` y `CA-21.2`.
- [ ] **T-197 · Alcance del dashboard a propiedades asignadas** — `HU-21 · RF-21.3`
  Hecho cuando: pasa `CA-21.3`.
- [ ] **T-198 · Transiciones de lista con `@formkit/auto-animate`** — `HU-21` · `RT-12`
  Hecho cuando: los listados del dashboard animan altas y bajas sin salto de layout.

## Paso 5 · HU-18, HU-19, HU-20 — Dashboard del Propietario

- [ ] **T-199 · Armado puro del resumen por fracción** — `HU-18 · RF-18.1, RF-18.3`
  Hecho cuando: pasan `CA-18.1` y `CA-18.2`.
- [ ] **T-200 · Detalle de ingresos por renta en la tarjeta** — `HU-18 · RF-18.2`
  Hecho cuando: pasa `CA-18.3`.
- [ ] **T-201 · Estado de plan de pagos e interruptor en la tarjeta** — `HU-18 · RF-18.5` · D-31
  Hecho cuando: muestra saldo pendiente, qué falta para activar y los copropietarios con nombre y fracción.
- [ ] **T-202 · RLS del dashboard a fracciones propias** — `HU-18 · RF-18.4`
  Hecho cuando: un Propietario con fracciones en dos propiedades ve exactamente esas dos.
- [ ] **T-203 · Desglose de gastos e ingresos prorrateados** — `HU-19 · RF-19.1`
  Hecho cuando: pasa `CA-19.2`.
- [ ] **T-204 · Agregación mensual pura** — `HU-19 · RF-19.2`
  Hecho cuando: pasan `CA-19.1` y `CA-19.3`.
- [ ] **T-205 · Enlace de cada línea al detalle de prorrateo** — `HU-19 · RF-19.3`
  Hecho cuando: cada línea abre el detalle de `HU-24` de esa cuota.
- [ ] **T-206 · Formato monetario del desglose** — `HU-19 · RF-19.4` · `TR-02`
  Hecho cuando: los importes usan IBM Plex Mono y el formato de `RF-D.5`.
- [ ] **T-207 · Historial de estadías con filtros** — `HU-20 · RF-20.1, RF-20.2, RF-20.3`
  Hecho cuando: pasan `CA-20.1`, `CA-20.2` y `CA-20.3`.

## Paso 6 · HU-53, HU-54 — Motor de comisiones

- [ ] **T-208 · Migración de `commissions` con estados de saldo** — `HU-54 · RF-54.1` · D-02
  Hecho cuando: existe con RLS y contempla pendiente, en gracia, disponible, retirada y reversada.
- [ ] **T-209 · Acreditación al completarse el pago** — `HU-54 · RF-54.2` · `HU-58 · RF-58.6`
  Hecho cuando: pasa `CA-54.1`.
- [ ] **T-210 · Una sola comisión por prospecto** — `HU-54 · RF-54.3` · D-04
  Hecho cuando: pasan `CA-54.6` y `CA-54.7`.
- [ ] **T-211 · Idempotencia de la acreditación** — `HU-54 · RF-54.4`
  Hecho cuando: pasa `CA-54.3`.
- [ ] **T-212 · Paso de gracia a disponible a los 30 días** — `HU-54 · RF-54.1` · DT-09
  Hecho cuando: pasa `CA-54.2` con tarea programada idempotente.
- [ ] **T-213 · Reversa dentro de la gracia** — `HU-54 · RF-54.5` · `HU-58 · RF-58.8`
  Hecho cuando: pasa `CA-54.4`.
- [ ] **T-214 · Devengo único en el libro de plataforma** — `HU-54 · RF-54.6` · D-01
  Hecho cuando: pasa `CA-54.5` y no se genera cuota alguna en la propiedad.
- [ ] **T-215 · Efecto de la suspensión según su tipo** — `HU-54 · RF-54.7` · D-07
  Hecho cuando: pasa `CA-54.8`.
- [ ] **T-216 · Listado de referidos con estados y comisión** — `HU-53 · RF-53.1, RF-53.2, RF-53.3`
  Hecho cuando: pasa `CA-53.3` y un referido `Registrado` no muestra monto.
- [ ] **T-217 · Filtros y totalizadores del listado** — `HU-53 · RF-53.4`
  Hecho cuando: pasan `CA-53.1` y `CA-53.2`.
- [ ] **T-218 · RLS del listado de referidos** — `HU-53 · RF-53.5` · D-20
  Hecho cuando: pasa `CA-53.4` y el Superadmin ve todos.

---

# Sprint 4 — Inventario, comunicación, panel y billetera · 66 SP

## Paso 1 · HU-26, HU-27, HU-28 — Inventario y mantenimiento

- [ ] **T-219 · Migración de `inventory_items` con baja lógica** — `HU-26 · RF-26.1, RF-26.2`
  Hecho cuando: existe con RLS y no admite borrado físico.
- [ ] **T-220 · Validaciones del ítem de inventario** — `HU-26 · RF-26.1`
  Hecho cuando: pasa `CA-26.1`.
- [ ] **T-221 · Baja lógica conservando histórico** — `HU-26 · RF-26.2, RF-26.4`
  Hecho cuando: pasa `CA-26.2` y los cambios de estado y cantidad quedan historizados.
- [ ] **T-222 · RLS de escritura solo para el Administrador asignado** — `HU-26 · RF-26.3`
  Hecho cuando: pasa `CA-26.3`.
- [ ] **T-223 · Gasto de mantenimiento como gasto de HU-23** — `HU-27 · RF-27.1, RF-27.2`
  Hecho cuando: pasa `CA-27.1` y genera las 8 cuotas del módulo financiero.
- [ ] **T-224 · Asociación del gasto a un ítem o a la propiedad** — `HU-27 · RF-27.3`
  Hecho cuando: pasa `CA-27.2`.
- [ ] **T-225 · Adjunto de factura con políticas de acceso** — `HU-27 · RF-27.1`
  Hecho cuando: pasa `CA-27.3`.
- [ ] **T-226 · Vista de solo lectura del Propietario** — `HU-28 · RF-28.1, RF-28.2`
  Hecho cuando: pasan `CA-28.1`, `CA-28.2` y `CA-28.3`.

## Paso 2 · HU-29, HU-30, HU-31 — Comunicación

- [ ] **T-227 · Migración de `announcements` con urgencia y estado** — `HU-29 · RF-29.1, RF-29.3`
  Hecho cuando: existe con RLS y contempla abierta y resuelta.
- [ ] **T-228 · Validación del aviso** — `HU-29 · RF-29.1`
  Hecho cuando: pasa `CA-29.2`.
- [ ] **T-229 · Notificación a todos los propietarios de la propiedad** — `HU-29 · RF-29.2` · `TR-03`
  Hecho cuando: pasan `CA-29.1` y `CA-29.3`.
- [ ] **T-230 · Semántica de color de la urgencia** — `HU-29 · RF-29.4` · `RT-07`
  Hecho cuando: el rojo se usa solo para urgente y sale de los tokens de marca.
- [ ] **T-231 · Novedades abiertas como alertas del Administrador** — `HU-29 · RF-29.3` · `HU-21 · RF-21.2`
  Hecho cuando: una novedad abierta aparece en el dashboard y desaparece al resolverse.
- [ ] **T-232 · Vista del Propietario sobre la bandeja** — `HU-30 · RF-30.1, RF-30.3` · `TR-03`
  Hecho cuando: pasan `CA-30.2` y `CA-30.3`.
- [ ] **T-233 · Marcado de leídas y contador** — `HU-30 · RF-30.2`
  Hecho cuando: pasa `CA-30.1`.
- [ ] **T-234 · Segmentación de comunicados globales** — `HU-31 · RF-31.1, RF-31.2`
  Hecho cuando: pasan `CA-31.1`, `CA-31.2` y `CA-31.3`.
- [ ] **T-235 · Envío y registro del comunicado** — `HU-31 · RF-31.3, RF-31.4`
  Hecho cuando: solo el Superadmin lo emite y queda registrado con su segmento y fecha.

## Paso 3 · HU-25, HU-32, HU-33, HU-22 — Panel del Superadmin

- [ ] **T-236 · Agregación pura del reporte financiero** — `HU-25 · RF-25.1, RF-25.4`
  Hecho cuando: pasan `CA-25.1` y `CA-25.2`.
- [ ] **T-237 · Separación de libro de propiedad y libro de plataforma** — `HU-25 · RF-25.3` · D-01
  Hecho cuando: pasa `CA-25.3`.
- [ ] **T-238 · Serialización CSV propia** — `HU-25 · RF-25.2` · DT-11
  Hecho cuando: pasan `CA-25.4` y `CA-25.5`.
- [ ] **T-239 · Acceso exclusivo del Superadmin al reporte** — `HU-25 · RF-25.5`
  Hecho cuando: cualquier otro rol recibe denegación.
- [ ] **T-240 · Cálculo de los KPI globales** — `HU-32 · RF-32.1, RF-32.3`
  Hecho cuando: pasan `CA-32.1` y `CA-32.3`, sin doble conteo entre estados de comisión.
- [ ] **T-241 · Series por periodo con `@unovis/vue`** — `HU-32 · RF-32.2` · `RT-12`, DT-01
  Hecho cuando: pasa `CA-32.2` y el componente recibe la serie ya calculada.
- [ ] **T-242 · Formato de cifras del panel** — `HU-32 · RF-32.4` · `TR-02`
  Hecho cuando: los importes siguen `RF-D.5` y ninguna métrica estimada aparece sin su condición.
- [ ] **T-243 · Suspensión con motivo y tipo** — `HU-33 · RF-33.1, RF-33.3` · D-07
  Hecho cuando: pasan `CA-33.1` y `CA-33.2`.
- [ ] **T-244 · Inhabilitación del código de referido** — `HU-33 · RF-33.2`
  Hecho cuando: pasa `CA-33.3`.
- [ ] **T-245 · Efecto de la suspensión sobre el saldo** — `HU-33 · RF-33.3` · `HU-54 · RF-54.7`
  Hecho cuando: pasa `CA-33.5`.
- [ ] **T-246 · Suspensión de un Propietario con estadías futuras** — `HU-33 · RF-33.4`
  Hecho cuando: las estadías no se cancelan solas y la decisión del Administrador queda auditada.
- [ ] **T-247 · Reactivación y auditoría** — `HU-33 · RF-33.5, RF-33.6`
  Hecho cuando: pasa `CA-33.4`.
- [ ] **T-248 · Buscador de propiedades del Administrador** — `HU-22 · RF-22.1, RF-22.2, RF-22.3`
  Hecho cuando: pasan `CA-22.1`, `CA-22.2` y `CA-22.3`.

## Paso 4 · HU-55, HU-56, HU-57 — Billetera y retiros

- [ ] **T-249 · Migración de `wallet_movements`** — `HU-55 · RF-55.2`
  Hecho cuando: existe con RLS y registra acreditación, paso a disponible, reversa, solicitud y pago.
- [ ] **T-250 · Derivación pura de los cuatro saldos** — `HU-55 · RF-55.1, RF-55.2`
  Hecho cuando: pasan `CA-55.1`, `CA-55.2` y `CA-55.3`.
- [ ] **T-251 · Listado de movimientos con filtros** — `HU-55 · RF-55.3`
  Hecho cuando: pasa `CA-55.4` con orden descendente y filtro por tipo y periodo.
- [ ] **T-252 · Acceso a la billetera y lectura del Superadmin** — `HU-55 · RF-55.4` · D-20
  Hecho cuando: pasa `CA-55.5`.
- [ ] **T-253 · Formato de la billetera** — `HU-55 · RF-55.5` · `TR-02`
  Hecho cuando: las cuatro cifras usan IBM Plex Mono y ninguna presenta lo pendiente como disponible.
- [ ] **T-254 · Migración de `withdrawal_requests` con solicitud única abierta** — `HU-56 · RF-56.3`
  Hecho cuando: existe con RLS y pasa `CA-56.5` por restricción de base de datos.
- [ ] **T-255 · Mínimo configurable y retiro parcial** — `HU-56 · RF-56.1` · D-06
  Hecho cuando: pasan `CA-56.1` y `CA-56.2`.
- [ ] **T-256 · Máquina de estados de la solicitud** — `HU-56 · RF-56.2`
  Hecho cuando: pasan `CA-56.3` y `CA-56.4`.
- [ ] **T-257 · Registro de pago con comprobante** — `HU-56 · RF-56.4`
  Hecho cuando: pasa `CA-56.6`.
- [ ] **T-258 · Ausencia de segundo egreso al pagar** — `HU-56 · RF-56.5` · D-01
  Hecho cuando: pasa `CA-56.7`.
- [ ] **T-259 · Auditoría y notificación de cada transición de retiro** — `HU-56 · RF-56.6` · `TR-01`, `TR-03`
  Hecho cuando: cada transición deja auditoría y avisa al Embajador una sola vez.
- [ ] **T-260 · Eventos notificables del Embajador** — `HU-57 · RF-57.1, RF-57.2`
  Hecho cuando: pasan `CA-57.1`, `CA-57.2` y `CA-57.3`.
- [ ] **T-261 · Plantillas e idioma del Embajador** — `HU-57 · RF-57.3` · `TR-03`
  Hecho cuando: cada evento tiene plantilla en `en` y `es` y se elige por el idioma del destinatario.
- [ ] **T-262 · Idempotencia de las notificaciones del programa** — `HU-57 · RF-57.4`
  Hecho cuando: pasa `CA-57.4`.

---

# Cierre del MVP

- [ ] **T-263 · Informe de trazabilidad completo en verde** — principio 4
  Hecho cuando: todos los `CA` de las 55 historias y los 3 transversales tienen test que los cita y la suite pasa.
- [ ] **T-264 · Revisión de responsive y bitema de todas las vistas** — `RT-06`
  Hecho cuando: cada vista se valida en 320/768/1280 px y en ambos temas.
- [ ] **T-265 · Auditoría de paridad i18n y ausencia de textos fijos** — `RT-05`
  Hecho cuando: `en.json` y `es.json` tienen las mismas claves y ningún texto visible está escrito en el código.
- [ ] **T-266 · Verificación del stack cerrado** — `RT-01` · principio 1
  Hecho cuando: `package.json` no contiene ninguna dependencia fuera de `stack.md`.
- [ ] **T-267 · Despliegue en Netlify con variables de entorno** — `RT-01`
  Hecho cuando: el sitio queda publicado, con Supabase y el proveedor de correo configurados por variables.

---

## Cobertura

| Sprint | Tareas | Historias y transversales cubiertas |
|---|---|---|
| 1 | T-001 … T-086 | RT base, TR-01, TR-02, HU-04, HU-05, HU-07, HU-08, HU-09, HU-10, HU-11, HU-06, HU-58, HU-00, HU-01, HU-02, HU-03, HU-46 |
| 2 | T-087 … T-163 | TR-03, HU-12, HU-13, HU-14, HU-15, HU-59, HU-52, HU-49, HU-50, HU-51, HU-41, HU-42, HU-43, HU-44, HU-47, HU-48 |
| 3 | T-164 … T-218 | HU-23, HU-24, HU-39, HU-40, HU-60, HU-16, HU-17, HU-21, HU-18, HU-19, HU-20, HU-53, HU-54 |
| 4 | T-219 … T-262 | HU-26, HU-27, HU-28, HU-29, HU-30, HU-31, HU-25, HU-32, HU-33, HU-22, HU-55, HU-56, HU-57 |
| Cierre | T-263 … T-267 | Verificación transversal |

**267 tareas. Las 55 historias y los 3 requisitos transversales tienen al menos una tarea; ninguna tarea existe sin HU o RT que la justifique.**
