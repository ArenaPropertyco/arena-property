# Arena Property — Historias de Usuario & Visual Story Map

**Documento de insumo para estimación de tiempo y valor de desarrollo**
**Modelo de referencia:** copropiedad fraccionada de propiedades vacacionales (fracciones de 1/8, SpA, agendamiento por temporada, property management centralizado)
**Horizonte de planificación:** 4 sprints (asumiendo sprints de 2 semanas / 8 semanas totales)

> **Novedades de esta revisión** — se **elimina por completo la épica del Simulador de Ganancias** y sus 5 historias (HU-34, HU-35, HU-36, HU-37 y HU-38, −29 SP), y se crea en su lugar el módulo **E11. Programa de Referidos (Embajadores)** con un nuevo rol, **Embajador**, y **10 historias nuevas** (HU-48 a HU-57, +55 SP) repartidas de forma lógica entre los 4 sprints. El total pasa de 47 a **52 historias** y de 264 a **290 story points**.

---

## 1. Contexto del producto

Arena Property es una web app que administra propiedades vacacionales bajo un modelo de copropiedad fraccionada: cada propiedad se divide en 8 fracciones, cada fracción da derecho a semanas de uso distribuidas por temporada (alta, media-alta, media, baja), y toda la operación (agendamiento, gastos comunes, mantenimiento, comunicación) vive dentro de la plataforma.

El producto gira en torno a un objeto central: **la Propiedad**. Todo rol, todo módulo y todo flujo se conecta a una o varias propiedades. Además del flujo transaccional, la plataforma incluye un **sitio institucional** (home, modelo de negocio, beneficios, sistema de agendamiento, sobre nosotros, contacto) que funciona como el embudo de descubrimiento antes del registro, y una capacidad de **renta a terceros**: el Administrador puede rentar las semanas no usadas de una propiedad a un tercero no propietario, generando y registrando un ingreso adicional para el inmueble.

A esto se suma un **canal de crecimiento propio: el Programa de Referidos**. Cualquier persona registrada puede inscribirse como **Embajador**, recibir un código de referido único y dedicarse a buscar clientes para Arena Property. Cuando un referido suyo compra una fracción y **completa la totalidad del pago**, se le libera automáticamente al Embajador un **saldo a favor** por el monto de comisión que el Superadmin haya definido. El Embajador puede hacer seguimiento del estado de cada referido (en proceso / pago completado), ver su saldo acumulado y solicitar el retiro de sus ganancias — convirtiendo la referenciación en una fuente de ingreso pasivo.

---

## 2. Roles de usuario

El producto distingue un **embudo de conversión** de tres estados por los que pasa una misma persona: **Visitante → Usuario → Propietario**. En paralelo existe un rol transversal de crecimiento: el **Embajador**, al que puede inscribirse cualquier persona con cuenta registrada (sea Usuario o Propietario).

| # | Rol | Descripción | Alcance |
|---|-----|-------------|---------|
| 1 | **Superadmin** | Dueño operativo de la plataforma. Administra administradores de propiedad, ve todas las propiedades del sistema, define el monto de comisión del programa de referidos, aprueba pagos a Embajadores, y configura parámetros globales, permisos y reportes consolidados. | Global — todas las propiedades y todos los embajadores |
| 2 | **Administrador de Propiedad** | Gestiona el portafolio de propiedades que tiene asignado. Crea y edita propiedades, controla el calendario de cada una (incluyendo reservas a terceros), gestiona inventario y gastos de mantenimiento, y notifica novedades a los propietarios. | Solo las propiedades que administra — permisos completos sobre esas propiedades y sus calendarios |
| 3 | **Propietario** | Dueño de una o más fracciones (1/8) de una o varias propiedades. Tiene un dashboard donde ve sus propiedades, sus utilidades/gastos prorrateados (incluyendo ingresos por renta a terceros) y agenda sus semanas de uso. Puede además inscribirse como Embajador. | Solo sus propias fracciones/propiedades |
| 4 | **Embajador** | Persona con cuenta registrada que se inscribe en el Programa de Referidos. Recibe un código de referido único, busca y refiere clientes potenciales, hace seguimiento del estado de cada referido y acumula un saldo a favor que se libera cuando su referido completa el pago total de la fracción. Su objetivo es generar ingresos pasivos por referenciación. | Solo sus propios referidos y su propio saldo |
| 5 | **Usuario** | Persona con cuenta registrada (completó HU-04) que aún no posee ninguna fracción. Está en proceso de decisión/compra. Al cerrar la compra de una fracción (HU-06), se convierte automáticamente en Propietario. | Cuenta propia, sin fracciones aún |
| 6 | **Visitante** | Persona sin cuenta que explora el sitio público: home, catálogo, ficha de propiedad, páginas institucionales, programa de embajadores y formularios de contacto/lista de espera. Al registrarse (HU-04), pasa a ser Usuario. | Público / sitio institucional y catálogo |

### Matriz de permisos (resumen)

