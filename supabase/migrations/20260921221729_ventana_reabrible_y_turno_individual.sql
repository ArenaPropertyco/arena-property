-- HU-59 · RF-59.1, RF-59.6, RF-59.9 · HU-12 · RF-12.4 · D-47 — la ventana se
-- reabre, el comprador tardío recibe turno y el Superadmin abre ventanas
-- individuales.
--
-- 1. **Cerrar no es irreversible.** `reopen_selection_window` devuelve la ventana
--    a la fase que le toque por fecha; reconfigurarla también la reabre. Lo único
--    que no vuelve es una ventana vencida sin nuevas fechas.
--
-- 2. **Quien compra después, elige después.** Vendida una fracción con la
--    selección ya abierta, recibe el siguiente turno (D-32: orden de compra) sin
--    que el Administrador tenga que reabrir nada. En la ventana de reubicación,
--    sin turno propio, entra en la fase por orden de llegada.
--
-- 3. **La ventana individual.** `fraction_windows` guarda la franja que el
--    Superadmin abre a una sola fracción para elegir o reubicar fuera del turno
--    general. Las demás reglas —temporada, ocupación, calendario activo (I-08)—
--    no cambian: la ventana individual sustituye al turno, no a las invariantes.

-- ── RF-12.4 · D-47 · el turno del comprador tardío ──────────────────────────
create or replace function private.asegurar_turno_de_seleccion(calendar uuid, fraccion uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.selection_turns (calendar_id, fraction_id, position)
  select calendar, fraccion,
         coalesce((select max(t.position) from public.selection_turns t where t.calendar_id = calendar), -1) + 1
   where not exists (select 1 from public.selection_turns t where t.calendar_id = calendar and t.fraction_id = fraccion);
$$;

comment on function private.asegurar_turno_de_seleccion(uuid, uuid) is
  'HU-12 · RF-12.4 · D-47 · si la fracción no tiene turno en el calendario, recibe el siguiente; si lo tiene, no pasa nada.';

create or replace function private.dar_turno_al_nuevo_titular()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'sold' and new.owner_id is not null and (old.owner_id is null or old.status <> 'sold') then
    perform private.asegurar_turno_de_seleccion(c.id, new.id)
       from public.season_calendars c
      where c.property_id = new.property_id and c.published_at is not null;
  end if;
  return new;
end;
$$;

create trigger fractions_con_turno
  after update of owner_id, status on public.fractions
  for each row execute function private.dar_turno_al_nuevo_titular();

-- ── RF-59.9 · D-47 · la ventana individual ──────────────────────────────────
create table public.fraction_windows (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  year integer not null,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  opens_at timestamptz not null default now(),
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),

  constraint fraction_windows_cierre_posterior check (closes_at > opens_at)
);

comment on table public.fraction_windows is
  'HU-59 · RF-59.9 · D-47 · la franja individual que el Superadmin abre a una fracción para elegir o reubicar fuera del turno general.';

create unique index fraction_windows_abierta_unica on public.fraction_windows (calendar_id, fraction_id) where closed_at is null;
create index fraction_windows_fraccion_idx on public.fraction_windows (fraction_id, year);

alter table public.fraction_windows enable row level security;
alter table public.fraction_windows force row level security;
revoke all on table public.fraction_windows from anon, authenticated, service_role;
grant select on table public.fraction_windows to authenticated, service_role;

-- D-16 · como la ventana general: la ven quien gestiona la propiedad y sus copropietarios.
create policy fraction_windows_lectura on public.fraction_windows for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

create trigger fraction_windows_auditadas
  after insert or update or delete on public.fraction_windows
  for each row execute function public.registrar_auditoria('fraction_window');

create or replace function private.ventana_individual_abierta(calendar uuid, fraccion uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fraction_windows fw
     where fw.calendar_id = calendar and fw.fraction_id = fraccion and fw.closed_at is null
       and now() >= fw.opens_at and now() < fw.closes_at
  );
