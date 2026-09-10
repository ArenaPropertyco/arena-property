-- HU-59 · RF-59.1…RF-59.6, RF-59.8 · D-36 — la ventana anual de reubicación por
-- semanas.
--
-- 1. **La ventana es dato.** `selection_windows` guarda, por calendario, el
--    instante de apertura (P-12), la duración (P-13) y la duración del turno
--    (P-14); `selection_window_turns` materializa la franja de cada fracción. Solo
--    el Superadmin la configura (RF-59.1); el orden se sugiere rotando el de la
--    ventana anterior (RF-59.2), como en la selección.
--
-- 2. **Una semana se mueve, no se regala.** `relocate_week` cambia la fecha de
--    una semana elegida y sin confirmar por otra libre de la misma temporada
--    (CA-59.1, CA-59.3, CA-59.4), solo en el turno de la fracción o en la fase
--    por orden de llegada (CA-59.5), con calendario activo (I-08). El
--    Administrador asignado puede hacerlo por cualquier fracción (HU-17).
--
-- 3. **La ventana se cierra.** A mano (`close_selection_window`) o por `pg_cron`
--    al vencer (`close_expired_selection_windows`); cerrada, nada se mueve y las
--    semanas liberadas quedan libres (CA-59.7).

-- ── La ventana ──────────────────────────────────────────────────────────────
create table public.selection_windows (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  year integer not null,
  opens_at timestamptz not null,
  duration_days integer not null default 16,
  turn_hours integer not null default 48,
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint selection_windows_calendario_unico unique (calendar_id),
  constraint selection_windows_duracion_valida check (duration_days between 1 and 90),
  constraint selection_windows_turno_valido check (turn_hours between 1 and 240),
  constraint selection_windows_cierre_posterior check (closes_at > opens_at)
);

comment on table public.selection_windows is
  'HU-59 · RF-59.1 · D-36 · la ventana anual de reubicación de semanas de un calendario: apertura, duración y turno por fracción.';

create index selection_windows_propiedad_idx on public.selection_windows (property_id, year);

create table public.selection_window_turns (
  id uuid primary key default gen_random_uuid(),
  window_id uuid not null references public.selection_windows (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  position smallint not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint selection_window_turns_posicion_valida check (position >= 0),
  constraint selection_window_turns_fraccion_unica unique (window_id, fraction_id),
  constraint selection_window_turns_posicion_unica unique (window_id, position),
  constraint selection_window_turns_franja_valida check (closes_at > opens_at)
);

comment on table public.selection_window_turns is
  'HU-59 · RF-59.1, RF-59.2 · la franja horaria de cada fracción dentro de la ventana de reubicación.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.selection_windows enable row level security;
alter table public.selection_windows force row level security;
alter table public.selection_window_turns enable row level security;
alter table public.selection_window_turns force row level security;

revoke all on table public.selection_windows, public.selection_window_turns from anon, authenticated, service_role;
grant select on table public.selection_windows, public.selection_window_turns to authenticated, service_role;

-- D-16 · la ventana la ven quien gestiona la propiedad y sus copropietarios.
create policy selection_windows_lectura on public.selection_windows for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));
create policy selection_window_turns_lectura on public.selection_window_turns for select to authenticated
  using (exists (select 1 from public.selection_windows w where w.id = selection_window_turns.window_id
                  and (private.puede_gestionar_propiedad(w.property_id) or private.es_copropietario(w.property_id))));

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger selection_windows_auditadas
  after insert or update or delete on public.selection_windows
  for each row execute function public.registrar_auditoria('selection_window');
create trigger selection_window_turns_auditados
  after insert or update or delete on public.selection_window_turns
  for each row execute function public.registrar_auditoria('selection_window_turn');