| Capacidad | Superadmin | Admin. de Propiedad | Propietario | Embajador | Usuario | Visitante |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Ver sitio institucional y catálogo público | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear/editar propiedades | ✅ (todas) | ✅ (las suyas, sin poder eliminar) | ❌ | ❌ | ❌ | ❌ |
| Gestionar calendario de una propiedad (incl. reservas a terceros) | ✅ (todas) | ✅ (las suyas) | ❌ (solo agenda su semana) | ❌ | ❌ | ❌ |
| Reservar semanas dentro de su fracción | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Ver utilidades / gastos e ingresos prorrateados | ✅ (todas) | ✅ (agregado) | ✅ (las suyas) | ❌ | ❌ | ❌ |
| Gestionar inventario de la propiedad | ❌ | ✅ | 👁️ solo lectura | ❌ | ❌ | ❌ |
| Registrar gastos de mantenimiento | ❌ | ✅ | 👁️ solo lectura | ❌ | ❌ | ❌ |
| Enviar notificaciones/novedades a propietarios | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Administrar usuarios y roles del sistema | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Registrarse / crear cuenta | — | — | — | — | — | ✅ |
| Anotarse en lista de espera / contactar / iniciar compra | — | — | — | ✅ | ✅ | ✅ |
| Inscribirse en el Programa de Referidos | ❌ | ❌ | ✅ | — (ya inscrito) | ✅ | ❌ (debe registrarse primero) |
| Generar y compartir código de referido | ❌ | ❌ | ✅ (si es Embajador) | ✅ | ❌ | ❌ |
| Ver listado de sus referidos y su estado | ✅ (todos) | ❌ | ✅ (los suyos, si es Embajador) | ✅ (los suyos) | ❌ | ❌ |
| Ver saldo a favor y solicitar retiro | ❌ | ❌ | ✅ (si es Embajador) | ✅ | ❌ | ❌ |
| Definir el monto de comisión por referido | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Aprobar y registrar pagos de comisión a Embajadores | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Épicas (backbone del Story Map)

Actividades de usuario de izquierda a derecha (eje horizontal del Story Map):

```
A. Descubrir      B. Referir y      C. Registrarse/     D. Gestionar      E. Agendar y      F. Administrar    G. Comunicar
   (sitio            ganar             Convertirse en      Propiedades       usar la           finanzas y         novedades
   institucional      (Embajador)       Propietario        (Admin)           propiedad         mantenimiento
   + catálogo)                          (Usuario/Admin)                      (Propietario)     (Admin)
   (Visitante)
```

| Épica | Objetivo | Rol principal |
|---|---|---|
| **E1. Catálogo y Descubrimiento** | Sitio institucional (home, modelo de negocio, beneficios, agendamiento, sobre nosotros, programa de embajadores, contacto) + catálogo, ficha de propiedad y lista de espera | Visitante |
| **E2. Onboarding y Roles** | Registro, login, asignación de rol, invitación de propietarios, métricas globales del Superadmin | Usuario / Superadmin |
| **E3. Gestión de Propiedades** | CRUD de propiedades (sin eliminación), ficha técnica ampliada, estados de visibilidad y comerciales, fracciones | Superadmin / Admin |
| **E4. Calendario y Agendamiento** | Reservas por fracción, reglas de temporada, bloqueos, reservas a terceros, novedades | Admin / Propietario |
| **E5. Dashboard del Propietario** | Vista consolidada de propiedades, calendario, utilidades e ingresos por renta a terceros | Propietario |
| **E6. Dashboard del Administrador** | Vista consolidada de propiedades administradas, notificaciones | Admin |
| **E7. Finanzas: Utilidades e Ingresos/Gastos Prorrateados** | Cálculo y visualización de ingresos y gastos comunes por fracción, incluyendo renta a terceros | Propietario / Admin |
| **E8. Inventario y Mantenimiento** | Registro de inventario y gastos de mantenimiento por propiedad | Admin |
| **E9. Notificaciones y Comunicación** | Avisos de novedades a propietarios, acotados a la fracción correspondiente | Admin → Propietario |
| **E10. Panel Superadmin** | Suspensión/reactivación de cuentas | Superadmin |
| **E11. Programa de Referidos (Embajadores)** | Inscripción de Embajadores, código de referido único, atribución de referidos, seguimiento de estado, comisión definida por Superadmin, liberación automática de saldo a favor al completarse el pago, y retiro de ganancias | Embajador / Superadmin |

---

## 4. Historias de usuario

Formato: `HU-##` — **Como** [rol] **quiero** [acción] **para** [beneficio].
Se incluyen criterios de aceptación clave, story points (escala Fibonacci) y prioridad MoSCoW.
Las historias marcadas 🆕 son nuevas en esta revisión; las marcadas ✏️ fueron corregidas/enriquecidas en revisiones previas.

### Épica E1 — Catálogo y Descubrimiento

**HU-00** — Como Visitante, quiero explorar la información general del negocio en la página de inicio, para entender rápidamente qué es Arena Property.
- Criterios: debe incluir Navbar; Hero principal con video y slogan; sección de Modelo de negocio (explicación corta + botón a subpágina de detalle, HU-41); sección de Beneficios (bullets cortos de ventajas del modelo fraccionado frente a una propiedad completa + botón a subpágina de detalle, HU-42); CTA; Footer.
- SP: 8 · Prioridad: Must

**HU-01** ✏️ — Como Visitante, quiero ver un catálogo público de propiedades Arena Property con fotos, ubicación y precio por fracción, para decidir si quiero invertir.
- Criterios: listado con filtros (región, precio, estado: disponible/lista de espera/vendida); ficha de detalle con m², habitaciones, baños, estacionamientos.
- SP: 5 · Prioridad: Must

**HU-02** ✏️ — Como Visitante, quiero ver el detalle de una propiedad luego de dar clic en el catálogo, para conocer a profundidad su información.
- Criterios: galería de imágenes y video, plano elevado, descripción larga, ubicación, equipamiento.
- SP: 5 · Prioridad: Must

