-- HU-04 · RF-04.2 — la verificación del correo, como dato de la base.
--
-- Por qué hace falta esta columna: la guarda de rutas necesita saber si el correo
-- está verificado, y el JWT no lo dice. Sus claims traen `user_metadata.email_verified`,
-- pero `user_metadata` lo edita el propio usuario (`updateUser({ data: ... })`), así que
-- usarlo para autorizar equivale a dejar que cualquiera se declare verificado.
--
-- La fuente de verdad es `auth.users.email_confirmed_at`, que la API no expone. Se
-- refleja aquí por disparador y se protege contra escritura del cliente, igual que el
-- estado de cuenta.

alter table public.profiles
  add column email_verified boolean not null default false;

comment on column public.profiles.email_verified is
  'HU-04 · RF-04.2 · espejo de auth.users.email_confirmed_at. Lo escribe solo el disparador.';

-- Cuentas que ya existían.
update public.profiles p
   set email_verified = (u.email_confirmed_at is not null)
  from auth.users u
 where u.id = p.id;

-- ── El perfil nace con el estado real de la cuenta ──────────────────────────
create or replace function private.crear_perfil_y_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  idioma text := nullif(new.raw_user_meta_data ->> 'locale', '');
begin
  insert into public.profiles (id, email, locale, referred_by_code, email_verified)
  values (
    new.id,
    new.email,
    case when idioma in ('es', 'en') then idioma else 'es' end,
    nullif(upper(btrim(coalesce(new.raw_user_meta_data ->> 'referral_code', ''))), ''),
    new.email_confirmed_at is not null
  );

  insert into public.user_roles (user_id, role, granted_by)
  values (new.id, 'user', null);

  return new;
end;
$$;

-- ── Y se mantiene al día con la cuenta ──────────────────────────────────────
create or replace function private.sincronizar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email,
         email_verified = new.email_confirmed_at is not null
   where id = new.id;

  return new;
end;
$$;

comment on function private.sincronizar_perfil() is
  'HU-04 · RF-04.2 · refleja en el perfil el correo y su confirmación desde auth.users.';

create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function private.sincronizar_perfil();

-- ── Nadie se declara verificado a sí mismo ──────────────────────────────────
-- Misma guarda que protege el estado de cuenta: sin JWT (disparadores del sistema,
-- rutas de servidor) no se interpone; con sesión, el cliente no puede tocar el campo.
create or replace function private.proteger_estado_de_cuenta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- `pg_trigger_depth() > 1` significa que la escritura viene de otro disparador —el
  -- que sincroniza desde `auth.users`—, no de un cliente. No se puede falsear desde la API.
  if (select auth.uid()) is not null and pg_trigger_depth() = 1 then
    if new.status is distinct from old.status and not private.es_superadmin() then
      raise exception 'Solo el Superadmin puede suspender o reactivar una cuenta.';
    end if;

    if new.email_verified is distinct from old.email_verified then
      raise exception 'La verificación del correo la fija la cuenta, no el perfil.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;
