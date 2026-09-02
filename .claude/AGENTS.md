# AGENTS.md — Arena Property

## Proyecto
Arena Property es una web app que administra propiedades vacacionales bajo un modelo de copropiedad fraccionada: cada propiedad se divide en 8 fracciones, cada fracción da derecho a semanas de uso distribuidas por temporada (alta, media-alta, media, baja), y toda la operación (agendamiento, gastos comunes, mantenimiento, comunicación) vive dentro de la plataforma.

El producto gira en torno a un objeto central: **la Propiedad**. Todo rol, todo módulo y todo flujo se conecta a una o varias propiedades. Además del flujo transaccional, la plataforma incluye un **sitio institucional** (home, modelo de negocio, beneficios, sistema de agendamiento, sobre nosotros, contacto) que funciona como el embudo de descubrimiento antes del registro, y una capacidad de **renta a terceros**: el Administrador puede rentar las semanas no usadas de una propiedad a un tercero no propietario, generando y registrando un ingreso adicional para el inmueble.

A esto se suma un **canal de crecimiento propio: el Programa de Referidos**. Cualquier persona registrada puede inscribirse como **Embajador**, recibir un código de referido único y dedicarse a buscar clientes para Arena Property. Cuando un referido suyo compra una fracción y **completa la totalidad del pago**, se le libera automáticamente al Embajador un **saldo a favor** por el monto de comisión que el Superadmin haya definido. El Embajador puede hacer seguimiento del estado de cada referido (en proceso / pago completado), ver su saldo acumulado y solicitar el retiro de sus ganancias — convirtiendo la referenciación en una fuente de ingreso pasivo.

## Documentos de referencia
- `docs/constitution.md` — principios innegociables.
- `docs/stack.md` — única lista de dependencias permitidas.
- `specs/001-Arena-Property/` — spec maestra, requisitos transversales (RT) y una spec por historia (`HUXX-spec.md`) y por requisito transversal (`TRXX-*-spec.md`).
- `docs/arena-property-VSM-Historias-Usuario-Specs.md` — documento de negocio de origen.

## Comandos
- `pnpm test` — pruebas unitarias con Vitest + `@nuxt/test-utils`.
- `pnpm lint` — ESLint.
- `supabase migration new <nombre>` — nueva migración de base de datos.

## Estilo
- Nuxt 4 y TypeScript `strict`; todo el código en TypeScript.
- Supabase para datos, autenticación y almacenamiento; despliegue en Netlify.
- Solo las dependencias registradas en `docs/stack.md`; ninguna otra se instala sin aprobación previa.
- Todo comentario y toda documentación en español, con buena ortografía.
- Diseño luxury minimalista, muy atractivo y moderno: la UI no es negociable.
- Diseño responsive y bitema siempre.
- Animaciones: `nuxt-aos` para entradas del sitio institucional, `@formkit/auto-animate` para listas, `motion-v` para movimiento de alto impacto y `@tresjs/nuxt` para el plano elevado 3D. **No se usa `framer-motion`: es una librería de React y no aplica a este proyecto.**
- Colores de la marca (manual de marca v1.0):
  - Oro Arena: `#CB9E4E`
  - Oro claro: `#E0BD76`
  - Café Arena: `#593824`
  - Carbón: `#0D0D0B`
  - Tinta: `#1C1C1A`
  - Tinta media: `#4A4A45`
  - Arena: `#F7F2E4`
  - Verde (solo confirmado/positivo): `#2D6A4F`
  - Rojo (solo alerta o dato sin confirmar): `#C0392B`
- Tipografías:
  - Titulares: Cormorant Garamond
  - Cuerpo: DM Sans
  - Cifras: IBM Plex Mono

## Reglas
- Lee `docs/constitution.md` y la spec activa en `specs/001-Arena-Property/` antes de tocar código.
- No modifiques archivos dentro de `specs/` salvo petición explícita.
- El dinero es entero en COP y se prorratea según `TR02-dinero-formatos-spec.md`; nunca en punto flotante.
- Toda operación auditable se registra según `TR01-auditoria-spec.md`.
- Usa todos los recursos de Nuxt 4 y sus módulos oficiales, y las mejores prácticas de Nuxt 4, TypeScript, Supabase y Netlify.

## Al terminar cualquier tarea
- Ejecuta `pnpm test` (si la tarea toca lógica) y `pnpm lint`, y confirma en tu respuesta que ambos pasan.