**HU-03** ✏️ — Como Visitante, quiero contactar a Arena Property desde la ficha de una propiedad, para resolver dudas antes de comprar.
- Criterios: al dar clic en el botón "Contáctanos" dentro de la ficha, se ubica al Visitante en el formulario de contacto de la misma página; el formulario incluye el campo "Intención de compra" (Estoy activamente buscando comprar una segunda vivienda / Tengo una casa familiar o compartida pero quiero algo que sea realmente mío / Cada verano arriendo en el mismo lugar pero sueño con tener algo mío / Estoy atento a oportunidades de inversión inmobiliaria) y un campo de "Mensaje" libre.
- SP: 3 · Prioridad: Should

**HU-47** — Como Visitante, quiero anotarme en la lista de espera de una propiedad sin fracciones disponibles, para ser notificado cuando se libere una.
- Criterios: formulario con nombre/email/teléfono; confirmación por correo.
- SP: 3 · Prioridad: Should

**HU-41** — Como Visitante, quiero ver una página con información detallada del modelo de negocio de Arena Property y cómo me hago dueño de una fracción, para entender el modelo antes de comprar.
- Criterios: CTA hacia el flujo de registro/compra.
- SP: 3 · Prioridad: Should

**HU-42** — Como Visitante, quiero ver una página con información detallada de los beneficios de una propiedad fraccionada frente a una renta tradicional, para comparar ambas opciones.
- Criterios: cuadro comparativo con cifras e información de renta tradicional vs. sistema fraccionado.
- SP: 5 · Prioridad: Should

**HU-43** — Como Visitante, quiero ver una página con información detallada de cómo funciona el sistema de agendamiento (distribución de tiempo de uso), para tener transparencia total antes de comprar.
- Criterios: CTA hacia el flujo de registro/compra.
- SP: 3 · Prioridad: Should

**HU-44** — Como Visitante, quiero ver una página "Sobre Nosotros" con secciones de Quiénes somos, Preguntas frecuentes, Testimonios e Información de interés, para conocer más sobre la empresa.
- Criterios: CTA hacia el flujo de registro/compra.
- SP: 5 · Prioridad: Should

**HU-46** — Como Visitante, quiero llenar un formulario general de contacto, para dejar mis datos y ser contactado por Arena Property.
- Criterios: campos Nombre, Apellidos, Correo electrónico, Teléfono, Mensaje; selección de "¿Qué tipo de propiedad estás buscando comprar?" (Vivienda Vacacional / Vivienda Residencial / Terreno); "Renta Familiar Mensual Promedio" (Menos de $4.000.000 / Entre $4.000.000 y $7.000.000 / Más de $7.000.000); "Intención de compra" (las mismas 4 opciones de HU-03); botón de envío; al enviarse debe llegar un correo al correo principal de Arena Property.
- SP: 3 · Prioridad: Must

**HU-48** 🆕 — Como Visitante, quiero ver una página pública del Programa de Embajadores que explique cómo ganar dinero refiriendo clientes a Arena Property, para decidir si quiero inscribirme.
- Criterios: explicación del funcionamiento del programa (refiero → mi referido compra → mi referido paga la totalidad → se libera mi comisión); ejemplo del monto de comisión vigente; condiciones del programa; CTA hacia el registro/inscripción como Embajador (HU-49).
- SP: 3 · Prioridad: Should

### Épica E2 — Onboarding y Roles

**HU-04** ✏️ — Como Visitante, quiero registrarme y crear una cuenta, para poder iniciar el proceso de compra de una fracción.
- Criterios: registro por email/contraseña; verificación de correo; al completar el registro, el Visitante pasa a ser Usuario.
- SP: 3 · Prioridad: Must

**HU-05** — Como Superadmin, quiero crear cuentas de Administrador de Propiedad y asignarles propiedades, para delegar la operación diaria.
- Criterios: alta de admin; asignación de una o más propiedades; el admin solo ve lo asignado.
- SP: 5 · Prioridad: Must

**HU-06** ✏️ — Como Administrador de Propiedad, quiero invitar a un comprador como Propietario de una fracción específica, para darle acceso a su dashboard una vez cerrada la compra.
- Criterios: invitación por correo; el Usuario invitado queda vinculado a la fracción X de la propiedad Y; al aceptar la invitación y cerrar la compra, el Usuario se convierte automáticamente en Propietario de esa fracción.
- SP: 5 · Prioridad: Must

**HU-07** — Como Superadmin, quiero definir y gestionar los roles y permisos del sistema, para controlar qué puede hacer cada tipo de usuario.
- Criterios: pantalla de gestión de roles; permisos por módulo (ver matriz de permisos), incluyendo el rol Embajador.
- SP: 8 · Prioridad: Must

**HU-32** ✏️ *(reubicada desde Panel Superadmin — E10)* — Como Superadmin, quiero ver un dashboard global con métricas de toda la plataforma (propiedades, fracciones vendidas, administradores activos, propietarios, embajadores activos y comisiones generadas), para tomar decisiones de negocio.
- Criterios: KPIs principales + gráficos por periodo.
- SP: 8 · Prioridad: Should

### Épica E3 — Gestión de Propiedades

**HU-08** ✏️ — Como Administrador de Propiedad, quiero crear una nueva propiedad con su ficha técnica completa (m², habitaciones, baños, estacionamientos, fotos, video, plano elevado, descripción larga, equipamiento, ubicación), para publicarla en el catálogo.
- Criterios: formulario con validaciones; carga múltiple de imágenes y video; estados de visibilidad (En borrador / Publicada / Inactiva); estados comerciales (Próximamente / Fracciones disponibles / Vendido).
- SP: 13 · Prioridad: Must

