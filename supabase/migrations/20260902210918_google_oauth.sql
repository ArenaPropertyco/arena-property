-- HU-61 · RF-61.5, RF-61.6 — atribución de referido tras entrar con un proveedor
-- externo (D-32) y guarda de escritura única (D-03: nadie se auto-refiere).
--
-- El código llega en una cookie que sobrevive el viaje a Google porque el navegador
-- la conserva sola; lo único que falta es un lugar seguro donde aplicarla al volver.
-- No es una función SECURITY DEFINER: RLS ya permite que la cuenta edite su propio
-- perfil (`profiles_edicion`), así que basta con marcar la escritura como legítima
-- ante la guarda — el privilegio nunca se eleva, solo se distingue el origen.

create or replace function private.proteger_referido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.referred_by_code is distinct from old.referred_by_code
     and coalesce(current_setting('app.aplicando_referido', true), '') <> 'true' then
    raise exception
      'CA-61.5 · la atribución de referido solo se aplica con public.aplicar_atribucion_referido().';
  end if;

  return new;
end;
$$;

comment on function private.proteger_referido() is
  'HU-61 · RF-61.6 · rechaza cualquier cambio directo de referred_by_code que no pase '
  'por la función de atribución. Nadie se auto-refiere (D-03).';

create trigger profiles_proteger_referido
  before update on public.profiles
  for each row execute function private.proteger_referido();

-- RF-61.5 · aplica el código pendiente, una sola vez: si el perfil ya tenía
-- atribución (del registro por correo o de un intento anterior), no la reemplaza.
-- Vive en `public` porque el cliente la invoca por RPC; SECURITY INVOKER porque no
-- necesita más privilegio que el que ya tiene el dueño del perfil.
create or replace function public.aplicar_atribucion_referido(codigo text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalizado text := nullif(upper(btrim(coalesce(codigo, ''))), '');
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

comment on function public.aplicar_atribucion_referido(text) is
  'HU-61 · RF-61.5 · D-32 · aplica al perfil propio el código que trajo la cookie tras '
  'volver de un proveedor externo. Una sola vez: si ya había atribución, no la toca.';

revoke all on function public.aplicar_atribucion_referido(text) from public;
grant execute on function public.aplicar_atribucion_referido(text) to authenticated;
