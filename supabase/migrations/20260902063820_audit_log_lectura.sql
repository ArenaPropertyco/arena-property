-- TR-01 · RF-A.6 — quién lee el registro de auditoría.
--
-- El Superadmin ve todo; el Administrador solo lo de sus propiedades asignadas;
-- ningún otro rol accede. La decisión se toma en una función y la política la
-- invoca, para que la regla viva en un solo sitio y se pueda probar directamente.
--
-- Dependencia declarada: la fuente de verdad de los roles es `user_roles` y la de
-- las asignaciones es `property_admins` (RF-07.2 y RF-05.2), tablas que llegan con
-- HU-07 y HU-05. Mientras no existan, `roles_efectivos()` y
-- `propiedades_administradas()` devuelven vacío, de modo que este archivo ya deja
-- cerrada la mitad verificable hoy: **nadie lee el registro**. Cuando esas tablas
-- existan se reemplaza el cuerpo de esas dos funciones y las políticas siguen igual.

-- ── Roles efectivos de quien consulta ───────────────────────────────────────
create or replace function public.roles_efectivos()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  -- HU-07 reemplaza este cuerpo por la consulta a public.user_roles.
  select array[]::text[];
$$;

comment on function public.roles_efectivos() is
  'HU-07 · roles de la cuenta que consulta. Cuerpo provisional hasta la migración de user_roles.';

-- ── Propiedades que administra quien consulta ───────────────────────────────
create or replace function public.propiedades_administradas()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  -- HU-05 reemplaza este cuerpo por la consulta a public.property_admins.
  select array[]::uuid[];
$$;

comment on function public.propiedades_administradas() is
  'HU-05 · propiedades asignadas a la cuenta que consulta. Cuerpo provisional hasta property_admins.';

-- ── La regla de lectura de RF-A.6, en un solo lugar ─────────────────────────
create or replace function public.puede_leer_auditoria_de(
  propiedad uuid,
  rol text
)
returns boolean
language sql
stable
as $$
  select case
    -- El Superadmin ve el registro completo, con o sin propiedad asociada.
    when rol = 'superadmin' then true
    -- El Administrador solo lo de sus propiedades. Una entrada sin propiedad no
    -- pertenece a su ámbito, así que tampoco la ve.
    when rol = 'administrador' then
      propiedad is not null and propiedad = any (public.propiedades_administradas())
    -- Ningún otro rol accede.
    else false
  end;
$$;

comment on function public.puede_leer_auditoria_de(uuid, text) is
  'TR-01 · RF-A.6 · decide si un rol puede leer una entrada de auditoría.';

-- ── Política de lectura ─────────────────────────────────────────────────────
create policy audit_log_lectura_por_rol
  on public.audit_log
  for select
  to authenticated
  using (
    -- Los roles se resuelven una vez por consulta, no una vez por fila.
    exists (
      select 1
      from unnest((select public.roles_efectivos())) as rol
      where public.puede_leer_auditoria_de(audit_log.property_id, rol)
    )
  );