**HU-09** — Como Administrador de Propiedad, quiero dividir una propiedad en 8 fracciones y definir su precio individual, para reflejar el modelo de copropiedad.
- Criterios: cada fracción tiene número (1/8 a 8/8), precio, estado (disponible/reservada/vendida).
- SP: 5 · Prioridad: Must

**HU-10** — Como Superadmin, quiero ver todas las propiedades del sistema sin importar qué administrador las gestiona, para tener visibilidad global.
- Criterios: listado global con filtro por administrador/estado/región.
- SP: 3 · Prioridad: Must

**HU-11** ✏️ — Como Administrador de Propiedad, quiero editar o inactivar una propiedad que administro, para mantener la información actualizada.
- Criterios: edición de ficha; el Administrador puede gestionar y modificar una propiedad, pero **nunca eliminarla** del sistema — solo inactivarla (baja lógica que conserva el histórico de reservas y gastos).
- SP: 3 · Prioridad: Should

### Épica E4 — Calendario y Agendamiento

**HU-12** — Como Administrador de Propiedad, quiero configurar el calendario de cada propiedad con las reglas de temporada (alta, media-alta, media, baja), para que el sistema reparta las semanas de forma equitativa entre las 8 fracciones.
- Criterios: calendario anual editable; cada fracción recibe 1 semana alta, 1 media-alta, 1 media y 3 bajas (o el criterio que se configure); sin solapamiento entre fracciones.
- SP: 13 · Prioridad: Must

**HU-13** — Como Propietario, quiero ver el calendario de agendamiento de cada propiedad donde tengo fracción, para saber qué semanas puedo usar.
- Criterios: vista de calendario por propiedad; semanas propias resaltadas; semanas de otros copropietarios visibles pero no editables.
- SP: 5 · Prioridad: Must

**HU-14** ✏️ — Como Propietario, quiero reservar una de mis semanas disponibles dentro del calendario, para asegurar mi estadía.
- Criterios: selección de semana dentro de su cupo; validación de cero solapamiento; **el Propietario no puede reservar más de una temporada alta de forma consecutiva**; confirmación.
- SP: 8 · Prioridad: Must

**HU-15** — Como Administrador de Propiedad, quiero marcar días como "ocupado" o "bloqueado" en el calendario de una propiedad (mantenimiento, uso institucional, etc.), para evitar reservas en esas fechas.
- Criterios: bloqueo manual con motivo; visible para todos los propietarios de esa propiedad.
- SP: 5 · Prioridad: Must

**HU-16** ✏️ — Como Propietario, quiero recibir una notificación cuando mi reserva sea confirmada o cuando haya un cambio en el calendario de mi propiedad, para estar siempre informado.
- Criterios: notificación in-app + email; **la notificación aplica únicamente a movimientos de mi propia fracción**, no a la actividad de todo el calendario de la propiedad.
- SP: 3 · Prioridad: Should

**HU-17** — Como Administrador de Propiedad, quiero tener permisos completos sobre el calendario de cada propiedad que administro (crear, editar, bloquear, reasignar), para resolver conflictos de agendamiento.
- Criterios: acciones de admin priman sobre reservas de propietarios con aviso previo automático.
- SP: 5 · Prioridad: Must

**HU-39** — Como Administrador de Propiedad, quiero crear una reserva en el calendario de una propiedad para un tercero (no propietario), para generar rentabilidad adicional del inmueble en semanas sin uso.
- Criterios: registrar los datos del tercero en una base de datos asociada; el bloqueo generado debe reflejarse en el calendario de la propiedad (mismo mecanismo de bloqueo de HU-15).
- SP: 8 · Prioridad: Should

### Épica E5 — Dashboard del Propietario

**HU-18** ✏️ — Como Propietario, quiero un dashboard donde vea todas mis propiedades (fracciones) en un solo lugar, incluyendo el detalle de ingresos generados por reservas a terceros, para gestionar mi portafolio.
- Criterios: tarjetas por propiedad con fracción, próxima estadía y estado de cuenta; detalle de ingresos por reserva a terceros (HU-40) cuando la propiedad los tenga.
- SP: 8 · Prioridad: Must

**HU-19** — Como Propietario, quiero ver mis utilidades y gastos prorrateados por propiedad dentro de mi dashboard, para entender el rendimiento y costo de mi inversión.
- Criterios: desglose de gastos comunes prorrateados por fracción; histórico mensual.
- SP: 8 · Prioridad: Must

**HU-20** — Como Propietario, quiero acceder al historial de mis reservas pasadas y futuras por propiedad, para planificar mis próximas estadías.
- Criterios: listado con filtro por propiedad y fecha.
- SP: 3 · Prioridad: Should

### Épica E6 — Dashboard del Administrador

**HU-21** — Como Administrador de Propiedad, quiero un dashboard con todas las propiedades que administro, su estado de ocupación y alertas pendientes, para operar el día a día.
- Criterios: vista resumen con % de fracciones vendidas, próximas reservas, novedades sin resolver.
- SP: 8 · Prioridad: Must

**HU-22** — Como Administrador de Propiedad, quiero filtrar y buscar entre las propiedades que administro, para encontrar rápidamente la que necesito gestionar.
- Criterios: buscador + filtros por región/estado.
- SP: 2 · Prioridad: Could

### Épica E7 — Finanzas: Utilidades e Ingresos/Gastos Prorrateados

