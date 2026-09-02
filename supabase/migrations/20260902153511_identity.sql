-- HU-04 · RF-04.3 y HU-07 · RF-07.1, RF-07.2, RF-07.4 — identidad, perfiles y roles.
--
-- Tres decisiones que conviene leer antes que el código:
--
-- 1. Los roles viven en `user_roles`, nunca en los metadatos del JWT. En Supabase
--    `raw_user_meta_data` lo edita el propio usuario, así que no sirve para autorizar.
--    Una cuenta puede tener varios roles (RF-07.1): una fila por rol.
--
-- 2. Las funciones que resuelven "quién soy y qué roles tengo" son `SECURITY DEFINER`
--    (deben saltar la RLS de `user_roles` para evaluarla en otras políticas). Por eso
--    viven en el esquema `private`, que PostgREST no expone: en `public` cualquier
--    cliente podría invocarlas por RPC. Esto reemplaza y retira las provisionales que
--    TR-01 dejó en `public`, y de paso fija `search_path` en la regla de lectura de
--    auditoría, que había quedado sin él.
--
-- 3. El registro crea perfil y rol `user` por disparador sobre `auth.users` (RF-04.3):
--    la aplicación no puede olvidarse de hacerlo ni hacerlo a medias.

-- ── Esquema privado: funciones con privilegio, fuera de la API ──────────────
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ── Tipos ───────────────────────────────────────────────────────────────────
create type public.app_role as enum ('superadmin', 'property_admin', 'owner', 'ambassador', 'user');
create type public.account_status as enum ('active', 'suspended');
-- D-07 · la suspensión se tipifica: administrativa o por incumplimiento/fraude.
create type public.suspension_kind as enum ('administrative', 'breach_or_fraud');

-- ── Perfil: extiende auth.users con lo que la aplicación necesita leer ──────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copia del correo: auth.users no es legible desde la API y los listados lo muestran.
  email text,
  full_name text,
  phone text,
  locale text not null default 'es' check (locale in ('es', 'en')),

  -- HU-33 · estado de cuenta con motivo y tipo obligatorios al suspender.
  status public.account_status not null default 'active',
  suspension_kind public.suspension_kind,
  suspension_reason text,
  suspended_at timestamptz,

  -- RF-04.4 · código de referido tal como llegó en el registro. HU-51 lo convierte
  -- en atribución cuando existan los códigos; hasta entonces solo se conserva.
  referred_by_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_suspension_coherente check (
    (status = 'active'
      and suspension_kind is null and suspension_reason is null and suspended_at is null)
    or
    (status = 'suspended'
      and suspension_kind is not null and length(btrim(coalesce(suspension_reason, ''))) > 0)
  )
);

comment on table public.profiles is
  'HU-04/HU-33 · perfil de cada cuenta: datos de contacto, idioma y estado de cuenta.';

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on table public.profiles from anon, authenticated, service_role;
grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.profiles to service_role;

-- ── Roles acumulables ───────────────────────────────────────────────────────
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  -- Quién lo otorgó; nulo cuando lo otorga el sistema (el rol `user` del registro).
  granted_by uuid,
  granted_at timestamptz not null default now(),
  constraint user_roles_unico_por_cuenta unique (user_id, role)
);

comment on table public.user_roles is
  'HU-07 · roles de cada cuenta, una fila por rol. Solo el Superadmin otorga y retira.';

create index user_roles_user_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;
alter table public.user_roles force row level security;

revoke all on table public.user_roles from anon, authenticated, service_role;
grant select, insert, delete on table public.user_roles to authenticated, service_role;

-- ── Quién consulta y qué roles tiene ────────────────────────────────────────
create or replace function private.roles_efectivos()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(role order by role), '{}'::public.app_role[])
  from public.user_roles
  where user_id = (select auth.uid());
$$;

comment on function private.roles_efectivos() is
  'HU-07 · roles de la cuenta que consulta. SECURITY DEFINER: evalúa user_roles bajo su propia RLS.';

create or replace function private.tiene_rol(rol public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select rol = any (private.roles_efectivos());
$$;

create or replace function private.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tiene_rol('superadmin');
$$;

-- HU-05 reemplaza el cuerpo en su propia migración; hasta entonces nadie administra nada.
create or replace function private.propiedades_administradas()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select '{}'::uuid[];
$$;

-- ── Regla de lectura del registro de auditoría (RF-A.6), ahora en privado ───
create or replace function private.puede_leer_auditoria_de(propiedad uuid, rol public.app_role)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when rol = 'superadmin' then true
    when rol = 'property_admin' then
      propiedad is not null and propiedad = any (private.propiedades_administradas())
    else false
  end;
$$;

comment on function private.puede_leer_auditoria_de(uuid, public.app_role) is
  'TR-01 · RF-A.6 · decide si un rol puede leer una entrada de auditoría.';

-- Las funciones nacen ejecutables por PUBLIC; se cierra y se abre solo a la API autenticada.
revoke execute on function
  private.roles_efectivos(), private.tiene_rol(public.app_role), private.es_superadmin(),
  private.propiedades_administradas(), private.puede_leer_auditoria_de(uuid, public.app_role)
from public, anon;
grant execute on function
  private.roles_efectivos(), private.tiene_rol(public.app_role), private.es_superadmin(),
  private.propiedades_administradas(), private.puede_leer_auditoria_de(uuid, public.app_role)
to authenticated, service_role;

-- Se retiran las provisionales de TR-01 que quedaron expuestas en `public`.
drop policy audit_log_lectura_por_rol on public.audit_log;
drop function public.puede_leer_auditoria_de(uuid, text);
drop function public.propiedades_administradas();
drop function public.roles_efectivos();

create policy audit_log_lectura_por_rol
  on public.audit_log
  for select
  to authenticated
  using (
    exists (
      select 1
      from unnest((select private.roles_efectivos())) as rol
      where private.puede_leer_auditoria_de(audit_log.property_id, rol)
    )
  );

-- ── Políticas de profiles: propio, o todo para el Superadmin ────────────────
create policy profiles_lectura
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.es_superadmin());

