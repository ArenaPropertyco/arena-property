-- HU-12 · RF-12.3…RF-12.6 · D-32 (sustituye a D-13 y D-27) — selección de
-- semanas por turnos e intercambios.
--
-- Qué cambia respecto al reparto automático:
--
-- 1. **Nadie asigna: cada Propietario elige.** `select_weeks` guarda las 6 semanas
--    que la fracción elige —1 alta, 1 media-alta, 1 media y 3 bajas por defecto—
--    entre las que siguen libres. La composición y el turno se comprueban aquí,
--    sea quien sea el cliente (RF-12.3, RF-12.4).
--
-- 2. **El turno es dato.** `selection_turns` guarda el orden del año. El primer
--    año sale del orden de compra (`payment_plans.closed_at`); los siguientes, del
--    orden que fije el Administrador al abrir el calendario, con una sugerencia
--    rotada (RF-12.5). Una fracción sin titular no tiene turno ni bloquea.
--
-- 3. **Los intercambios son del Administrador, con motivo.** `swap_weeks` cambia
--    una semana de una fracción por otra de la misma temporada (D-28) y sin
--    estadías encima; el motivo viaja a la auditoría y ambos titulares reciben
--    aviso (TR-03). El Propietario puede solicitarlo con `request_week_swap` y el
--    Administrador lo resuelve con `resolve_swap_request` (RF-12.6).
--
-- 4. **`publicar_calendario` desaparece.** Abrir el calendario ya no persiste un
--    reparto: valida la rejilla (RF-12.7), fija el orden y deja elegir.

-- ── Orden de turnos ─────────────────────────────────────────────────────────
create table public.selection_turns (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  position smallint not null,
  created_at timestamptz not null default now(),

  constraint selection_turns_posicion_valida check (position >= 0),
  constraint selection_turns_fraccion_unica unique (calendar_id, fraction_id),
  constraint selection_turns_posicion_unica unique (calendar_id, position)
);

comment on table public.selection_turns is
  'HU-12 · RF-12.4, RF-12.5 · D-32 · en qué orden eligen semanas las fracciones de un calendario.';

-- ── La elección deja rastro de quién y cuándo ───────────────────────────────
alter table public.allocations
  add column selected_by uuid references auth.users (id),
  add column selected_at timestamptz not null default now();

-- ── Solicitudes de intercambio del Propietario ──────────────────────────────
create table public.week_swap_requests (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  requester_fraction_id uuid not null references public.fractions (id) on delete cascade,
  offered_week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  target_fraction_id uuid not null references public.fractions (id) on delete cascade,
  requested_week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  message text,
  status text not null default 'open',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  resolution_reason text,

  constraint week_swap_requests_estado_valido check (status in ('open', 'approved', 'rejected')),
  constraint week_swap_requests_fracciones_distintas check (requester_fraction_id <> target_fraction_id),
  constraint week_swap_requests_rechazo_con_motivo check (status <> 'rejected' or btrim(coalesce(resolution_reason, '')) <> '')
);

comment on table public.week_swap_requests is
  'HU-12 · RF-12.6 · D-32 · un Propietario ofrece una semana suya por una de otra fracción; el Administrador la aprueba o rechaza con motivo.';

create index week_swap_requests_calendario_idx on public.week_swap_requests (calendar_id) where status = 'open';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.selection_turns enable row level security;
alter table public.selection_turns force row level security;
alter table public.week_swap_requests enable row level security;
alter table public.week_swap_requests force row level security;

revoke all on table public.selection_turns, public.week_swap_requests from anon, authenticated, service_role;
grant select on table public.selection_turns, public.week_swap_requests to authenticated, service_role;

create policy selection_turns_lectura on public.selection_turns for select to authenticated
  using (exists (select 1 from public.season_calendars c where c.id = selection_turns.calendar_id
                  and (private.puede_gestionar_propiedad(c.property_id) or private.es_copropietario(c.property_id))));