**HU-23** ✏️ — Como Administrador de Propiedad, quiero registrar gastos comunes de una propiedad (mantención, servicios, limpieza), para que se prorrateen automáticamente entre las 8 fracciones.
- Criterios: alta de gasto con monto/categoría/fecha; cálculo automático de 1/8 por fracción; **requiere una maestra de categorías de ingreso/egreso, tipo de pago y cuentas contables** desde la cual se seleccionan estos campos.
- SP: 13 · Prioridad: Must

**HU-24** ✏️ — Como Propietario, quiero ver el detalle de cómo se calculó mi cuota prorrateada **tanto de un gasto como de un ingreso**, para tener transparencia total.
- Criterios: detalle de gasto o ingreso original + fórmula de prorrateo + monto final.
- SP: 5 · Prioridad: Should

**HU-25** ✏️ — Como Superadmin, quiero ver reportes financieros consolidados de todas las propiedades de la plataforma, para tener visión de negocio global.
- Criterios: reporte agregable por propiedad/administrador/periodo; **visualización y exportación a nivel de ingresos y egresos, por categoría y tipo de pago**; las comisiones pagadas a Embajadores se reflejan como una categoría de egreso.
- SP: 8 · Prioridad: Should

**HU-40** — Como Administrador de Propiedad, quiero registrar el ingreso generado por el uso de la propiedad en una reserva a terceros, para llevar el registro financiero de esa renta adicional.
- Criterios: guardar el valor del alquiler cobrado; el monto se suma automáticamente a las utilidades de la propiedad (alimenta HU-18, HU-24 y HU-25).
- SP: 5 · Prioridad: Should

### Épica E8 — Inventario y Mantenimiento

**HU-26** — Como Administrador de Propiedad, quiero gestionar el inventario de cada propiedad (mobiliario, equipamiento, insumos), para llevar control de los activos.
- Criterios: CRUD de ítems de inventario con categoría, estado y cantidad, asociado a una propiedad específica.
- SP: 8 · Prioridad: Must

**HU-27** — Como Administrador de Propiedad, quiero registrar gastos de mantenimiento asociados a un ítem o a la propiedad en general, para llevar trazabilidad de costos.
- Criterios: gasto de mantenimiento con foto/factura opcional, categoría, monto, fecha; queda vinculado al módulo financiero (HU-23).
- SP: 5 · Prioridad: Must

**HU-28** — Como Propietario, quiero ver el inventario y el historial de mantenimientos de mi propiedad en modo solo lectura, para estar al tanto del estado del activo.
- Criterios: vista de solo lectura dentro del dashboard del propietario.
- SP: 3 · Prioridad: Could

### Épica E9 — Notificaciones y Comunicación

**HU-29** — Como Administrador de Propiedad, quiero publicar una novedad (ej. corte de agua, reparación, cambio de reglas) en la plataforma, para notificar a todos los propietarios de esa propiedad.
- Criterios: creación de aviso con título/descripción/urgencia; notifica a todos los propietarios de esa propiedad vía in-app y email.
- SP: 5 · Prioridad: Must

**HU-30** — Como Propietario, quiero recibir y ver un historial de las novedades publicadas sobre mis propiedades, para no perder información importante.
- Criterios: bandeja de notificaciones con estado leído/no leído.
- SP: 3 · Prioridad: Should

**HU-31** — Como Superadmin, quiero enviar comunicados globales a todos los administradores, propietarios o embajadores de la plataforma, para anuncios institucionales.
- Criterios: segmentación de destinatarios (todos, por rol, por propiedad).
- SP: 5 · Prioridad: Could

### Épica E10 — Panel Superadmin

**HU-33** — Como Superadmin, quiero suspender o reactivar cuentas de administradores, propietarios o embajadores, para mantener el control de acceso a la plataforma.
- Criterios: acción de suspensión con motivo; el usuario suspendido pierde acceso inmediato; si es un Embajador, su código de referido queda inhabilitado y no genera nuevas atribuciones.
- SP: 3 · Prioridad: Should

> HU-32 (dashboard global de métricas) se reubicó al módulo de Onboarding y Roles (E2) según corrección del cliente — ver sección E2 arriba.

### Épica E11 — Programa de Referidos (Embajadores)

**HU-49** 🆕 — Como Usuario o Propietario, quiero inscribirme en el Programa de Referidos para convertirme en Embajador, para empezar a referir clientes y generar ingresos pasivos.
- Criterios: formulario de inscripción con aceptación de términos y condiciones del programa; captura de datos de pago para el desembolso de comisiones (banco, tipo y número de cuenta, titular); al aprobarse la inscripción, la cuenta suma el rol Embajador sin perder su rol previo (Usuario o Propietario); el Superadmin puede ver y gestionar la lista de embajadores inscritos.
- SP: 5 · Prioridad: Must

**HU-50** 🆕 — Como Embajador, quiero tener un código de referido único y un enlace compartible, para invitar prospectos y que quede registrado que vienen de mi parte.
- Criterios: generación automática de un código único e irrepetible al aprobarse la inscripción; enlace compartible que incluye el código; botones para copiar el código y compartir el enlace por WhatsApp, correo y redes; el código no cambia en el tiempo y queda asociado permanentemente al Embajador.
- SP: 5 · Prioridad: Must