-- ── RF-59.2 · el orden sugerido ─────────────────────────────────────────────
create or replace function public.suggested_relocation_order(calendar uuid)
returns integer[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  previous integer[];
  owned integer[];
  rotated integer[];
  n integer;
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not (private.puede_gestionar_propiedad(cal.property_id) or private.es_copropietario(cal.property_id)) then
    raise exception 'CA-13.3 · RF-13.1 · solo quien gestiona o es copropietario consulta el orden de la ventana.';
  end if;

  owned := private.owned_fractions_of(cal.property_id);

  -- El orden de la ventana del año anterior, si la hubo; si no, el de la selección de este año.
  select array_agg(f.number order by t.position) into previous
    from public.selection_window_turns t
    join public.selection_windows w on w.id = t.window_id
    join public.fractions f on f.id = t.fraction_id
   where w.property_id = cal.property_id and w.year = cal.year - 1;
  if previous is null or cardinality(previous) = 0 then
    select array_agg(f.number order by t.position) into previous
      from public.selection_turns t
      join public.fractions f on f.id = t.fraction_id
     where t.calendar_id = calendar;
    if previous is null or cardinality(previous) = 0 then
      return owned;
    end if;
    rotated := previous;
  else
    rotated := previous[2:cardinality(previous)] || previous[1];
  end if;

  -- Solo fracciones que hoy tienen titular; las nuevas se añaden al final.
  rotated := (select coalesce(array_agg(x order by ord), '{}'::integer[])
                from unnest(rotated) with ordinality as u(x, ord) where x = any (owned));
  foreach n in array owned loop
    if not (n = any (rotated)) then
      rotated := rotated || n;
    end if;
  end loop;
  return rotated;
end;
$$;

comment on function public.suggested_relocation_order(uuid) is
  'HU-59 · RF-59.2 · CA-59.6 · el orden sugerido de la ventana: el de la selección el primer año; después, el de la ventana anterior rotado.';

revoke execute on function public.suggested_relocation_order(uuid) from public, anon;
grant execute on function public.suggested_relocation_order(uuid) to authenticated, service_role;

-- ── RF-59.1 · configurar la ventana ─────────────────────────────────────────
create or replace function public.configure_selection_window(
  calendar uuid,
  opens_at timestamptz default null,
  duration_days integer default 16,
  turn_hours integer default 48,
  fraction_order integer[] default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  existing public.selection_windows;
  window_id uuid;
  start timestamptz;
  final_order integer[];
  owned integer[];
  n integer;
  pos integer := 0;
begin
  if not private.es_superadmin() then
    raise exception 'RF-59.1 · solo el Superadmin configura la ventana de reubicación.';
  end if;
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null then
    raise exception 'RF-59.1 · el calendario no existe.';
  end if;
  if duration_days is null or duration_days < 1 or turn_hours is null or turn_hours < 1 then
    raise exception 'RF-59.1 · P-13 · P-14 · la duración y el turno deben ser de al menos un día y una hora.';
  end if;
  select * into existing from public.selection_windows where calendar_id = calendar;
  if existing.closed_at is not null then
    raise exception 'CA-59.7 · la ventana de % ya está cerrada y no se reconfigura.', cal.year;
  end if;

  -- P-12 · por defecto, el 1 de octubre del año anterior a las 00:00 de Bogotá.
  start := coalesce(opens_at, make_timestamptz(cal.year - 1, 10, 1, 0, 0, 0, 'America/Bogota'));

  owned := private.owned_fractions_of(cal.property_id);
  final_order := coalesce(fraction_order, public.suggested_relocation_order(calendar));
  -- RF-59.2 · una permutación exacta de las fracciones con titular.
  if cardinality(final_order) <> cardinality(owned)
     or (select count(distinct x) from unnest(final_order) as x) <> cardinality(final_order)
     or exists (select 1 from unnest(final_order) as x where not (x = any (owned))) then
    raise exception 'RF-59.2 · el orden debe incluir cada fracción con titular exactamente una vez.';
  end if;

  perform set_config('app.audit_reason', 'Ventana de reubicación configurada por el Superadmin', true);
  if existing.id is null then
    insert into public.selection_windows (calendar_id, property_id, year, opens_at, duration_days, turn_hours, closes_at, created_by)
    values (calendar, cal.property_id, cal.year, start, duration_days, turn_hours, start + make_interval(days => duration_days), (select auth.uid()))
    returning id into window_id;
  else
    update public.selection_windows
       set opens_at = start, duration_days = configure_selection_window.duration_days, turn_hours = configure_selection_window.turn_hours,
           closes_at = start + make_interval(days => duration_days), updated_at = now()
     where id = existing.id;
    window_id := existing.id;
    delete from public.selection_window_turns where selection_window_turns.window_id = existing.id;
  end if;

  -- P-14 · cada fracción del orden recibe una franja consecutiva desde la apertura.
  foreach n in array final_order loop
    insert into public.selection_window_turns (window_id, fraction_id, position, opens_at, closes_at)
    select window_id, f.id, pos, start + make_interval(hours => pos * turn_hours), start + make_interval(hours => (pos + 1) * turn_hours)
      from public.fractions f where f.property_id = cal.property_id and f.number = n;
    pos := pos + 1;
  end loop;
  perform set_config('app.audit_reason', '', true);

  return window_id;
end;
$$;

comment on function public.configure_selection_window(uuid, timestamptz, integer, integer, integer[]) is
  'HU-59 · RF-59.1, RF-59.2 · D-36 · el Superadmin fija apertura, duración, turno y orden de la ventana de reubicación de un calendario.';

revoke execute on function public.configure_selection_window(uuid, timestamptz, integer, integer, integer[]) from public, anon;
grant execute on function public.configure_selection_window(uuid, timestamptz, integer, integer, integer[]) to authenticated, service_role;

-- ── RF-59.3 · RF-59.4 · RF-59.5 · RF-59.8 · reubicar una semana ─────────────
create or replace function public.relocate_week(calendar uuid, fraction uuid, from_week integer, to_week integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  cal public.season_calendars;
  p public.properties;
  w public.selection_windows;
  manages boolean;
  own_turn public.selection_window_turns;
  last_turn_closes timestamptz;
  current_fraction integer;
  origen record;
  destino record;
  motivo text;
begin
  select * into f from public.fractions where id = fraction;
  manages := f.id is not null and private.puede_gestionar_propiedad(f.property_id);
  if f.id is null or (not manages and f.owner_id is distinct from (select auth.uid())) then
    raise exception 'RF-59.3 · solo el titular de la fracción (o el Administrador asignado) reubica sus semanas.';
  end if;
  -- CA-59.5 · I-08 · D-31 · sin calendario activo se conserva el turno pero no se opera.
  if not f.calendar_active then
    raise exception 'CA-59.5 · I-08 · la fracción % no tiene el calendario activo.', f.number;
  end if;
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or cal.property_id <> f.property_id or cal.published_at is null then
    raise exception 'RF-12.4 · el calendario no está abierto para esta propiedad.';
  end if;

  select * into w from public.selection_windows where calendar_id = calendar;
  if w.id is null then
    raise exception 'RF-59.1 · el Superadmin todavía no configura la ventana de reubicación de %.', cal.year;
  end if;
  if w.closed_at is not null or now() >= w.closes_at then
    raise exception 'CA-59.7 · la ventana de % está cerrada.', cal.year;
  end if;
  if now() < w.opens_at then
    raise exception 'CA-59.5 · la ventana de % abre el %.', cal.year, w.opens_at;
  end if;

  -- CA-59.5 · RF-59.6 · el turno solo lo salta el Administrador (HU-17).
  if not manages then
    select * into own_turn from public.selection_window_turns t where t.window_id = w.id and t.fraction_id = fraction;
    if own_turn.id is null then
      raise exception 'CA-59.5 · la fracción % no tiene turno en esta ventana.', f.number;
    end if;
    select max(t.closes_at) into last_turn_closes from public.selection_window_turns t where t.window_id = w.id;
    if now() < own_turn.opens_at then
      select fr.number into current_fraction
        from public.selection_window_turns t join public.fractions fr on fr.id = t.fraction_id
       where t.window_id = w.id and now() >= t.opens_at and now() < t.closes_at;
      raise exception 'CA-59.5 · todavía no es el turno de la fracción %: abre el % (ahora es el de la fracción %).', f.number, own_turn.opens_at, current_fraction;
    end if;
    if now() >= own_turn.closes_at and now() < last_turn_closes then
      raise exception 'CA-59.5 · el turno de la fracción % ya pasó; la ventana abre por orden de llegada el %.', f.number, last_turn_closes;
    end if;
  end if;

  -- RF-59.3 · CA-59.4 · solo una semana propia, elegida y sin confirmar.
  select * into origen from private.week_allocation(calendar, from_week);
  if origen.week_id is null or origen.fraction_id is distinct from fraction then
    raise exception 'RF-59.3 · la semana % no es de la fracción %.', from_week, f.number;
  end if;
  if origen.confirmed_at is not null or origen.released_at is not null then
    raise exception 'CA-59.4 · la semana % ya está confirmada o liberada y no se mueve.', from_week;
  end if;
  if origen.starts_on < current_date then
    raise exception 'RF-59.5 · la semana % ya pasó.', from_week;
  end if;

  -- RF-59.5 · CA-59.1 · CA-59.3 · el destino: otra semana libre, futura, de la misma temporada.
  select * into destino from private.week_allocation(calendar, to_week);
  if destino.week_id is null or to_week = from_week then
    raise exception 'RF-59.5 · el destino debe ser otra semana de la rejilla.';
  end if;
  if destino.season <> origen.season then
    raise exception 'CA-59.1 · I-03 · la semana % es % y la % es %: solo se reubica dentro de la misma temporada.', to_week, destino.season, from_week, origen.season;
  end if;
  if destino.starts_on < current_date then
    raise exception 'RF-59.5 · la semana % ya pasó.', to_week;
  end if;
  if destino.allocation_id is not null then
    if destino.released_at is not null then
      raise exception 'CA-59.3 · HU-39 · la semana % está en la bolsa de renta.', to_week;
    end if;
    raise exception 'CA-59.3 · la semana % está elegida por la fracción %.', to_week,
      (select fr.number from public.fractions fr where fr.id = destino.fraction_id);
  end if;
  if exists (select 1 from public.week_blocks b where b.week_id = destino.week_id and b.lifted_at is null) then
    raise exception 'CA-59.3 · RF-15.2 · la semana % está bloqueada por el Administrador.', to_week;
  end if;

  -- CA-59.2 · I-02 · la semana cambia de fecha, no de dueño: el cupo no se toca.
  motivo := 'Semana reubicada en la ventana anual: ' || (from_week + 1) || ' → ' || (to_week + 1);
  perform set_config('app.audit_reason', motivo, true);
  update public.allocations set week_id = destino.week_id where id = origen.allocation_id;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el titular tiene constancia; la clave lleva el instante para no deduplicar dos movimientos.
  if f.owner_id is not null then
    select * into p from public.properties where id = cal.property_id;
    perform public.emitir_notificacion(
      'calendar_changed', 'week_relocation', origen.allocation_id::text || ':' || extract(epoch from clock_timestamp())::text, cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'detail', 'tu semana ' || (from_week + 1) || ' de ' || cal.year || ' pasó a la semana ' || (to_week + 1)
                                   || ' (' || destino.starts_on::text || ')'),
      array[f.owner_id]
    );
  end if;
end;
$$;

comment on function public.relocate_week(uuid, uuid, integer, integer) is
  'HU-59 · RF-59.3…RF-59.5, RF-59.8 · D-36 · mueve una semana elegida y sin confirmar a otra libre de la misma temporada, en el turno de la fracción.';

revoke execute on function public.relocate_week(uuid, uuid, integer, integer) from public, anon;
grant execute on function public.relocate_week(uuid, uuid, integer, integer) to authenticated, service_role;

-- ── RF-59.6 · CA-59.7 · cerrar la ventana ───────────────────────────────────
create or replace function public.close_selection_window(calendar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.selection_windows;
begin
  select * into w from public.selection_windows where calendar_id = calendar;
  if w.id is null or not (private.es_superadmin() or private.puede_gestionar_propiedad(w.property_id)) then
    raise exception 'RF-59.6 · solo el Superadmin o el Administrador asignado cierran la ventana.';
  end if;
  if w.closed_at is not null then
    return;
  end if;
  perform set_config('app.audit_reason', 'Ventana de reubicación cerrada', true);
  update public.selection_windows set closed_at = now(), updated_at = now() where id = w.id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.close_selection_window(uuid) is
  'HU-59 · RF-59.6 · CA-59.7 · cierra la ventana de reubicación antes de su vencimiento; lo no reubicado se queda donde está.';

revoke execute on function public.close_selection_window(uuid) from public, anon;
grant execute on function public.close_selection_window(uuid) to authenticated, service_role;

create or replace function public.close_expired_selection_windows(at timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer := 0;
begin
  perform set_config('app.audit_reason', 'Ventana de reubicación vencida', true);
  update public.selection_windows
     set closed_at = closes_at, updated_at = now()
   where closed_at is null and closes_at <= at;
  get diagnostics closed = row_count;
  perform set_config('app.audit_reason', '', true);
  return closed;
end;
$$;

comment on function public.close_expired_selection_windows(timestamptz) is
  'HU-59 · RF-59.6 · cierra las ventanas cuya duración venció; idempotente, corre cada hora en pg_cron.';

revoke execute on function public.close_expired_selection_windows(timestamptz) from public, anon, authenticated;
grant execute on function public.close_expired_selection_windows(timestamptz) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'close-selection-windows';
    perform cron.schedule('close-selection-windows', '5 * * * *', $job$ select public.close_expired_selection_windows() $job$);
  end if;
end;
$$;
