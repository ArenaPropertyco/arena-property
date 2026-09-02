# HU-61 — Ingreso y registro con Google

Épica E2 · Sprint 1 · SP 5 · Prioridad **Must** · Rol: Visitante
Aplican los requisitos transversales RT-01…RT-12 de [specs.md](./specs.md). Implementa [D-32](../../docs/decisions.md), [D-33](../../docs/decisions.md), [D-34](../../docs/decisions.md) y [D-35](../../docs/decisions.md).
🆕 Historia nueva: el VSM solo previó el alta por correo y contraseña (HU-04). La entrada con Google se decidió después de la primera revisión visual y no estaba en el alcance original.

## Historia
Como Visitante, quiero entrar y crear mi cuenta con mi cuenta de Google, para no tener que inventar y recordar otra contraseña.

## Requisitos funcionales
- **RF-61.1** — Ingreso y registro con Google mediante `signInWithOAuth` de `@nuxtjs/supabase`, **sin dependencia nueva** (RT-01). El botón acompaña al formulario en `/ingresar` y `/registro`; nunca lo sustituye.
- **RF-61.2** — El alta por Google produce exactamente el mismo perfil que el alta por correo: rol `Usuario` y ningún otro (RF-04.3), estado `active` e idioma según la sesión. No hay excepción para el proveedor.
- **RF-61.3** — **(D-34)** Google entrega el correo verificado, así que la cuenta accede a rutas privadas sin paso adicional. `profiles.email_verified` lo escribe el disparador desde `auth.users.email_confirmed_at`, igual que en cualquier alta: la vía de entrada no altera la regla de RF-04.2.
- **RF-61.4** — **(D-33)** Si ya existe una cuenta con ese correo, la identidad de Google se **vincula** a ella y no nace un segundo perfil ni un segundo juego de roles. La vinculación solo procede si el proveedor entrega el correo verificado, y queda auditada (TR-01).
- **RF-61.5** — **(D-32)** Antes de redirigir al proveedor, el código de referido vigente se persiste en cookie `SameSite=Lax`; al volver se aplica al perfil. Entrar por Google no le cuesta la atribución a ningún Embajador.
- **RF-61.6** — La atribución la escribe una función `SECURITY DEFINER` del esquema `private`, **una sola vez y solo si el perfil no tenía `referred_by_code`**. Ninguna política de RLS permite que una cuenta escriba su propia atribución: nadie se auto-refiere (D-03).
- **RF-61.7** — **(D-35)** El perfil guarda `full_name` y `avatar_url` de la identidad de Google en el alta, y los refresca en cada ingreso por el proveedor.
- **RF-61.8** — `full_name` y `avatar_url` son **datos de presentación**. Proceden de `raw_user_meta_data`, que el propio usuario puede editar: no se usan jamás para autorizar, ni se presentan a un Administrador como identidad acreditada.
- **RF-61.9** — Los errores del proveedor (permiso denegado, ventana cerrada, correo no entregado) se muestran traducidos y sin detalle técnico (RF-04.5), y devuelven al Visitante a `/ingresar`.
- **RF-61.10** — El secreto del cliente OAuth vive solo en configuración de servidor: ninguna credencial del proveedor lleva el prefijo `NUXT_PUBLIC_` ni entra en las claves omitidas del escaneo de secretos del despliegue.

## Criterios de aceptación (base de las pruebas unitarias)
- **CA-61.1** — Dado un Visitante sin cuenta que entra con Google, entonces se crea su perfil con rol `Usuario` y ninguno más, estado `active` y `email_verified` en verdadero.
- **CA-61.2** — Dado un correo que ya tiene cuenta con contraseña, cuando entra con Google, entonces la identidad se vincula a la cuenta existente y no nace un segundo perfil.
- **CA-61.3** — Dado un Visitante que llega con código de referido y entra con Google, entonces su perfil queda con ese código, igual que si se hubiera registrado por el formulario.
- **CA-61.4** — Dado un perfil que ya tiene atribución, cuando se intenta aplicar otro código, entonces la atribución no cambia.
- **CA-61.5** — Dada una cuenta autenticada que intenta escribir su propio `referred_by_code`, entonces la base lo rechaza.
- **CA-61.6** — Dado un alta por Google con nombre y avatar, entonces el perfil los guarda; dado un ingreso posterior con el nombre cambiado en Google, entonces el perfil refleja el nuevo.
- **CA-61.7** — Dado un Visitante que cancela el permiso en Google, entonces vuelve a `/ingresar` con un mensaje traducido y sin detalle técnico.

## Dependencias
- HU-04 (alta, verificación y guarda de rutas privadas) · HU-07 (roles) · HU-51 (reglas de atribución, D-03) · TR-01 (auditoría de la vinculación).