**HU-51** 🆕 — Como Embajador, quiero que quede registrada la atribución cuando un prospecto ingresa con mi código o enlace de referido y luego se registra o compra, para asegurar que se me reconozca la comisión.
- Criterios: al ingresar por un enlace con código, el sistema persiste la atribución durante la sesión y hasta el registro; el formulario de registro (HU-04) y el de contacto (HU-46) incluyen un campo opcional de "Código de referido" prellenado si viene por enlace; la atribución queda vinculada de forma permanente al prospecto y se arrastra a la compra de fracción (HU-06); un mismo prospecto solo puede tener un Embajador atribuido (el primero que lo refirió); un Embajador no puede auto-referirse.
- SP: 8 · Prioridad: Must

**HU-52** 🆕 — Como Superadmin, quiero definir el monto de comisión que se paga por cada referido efectivo, para controlar el costo de adquisición del programa.
- Criterios: pantalla de configuración con el monto de comisión (valor fijo en COP o porcentaje sobre el valor de la fracción); posibilidad de vigencias (el monto vigente al momento de la atribución es el que se aplica a ese referido, aunque después cambie); histórico de cambios con fecha y usuario que lo modificó; el monto vigente se muestra en la página pública del programa (HU-48).
- SP: 5 · Prioridad: Must

**HU-53** 🆕 — Como Embajador, quiero listar mis referidos y ver el estado de cada uno (en proceso o pago completado), para hacer seguimiento de mis ganancias.
- Criterios: listado de referidos con nombre, fecha de referencia, propiedad/fracción de interés y estado; estados posibles: **Registrado**, **En proceso de pago** (compró la fracción pero aún no completa el pago) y **Pago completado**; cada referido muestra la comisión asociada y si ya fue liberada; filtros por estado y periodo; totalizadores de referidos por estado.
- SP: 5 · Prioridad: Must

**HU-54** 🆕 — Como Embajador, quiero que se libere automáticamente mi saldo a favor cuando mi referido completa la totalidad del pago de su fracción, para recibir mi comisión sin tener que reclamarla.
- Criterios: al marcarse como **Pago completado** la compra de una fracción de un referido atribuido, el sistema acredita automáticamente el monto de comisión vigente al momento de la atribución como **saldo a favor disponible** del Embajador; antes de ese evento la comisión permanece como **saldo pendiente** (no retirable); la operación queda registrada como un movimiento auditable con fecha, referido, propiedad y monto; se genera un egreso en el módulo financiero (HU-25).
- SP: 8 · Prioridad: Must

**HU-55** 🆕 — Como Embajador, quiero ver mi billetera con el saldo pendiente, el saldo disponible y el histórico de movimientos, para saber cuánto he ganado y cuánto puedo retirar.
- Criterios: dashboard del Embajador con tres cifras claras (saldo pendiente, saldo disponible para retiro, total ganado histórico); listado de movimientos (comisión acreditada, retiro solicitado, retiro pagado) con fecha y monto; acceso desde el menú principal para cualquier cuenta con rol Embajador.
- SP: 5 · Prioridad: Must

**HU-56** 🆕 — Como Embajador, quiero solicitar el retiro de mi saldo disponible y que el Superadmin lo apruebe y registre el pago, para cobrar efectivamente mis ganancias.
- Criterios: botón de solicitud de retiro que valida que el saldo disponible sea mayor a un mínimo configurable; la solicitud entra en estado **Solicitada**; el Superadmin ve la bandeja de solicitudes, puede aprobarla o rechazarla con motivo, y al registrar el pago adjunta el comprobante y la solicitud pasa a **Pagada**; el saldo disponible se descuenta al aprobarse; el movimiento queda registrado en la billetera (HU-55) y como egreso en el módulo financiero (HU-25).
- SP: 8 · Prioridad: Should

**HU-57** 🆕 — Como Embajador, quiero recibir notificaciones cuando un referido cambia de estado o cuando se libera un saldo a mi favor, para estar al tanto de mis ganancias sin tener que revisar la plataforma.
- Criterios: notificación in-app + email cuando un referido pasa a **En proceso de pago**, cuando pasa a **Pago completado** (con el monto liberado), y cuando una solicitud de retiro es aprobada o pagada; las notificaciones aplican únicamente a los referidos propios del Embajador.
- SP: 3 · Prioridad: Should

---

## 5. Visual Story Map (estructura)

Backbone de 7 columnas (actividades) × 4 filas (sprints). Las 52 historias quedan repartidas por completo entre los 4 sprints — no queda ninguna en backlog.

| Sprint | Descubrir (E1) | Referir y ganar (E11) | Onboarding y Roles (E2) | Gestionar Propiedades (E3) | Agendar y usar (E4/E5/E6) | Administrar finanzas (E7/E8) | Comunicar novedades (E9/E10) |
|---|---|---|---|---|---|---|---|
| **Sprint 1 — Fundación** | HU-00, HU-01, HU-02, HU-03, HU-41, HU-42, HU-43, HU-44, HU-46, HU-47, HU-48 | — | HU-04, HU-05, HU-06, HU-07 | HU-08, HU-09, HU-10, HU-11 | — | — | — |
| **Sprint 2 — Calendario, operación y alta de Embajadores** | — | HU-49, HU-50, HU-51 | — | — | HU-12, HU-13, HU-14, HU-15, HU-16, HU-17, HU-21, HU-22, HU-39 | — | — |
| **Sprint 3 — Dashboards, finanzas y motor de comisiones** | — | HU-52, HU-53, HU-54 | — | — | HU-18, HU-19, HU-20 | HU-23, HU-24, HU-25, HU-40 | — |
| **Sprint 4 — Inventario, comunicación, billetera y cierre** | — | HU-55, HU-56, HU-57 | HU-32 | — | — | HU-26, HU-27, HU-28 | HU-29, HU-30, HU-31, HU-33 |

