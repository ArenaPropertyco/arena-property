-- HU-61 · RF-61.4, RF-61.7, RF-61.8 · D-33, D-35 — el perfil guarda el nombre y el
-- avatar de la identidad de Google, los refresca en cada ingreso, y la vinculación
-- de una identidad a una cuenta existente queda auditada.
--
-- Hasta aquí el alta copiaba correo, idioma, referido y verificación, pero no el
-- nombre ni el avatar: `full_name` quedaba vacío en toda cuenta y `avatar_url` no
-- existía. Google los entrega en `raw_user_meta_data` (`full_name`/`name` y
-- `avatar_url`/`picture`), y Supabase Auth reescribe esos metadatos en cada ingreso
-- por el proveedor: el disparador de actualización los escucha y el perfil los sigue.
--
-- RF-61.8 · son datos de **presentación**. `raw_user_meta_data` lo edita el propio
-- usuario, así que nada de esto autoriza: ninguna política ni función los lee para
-- decidir acceso. Solo se aceptan avatares por `https` y con longitud acotada.

alter table public.profiles
  add column avatar_url text;

comment on column public.profiles.avatar_url is
  'HU-61 · RF-61.7 · RF-61.8 · avatar de la identidad del proveedor. Presentación: nunca autoriza.';

-- ── Lectura acotada de los metadatos ────────────────────────────────────────
create or replace function private.nombre_de_metadatos(metadatos jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(left(btrim(coalesce(metadatos ->> 'full_name', metadatos ->> 'name', '')), 200), '');
$$;

create or replace function private.avatar_de_metadatos(metadatos jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when url ~ '^https://' and length(url) <= 2048 then url
    else null
  end
  from (select btrim(coalesce(metadatos ->> 'avatar_url', metadatos ->> 'picture', '')) as url) as m;
$$;

comment on function private.nombre_de_metadatos(jsonb) is
  'HU-61 · RF-61.7 · el nombre que trae el proveedor, recortado. Presentación (RF-61.8).';
comment on function private.avatar_de_metadatos(jsonb) is
  'HU-61 · RF-61.7 · el avatar que trae el proveedor, solo https. Presentación (RF-61.8).';

revoke execute on function private.nombre_de_metadatos(jsonb), private.avatar_de_metadatos(jsonb) from public, anon, authenticated;

-- ── RF-61.2 · RF-61.7 · el alta copia nombre y avatar ───────────────────────
create or replace function private.crear_perfil_y_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idioma text := nullif(new.raw_user_meta_data ->> 'locale', '');
begin
  insert into public.profiles (id, email, locale, referred_by_code, email_verified, full_name, avatar_url)
  values (
    new.id,
    new.email,
    case when idioma in ('es', 'en') then idioma else 'es' end,
    private.normalizar_codigo_referido(new.raw_user_meta_data ->> 'referral_code'),
    new.email_confirmed_at is not null,
    private.nombre_de_metadatos(new.raw_user_meta_data),
    private.avatar_de_metadatos(new.raw_user_meta_data)
  );

  insert into public.user_roles (user_id, role, granted_by)
  values (new.id, 'user', null);

  return new;
end;
$$;

-- ── RF-61.7 · cada ingreso por el proveedor refresca nombre y avatar ────────
-- Sin nombre o avatar nuevos se conserva lo que había: un alta por correo no borra
-- el nombre que dejó un ingreso anterior por Google. Solo se escribe si algo cambió,
-- para no llenar la auditoría con una entrada por cada ingreso.
create or replace function private.sincronizar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre text := private.nombre_de_metadatos(new.raw_user_meta_data);
  avatar text := private.avatar_de_metadatos(new.raw_user_meta_data);
begin
  update public.profiles p
     set email = new.email,
         email_verified = new.email_confirmed_at is not null,
         full_name = coalesce(nombre, p.full_name),
         avatar_url = coalesce(avatar, p.avatar_url)
   where p.id = new.id
     and (p.email is distinct from new.email
       or p.email_verified is distinct from (new.email_confirmed_at is not null)
       or p.full_name is distinct from coalesce(nombre, p.full_name)
       or p.avatar_url is distinct from coalesce(avatar, p.avatar_url));

  return new;
end;
$$;

drop trigger on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, email_confirmed_at, raw_user_meta_data on auth.users
  for each row execute function private.sincronizar_perfil();

-- ── RF-61.4 · D-33 · la vinculación de una identidad queda auditada ─────────
-- Supabase Auth vincula la identidad de Google a la cuenta que ya tiene ese correo
-- verificado: no nace un segundo `auth.users` ni un segundo perfil. Lo que sí nace
-- es una fila en `auth.identities`; si la cuenta ya tenía otra, es una vinculación.
create or replace function private.auditar_vinculacion_de_identidad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from auth.identities i
     where i.user_id = new.user_id and i.id <> new.id
  ) then
    insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, next_state)
    values (
      new.user_id,
      'user',
      'profile.identidad_vinculada',
      'profile',
      new.user_id,
      'Identidad de ' || new.provider || ' vinculada a la cuenta existente',
      jsonb_build_object('provider', new.provider)
    );
  end if;
  return new;
end;
$$;

comment on function private.auditar_vinculacion_de_identidad() is
  'HU-61 · RF-61.4 · TR-01 · registra la vinculación de una identidad nueva a una cuenta que ya existía.';

create trigger on_auth_identity_created
  after insert on auth.identities
  for each row execute function private.auditar_vinculacion_de_identidad();