create policy profiles_edicion
  on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.es_superadmin())
  with check (id = (select auth.uid()) or private.es_superadmin());

-- ── Políticas de user_roles: lectura propia, escritura solo Superadmin ──────
create policy user_roles_lectura
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.es_superadmin());

create policy user_roles_otorgar
  on public.user_roles for insert to authenticated
  with check (private.es_superadmin());

create policy user_roles_retirar
  on public.user_roles for delete to authenticated
  using (private.es_superadmin());

-- ── RF-07.1 · Embajador se acumula con Usuario o Propietario, con nadie más ─
create or replace function private.validar_roles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resultantes public.app_role[];
begin
  select array_agg(role) || new.role into resultantes
  from public.user_roles where user_id = new.user_id;
  resultantes := coalesce(resultantes, array[new.role]);

  if 'ambassador' = any (resultantes)
     and ('superadmin' = any (resultantes) or 'property_admin' = any (resultantes)) then
    raise exception 'El rol Embajador no se acumula con Superadmin ni con Administrador.';
  end if;

  return new;
end;
$$;

create trigger user_roles_validar
  before insert on public.user_roles
  for each row execute function private.validar_roles();

-- ── RF-33.6 · el estado de cuenta solo lo cambia el Superadmin ──────────────
-- Sin JWT (rutas de servidor, disparadores del sistema) no se interpone: ahí ya no
-- hay usuario al que proteger, y las restricciones CHECK siguen aplicando.
create or replace function private.proteger_estado_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and (select auth.uid()) is not null
     and not private.es_superadmin() then
    raise exception 'Solo el Superadmin puede suspender o reactivar una cuenta.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_proteger_estado
  before update on public.profiles
  for each row execute function private.proteger_estado_de_cuenta();

-- ── RF-04.3 · el registro crea perfil y rol Usuario ─────────────────────────
create or replace function private.crear_perfil_y_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idioma text := nullif(new.raw_user_meta_data ->> 'locale', '');
begin
  insert into public.profiles (id, email, locale, referred_by_code)
  values (
    new.id,
    new.email,
    case when idioma in ('es', 'en') then idioma else 'es' end,
    nullif(upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), '')
  );

  insert into public.user_roles (user_id, role, granted_by)
  values (new.id, 'user', null);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.crear_perfil_y_rol();

-- ── TR-01 · RF-A.3 · cambios de rol y de cuenta quedan auditados ────────────
create trigger user_roles_auditada
  after insert or update or delete on public.user_roles
  for each row execute function public.registrar_auditoria('user_role');

create trigger profiles_auditada
  after insert or update or delete on public.profiles
  for each row execute function public.registrar_auditoria('profile');

-- El rol efectivo del autor ahora sale de user_roles cuando la aplicación no lo fija.
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tipo_entidad text := tg_argv[0];
  operacion text;
  accion text;
  estado_anterior jsonb;
  estado_posterior jsonb;
  fila jsonb;
  motivo text;
  rol text;
  identificador uuid;
  propiedad uuid;
begin
  if tipo_entidad is null then
    raise exception 'registrar_auditoria() necesita el tipo de entidad como argumento del disparador.';
  end if;

  if tg_op = 'INSERT' then
    operacion := 'creada';
    estado_anterior := null;
    estado_posterior := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    operacion := 'actualizada';
    estado_anterior := to_jsonb(old);
    estado_posterior := to_jsonb(new);
  else
    operacion := 'eliminada';
    estado_anterior := to_jsonb(old);
    estado_posterior := null;
  end if;

  accion := tipo_entidad || '.' || operacion;
  fila := coalesce(estado_posterior, estado_anterior);

  motivo := nullif(btrim(coalesce(current_setting('app.audit_reason', true), '')), '');

  if motivo is null
     and exists (select 1 from public.audit_reason_required r where r.action = accion) then
    raise exception 'La operación % exige un motivo y no lo trae.', accion;
  end if;

  -- RF-A.1 · rol efectivo al momento: lo que fije la aplicación, si no los roles
  -- reales de la cuenta, y como último recurso el rol de base de datos.
  rol := coalesce(
    nullif(btrim(coalesce(current_setting('app.audit_actor_role', true), '')), ''),
    nullif(array_to_string(private.roles_efectivos(), ','), ''),
    current_user
  );

  identificador := nullif(fila ->> 'id', '')::uuid;
  propiedad := case
    when fila ? 'property_id' then nullif(fila ->> 'property_id', '')::uuid
    when tipo_entidad = 'property' then identificador
    else null
  end;

  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, property_id,
    reason, previous_state, next_state
  )
  values (
    (select auth.uid()),
    rol, accion, tipo_entidad, identificador, propiedad,
    motivo, estado_anterior, estado_posterior
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