> El orden respeta las dependencias reales del producto: primero el sitio institucional (incluida la página del Programa de Embajadores), los roles y la estructura de propiedades (Sprint 1); luego el motor de calendario, la operación del administrador, las reservas a terceros y el alta de Embajadores con su código y atribución (Sprint 2); después los dashboards con datos reales, las finanzas y el motor de comisiones que libera el saldo al completarse el pago (Sprint 3); y por último inventario, mantenimiento, comunicación, panel Superadmin y la billetera/retiro del Embajador (Sprint 4).

---

## 6. Planificación en 4 sprints

Supuestos: sprint de 2 semanas. La velocidad de referencia varía por sprint dado el volumen de contenido institucional concentrado en Sprint 1; se recomienda calibrar con el equipo real tras el primer sprint.

### Sprint 1 — Fundación: sitio institucional, roles y propiedades
**Objetivo:** dejar operativo el sitio público completo (home + páginas institucionales + programa de embajadores + catálogo + ficha de propiedad + contacto/lista de espera), el sistema de roles y la estructura de propiedades/fracciones.

| HU | Historia | SP |
|---|---|---|
| HU-00 | Home Arena Property | 8 |
| HU-01 | Catálogo público de propiedades | 5 |
| HU-02 ✏️ | Detalle de propiedad | 5 |
| HU-03 ✏️ | Contacto desde ficha de propiedad | 3 |
| HU-04 ✏️ | Registro de Visitante → Usuario | 3 |
| HU-05 | Superadmin crea Administradores | 5 |
| HU-06 ✏️ | Admin invita Propietarios | 5 |
| HU-07 | Gestión de roles y permisos | 8 |
| HU-08 ✏️ | Crear propiedad (ficha técnica ampliada + estados) | 13 |
| HU-09 | Dividir propiedad en 8 fracciones | 5 |
| HU-10 | Vista global de propiedades (Superadmin) | 3 |
| HU-11 ✏️ | Editar/inactivar propiedad (sin eliminación) | 3 |
| HU-41 | Página Modelo de negocio | 3 |
| HU-42 | Página Beneficios sistema fraccionado | 5 |
| HU-43 | Página Sistema de Agendamiento | 3 |
| HU-44 | Página Sobre Nosotros | 5 |
| HU-46 | Contáctenos (formulario general) | 3 |
| HU-47 | Lista de espera | 3 |
| HU-48 🆕 | Página pública Programa de Embajadores | 3 |
| **Total** | | **91** |

### Sprint 2 — Calendario, operación y alta de Embajadores
**Objetivo:** habilitar el motor de calendario por temporada, la reserva de semanas, el dashboard del Administrador, la reserva a terceros, y dejar operativa la inscripción de Embajadores con su código de referido y la atribución de prospectos.

| HU | Historia | SP |
|---|---|---|
| HU-12 | Configuración de calendario por temporada | 13 |
| HU-13 | Propietario visualiza calendario | 5 |
| HU-14 ✏️ | Propietario reserva semana (regla de temporada alta consecutiva) | 8 |
| HU-15 | Admin bloquea/marca días en calendario | 5 |
| HU-16 ✏️ | Notificación de reserva confirmada (acotada a mi fracción) | 3 |
| HU-17 | Permisos completos de Admin sobre calendario | 5 |
| HU-21 | Dashboard del Administrador | 8 |
| HU-22 | Buscador de propiedades del Admin | 2 |
| HU-39 | Reservar semana a terceros | 8 |
| HU-49 🆕 | Inscripción como Embajador | 5 |
| HU-50 🆕 | Código de referido único y enlace compartible | 5 |
| HU-51 🆕 | Atribución del referido en registro y compra | 8 |
| **Total** | | **75** |

### Sprint 3 — Dashboards, finanzas y motor de comisiones
**Objetivo:** entregar el dashboard del Propietario con datos reales, el módulo financiero enriquecido con maestra de categorías/ingresos, y el motor de comisiones del Programa de Referidos: monto definido por el Superadmin, seguimiento de referidos y liberación automática del saldo a favor.

| HU | Historia | SP |
|---|---|---|
| HU-18 ✏️ | Dashboard del Propietario (+ ingresos por reserva a terceros) | 8 |
| HU-19 | Utilidades y gastos prorrateados (Propietario) | 8 |
| HU-20 | Historial de reservas del Propietario | 3 |
| HU-23 ✏️ | Gastos comunes con prorrateo (+ maestra de categorías/cuentas) | 13 |
| HU-24 ✏️ | Detalle de prorrateo (gasto e ingreso) | 5 |
| HU-25 ✏️ | Reportes financieros globales (ingresos y egresos, exportable) | 8 |
| HU-40 | Ingreso de reserva a terceros | 5 |
| HU-52 🆕 | Superadmin define el monto de comisión por referido | 5 |
| HU-53 🆕 | Listado de referidos con estado (en proceso / pago completado) | 5 |
| HU-54 🆕 | Liberación automática del saldo a favor al completarse el pago | 8 |
| **Total** | | **68** |

### Sprint 4 — Inventario, comunicación, billetera y cierre
**Objetivo:** completar inventario/mantenimiento, comunicación de novedades, panel Superadmin (incluyendo las métricas globales reubicadas) y cerrar el Programa de Referidos con la billetera del Embajador, el flujo de retiro y sus notificaciones.

