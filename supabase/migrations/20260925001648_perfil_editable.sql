-- Perfil editable — la propia cuenta cambia nombre, teléfono e idioma; el
-- Superadmin, los de cualquier cuenta. El correo, la identidad y la suspensión no
-- se tocan desde el perfil.
--
-- Hasta aquí `profiles_edicion` dejaba a cada cuenta escribir **todas** las columnas
-- de su propio perfil, y la guarda solo frenaba `status` y `email_verified`. Con la
-- pantalla de «Perfil» ese hueco quedaría a un clic: una cuenta podría reescribir su
-- correo (que ya no coincidiría con el de acceso), su id o su fecha de alta, o
-- borrar el motivo de su propia suspensión. La guarda cubre ahora todo eso:
--
--   - `email` solo cambia desde `auth.users` (el disparador de sincronización corre
--     con `pg_trigger_depth() > 1`); el Superadmin lo cambia por la API de
--     administración de Supabase Auth, nunca escribiendo el perfil.
--   - `id` y `created_at` no cambian nunca.
--   - Los datos de suspensión, solo el Superadmin (HU-33).
--   - Nombre, teléfono y avatar se validan igual que en la pantalla
--     (`shared/identity/edicion-de-perfil.ts`).

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

    if new.email is distinct from old.email then
      raise exception 'PERFIL-CORREO · el correo es el de acceso: se cambia en la cuenta, no en el perfil.';
    end if;

    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'PERFIL-IDENTIDAD · el identificador y la fecha de alta no cambian.';
    end if;

    if (new.suspension_kind, new.suspension_reason, new.suspended_at)
         is distinct from (old.suspension_kind, old.suspension_reason, old.suspended_at)
       and not private.es_superadmin() then
      raise exception 'Solo el Superadmin puede suspender o reactivar una cuenta.';
    end if;

    if new.full_name is distinct from old.full_name
       and length(btrim(coalesce(new.full_name, ''))) > 120 then
      raise exception 'PERFIL-NOMBRE · el nombre admite hasta 120 caracteres.';
    end if;

    if new.phone is distinct from old.phone
       and new.phone is not null
       and new.phone !~ '^\+?[0-9 ()-]{7,20}$' then
      raise exception 'PERFIL-TELEFONO · el teléfono no es válido.';
    end if;

    if new.avatar_url is distinct from old.avatar_url
       and new.avatar_url is not null
       and (new.avatar_url !~ '^https://' or length(new.avatar_url) > 2048) then
      raise exception 'PERFIL-AVATAR · el avatar debe ser una dirección https.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ── ¿Tiene contraseña la cuenta? ────────────────────────────────────────────
-- Una cuenta creada con Google no tiene: la pantalla ofrece crearla en vez de
-- cambiarla, y el servidor no pide una actual que no existe. Solo responde por la
-- propia cuenta y nunca expone el hash.
create or replace function public.tengo_contrasena()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select u.encrypted_password is not null and u.encrypted_password <> ''
       from auth.users u
      where u.id = (select auth.uid())),
    false
  );
$$;

comment on function public.tengo_contrasena() is
  'Perfil · si la cuenta que llama tiene contraseña (las creadas con Google no). Nunca expone el hash.';

revoke execute on function public.tengo_contrasena() from public, anon;
grant execute on function public.tengo_contrasena() to authenticated, service_role;