-- La solicitud la ven quien la hizo, el titular de la otra fracción y quien gestiona.
create policy week_swap_requests_lectura on public.week_swap_requests for select to authenticated
  using (private.puede_gestionar_propiedad(property_id)
         or exists (select 1 from public.fractions f
                     where f.id in (week_swap_requests.requester_fraction_id, week_swap_requests.target_fraction_id)
                       and f.owner_id = (select auth.uid())));

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
insert into public.audit_reason_required (action, source) values
  ('allocation.actualizada', 'HU-12')
on conflict (action) do nothing;

create trigger allocations_auditadas
  after insert or update or delete on public.allocations
  for each row execute function public.registrar_auditoria('allocation');
create trigger selection_turns_auditados
  after insert or update or delete on public.selection_turns
  for each row execute function public.registrar_auditoria('selection_turn');
create trigger week_swap_requests_auditadas
  after insert or update or delete on public.week_swap_requests
  for each row execute function public.registrar_auditoria('week_swap_request');

-- ── El reparto automático desaparece ────────────────────────────────────────
drop function if exists public.publicar_calendario(uuid, jsonb, boolean);

-- ── Ayudas privadas ─────────────────────────────────────────────────────────
/** Semanas que elige cada fracción según el criterio del calendario (P-04). */
create or replace function private.weeks_per_fraction(criteria jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce((criteria ->> 'alta')::integer, 0) + coalesce((criteria ->> 'media_alta')::integer, 0)
       + coalesce((criteria ->> 'media')::integer, 0) + coalesce((criteria ->> 'baja')::integer, 0);
$$;

/** RF-12.4 · CA-12.4 · el orden de compra: de la más antigua a la más reciente; sin titular, fuera. */
create or replace function private.purchase_order_of(propiedad uuid)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(f.number order by compra.closed_at, f.number), '{}'::integer[])
    from public.fractions f
    join lateral (
      select min(p.closed_at) as closed_at
        from public.payment_plans p
       where p.fraction_id = f.id and p.owner_id = f.owner_id and p.voided_at is null
    ) as compra on true
   where f.property_id = propiedad
     and f.owner_id is not null;
$$;

/** Las fracciones con titular de la propiedad, por número. */
create or replace function private.owned_fractions_of(propiedad uuid)
returns integer[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(f.number order by f.number), '{}'::integer[])
    from public.fractions f where f.property_id = propiedad and f.owner_id is not null;
$$;

revoke execute on function private.weeks_per_fraction(jsonb), private.purchase_order_of(uuid), private.owned_fractions_of(uuid) from public, anon;
grant execute on function private.weeks_per_fraction(jsonb), private.purchase_order_of(uuid), private.owned_fractions_of(uuid) to authenticated, service_role;

-- ── RF-12.5 · CA-12.6 · la sugerencia de orden ──────────────────────────────
create or replace function public.suggested_selection_order(calendar uuid)
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
    raise exception 'CA-13.3 · RF-13.1 · solo quien gestiona o es copropietario consulta el orden de selección.';
  end if;

  owned := private.owned_fractions_of(cal.property_id);

  -- El orden del año anterior, si lo hubo; la primera pasa al final.
  select array_agg(f.number order by t.position) into previous
    from public.selection_turns t
    join public.season_calendars c on c.id = t.calendar_id
    join public.fractions f on f.id = t.fraction_id
   where c.property_id = cal.property_id and c.year = cal.year - 1;

  if previous is null or cardinality(previous) = 0 then
    return private.purchase_order_of(cal.property_id);
  end if;

  rotated := previous[2:cardinality(previous)] || previous[1];
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

comment on function public.suggested_selection_order(uuid) is
  'HU-12 · RF-12.5 · CA-12.6 · el orden sugerido: el de compra el primer año; después, el anterior rotado.';

revoke execute on function public.suggested_selection_order(uuid) from public, anon;
grant execute on function public.suggested_selection_order(uuid) to authenticated, service_role;

