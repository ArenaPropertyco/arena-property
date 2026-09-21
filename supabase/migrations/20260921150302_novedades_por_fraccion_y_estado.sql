-- HU-29 · RF-29.5, RF-29.6 · D-46 — la novedad dirigida a una fracción y su
-- estado activa/inactiva.
--
-- Tres decisiones que conviene leer antes que el código:
--
-- 1. **Una novedad puede ir a toda la propiedad o a una sola fracción (RF-29.5).**
--    Dirigida a una fracción, solo su titular la recibe y la ve en su historial;
--    los demás copropietarios ni se enteran, con el mismo acotamiento que HU-16
--    aplica al calendario. La fracción tiene que ser de la propiedad de la novedad.
--
-- 2. **Inactiva, ningún Propietario la ve (RF-29.6).** El estado es un interruptor
--    de visibilidad hacia los propietarios: quien gestiona la propiedad la sigue
--    viendo, marcada. Una novedad que nace inactiva no notifica; notifica la
--    primera vez que se activa, y volver a activarla no repite el aviso (RF-N.4).
--    Desactivarla no borra la notificación ya entregada: lo que se envió, se envió.
--
-- 3. **El estado lo fija solo el Superadmin (RF-29.6).** El Administrador publica
--    —a toda la propiedad o a una fracción— exactamente igual que el Superadmin,
--    pero no puede desactivar, reactivar ni publicar inactiva: eso es decidir el
--    estado, y esa decisión no es suya. La RLS deja pasar su escritura y el
--    disparador la acota a lo que sí puede tocar.

alter table public.announcements
  add column fraction_id uuid references public.fractions (id),
  add column active boolean not null default true;

comment on column public.announcements.fraction_id is
  'RF-29.5 · fracción a la que va dirigida; nula, va a todos los titulares de la propiedad.';
comment on column public.announcements.active is
  'RF-29.6 · inactiva, ningún Propietario la ve ni se notifica; la cambia solo el Superadmin.';

-- ── RF-29.5 · ¿es mía esa fracción? ─────────────────────────────────────────
create or replace function private.es_titular_de_fraccion(fraccion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fractions
     where id = fraccion and owner_id = (select auth.uid())
  );
$$;

-- ── RLS · quien gestiona ve todo; el titular, lo activo que le toca ─────────
drop policy announcements_lectura on public.announcements;
create policy announcements_lectura on public.announcements for select to authenticated
  using (
    private.puede_gestionar_propiedad(property_id)
    or (
      active
      and private.es_copropietario(property_id)
      and (fraction_id is null or private.es_titular_de_fraccion(fraction_id))
    )
  );

-- ── RF-29.5 · RF-29.6 · las reglas, en el disparador ────────────────────────
create or replace function private.validar_novedad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Sin JWT (disparadores del sistema, pruebas como superusuario) no hay a quién acotar.
  con_sesion boolean := (select auth.uid()) is not null;
begin
  if tg_op = 'INSERT' then
    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.resolved_at := null;
    new.resolved_by := null;
    -- RF-29.5 · la fracción es de la propiedad de la novedad, o no es.
    if new.fraction_id is not null and not exists (
      select 1 from public.fractions f where f.id = new.fraction_id and f.property_id = new.property_id
    ) then
      raise exception 'RF-29.5 · la fracción no pertenece a la propiedad de la novedad.';
    end if;
    -- RF-29.6 · publicar inactiva es fijar el estado, y eso es del Superadmin.
    if not new.active and con_sesion and not private.es_superadmin() then
      raise exception 'RF-29.6 · solo el Superadmin activa o desactiva una novedad.';
    end if;
    return new;
  end if;

  -- RF-29.3 · publicada, solo cambia su resolución y su estado.
  if new.property_id <> old.property_id
     or new.fraction_id is distinct from old.fraction_id
     or new.title <> old.title
     or new.body <> old.body
     or new.urgency <> old.urgency
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception 'RF-29.3 · una novedad publicada no se reescribe: para corregirla se publica otra.';
  end if;
  if new.active is distinct from old.active and con_sesion and not private.es_superadmin() then
    raise exception 'RF-29.6 · solo el Superadmin activa o desactiva una novedad.';
  end if;
  if old.resolved_at is not null and (new.resolved_at is distinct from old.resolved_at or new.resolved_by is distinct from old.resolved_by) then
    raise exception 'RF-29.3 · la novedad ya está resuelta.';
  end if;
  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

-- ── RF-29.2 · RF-29.5 · notificar: a la fracción o a toda la propiedad, si está activa ─
create or replace function private.notificar_novedad(novedad uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  p public.properties;
  f public.fractions;
  destinatarios uuid[];
  carga jsonb;
begin
  select * into a from public.announcements where id = novedad;
  if not found or not a.active then
    return;
  end if;
  select * into p from public.properties where id = a.property_id;
  carga := jsonb_build_object('title', a.title, 'body', a.body, 'urgency', a.urgency, 'property_name', p.name, 'announcement_id', a.id);

  if a.fraction_id is not null then
    -- CA-29.4 · espejo de `destinatariosDeFraccion`: el titular, y nadie si no tiene.
    select * into f from public.fractions where id = a.fraction_id;
    destinatarios := case when f.owner_id is null then '{}'::uuid[] else array[f.owner_id] end;
    carga := carga || jsonb_build_object('fraction_number', f.number);
  else
    -- CA-29.1 · espejo de `destinatariosDePropiedad`: titular por titular, sin repetir.
    select coalesce(array_agg(distinct fr.owner_id), '{}'::uuid[]) into destinatarios
      from public.fractions fr
     where fr.property_id = a.property_id and fr.owner_id is not null;
  end if;

  perform public.emitir_notificacion('announcement_published', 'announcement', a.id::text, a.property_id, carga, destinatarios);
end;
$$;

comment on function private.notificar_novedad(uuid) is
  'HU-29 · RF-29.2, RF-29.5 · emite la novedad activa a su fracción o a todos los titulares de la propiedad, una vez cada uno; idempotente por TR-03.';

-- RF-29.6 · la que nace inactiva avisa la primera vez que se activa; reactivar no repite.
create trigger announcements_activadas
  after update of active on public.announcements
  for each row
  when (new.active and not old.active)
  execute function private.notificar_novedad_publicada();

-- ── RF-29.6 · cambiar el estado ─────────────────────────────────────────────
-- SECURITY INVOKER: la RLS decide quién escribe y el disparador reserva el estado al Superadmin.
create or replace function public.set_announcement_active(announcement uuid, active boolean)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado boolean;
begin
  update public.announcements a
     set active = set_announcement_active.active
   where a.id = announcement
  returning a.active into resultado;

  if resultado is null then
    raise exception 'RF-29.6 · la novedad no existe o no es visible.';
  end if;
  return resultado;
end;
$$;

comment on function public.set_announcement_active(uuid, boolean) is
  'HU-29 · RF-29.6 · activa o desactiva una novedad; solo el Superadmin, y activarla por primera vez la notifica.';

revoke execute on function public.set_announcement_active(uuid, boolean) from public, anon;
grant execute on function public.set_announcement_active(uuid, boolean) to authenticated, service_role;
