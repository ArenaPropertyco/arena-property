-- HU-59 · RF-59.1, RF-59.10 · D-48 — la ventana ya creada se ajusta y se elimina.
--
-- 1. **Ajustar no reescribe el orden.** Hasta aquí, guardar una ventana sin pasar
--    orden lo reemplazaba por la sugerencia: cambiar la hora de apertura borraba
--    en silencio el orden que el Superadmin había decidido. Ahora, si la ventana
--    existe y no se pide otro orden, se conserva el suyo, normalizado contra las
--    fracciones que hoy tienen titular (la vendida después entra al final, D-47).
--
-- 2. **Quien tenía turno se entera.** Ajustar la apertura, la duración, el turno o
--    el orden mueve franjas ajenas. Cada titular cuya franja cambió recibe la
--    suya nueva (TR-03); si nada cambió, nadie recibe nada.
--
-- 3. **Eliminar la ventana.** `delete_selection_window` la borra en cualquier fase
--    —programada, abierta o cerrada—. Lo que ya se reubicó **no se deshace**: la
--    semana cambió de fecha y ahí se queda (principio 9). Sin ventana, nadie
--    reubica hasta que se configure otra.

-- ── RF-59.2 · el orden, contra las fracciones que hoy tienen titular ────────
create or replace function private.normalizar_orden(propiedad uuid, base integer[])
returns integer[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owned integer[];
  resultado integer[];
  n integer;
begin
  owned := private.owned_fractions_of(propiedad);
  -- Solo fracciones que hoy tienen titular, en el orden dado; las nuevas, al final.
  resultado := (select coalesce(array_agg(x order by ord), '{}'::integer[])
                  from unnest(coalesce(base, '{}'::integer[])) with ordinality as u(x, ord)
                 where x = any (owned));
  foreach n in array owned loop
    if not (n = any (resultado)) then
      resultado := resultado || n;
    end if;
  end loop;
  return resultado;
end;
$$;

comment on function private.normalizar_orden(uuid, integer[]) is
  'HU-59 · RF-59.2 · D-47, D-48 · depura un orden de turnos: quita las fracciones sin titular y añade al final las que lo ganaron.';

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
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not (private.puede_gestionar_propiedad(cal.property_id) or private.es_copropietario(cal.property_id)) then
    raise exception 'CA-13.3 · RF-13.1 · solo quien gestiona o es copropietario consulta el orden de la ventana.';
  end if;

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
      return private.owned_fractions_of(cal.property_id);
    end if;
  else
    -- RF-59.2 · la primera de la ventana anterior pasa al final.
    previous := previous[2:cardinality(previous)] || previous[1];
  end if;

  return private.normalizar_orden(cal.property_id, previous);
end;
$$;

comment on function public.suggested_relocation_order(uuid) is
  'HU-59 · RF-59.2 · CA-59.6 · el orden sugerido de la ventana: el de la selección el primer año; después, el de la ventana anterior rotado.';

-- ── RF-59.1 · D-48 · configurar y ajustar la ventana ────────────────────────
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
  p public.properties;
  existing public.selection_windows;
  -- No se llama `window_id`: coincidiría con la columna de selection_window_turns.
  ventana uuid;
  start timestamptz;
  final_order integer[];
  previos jsonb;
  cambio record;
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

  if existing.id is null then
    final_order := coalesce(fraction_order, public.suggested_relocation_order(calendar));
  else
    -- D-48 · ajustar una ventana ya creada no le cambia el orden si no se pide otro.
    if fraction_order is null then
      select array_agg(f.number order by t.position) into final_order
        from public.selection_window_turns t
        join public.fractions f on f.id = t.fraction_id
       where t.window_id = existing.id;
    else
      final_order := fraction_order;
    end if;
    -- D-47 · la fracción vendida después de crear la ventana entra al final.
    final_order := private.normalizar_orden(cal.property_id, final_order);
    -- TR-03 · las franjas de antes, para avisar solo a quien de verdad se le mueve.
    select coalesce(jsonb_object_agg(f.number::text, jsonb_build_array(t.opens_at, t.closes_at)), '{}'::jsonb)
      into previos
      from public.selection_window_turns t
      join public.fractions f on f.id = t.fraction_id
     where t.window_id = existing.id;
  end if;

  -- RF-59.2 · una permutación exacta de las fracciones con titular.
  if cardinality(final_order) <> cardinality(private.owned_fractions_of(cal.property_id))
     or (select count(distinct x) from unnest(final_order) as x) <> cardinality(final_order)
     or exists (select 1 from unnest(final_order) as x where not (x = any (private.owned_fractions_of(cal.property_id)))) then
    raise exception 'RF-59.2 · el orden debe incluir cada fracción con titular exactamente una vez.';
  end if;

  perform set_config('app.audit_reason',
    case when existing.id is null
      then 'Ventana de reubicación configurada por el Superadmin'
      else 'Ventana de reubicación ajustada por el Superadmin' end, true);
  if existing.id is null then
    insert into public.selection_windows (calendar_id, property_id, year, opens_at, duration_days, turn_hours, closes_at, created_by)
    values (calendar, cal.property_id, cal.year, start, duration_days, turn_hours, start + make_interval(days => duration_days), (select auth.uid()))
    returning id into ventana;
  else
    -- D-47 · reconfigurar es volver a abrir: el cierre anterior se levanta.
    update public.selection_windows
       set opens_at = start, duration_days = configure_selection_window.duration_days, turn_hours = configure_selection_window.turn_hours,
           closes_at = start + make_interval(days => configure_selection_window.duration_days), closed_at = null, updated_at = now()
     where id = existing.id;
    ventana := existing.id;
    delete from public.selection_window_turns where selection_window_turns.window_id = existing.id;
  end if;

  -- P-14 · cada fracción del orden recibe una franja consecutiva desde la apertura.
  foreach n in array final_order loop
    insert into public.selection_window_turns (window_id, fraction_id, position, opens_at, closes_at)
    select ventana, f.id, pos, start + make_interval(hours => pos * turn_hours), start + make_interval(hours => (pos + 1) * turn_hours)
      from public.fractions f where f.property_id = cal.property_id and f.number = n;
    pos := pos + 1;
  end loop;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · D-48 · a cada titular cuya franja cambió, su franja nueva; si nada cambió, nada.
  if previos is not null then
    select * into p from public.properties where id = cal.property_id;
    for cambio in
      select f.number, f.owner_id, t.opens_at, t.closes_at
        from public.selection_window_turns t
        join public.fractions f on f.id = t.fraction_id
       where t.window_id = ventana and f.owner_id is not null
         and previos -> f.number::text is distinct from jsonb_build_array(t.opens_at, t.closes_at)
    loop
      perform public.emitir_notificacion(
        'calendar_changed', 'selection_window_adjusted',
        ventana::text || ':' || cambio.number::text || ':' || extract(epoch from clock_timestamp())::text,
        cal.property_id,
        jsonb_build_object('property_name', p.name, 'fraction_number', cambio.number,
                           'detail', 'el Superadmin ajustó la ventana de reubicación de ' || cal.year
                                     || '; tu turno va del ' || to_char(cambio.opens_at at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI')
                                     || ' al ' || to_char(cambio.closes_at at time zone 'America/Bogota', 'DD/MM/YYYY HH24:MI')),
        array[cambio.owner_id]
      );
    end loop;
  end if;

  return ventana;
end;
$$;

comment on function public.configure_selection_window(uuid, timestamptz, integer, integer, integer[]) is
  'HU-59 · RF-59.1, RF-59.2 · D-36, D-47, D-48 · el Superadmin fija o ajusta apertura, duración, turno y orden; guardarla de nuevo la reabre y conserva su orden si no se pide otro.';

-- ── RF-59.10 · D-48 · eliminar la ventana ──────────────────────────────────
create or replace function public.delete_selection_window(calendar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.selection_windows;
  cal public.season_calendars;
  p public.properties;
  aviso record;
begin
  if not private.es_superadmin() then
    raise exception 'RF-59.10 · solo el Superadmin elimina la ventana de reubicación.';
  end if;
  select * into w from public.selection_windows where calendar_id = calendar;
  if w.id is null then
    raise exception 'RF-59.10 · el calendario no tiene ventana de reubicación.';
  end if;
  select * into cal from public.season_calendars where id = calendar;
  select * into p from public.properties where id = w.property_id;

  -- TR-03 · se avisa antes de borrar: al eliminar la ventana, sus turnos se van con ella.
  for aviso in
    select f.number, f.owner_id
      from public.selection_window_turns t
      join public.fractions f on f.id = t.fraction_id
     where t.window_id = w.id and f.owner_id is not null
  loop
    perform public.emitir_notificacion(
      'calendar_changed', 'selection_window_deleted', w.id::text || ':' || aviso.number::text, w.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', aviso.number,
                         'detail', 'el Superadmin eliminó la ventana de reubicación de ' || cal.year
                                   || '; las semanas ya reubicadas se quedan donde están'),
      array[aviso.owner_id]
    );
  end loop;

  -- CA-59.11 · principio 9 · lo ya reubicado no se deshace: la semana cambió de fecha y ahí sigue.
  perform set_config('app.audit_reason', 'Ventana de reubicación eliminada por el Superadmin', true);
  delete from public.selection_windows where id = w.id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.delete_selection_window(uuid) is
  'HU-59 · RF-59.10 · D-48 · el Superadmin elimina la ventana en cualquier fase; lo ya reubicado se queda donde está.';

revoke execute on function public.delete_selection_window(uuid) from public, anon;
grant execute on function public.delete_selection_window(uuid) to authenticated, service_role;