| HU | Historia | SP |
|---|---|---|
| HU-26 | Gestión de inventario por propiedad | 8 |
| HU-27 | Gastos de mantenimiento | 5 |
| HU-28 | Inventario en modo solo lectura (Propietario) | 3 |
| HU-29 | Publicar novedad → notifica a propietarios | 5 |
| HU-30 | Propietario ve historial de novedades | 3 |
| HU-31 | Comunicados globales del Superadmin | 5 |
| HU-32 ✏️ | Dashboard global de métricas (Superadmin) | 8 |
| HU-33 | Suspender/reactivar cuentas | 3 |
| HU-55 🆕 | Billetera del Embajador (saldo pendiente/disponible/histórico) | 5 |
| HU-56 🆕 | Solicitud y aprobación de retiro de comisiones | 8 |
| HU-57 🆕 | Notificaciones al Embajador | 3 |
| **Total** | | **56** |

> Las 52 historias quedan repartidas en su totalidad entre los 4 sprints — no hay backlog post-MVP. **Sprint 1 (91 SP) y Sprint 2 (75 SP) concentran más carga que los demás**; Sprint 1 por el volumen del sitio institucional y Sprint 2 por sumar el alta del Programa de Referidos al motor de calendario. Se recomienda evaluar trabajar el contenido institucional en paralelo con la estructura de datos, o extender la línea de tiempo si el equipo no puede absorber ese volumen en 2 semanas.

---

## 7. Resumen de estimación y valor

| Sprint | Foco | Story Points | Valor de negocio entregado |
|---|---|---|---|
| 1 | Sitio institucional + descubrimiento + roles + estructura de propiedades | 91 | Presencia pública completa de Arena Property (home, páginas institucionales, programa de embajadores, catálogo, ficha de propiedad) + plataforma operable a nivel de datos: roles definidos y propiedades cargadas con sus 8 fracciones |
| 2 | Calendario + operación del Administrador + reservas a terceros + alta de Embajadores | 75 | Producto usable de punta a punta: un Propietario puede ver y reservar su semana, el Administrador opera su portafolio y renta semanas libres a terceros, y el canal de referidos empieza a captar prospectos atribuidos |
| 3 | Dashboards con datos reales + finanzas enriquecidas + **motor de comisiones** | 68 | Valor diferencial del negocio: transparencia financiera (incluyendo renta a terceros) para el Propietario y un canal de adquisición que se paga solo — la comisión se libera únicamente cuando el referido completa su pago |
| 4 | Inventario, mantenimiento, comunicación, panel Superadmin y billetera del Embajador | 56 | Cierre de experiencia: trazabilidad de activos, comunicación acotada a la fracción, visibilidad global de negocio para el Superadmin, y el Embajador puede finalmente cobrar sus ganancias |
| **Total MVP** | | **290 SP** | MVP completo alineado al modelo Arena Property — las 52 historias de usuario, sin backlog pendiente |

**Notas para la estimación final del equipo:**
- Los puntos son un punto de partida (Fibonacci: 2, 3, 5, 8, 13) para calibrar con la velocidad real del equipo tras el primer sprint.
- HU-12 (motor de calendario por temporada) y HU-08 (ficha de propiedad con doble máquina de estados) son las historias de mayor riesgo técnico del MVP — se recomienda un spike técnico para ambas antes de comprometerlas.
- HU-23/HU-27 (finanzas y mantenimiento) comparten un mismo módulo de "gastos", por lo que conviene diseñarlas juntas aunque se implementen en sprints distintos; HU-23 también requiere la maestra de categorías/cuentas que usarán HU-24, HU-25, HU-40 y las comisiones del programa de referidos.
- El **Programa de Referidos (E11)** tiene una dependencia dura con el módulo financiero: HU-54 (liberación de saldo) se dispara con el evento "pago completado" de una fracción, por lo que ese estado debe existir y ser confiable antes de Sprint 3. Se recomienda definir en Sprint 2, junto con HU-51, el modelo de datos de atribución y el ciclo de vida completo del referido.
- **HU-51 (atribución) es la historia de mayor riesgo del módulo de referidos**: define reglas de negocio sensibles (un solo Embajador por prospecto, no auto-referencia, persistencia de la atribución hasta la compra) que, si se implementan mal, generan disputas de comisiones difíciles de corregir después.
- Sprint 1 y Sprint 2 quedaron considerablemente más grandes que el resto; son las primeras candidatas a replanificación si el equipo confirma una velocidad menor a lo estimado.

---

## 8. Valor del desarrollo (COP)

| Sprint | Foco | Valor |
|---|---|---|
| Sprint 1 | Sitio institucional + descubrimiento + roles + estructura de propiedades | $1.000.000 COP |
| Sprint 2 | Calendario + operación del Administrador + reservas a terceros + alta de Embajadores | $1.000.000 COP |
| Sprint 3 | Dashboards + finanzas enriquecidas + motor de comisiones | $1.000.000 COP |
| Sprint 4 | Inventario, comunicación, panel Superadmin y billetera del Embajador | $1.000.000 COP |
| **Total MVP (4 sprints)** | | **$4.000.000 COP** |

> Valor de referencia por sprint, no ajustado por story points. Las 52 historias del MVP quedan cubiertas en su totalidad dentro de este valor — no hay historias en backlog pendientes de cotizar por separado. Dado que Sprint 1 (91 SP) y Sprint 2 (75 SP) concentran bastante más esfuerzo que Sprint 3 (68 SP) y Sprint 4 (56 SP), se recomienda revisar si el valor por sprint debería ajustarse de forma proporcional al esfuerzo en una futura iteración de este documento.
