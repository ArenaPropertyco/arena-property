-- HU-12 · RF-12.4 · D-31, D-32 — el turno de selección exige calendario activo.
--
-- Sin interruptor (el plan de pagos no está completo) el Propietario no elige sus
-- semanas ni bloquea a los siguientes: su fracción se salta en el orden, igual que
-- una fracción sin titular. El Administrador puede seguir eligiendo por ella.

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
    -- D-31 · I-08 · sin calendario activo no se participa en la selección.
    if not f.calendar_active then
      raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo: completa el plan de pagos para elegir.', f.number;
    end if;
    select t.position into own_position from public.selection_turns t where t.calendar_id = calendar and t.fraction_id = fraction;
    if own_position is null then
      raise exception 'CA-12.5 · RF-12.4 · la fracción % no tiene turno en este calendario.', f.number;
    end if;
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
  'HU-12 · RF-12.3, RF-12.4 · D-31, D-32 · la fracción con calendario activo elige sus semanas en su turno; el Administrador puede hacerlo por ella.';