$$;

create or replace function public.open_fraction_window(calendar uuid, fraction_number integer, hours integer default 48)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  f public.fractions;
  p public.properties;
  window_id uuid;
  until timestamptz;
begin
  if not private.es_superadmin() then
    raise exception 'RF-59.9 · solo el Superadmin abre una ventana individual.';
  end if;
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or cal.published_at is null then
    raise exception 'RF-12.4 · la selección de este calendario todavía no está abierta.';
  end if;
  select * into f from public.fractions where property_id = cal.property_id and number = fraction_number;
  if f.id is null or f.owner_id is null then
    raise exception 'RF-59.9 · la fracción % no tiene titular.', fraction_number;
  end if;
  if hours is null or hours < 1 or hours > 720 then
    raise exception 'RF-59.9 · la ventana individual dura entre 1 y 720 horas.';
  end if;

  until := now() + make_interval(hours => hours);
  perform set_config('app.audit_reason', 'Ventana individual abierta por el Superadmin', true);
  -- Una abierta por fracción y calendario: la nueva reemplaza a la anterior.
  update public.fraction_windows set closed_at = now() where calendar_id = calendar and fraction_id = f.id and closed_at is null;
  insert into public.fraction_windows (calendar_id, property_id, year, fraction_id, closes_at)
  values (calendar, cal.property_id, cal.year, f.id, until)
  returning id into window_id;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el titular se entera de que puede actuar.
  select * into p from public.properties where id = cal.property_id;
  perform public.emitir_notificacion(
    'calendar_changed', 'fraction_window', window_id::text, cal.property_id,
    jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                       'detail', 'el Superadmin te abrió una ventana individual de ' || cal.year || ' hasta el ' || to_char(until at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI')),
    array[f.owner_id]
  );
  return window_id;
end;
$$;

comment on function public.open_fraction_window(uuid, integer, integer) is
  'HU-59 · RF-59.9 · D-47 · el Superadmin abre a una fracción una franja propia, desde ahora y por las horas dadas, para elegir o reubicar fuera del turno general.';

revoke execute on function public.open_fraction_window(uuid, integer, integer) from public, anon;
grant execute on function public.open_fraction_window(uuid, integer, integer) to authenticated, service_role;

create or replace function public.close_fraction_window(window_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'RF-59.9 · solo el Superadmin cierra una ventana individual.';
  end if;
  perform set_config('app.audit_reason', 'Ventana individual cerrada por el Superadmin', true);
  update public.fraction_windows set closed_at = now() where id = window_id and closed_at is null;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.close_fraction_window(uuid) is
  'HU-59 · RF-59.9 · D-47 · cierra una ventana individual antes de su vencimiento; idempotente.';

revoke execute on function public.close_fraction_window(uuid) from public, anon;
grant execute on function public.close_fraction_window(uuid) to authenticated, service_role;

-- ── RF-59.6 · D-47 · reabrir la ventana general ─────────────────────────────
create or replace function public.reopen_selection_window(calendar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.selection_windows;
begin
  if not private.es_superadmin() then
    raise exception 'RF-59.6 · solo el Superadmin reabre la ventana.';
  end if;
  select * into w from public.selection_windows where calendar_id = calendar;
  if w.id is null then
    raise exception 'RF-59.1 · el calendario no tiene ventana de reubicación.';
  end if;
  if w.closed_at is null then
    return;
  end if;
  if w.closes_at <= now() then
    raise exception 'RF-59.6 · la ventana de % ya venció: guárdala con nuevas fechas para reabrirla.', w.year;
  end if;
  perform set_config('app.audit_reason', 'Ventana de reubicación reabierta por el Superadmin', true);
  update public.selection_windows set closed_at = null, updated_at = now() where id = w.id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.reopen_selection_window(uuid) is
  'HU-59 · RF-59.6 · D-47 · el Superadmin reabre una ventana cerrada antes de tiempo; vuelve a la fase que le toque por fecha.';

revoke execute on function public.reopen_selection_window(uuid) from public, anon;
grant execute on function public.reopen_selection_window(uuid) to authenticated, service_role;

-- ── RF-59.1 · D-47 · reconfigurar también reabre ────────────────────────────
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

  -- P-12 · por defecto, el 1 de octubre del año anterior a las 00:00 de Bogotá.
  start := coalesce(opens_at, make_timestamptz(cal.year - 1, 10, 1, 0, 0, 0, 'America/Bogota'));
  -- D-47 · una ventana que ya habría vencido no se guarda: el cierre programado la cerraría en el acto.
  if start + make_interval(days => duration_days) <= now() then
    raise exception 'RF-59.1 · la ventana de % terminaría en el pasado.', cal.year;
  end if;

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
    -- D-47 · reconfigurar es volver a abrir: el cierre anterior se levanta.
    update public.selection_windows
       set opens_at = start, duration_days = configure_selection_window.duration_days, turn_hours = configure_selection_window.turn_hours,
           closes_at = start + make_interval(days => configure_selection_window.duration_days), closed_at = null, updated_at = now()
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
  'HU-59 · RF-59.1, RF-59.2 · D-36, D-47 · el Superadmin fija apertura, duración, turno y orden de la ventana; guardarla de nuevo también la reabre.';

-- ── RF-12.4 · RF-59.9 · elegir: turno del comprador tardío y ventana individual ─
create or replace function public.select_weeks(calendar uuid, fraction uuid, week_indexes integer[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  f public.fractions;
  p public.properties;
  manages boolean;
  needed integer;
  own_position integer;
  blocking integer;
  temporada text;
  chosen integer;
  required integer;
  bad integer[];
  inserted integer;
begin
  select * into cal from public.season_calendars where id = calendar;
  select * into f from public.fractions where id = fraction;
  if cal.id is null or f.id is null or f.property_id <> cal.property_id then
    raise exception 'RF-12.3 · la fracción no pertenece a la propiedad del calendario.';
  end if;
  manages := private.puede_gestionar_propiedad(cal.property_id);
  if not manages and f.owner_id is distinct from (select auth.uid()) then
    raise exception 'RF-12.3 · solo el titular de la fracción (o el Administrador) elige sus semanas.';
  end if;
  if cal.published_at is null then
    raise exception 'RF-12.4 · la selección de % todavía no está abierta.', cal.year;
  end if;
  if exists (select 1 from public.allocations a where a.calendar_id = calendar and a.fraction_id = fraction) then
    raise exception 'CA-12.5 · RF-12.3 · la fracción % ya eligió sus semanas; los cambios son intercambios.', f.number;
  end if;

  needed := private.weeks_per_fraction(cal.criteria);

  -- RF-12.4 · CA-12.5 · el turno solo lo saltan el Administrador (HU-17) y la ventana individual (RF-59.9).
  if not manages then
    -- D-31 · I-08 · sin calendario activo no se participa en la selección.
    if not f.calendar_active then
      raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo: completa el plan de pagos para elegir.', f.number;
    end if;
    -- D-47 · comprada con la selección abierta, la fracción recibe el siguiente turno.
    perform private.asegurar_turno_de_seleccion(calendar, fraction);
    if not private.ventana_individual_abierta(calendar, fraction) then
      select t.position into own_position from public.selection_turns t where t.calendar_id = calendar and t.fraction_id = fraction;
      select f2.number into blocking
        from public.selection_turns t
        join public.fractions f2 on f2.id = t.fraction_id
       where t.calendar_id = calendar and t.position < own_position
         and f2.owner_id is not null and f2.calendar_active
         and (select count(*) from public.allocations a where a.calendar_id = calendar and a.fraction_id = f2.id) < needed
       order by t.position
       limit 1;
      if blocking is not null then
        raise exception 'CA-12.5 · RF-12.4 · todavía es el turno de la fracción %.', blocking;
      end if;
    end if;
  end if;

  -- RF-12.3 · CA-12.2 · CA-12.3 · seis semanas, libres, con la composición exacta.
  if (select count(distinct x) from unnest(week_indexes) as x) <> cardinality(week_indexes) then
    raise exception 'RF-12.3 · hay semanas repetidas en la elección.';
  end if;
  if cardinality(week_indexes) <> needed then
    raise exception 'CA-12.2 · RF-12.3 · hay que elegir exactamente % semanas (elegiste %).', needed, cardinality(week_indexes);
  end if;
  select array_agg(x) into bad from unnest(week_indexes) as x
   where not exists (select 1 from public.calendar_weeks w where w.calendar_id = calendar and w.index = x);
  if bad is not null then
    raise exception 'RF-12.3 · semanas fuera de la rejilla: %.', bad;
  end if;
  select array_agg(w.index order by w.index) into bad
    from public.calendar_weeks w
    join public.allocations a on a.week_id = w.id
   where w.calendar_id = calendar and w.index = any (week_indexes);
  if bad is not null then
    raise exception 'CA-12.3 · RF-12.3 · semanas ya elegidas por otra fracción: %.', bad;
  end if;
  foreach temporada in array array['alta', 'media_alta', 'media', 'baja'] loop
    required := coalesce((cal.criteria ->> temporada)::integer, 0);
    select count(*) into chosen from public.calendar_weeks w
     where w.calendar_id = calendar and w.index = any (week_indexes) and w.season = temporada;
    if chosen <> required then
      raise exception 'CA-12.2 · RF-12.3 · en temporada % hay que elegir % semanas (elegiste %).', temporada, required, chosen;
    end if;
  end loop;

  insert into public.allocations (calendar_id, fraction_id, week_id, selected_by)
  select calendar, fraction, w.id, (select auth.uid())
    from public.calendar_weeks w
   where w.calendar_id = calendar and w.index = any (week_indexes);
  get diagnostics inserted = row_count;

  -- TR-03 · el titular tiene constancia de su elección, una vez por calendario.
  if f.owner_id is not null then
    select * into p from public.properties where id = cal.property_id;
    perform public.emitir_notificacion(
      'calendar_changed', 'week_selection', calendar::text || ':' || fraction::text, cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'detail', 'quedaron elegidas las semanas ' || array_to_string(week_indexes, ', ') || ' de ' || cal.year),
      array[f.owner_id]
    );
  end if;

  return inserted;
end;
$$;

comment on function public.select_weeks(uuid, uuid, integer[]) is
  'HU-12 · RF-12.3, RF-12.4 · D-31, D-32, D-47 · la fracción con calendario activo elige en su turno, o en su ventana individual; el Administrador puede hacerlo por ella.';

-- ── RF-59.3 · RF-59.9 · reubicar: sin turno por orden de llegada, o en la ventana individual ─
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

  -- RF-59.9 · D-47 · la ventana individual sustituye a la general y a su turno.
  if not private.ventana_individual_abierta(calendar, fraction) then
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
      select max(t.closes_at) into last_turn_closes from public.selection_window_turns t where t.window_id = w.id;
      if own_turn.id is null then
        -- D-47 · comprada después de configurar la ventana: entra por orden de llegada.
        if now() < last_turn_closes then
          raise exception 'CA-59.5 · la fracción % no tiene turno en esta ventana; entra por orden de llegada el %.', f.number, last_turn_closes;
        end if;
      else
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
  'HU-59 · RF-59.3…RF-59.5, RF-59.8, RF-59.9 · D-36, D-47 · mueve una semana elegida y sin confirmar a otra libre de la misma temporada, en el turno de la fracción, por orden de llegada o en su ventana individual.';