-- ── RF-12.4 · RF-12.5 · RF-12.7 · abrir la selección ────────────────────────
create or replace function public.open_calendar_selection(calendar uuid, fraction_order integer[] default null)
returns integer[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  temporada text;
  needed integer;
  found_weeks integer;
  final_order integer[];
  owned integer[];
  n integer;
  pos integer := 0;
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not private.puede_gestionar_propiedad(cal.property_id) then
    raise exception 'CA-11.3 · solo el Administrador asignado abre la selección de este calendario.';
  end if;

  -- RF-12.7 · CA-12.7 · la rejilla tiene que dar para las 8 fracciones.
  foreach temporada in array array['alta', 'media_alta', 'media', 'baja'] loop
    needed := coalesce((cal.criteria ->> temporada)::integer, 0) * 8;
    select count(*) into found_weeks from public.calendar_weeks w where w.calendar_id = calendar and w.season = temporada;
    if found_weeks < needed then
      raise exception 'RF-12.7 · CA-12.7 · la rejilla no permite cumplir el criterio: % semanas de % (hacen falta %).', found_weeks, temporada, needed;
    end if;
  end loop;

  -- RF-12.5 · el orden no se cambia con semanas ya elegidas: se resuelve con intercambios.
  if exists (select 1 from public.allocations a where a.calendar_id = calendar) then
    if fraction_order is not null then
      raise exception 'RF-12.5 · el orden de selección no se cambia cuando ya hay semanas elegidas.';
    end if;
    return (select array_agg(f.number order by t.position) from public.selection_turns t join public.fractions f on f.id = t.fraction_id where t.calendar_id = calendar);
  end if;

  owned := private.owned_fractions_of(cal.property_id);
  final_order := coalesce(fraction_order, public.suggested_selection_order(calendar));

  -- CA-12.6 · una permutación exacta de las fracciones con titular.
  if cardinality(final_order) <> cardinality(owned)
     or (select count(distinct x) from unnest(final_order) as x) <> cardinality(final_order)
     or exists (select 1 from unnest(final_order) as x where not (x = any (owned))) then
    raise exception 'CA-12.6 · RF-12.5 · el orden debe incluir cada fracción con titular exactamente una vez.';
  end if;

  delete from public.selection_turns where calendar_id = calendar;
  foreach n in array final_order loop
    insert into public.selection_turns (calendar_id, fraction_id, position)
    select calendar, f.id, pos from public.fractions f where f.property_id = cal.property_id and f.number = n;
    pos := pos + 1;
  end loop;

  update public.season_calendars
     set published_at = coalesce(published_at, now()), updated_at = now()
   where id = calendar;

  return final_order;
end;
$$;

comment on function public.open_calendar_selection(uuid, integer[]) is
  'HU-12 · RF-12.4, RF-12.5, RF-12.7 · valida la rejilla, fija el orden de turnos (o el sugerido) y abre la selección.';

revoke execute on function public.open_calendar_selection(uuid, integer[]) from public, anon;
grant execute on function public.open_calendar_selection(uuid, integer[]) to authenticated, service_role;

-- ── RF-12.3 · RF-12.4 · elegir las semanas ──────────────────────────────────
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

  -- RF-12.4 · CA-12.5 · el turno solo se salta el Administrador (HU-17).
  if not manages then
    select t.position into own_position from public.selection_turns t where t.calendar_id = calendar and t.fraction_id = fraction;
    if own_position is null then
      raise exception 'CA-12.5 · RF-12.4 · la fracción % no tiene turno en este calendario.', f.number;
    end if;
    select f2.number into blocking
      from public.selection_turns t
      join public.fractions f2 on f2.id = t.fraction_id
     where t.calendar_id = calendar and t.position < own_position and f2.owner_id is not null
       and (select count(*) from public.allocations a where a.calendar_id = calendar and a.fraction_id = f2.id) < needed
     order by t.position
     limit 1;
    if blocking is not null then
      raise exception 'CA-12.5 · RF-12.4 · todavía es el turno de la fracción %.', blocking;
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
  'HU-12 · RF-12.3, RF-12.4 · D-32 · la fracción elige sus semanas (índices de rejilla) en su turno; el Administrador puede hacerlo por ella.';

revoke execute on function public.select_weeks(uuid, uuid, integer[]) from public, anon;
grant execute on function public.select_weeks(uuid, uuid, integer[]) to authenticated, service_role;

-- ── RF-12.6 · CA-12.10 · intercambio por el Administrador ───────────────────
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
  -- RF-12.9 · una semana con estadías no se mueve: primero se resuelven (HU-17).
  if exists (
    select 1 from public.stays s
     where s.calendar_id = calendar and s.status = 'confirmed'
       and (s.nights && daterange(wa.starts_on, wa.ends_on) or s.nights && daterange(wb.starts_on, wb.ends_on))
  ) then
    raise exception 'CA-12.10 · RF-12.9 · hay estadías declaradas sobre alguna de las semanas.';
  end if;

  perform set_config('app.audit_reason', btrim(reason), true);
  update public.allocations set fraction_id = fb.id where id = aa.id;
  update public.allocations set fraction_id = fa.id where id = ab.id;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · ambos titulares se enteran; la clave lleva el instante para no deduplicar dos intercambios distintos.
  select * into p from public.properties where id = cal.property_id;
  key := calendar::text || ':' || week_a || ':' || week_b || ':' || extract(epoch from clock_timestamp())::text;
  if fa.owner_id is not null then
    perform public.emitir_notificacion('calendar_changed', 'week_swap', key || ':a', cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', fa.number,
                         'detail', 'tu semana ' || week_a || ' de ' || cal.year || ' se intercambió por la semana ' || week_b || ' (' || btrim(reason) || ')'),
      array[fa.owner_id]);
  end if;
  if fb.owner_id is not null then
    perform public.emitir_notificacion('calendar_changed', 'week_swap', key || ':b', cal.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', fb.number,
                         'detail', 'tu semana ' || week_b || ' de ' || cal.year || ' se intercambió por la semana ' || week_a || ' (' || btrim(reason) || ')'),
      array[fb.owner_id]);
  end if;
