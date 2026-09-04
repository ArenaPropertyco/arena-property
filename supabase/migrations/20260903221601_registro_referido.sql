-- HU-04 · RF-04.4 y CA-04.3 — el código de referido se persiste solo si tiene un
-- formato plausible; uno inválido no bloquea el registro: se descarta.
--
-- La regla es la misma de `shared/identity/registro.ts` (`atribucionDeRegistro`).
-- Vive también aquí porque el registro por Google (HU-61) y cualquier cliente que
-- escriba `raw_user_meta_data.referral_code` llegan a la base sin pasar por el
-- formulario, y la atribución no puede depender de que lo hicieran.

create or replace function private.normalizar_codigo_referido(codigo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(btrim(coalesce(codigo, ''))) ~ '^[A-Z0-9][A-Z0-9-]{4,14}$'
      then upper(btrim(codigo))
    else null
  end;
$$;

comment on function private.normalizar_codigo_referido(text) is
  'HU-04 · CA-04.3 · código de referido en mayúsculas si su formato es plausible; null si no lo es o viene vacío.';

revoke execute on function private.normalizar_codigo_referido(text) from public, anon;
grant execute on function private.normalizar_codigo_referido(text) to authenticated, service_role;

-- RF-04.3 · RF-04.4 · el registro crea perfil y rol; la atribución, solo si sirve.
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
    private.normalizar_codigo_referido(new.raw_user_meta_data ->> 'referral_code'),
    new.email_confirmed_at is not null
  );

  insert into public.user_roles (user_id, role, granted_by)
  values (new.id, 'user', null);

  return new;
end;
$$;

-- HU-61 · RF-61.5 · la atribución que llega por cookie sigue la misma regla.
create or replace function public.aplicar_atribucion_referido(codigo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalizado text := private.normalizar_codigo_referido(codigo);
begin
  if normalizado is null or (select auth.uid()) is null then
    return;
  end if;

  -- `is_local = true` no se reinicia solo entre sentencias, solo al terminar la
  -- transacción: se apaga a mano para que no quede «encendida» y afloje la guarda
  -- de alguna escritura posterior dentro de la misma transacción.
  perform set_config('app.aplicando_referido', 'true', true);

  update public.profiles
     set referred_by_code = normalizado
   where id = (select auth.uid())
     and referred_by_code is null;

  perform set_config('app.aplicando_referido', 'false', true);
end;
$$;
