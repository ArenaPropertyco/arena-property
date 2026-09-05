# Arena Property — Stack aprobado

Registro único de dependencias permitidas (principio 1 de [constitution.md](./constitution.md)).
Nada se instala sin estar aquí, con su justificación y la historia que lo exige.

## Plataforma

Nuxt 4 · TypeScript `strict` · Supabase (Postgres, Auth, Storage, RLS) · despliegue en Netlify.

## Módulos base

| Módulo | Uso obligatorio en |
|---|---|
| `@nuxt/eslint` | Todo el repositorio |
| `@nuxt/icon` | Iconografía de toda la UI |
| `@nuxt/fonts` | Cormorant Garamond · DM Sans · IBM Plex Mono |
| `@nuxt/ui` | Todos los componentes y los tokens de marca |
| `@nuxt/image` | Galerías y fotos de propiedad (HU-01, HU-02, HU-08) |
| `@nuxtjs/i18n` | Todo texto visible (RT-05) |
| `@formkit/auto-animate` | Transiciones de listas y tablas (HU-18, HU-21, HU-53, HU-55) |
| `@nuxtjs/supabase` | Auth, datos y Storage |
| `@nuxtjs/seo` | Sitio institucional y fichas públicas (E1) |
| `nuxt-gtag` | Analítica del embudo público (HU-00, HU-41…HU-48) |
| `@tresjs/nuxt` | Plano elevado 3D de la ficha de propiedad (HU-02) |
| `@nuxt/test-utils` | Suite de pruebas (RT-03) |
| `nuxt-aos` | Animación de entrada de las secciones institucionales (E1) |

## Complementos aprobados

| Dependencia | Justificación | Exigida por |
|---|---|---|
| `@unovis/vue` + `@unovis/ts` | `@nuxt/ui` no incluye componente de gráfico; Unovis se estiliza con variables CSS, así que respeta los tokens de marca sin paleta propia | HU-32 RF-32.2 |
| `motion-v` | Animaciones de alto impacto en Vue. Sustituye la mención histórica a `framer-motion`, que es una librería de React y **no** es utilizable en este proyecto | E1 (uso puntual) |
| `three` | Motor sobre el que corre `@tresjs/nuxt`. Se declara como dependencia directa para poder importar sus cargadores (`GLTFLoader`) y abrir el plano elevado como modelo `.glb`; sin esta entrada pnpm no lo resuelve desde el proyecto. Versión fijada para que TresJS y la app compartan una sola copia | HU-02 RF-02.5 |

## Necesidades resueltas sin dependencia nueva

| Necesidad | Solución aprobada | Exigida por |
|---|---|---|
| Exportación CSV | Serialización en función pura de `shared/` servida por una ruta Nitro | HU-25 RF-25.2 |
| Correo transaccional | API REST del proveedor (**Resend** por defecto) invocada con `$fetch` desde Nitro, credenciales en runtime config; sin SDK | HU-03, HU-04, HU-06, HU-29, HU-46, HU-47, HU-54, HU-57 |
| Correo de verificación de cuenta | SMTP configurado en Supabase Auth | HU-04 RF-04.2 |
| Ingreso con Google | `signInWithOAuth` de `@nuxtjs/supabase`; el proveedor se configura en Supabase Auth y su secreto vive solo en runtime config de servidor. **Sin paquete nuevo** | HU-61 RF-61.1 |
| Fechas y formatos | `Intl` nativo + funciones puras (TR-02) | Transversal |

## Diferido — requiere decisión antes de aprobar

| Necesidad | Estado |
|---|---|
| Pasarela de pagos | **No aprobada.** En el MVP el estado de pago de una fracción se registra manualmente (HU-06 RF-06.3). Integrar una pasarela exige una historia nueva y una entrada en esta tabla. |

## Dependencias de desarrollo permitidas

`vitest`, `@vue/test-utils`, `happy-dom` (vía `@nuxt/test-utils`), `typescript`, `eslint` (vía `@nuxt/eslint`), `@types/three` (tipos del motor 3D, solo en compilación) y la CLI `supabase`.
