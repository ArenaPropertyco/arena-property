-- HU-13, HU-14, HU-15 · D-33 — la semana completa como única unidad de uso.
--
-- Qué cambia respecto al modelo por noches:
--
-- 1. **Desaparecen las estadías por noches.** `stays`, `released_nights`, los
--    bloqueos por noches y sus funciones se retiran. La unidad es la semana
--    elegida en HU-12: `allocations` guarda ahora cuándo se confirmó como uso propio
--    y cuándo y por qué se liberó (cancelada, voluntaria o caducada).
--
-- 2. **Confirmar, cancelar y liberar son funciones del titular (RF-14.10).**
--    Calendario activo (I-08), semana propia y futura, sin bloqueo, dentro del plazo
--    de 60 días para confirmar (D-15) y de 30 para cancelar (D-14). El Administrador
--    puede hacerlo por la fracción (HU-17).
--
-- 3. **La caducidad es una tarea diaria idempotente (DT-09).** La semana elegida
--    que sigue sin confirmar a 60 días de su entrada pasa a la bolsa de renta con
--    aviso al titular; repetir la pasada no repite nada.
--
-- 4. **Los bloqueos son por semanas (HU-15).** Un bloqueo sobre una semana ya
--    confirmada no la elimina: deja el conflicto para HU-17.

-- ── Retirada del modelo por noches ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'liberar-noches-vencidas';
  end if;
end;
$$;

drop function if exists public.liberar_noches_vencidas(date, integer);
drop function if exists public.declarar_estadia(uuid, date, date);
drop function if exists public.cancelar_estadia(uuid, date, date);
drop function if exists public.liberar_noches(uuid, date, date);
drop function if exists public.crear_bloqueo(uuid, date, date, text);
drop function if exists public.levantar_bloqueo(uuid, text);
drop table if exists public.calendar_conflicts cascade;
drop table if exists public.blocks cascade;
drop table if exists public.released_nights cascade;
drop table if exists public.stays cascade;
drop function if exists private.validar_estadia() cascade;
drop function if exists private.noche_libre_de(uuid, uuid, date);
drop function if exists private.noches_de(daterange);
drop function if exists private.temporada_de(uuid, date);
drop function if exists private.rango_de_temporada(text);
drop function if exists private.minimo_de_estadia(text);
delete from public.audit_reason_required where action in ('block.creada', 'block.actualizada');

-- ── La semana elegida: confirmada o liberada ────────────────────────────────
alter table public.allocations
  add column confirmed_at timestamptz,
  add column confirmed_by uuid references auth.users (id),
  add column released_at timestamptz,
  add column released_by uuid references auth.users (id),
  add column release_reason text,
  add constraint allocations_motivo_de_liberacion check (release_reason is null or release_reason in ('cancelled', 'voluntary', 'expired')),
  add constraint allocations_liberacion_con_motivo check ((released_at is null) = (release_reason is null));

comment on column public.allocations.confirmed_at is 'HU-14 · RF-14.1 · D-33 · cuándo el titular confirmó la semana como uso propio.';
comment on column public.allocations.released_at is 'HU-14 · RF-14.6, RF-14.7 · cuándo la semana pasó a la bolsa de renta (cancelada, voluntaria o caducada).';

-- ── RF-15.1 · bloqueos por semanas ──────────────────────────────────────────
create table public.week_blocks (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  reason text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id),
  lift_reason text,

  constraint week_blocks_motivo_obligatorio check (btrim(reason) <> ''),
  constraint week_blocks_levantado_con_motivo check (lifted_at is null or btrim(coalesce(lift_reason, '')) <> '')
);

-- Una semana tiene a lo sumo un bloqueo vigente.
create unique index week_blocks_vigente_unico on public.week_blocks (week_id) where lifted_at is null;
create index week_blocks_calendario_idx on public.week_blocks (calendar_id) where lifted_at is null;

comment on table public.week_blocks is
  'HU-15 · RF-15.1 · D-33 · semanas bloqueadas por el Administrador con motivo obligatorio. Levantado con `lifted_at`, nunca borrado.';

-- ── RF-15.4 · conflictos para la bandeja de HU-17 ───────────────────────────
create table public.calendar_conflicts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  block_id uuid references public.week_blocks (id) on delete cascade,
  allocation_id uuid not null references public.allocations (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint calendar_conflicts_estado_valido check (status in ('open', 'resolved')),
  constraint calendar_conflicts_unico unique (block_id, allocation_id)
);

