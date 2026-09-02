# Arena Property — Constitución

Principios innegociables. Toda spec, plan y tarea debe cumplirlos; lo que viole uno no se aprueba ni se mergea.

1. **Stack cerrado.** El stack y las dependencias permitidas son exactamente las registradas en [docs/stack.md](./stack.md): Nuxt 4 + TypeScript `strict`, Supabase, Netlify, los módulos base y los complementos aprobados con su justificación y la historia que los exige. Toda dependencia nueva requiere aprobación explícita anotada en ese archivo antes de instalarse. *Verificable:* `package.json` no contiene nada fuera de `docs/stack.md`.

2. **Sin spec no hay código.** Cada tarea nace de una spec en `specs/001-Arena-Property/`. Las reglas del negocio —8 fracciones por propiedad, semanas por temporada (alta, media-alta, media, baja), gastos comunes, mantenimiento, comisiones— viven escritas ahí, nunca solo en el código. Si spec y código divergen, el mismo PR corrige uno de los dos. *Verificable:* cada PR referencia su spec.

3. **Dominio antes que interfaz.** Las reglas de negocio viven en `app/composables/`, `shared/` y SQL; los componentes solo presentan datos y emiten eventos. Ningún `.vue` consulta Supabase directamente ni calcula elegibilidad, cupos o prorrateos. *Verificable:* `grep` de clientes Supabase y de aritmética de negocio en `app/components/` da cero.

4. **Todo criterio de aceptación se prueba.** Las reglas de dominio se prueban con Vitest + `@nuxt/test-utils`, y las pantallas de contenido con test de contrato sobre su manifiesto tipado de secciones, rutas e i18n. La apariencia no se prueba; ninguna spec queda sin test. Todo bug se reproduce con un test que falla antes de arreglarse. *Verificable:* `pnpm test` pasa y cada spec tiene al menos un test que la referencia.

5. **Supabase es la única fuente de verdad.** Todo cambio de esquema es una migración versionada en `supabase/migrations/`; cada tabla nace con RLS habilitada y sus políticas explícitas; los tipos se generan, no se escriben a mano. Ningún dato de negocio persiste en `localStorage`, constantes ni estado global. *Verificable:* no hay cambios de esquema fuera de migraciones y ninguna tabla sin RLS.

6. **Un idioma para el código, dos para las personas.** Código, tipos, tablas, ramas y commits en inglés; comentarios y documentación en español correcto. Todo texto visible pasa por i18n con archivos separados `i18n/locales/en.json` y `es.json`, siempre en paridad de claves. *Verificable:* cero strings visibles hardcodeados y ambos locales con las mismas claves.

7. **Responsive y bitema, siempre.** Toda vista y componente funciona de 320px a desktop y se ve correcto en tema claro y oscuro desde el primer commit; no existe "después lo adapto". *Verificable:* revisión en 320/768/1280px y en ambos temas antes de aprobar.

8. **La marca no se improvisa.** Colores y tipografías salen de los tokens de `@nuxt/ui` derivados del manual de marca: Oro Arena `#CB9E4E`, Oro claro `#E0BD76`, Café Arena `#593824`, Carbón `#0D0D0B`, Tinta `#1C1C1A`, Tinta media `#4A4A45`, Arena `#F7F2E4`, Verde `#2D6A4F` solo para confirmado/positivo y Rojo `#C0392B` solo para alerta o dato sin confirmar. Cormorant Garamond en titulares, DM Sans en cuerpo, IBM Plex Mono en cifras. *Verificable:* no hay colores, fuentes ni espaciados sueltos fuera de los tokens.

9. **Honestidad en los datos.** La plataforma administra dinero y derechos de uso ajenos: ninguna cifra estimada se muestra como confirmada; el dinero se maneja como entero en COP y se prorratea con reparto determinista de residuos según [TR-02](../specs/001-Arena-Property/TR02-dinero-formatos-spec.md); y todo movimiento de dinero, agenda, rol o estado de cuenta deja registro en el log de auditoría de [TR-01](../specs/001-Arena-Property/TR01-auditoria-spec.md). *Verificable:* ningún importe en punto flotante, suma de cuotas exacta, y cada operación auditable con su registro.

Cambiar esta constitución es una decisión explícita del dueño del proyecto, en un PR propio que actualiza este archivo antes que cualquier código.