end;
$$;

comment on function public.swap_weeks(uuid, integer, integer, integer, integer, text) is
  'HU-12 · RF-12.6 · CA-12.10 · el Administrador intercambia dos semanas de la misma temporada entre fracciones, con motivo y aviso.';

revoke execute on function public.swap_weeks(uuid, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.swap_weeks(uuid, integer, integer, integer, integer, text) to authenticated, service_role;

-- ── RF-12.6 · CA-12.11 · solicitud del Propietario ──────────────────────────
create or replace function public.request_week_swap(
  calendar uuid,
  fraction uuid,
  offered_week integer,
  target_fraction integer,
  requested_week integer,
  message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  f public.fractions;
  tf public.fractions;
  wo public.calendar_weeks;
  wr public.calendar_weeks;
  request uuid;
begin
  select * into cal from public.season_calendars where id = calendar;
  select * into f from public.fractions where id = fraction;
  if cal.id is null or f.id is null or f.property_id <> cal.property_id or f.owner_id is distinct from (select auth.uid()) then
    raise exception 'CA-12.11 · RF-12.6 · solo el titular de la fracción solicita intercambios.';
  end if;
  select * into tf from public.fractions where property_id = cal.property_id and number = target_fraction;
  if tf.id is null or tf.id = f.id then
    raise exception 'CA-12.11 · RF-12.6 · la otra fracción debe existir y ser distinta.';
  end if;
  select * into wo from public.calendar_weeks where calendar_id = calendar and index = offered_week;
  select * into wr from public.calendar_weeks where calendar_id = calendar and index = requested_week;
  if wo.id is null or not exists (select 1 from public.allocations a where a.calendar_id = calendar and a.week_id = wo.id and a.fraction_id = f.id) then
    raise exception 'CA-12.11 · RF-12.6 · solo se ofrece una semana propia.';
  end if;
  if wr.id is null or not exists (select 1 from public.allocations a where a.calendar_id = calendar and a.week_id = wr.id and a.fraction_id = tf.id) then
    raise exception 'CA-12.11 · RF-12.6 · la semana pedida debe ser de la fracción %.', target_fraction;
  end if;
  if wo.season <> wr.season then
    raise exception 'CA-12.11 · RF-12.6 · solo se intercambian semanas de la misma temporada.';
  end if;

  insert into public.week_swap_requests (calendar_id, property_id, requester_fraction_id, offered_week_id, target_fraction_id, requested_week_id, message, created_by)
  values (calendar, cal.property_id, f.id, wo.id, tf.id, wr.id, nullif(btrim(coalesce(message, '')), ''), f.owner_id)
  returning id into request;

  return request;
end;
$$;

comment on function public.request_week_swap(uuid, uuid, integer, integer, integer, text) is
  'HU-12 · RF-12.6 · CA-12.11 · el titular ofrece una semana suya por una de otra fracción, de la misma temporada.';

revoke execute on function public.request_week_swap(uuid, uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.request_week_swap(uuid, uuid, integer, integer, integer, text) to authenticated, service_role;

create or replace function public.resolve_swap_request(request uuid, approve boolean, reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.week_swap_requests;
  cal public.season_calendars;
  p public.properties;
  requester public.fractions;
  target public.fractions;
  wo public.calendar_weeks;
  wr public.calendar_weeks;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
begin
  select * into r from public.week_swap_requests where id = request;
  if r.id is null or not private.puede_gestionar_propiedad(r.property_id) then
    raise exception 'CA-17.4 · solo el Administrador asignado resuelve solicitudes de intercambio.';
  end if;
  if r.status <> 'open' then
    raise exception 'CA-12.11 · la solicitud ya fue resuelta.';
  end if;
  if not approve and motivo is null then
    raise exception 'CA-12.11 · RF-12.6 · rechazar una solicitud exige un motivo.';
  end if;

  select * into cal from public.season_calendars where id = r.calendar_id;
  select * into requester from public.fractions where id = r.requester_fraction_id;
  select * into target from public.fractions where id = r.target_fraction_id;
  select * into wo from public.calendar_weeks where id = r.offered_week_id;
  select * into wr from public.calendar_weeks where id = r.requested_week_id;

  if approve then
    perform public.swap_weeks(r.calendar_id, requester.number, wo.index, target.number, wr.index,
      coalesce(motivo, 'Solicitud de intercambio aprobada'));
  end if;

  perform set_config('app.audit_reason', coalesce(motivo, 'Solicitud de intercambio aprobada'), true);
  update public.week_swap_requests
     set status = case when approve then 'approved' else 'rejected' end,
         resolved_by = (select auth.uid()), resolved_at = now(), resolution_reason = motivo
   where id = request;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el solicitante se entera de la decisión.
  select * into p from public.properties where id = r.property_id;
  if requester.owner_id is not null then
    perform public.emitir_notificacion('calendar_changed', 'swap_request', request::text || ':' || case when approve then 'approved' else 'rejected' end, r.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', requester.number,
                         'detail', case when approve
                                        then 'tu solicitud de intercambio de la semana ' || wo.index || ' por la ' || wr.index || ' fue aprobada'
                                        else 'tu solicitud de intercambio de la semana ' || wo.index || ' por la ' || wr.index || ' fue rechazada: ' || motivo end),
      array[requester.owner_id]);
  end if;
end;
$$;

comment on function public.resolve_swap_request(uuid, boolean, text) is
  'HU-12 · RF-12.6 · CA-12.11 · el Administrador aprueba (aplica el intercambio) o rechaza con motivo; el solicitante recibe aviso.';

revoke execute on function public.resolve_swap_request(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_swap_request(uuid, boolean, text) to authenticated, service_role;