comment on table public.calendar_conflicts is
  'HU-15 · RF-15.4 · CA-15.3 · semana confirmada que un bloqueo pisa; HU-17 la reasigna.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.week_blocks enable row level security;
alter table public.week_blocks force row level security;
alter table public.calendar_conflicts enable row level security;
alter table public.calendar_conflicts force row level security;

revoke all on table public.week_blocks, public.calendar_conflicts from anon, authenticated, service_role;
grant select, insert, update on table public.week_blocks to authenticated, service_role;
grant select on table public.calendar_conflicts to authenticated, service_role;

-- RF-15.3 · D-16 · los bloqueos se ven con su motivo por todos los copropietarios.
create policy week_blocks_lectura on public.week_blocks for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

-- CA-15.4 · solo el Administrador asignado (o el Superadmin) bloquea y levanta.
create policy week_blocks_creacion on public.week_blocks for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));
create policy week_blocks_edicion on public.week_blocks for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

create policy calendar_conflicts_lectura on public.calendar_conflicts for select to authenticated
  using (private.puede_gestionar_propiedad(property_id)
         or exists (select 1 from public.fractions f where f.id = calendar_conflicts.fraction_id and f.owner_id = (select auth.uid())));

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
insert into public.audit_reason_required (action, source) values
  ('week_block.creada', 'HU-15'),
  ('week_block.actualizada', 'HU-15')
on conflict (action) do nothing;

create trigger week_blocks_auditados
  after insert or update or delete on public.week_blocks
  for each row execute function public.registrar_auditoria('week_block');
create trigger calendar_conflicts_auditados
  after insert or update or delete on public.calendar_conflicts
  for each row execute function public.registrar_auditoria('calendar_conflict');

-- ── Ayudas privadas ─────────────────────────────────────────────────────────
/** La semana `week_index` del calendario, con su asignación (si la hay). */
create or replace function private.week_allocation(calendar uuid, week_index integer)
returns table (week_id uuid, starts_on date, ends_on date, season text, allocation_id uuid, fraction_id uuid, confirmed_at timestamptz, released_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.starts_on, w.ends_on, w.season, a.id, a.fraction_id, a.confirmed_at, a.released_at
    from public.calendar_weeks w
    left join public.allocations a on a.week_id = w.id and a.calendar_id = calendar
   where w.calendar_id = calendar and w.index = week_index;
$$;

revoke execute on function private.week_allocation(uuid, integer) from public, anon;
grant execute on function private.week_allocation(uuid, integer) to authenticated, service_role;

-- ── RF-14.1 · confirmar ─────────────────────────────────────────────────────
create or replace function public.confirm_week(calendar uuid, fraction uuid, week_index integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  manages boolean;
  cal public.season_calendars;
  p public.properties;
  w record;
  updated integer;
begin
  select * into f from public.fractions where id = fraction;
  manages := f.id is not null and private.puede_gestionar_propiedad(f.property_id);
  if f.id is null or (not manages and f.owner_id is distinct from (select auth.uid())) then
    raise exception 'RF-14.1 · solo el titular de la fracción (o el Administrador) confirma sus semanas.';
  end if;
  -- CA-14.0 · I-08 · D-31 · sin calendario activo no se confirma, cancela ni libera.
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo.', f.number;
  end if;
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or cal.property_id <> f.property_id or cal.published_at is null then
    raise exception 'RF-12.4 · el calendario no está abierto para esta propiedad.';
  end if;

  select * into w from private.week_allocation(calendar, week_index);
  if w.week_id is null or w.fraction_id is distinct from fraction then
    raise exception 'CA-14.1 · RF-14.3 · la semana % no es de la fracción %.', week_index, f.number;
  end if;
  if w.released_at is not null then
    raise exception 'CA-14.2 · CA-14.6 · RF-14.7 · la semana % ya está en la bolsa de renta.', week_index;
  end if;
  if w.confirmed_at is not null then
    raise exception 'CA-14.2 · RF-14.1 · la semana % ya estaba confirmada.', week_index;
  end if;
  if w.starts_on < current_date then
    raise exception 'RF-14.1 · la semana % ya pasó.', week_index;
  end if;
  -- RF-14.1c · CA-14.0b · el primer año solo cuentan las semanas posteriores a la activación.
  if f.calendar_activated_at is not null and w.starts_on < f.calendar_activated_at::date then
    raise exception 'CA-14.0b · RF-14.1c · la semana % empieza antes de la activación del calendario.', week_index;
  end if;
  -- RF-15.2 · CA-15.2 · bloqueos del Administrador.
  if exists (select 1 from public.week_blocks b where b.week_id = w.week_id and b.lifted_at is null) then
    raise exception 'CA-15.2 · RF-15.2 · la semana % está bloqueada por el Administrador.', week_index;
  end if;
  -- RF-14.7 · D-15 · se confirma hasta 60 días antes de la entrada.
  if w.starts_on - current_date < 60 then
    raise exception 'RF-14.7 · la confirmación de la semana % se cerró 60 días antes de su entrada.', week_index;
  end if;

  perform set_config('app.audit_reason', 'Semana confirmada como uso propio', true);
  -- CA-14.9 · dos confirmaciones a la vez: la fila se bloquea y solo la primera la encuentra sin confirmar.
  update public.allocations
     set confirmed_at = now(), confirmed_by = (select auth.uid())
   where id = w.allocation_id and confirmed_at is null;
  get diagnostics updated = row_count;
  perform set_config('app.audit_reason', '', true);
  if updated = 0 then
    raise exception 'CA-14.9 · CA-14.2 · la semana % acaba de ser confirmada.', week_index;
  end if;

  -- TR-03 · HU-16 · CA-16.3 · una sola vez por semana.
  if f.owner_id is not null then
    select * into p from public.properties where id = f.property_id;
    perform public.emitir_notificacion(
      'stay_confirmed', 'week_confirmation', w.allocation_id::text, f.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number, 'check_in', w.starts_on::text, 'check_out', w.ends_on::text, 'week_index', week_index),
      array[f.owner_id]
    );
  end if;
end;
$$;

comment on function public.confirm_week(uuid, uuid, integer) is
  'HU-14 · RF-14.1 · D-33 · el titular confirma como uso propio una semana elegida, hasta 60 días antes de su entrada.';

-- ── RF-14.6 · cancelar ──────────────────────────────────────────────────────
create or replace function public.cancel_week(calendar uuid, fraction uuid, week_index integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  manages boolean;
  p public.properties;
  w record;
begin
  select * into f from public.fractions where id = fraction;
  manages := f.id is not null and private.puede_gestionar_propiedad(f.property_id);
  if f.id is null or (not manages and f.owner_id is distinct from (select auth.uid())) then
    raise exception 'RF-14.6 · solo el titular de la fracción (o el Administrador) cancela sus semanas.';
  end if;
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo.', f.number;
  end if;
  select * into w from private.week_allocation(calendar, week_index);
  if w.week_id is null or w.fraction_id is distinct from fraction then
    raise exception 'CA-14.1 · RF-14.3 · la semana % no es de la fracción %.', week_index, f.number;
  end if;
  if w.released_at is not null then
    raise exception 'CA-14.6 · RF-14.6 · la semana % ya está en la bolsa de renta.', week_index;
  end if;
  if w.confirmed_at is null then
    raise exception 'RF-14.6 · la semana % no está confirmada: libérala en vez de cancelarla.', week_index;
  end if;
  -- D-14 · P-10 · CA-14.5 · hasta 30 días antes de la entrada.
  if w.starts_on - current_date < 30 then
    raise exception 'CA-14.5 · RF-14.6 · la cancelación de la semana % se cerró 30 días antes de su entrada.', week_index;
  end if;

  perform set_config('app.audit_reason', 'Semana cancelada por el titular', true);
  update public.allocations
     set released_at = now(), released_by = (select auth.uid()), release_reason = 'cancelled'
   where id = w.allocation_id;
  perform set_config('app.audit_reason', '', true);

  if f.owner_id is not null then
    select * into p from public.properties where id = f.property_id;
    perform public.emitir_notificacion(
      'calendar_changed', 'week_cancellation', w.allocation_id::text, f.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'detail', 'la semana ' || (week_index + 1) || ' (' || w.starts_on || ') fue cancelada y pasó a la bolsa de renta'),
      array[f.owner_id]
    );
  end if;
end;
$$;

comment on function public.cancel_week(uuid, uuid, integer) is
  'HU-14 · RF-14.6 · D-14 · cancela una semana confirmada hasta 30 días antes; la semana entera va a la bolsa de renta.';

-- ── RF-14.7 · liberar ───────────────────────────────────────────────────────
create or replace function public.release_week(calendar uuid, fraction uuid, week_index integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  manages boolean;
  p public.properties;
  w record;
begin
  select * into f from public.fractions where id = fraction;
  manages := f.id is not null and private.puede_gestionar_propiedad(f.property_id);
  if f.id is null or (not manages and f.owner_id is distinct from (select auth.uid())) then
    raise exception 'RF-14.7 · solo el titular de la fracción (o el Administrador) libera sus semanas.';
  end if;
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo.', f.number;
  end if;
  select * into w from private.week_allocation(calendar, week_index);
  if w.week_id is null or w.fraction_id is distinct from fraction then
    raise exception 'CA-14.1 · RF-14.3 · la semana % no es de la fracción %.', week_index, f.number;
  end if;
  if w.released_at is not null then
    raise exception 'CA-14.8 · RF-14.7 · la semana % ya está en la bolsa de renta.', week_index;
  end if;
  if w.starts_on < current_date then
    raise exception 'RF-14.7 · la semana % ya pasó.', week_index;
  end if;

  perform set_config('app.audit_reason', 'Semana liberada por el titular', true);
  update public.allocations
     set released_at = now(), released_by = (select auth.uid()), release_reason = 'voluntary'
   where id = w.allocation_id;
  perform set_config('app.audit_reason', '', true);

  if f.owner_id is not null then
    select * into p from public.properties where id = f.property_id;
    perform public.emitir_notificacion(
      'calendar_changed', 'week_release', w.allocation_id::text, f.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'detail', 'la semana ' || (week_index + 1) || ' (' || w.starts_on || ') fue liberada a la bolsa de renta'),
      array[f.owner_id]
    );
  end if;
end;
$$;

comment on function public.release_week(uuid, uuid, integer) is
  'HU-14 · RF-14.7 · D-15 · el titular pasa a la bolsa de renta una semana propia futura.';

revoke execute on function public.confirm_week(uuid, uuid, integer), public.cancel_week(uuid, uuid, integer), public.release_week(uuid, uuid, integer) from public, anon;
grant execute on function public.confirm_week(uuid, uuid, integer), public.cancel_week(uuid, uuid, integer), public.release_week(uuid, uuid, integer) to authenticated, service_role;

-- ── RF-14.7 · D-15 · DT-09 · caducidad a 60 días, idempotente ───────────────
create or replace function public.expire_unconfirmed_weeks(today date default current_date, days integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired integer := 0;
  aviso record;
begin
  perform set_config('app.audit_reason', 'Semana caducada sin confirmar a ' || days || ' días', true);
  with vencidas as (
    update public.allocations a
       set released_at = now(), release_reason = 'expired'
      from public.calendar_weeks w, public.season_calendars c
     where w.id = a.week_id and c.id = a.calendar_id and c.published_at is not null
       and a.confirmed_at is null and a.released_at is null
       and w.starts_on >= today and w.starts_on - today <= days
    returning a.calendar_id, a.fraction_id, c.property_id, w.index
  )
  select count(*) into expired from vencidas;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · un aviso por fracción con titular y por pasada del día; idempotente por la clave.
  for aviso in
    select a.calendar_id, a.fraction_id, c.property_id, f.number, f.owner_id, p.name, count(*) as semanas
      from public.allocations a
      join public.season_calendars c on c.id = a.calendar_id
      join public.fractions f on f.id = a.fraction_id
      join public.properties p on p.id = c.property_id
     where a.release_reason = 'expired' and a.released_at >= now() - interval '1 minute'
       and f.owner_id is not null
     group by a.calendar_id, a.fraction_id, c.property_id, f.number, f.owner_id, p.name
  loop
    perform public.emitir_notificacion(
      'calendar_changed', 'expired_weeks',
      aviso.calendar_id::text || ':' || aviso.fraction_id::text || ':' || today::text,
      aviso.property_id,
      jsonb_build_object('property_name', aviso.name, 'fraction_number', aviso.number,
                         'detail', aviso.semanas || ' semanas sin confirmar pasaron a la bolsa de renta'),
      array[aviso.owner_id]
    );
  end loop;

  return expired;
end;
$$;

comment on function public.expire_unconfirmed_weeks(date, integer) is
  'HU-14 · RF-14.7 · D-15 · D-33 · pasa a la bolsa de renta las semanas elegidas sin confirmar a `days` días de su entrada; idempotente y con aviso al titular.';

revoke execute on function public.expire_unconfirmed_weeks(date, integer) from public, anon, authenticated;
grant execute on function public.expire_unconfirmed_weeks(date, integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-unconfirmed-weeks';
    perform cron.schedule('expire-unconfirmed-weeks', '15 8 * * *', $job$ select public.expire_unconfirmed_weeks() $job$);
  end if;
end;
$$;

-- ── RF-15.1 · RF-15.4 · RF-15.5 · bloquear semanas ──────────────────────────
create or replace function public.block_weeks(calendar uuid, week_indexes integer[], reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  p public.properties;
  idx integer;
  w public.calendar_weeks;
  block uuid;
  blocks uuid[] := '{}';
  conflict record;
  conflicts jsonb := '[]'::jsonb;
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not private.puede_gestionar_propiedad(cal.property_id) then
    raise exception 'CA-15.4 · solo el Administrador asignado bloquea semanas de esta propiedad.';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception 'CA-15.1 · RF-15.1 · el bloqueo exige un motivo.';
  end if;
  if week_indexes is null or cardinality(week_indexes) = 0 then
    raise exception 'RF-15.1 · un bloqueo es de una o más semanas.';
  end if;

  perform set_config('app.audit_reason', btrim(reason), true);
  foreach idx in array week_indexes loop
    select * into w from public.calendar_weeks where calendar_id = calendar and index = idx;
    if w.id is null then
      raise exception 'RF-15.1 · la semana % no está en la rejilla.', idx;
    end if;
    if w.starts_on < current_date then
      raise exception 'RF-15.1 · la semana % ya pasó.', idx;
    end if;
    if exists (select 1 from public.week_blocks b where b.week_id = w.id and b.lifted_at is null) then
      raise exception 'RF-15.1 · la semana % ya está bloqueada.', idx;
    end if;

    insert into public.week_blocks (calendar_id, property_id, week_id, reason, created_by)
    values (calendar, cal.property_id, w.id, btrim(reason), (select auth.uid()))
    returning id into block;
    blocks := blocks || block;

    -- RF-15.4 · CA-15.3 · la semana confirmada persiste; queda el conflicto.
    insert into public.calendar_conflicts (property_id, block_id, allocation_id, fraction_id, week_id)
    select cal.property_id, block, a.id, a.fraction_id, w.id
      from public.allocations a
     where a.week_id = w.id and a.confirmed_at is not null and a.released_at is null;
  end loop;
  perform set_config('app.audit_reason', '', true);

  select * into p from public.properties where id = cal.property_id;
  for conflict in
    select c.allocation_id, c.block_id, w2.index, f.number, f.owner_id
      from public.calendar_conflicts c
      join public.calendar_weeks w2 on w2.id = c.week_id
      join public.fractions f on f.id = c.fraction_id
     where c.block_id = any (blocks)
  loop
    conflicts := conflicts || jsonb_build_object('allocation_id', conflict.allocation_id, 'fraction_number', conflict.number, 'week', conflict.index);
    -- HU-16 · RF-16.1 · el titular afectado se entera antes o junto con el cambio.
    if conflict.owner_id is not null then
      perform public.emitir_notificacion(
        'calendar_changed', 'week_block', conflict.block_id::text || ':' || conflict.allocation_id::text, cal.property_id,
        jsonb_build_object('property_name', p.name, 'fraction_number', conflict.number,
                           'detail', 'un bloqueo del Administrador (' || btrim(reason) || ') pisa tu semana ' || (conflict.index + 1) || ' ya confirmada'),
        array[conflict.owner_id]
      );
    end if;
  end loop;

  return jsonb_build_object('ids', to_jsonb(blocks), 'conflicts', conflicts);
end;
$$;

comment on function public.block_weeks(uuid, integer[], text) is
  'HU-15 · RF-15.1, RF-15.4, RF-15.5 · bloquea semanas de la rejilla con motivo; devuelve los ids y los conflictos con semanas confirmadas.';

create or replace function public.lift_week_block(block uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  b public.week_blocks;
begin
  select * into b from public.week_blocks where id = block;
  if b.id is null or not private.puede_gestionar_propiedad(b.property_id) then
    raise exception 'CA-15.4 · solo el Administrador asignado levanta bloqueos de esta propiedad.';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception 'CA-15.1 · RF-15.5 · levantar un bloqueo exige un motivo.';
  end if;
  if b.lifted_at is not null then
    return;
  end if;

  perform set_config('app.audit_reason', btrim(reason), true);
  update public.week_blocks
     set lifted_at = now(), lifted_by = (select auth.uid()), lift_reason = btrim(reason)
   where id = block;
  update public.calendar_conflicts
     set status = 'resolved', resolved_at = now()
   where block_id = block and status = 'open';
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.lift_week_block(uuid, text) is
  'HU-15 · RF-15.5 · levanta un bloqueo con motivo; resuelve sus conflictos abiertos. El bloqueo no se borra.';

revoke execute on function public.block_weeks(uuid, integer[], text), public.lift_week_block(uuid, text) from public, anon;
grant execute on function public.block_weeks(uuid, integer[], text), public.lift_week_block(uuid, text) to authenticated, service_role;

-- ── RF-12.6 · el intercambio respeta confirmaciones y liberaciones (D-33) ───
create or replace function public.swap_weeks(
  calendar uuid,
  fraction_a integer,
  week_a integer,
  fraction_b integer,
  week_b integer,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  p public.properties;
  fa public.fractions;
  fb public.fractions;
  wa public.calendar_weeks;
  wb public.calendar_weeks;
  aa public.allocations;
  ab public.allocations;
  key text;
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not private.puede_gestionar_propiedad(cal.property_id) then
    raise exception 'CA-17.4 · solo el Administrador asignado intercambia semanas de este calendario.';
  end if;
  if btrim(coalesce(reason, '')) = '' then
    raise exception 'CA-12.10 · RF-12.6 · el intercambio exige un motivo.';
  end if;
  if fraction_a = fraction_b then
    raise exception 'CA-12.10 · RF-12.6 · las dos fracciones deben ser distintas.';
  end if;

  select * into fa from public.fractions where property_id = cal.property_id and number = fraction_a;
  select * into fb from public.fractions where property_id = cal.property_id and number = fraction_b;
  select * into wa from public.calendar_weeks where calendar_id = calendar and index = week_a;
  select * into wb from public.calendar_weeks where calendar_id = calendar and index = week_b;
  select * into aa from public.allocations where calendar_id = calendar and week_id = wa.id and fraction_id = fa.id;
  select * into ab from public.allocations where calendar_id = calendar and week_id = wb.id and fraction_id = fb.id;
  if aa.id is null or ab.id is null then
    raise exception 'CA-12.10 · RF-12.6 · cada semana debe pertenecer a la fracción indicada.';
  end if;
  -- D-28 · I-06 · nadie convierte bajas en altas.
  if wa.season <> wb.season then
    raise exception 'CA-12.10 · RF-12.6 · solo se intercambian semanas de la misma temporada (% ≠ %).', wa.season, wb.season;
  end if;
  -- RF-12.9 · D-33 · una semana confirmada o liberada no se mueve: primero se resuelve (HU-17).
  if aa.confirmed_at is not null or ab.confirmed_at is not null or aa.released_at is not null or ab.released_at is not null then
    raise exception 'CA-12.10 · RF-12.9 · alguna de las semanas ya está confirmada o liberada.';
  end if;

  perform set_config('app.audit_reason', btrim(reason), true);
  update public.allocations set fraction_id = fb.id where id = aa.id;
  update public.allocations set fraction_id = fa.id where id = ab.id;
  perform set_config('app.audit_reason', '', true);

  select * into p from public.properties where id = cal.property_id;
  key := calendar::text || ':' || week_a || ':' || week_b || ':' || extract(epoch from clock_timestamp())::text;
  if fa.owner_id is not null then
    perform public.emitir_notificacion('calendar_changed', 'week_swap', key || ':a', cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', fa.number,
                         'detail', 'tu semana ' || (week_a + 1) || ' de ' || cal.year || ' se intercambió por la semana ' || (week_b + 1) || ' (' || btrim(reason) || ')'),
      array[fa.owner_id]);
  end if;
  if fb.owner_id is not null then
    perform public.emitir_notificacion('calendar_changed', 'week_swap', key || ':b', cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', fb.number,
                         'detail', 'tu semana ' || (week_b + 1) || ' de ' || cal.year || ' se intercambió por la semana ' || (week_a + 1) || ' (' || btrim(reason) || ')'),
      array[fb.owner_id]);
  end if;
end;
$$;
