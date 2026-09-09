-- HU-12 · RF-12.2, RF-12.3, RF-12.8, RF-12.9 — el calendario persistido.
--
-- Cuatro decisiones que conviene leer antes que el código:
--
-- 1. **El motor es TypeScript; la base guarda su resultado (DT-07).** La rejilla
--    clasificada y el reparto llegan ya calculados; aquí se validan las
--    invariantes que no pueden depender del cliente: bloques pico solo en alta y
--    una vez, una semana para una sola fracción, las 8 fracciones de la propiedad.
--
-- 2. **Nadie escribe las tablas del calendario a mano.** `authenticated` solo lee;
--    guardar y publicar son funciones SECURITY DEFINER que exigen administrar la
--    propiedad. Las estadías sí las escribe el titular (HU-14 les pondrá reglas).
--
-- 3. **Una noche pertenece a lo sumo a una ocupación (I-04, DT-02).** `stays`
--    guarda las noches como `daterange` con una restricción de exclusión por
--    propiedad: el motor de la base hace imposible el solapamiento.
--
-- 4. **La liberación a 60 días es idempotente (RF-12.8, DT-09).** `released_nights`
--    es única por calendario y noche; la tarea diaria de `pg_cron` inserta con
--    `on conflict do nothing` y avisa al Propietario una vez por fracción y pasada.

create extension if not exists btree_gist with schema extensions;

-- ── Calendario por propiedad y año ──────────────────────────────────────────
create table public.season_calendars (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  year integer not null,
  -- P-07 · año base de la rotación: el de la primera venta.
  base_year integer not null,
  -- P-04 · semanas por fracción y temporada; 1/1/1/3 por defecto (42 noches).
  criteria jsonb not null default '{"alta": 1, "media_alta": 1, "media": 1, "baja": 3}'::jsonb,
  -- P-02 · horas de entrada y salida.
  check_in time not null default '15:00',
  check_out time not null default '11:00',
  published_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint season_calendars_anio_razonable check (year between 2020 and 2100),
  constraint season_calendars_base_razonable check (base_year between 2020 and year),
  constraint season_calendars_unico_por_anio unique (property_id, year)
);

comment on table public.season_calendars is
  'HU-12 · el calendario de una propiedad para un año: parámetros vigentes (schedule.md §2) y si está publicado.';

-- ── Rejilla clasificada (RF-12.2) ───────────────────────────────────────────
create table public.calendar_weeks (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  index smallint not null,
  starts_on date not null,
  ends_on date not null,
  season text not null,
  peak_block text,
  created_at timestamptz not null default now(),

  constraint calendar_weeks_temporada_valida check (season in ('alta', 'media_alta', 'media', 'baja')),
  constraint calendar_weeks_bloque_valido check (peak_block is null or peak_block in ('christmas', 'new_year', 'holy_week')),
  constraint calendar_weeks_bloque_en_alta check (peak_block is null or season = 'alta'),
  constraint calendar_weeks_siete_noches check (ends_on - starts_on = 7),
  constraint calendar_weeks_unica unique (calendar_id, index)
);

create unique index calendar_weeks_bloque_unico on public.calendar_weeks (calendar_id, peak_block) where peak_block is not null;

comment on table public.calendar_weeks is
  'HU-12 · RF-12.2 · rejilla sábado→sábado del año, con temporada y bloque pico por semana.';

-- ── Reparto publicado (RF-12.3) ─────────────────────────────────────────────
create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  kind text not null default 'regular',
  created_at timestamptz not null default now(),

  constraint allocations_tipo_valido check (kind in ('regular', 'wildcard')),
  -- CA-12.3 · una semana, una fracción.
  constraint allocations_semana_unica unique (calendar_id, week_id)
);

comment on table public.allocations is
  'HU-12 · RF-12.3 · qué semana de la rejilla recibe cada fracción. Se reemplaza al republicar.';

create index allocations_fraccion_idx on public.allocations (fraction_id);

-- ── Estadías (mínimo de HU-14, necesario para liberar y reconfigurar) ───────
create table public.stays (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  -- D-11 · noches como rango [entrada, salida): la noche de salida no cuenta.
  nights daterange not null,
  status text not null default 'confirmed',
  origin text not null default 'owner',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),

  constraint stays_estado_valido check (status in ('confirmed', 'cancelled')),
  constraint stays_origen_valido check (origin in ('owner', 'relocation', 'wildcard')),
  constraint stays_rango_no_vacio check (not isempty(nights)),
  -- I-04 · DT-02 · dos ocupaciones confirmadas no comparten noche en la misma propiedad.
  constraint stays_sin_solape exclude using gist (property_id with =, nights with &&) where (status = 'confirmed')
);

comment on table public.stays is
  'HU-14 · estadías declaradas por el titular, como rango de noches. Aquí nace con lo que HU-12 necesita; HU-14 añade sus reglas.';

create index stays_calendario_idx on public.stays (calendar_id, fraction_id);

-- ── Bolsa de renta (RF-12.8) ────────────────────────────────────────────────
create table public.released_nights (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  night date not null,
  reason text not null default 'expired',
  released_at timestamptz not null default now(),

  constraint released_nights_motivo_valido check (reason in ('expired', 'cancelled', 'inactive')),
  constraint released_nights_unica unique (calendar_id, night)
);

comment on table public.released_nights is
  'HU-12 · RF-12.8 · noches que pasaron a la bolsa de renta a terceros (HU-39). Únicas por calendario y noche.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.season_calendars enable row level security;
alter table public.season_calendars force row level security;
alter table public.calendar_weeks enable row level security;
alter table public.calendar_weeks force row level security;
alter table public.allocations enable row level security;
alter table public.allocations force row level security;
alter table public.stays enable row level security;
alter table public.stays force row level security;
alter table public.released_nights enable row level security;
alter table public.released_nights force row level security;

revoke all on table public.season_calendars, public.calendar_weeks, public.allocations, public.stays, public.released_nights
  from anon, authenticated, service_role;
grant select on table public.season_calendars, public.calendar_weeks, public.allocations, public.released_nights to authenticated, service_role;
grant select, insert, update on table public.stays to authenticated, service_role;

-- D-16 · un copropietario ve el calendario completo de su propiedad, no solo su fracción.
create or replace function private.es_copropietario(propiedad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.fractions
     where property_id = propiedad and owner_id = (select auth.uid())
  );
$$;

revoke execute on function private.es_copropietario(uuid) from public, anon;
grant execute on function private.es_copropietario(uuid) to authenticated, service_role;

create policy season_calendars_lectura on public.season_calendars for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

create policy calendar_weeks_lectura on public.calendar_weeks for select to authenticated
  using (exists (select 1 from public.season_calendars c where c.id = calendar_weeks.calendar_id
                  and (private.puede_gestionar_propiedad(c.property_id) or private.es_copropietario(c.property_id))));

create policy allocations_lectura on public.allocations for select to authenticated
  using (exists (select 1 from public.season_calendars c where c.id = allocations.calendar_id
                  and (private.puede_gestionar_propiedad(c.property_id) or private.es_copropietario(c.property_id))));

create policy released_nights_lectura on public.released_nights for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

create policy stays_lectura on public.stays for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

-- El titular declara sobre su propia fracción; el resto de reglas llega con HU-14.
create policy stays_creacion on public.stays for insert to authenticated
  with check (exists (select 1 from public.fractions f where f.id = fraction_id and f.owner_id = (select auth.uid())));

create policy stays_edicion on public.stays for update to authenticated
  using (exists (select 1 from public.fractions f where f.id = fraction_id and f.owner_id = (select auth.uid()))
         or private.puede_gestionar_propiedad(property_id))
  with check (exists (select 1 from public.fractions f where f.id = fraction_id and f.owner_id = (select auth.uid()))
              or private.puede_gestionar_propiedad(property_id));

-- ── RF-12.2 · guardar la rejilla clasificada ────────────────────────────────
create or replace function public.guardar_calendario(
  propiedad uuid,
  anio integer,
  anio_base integer,
  criterio jsonb,
  semanas jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  calendario uuid;
  semana jsonb;
  bloques text[] := '{}';
  indices integer[] := '{}';
begin
  if not private.puede_gestionar_propiedad(propiedad) then
    raise exception 'CA-11.3 · solo el Administrador asignado configura el calendario de esta propiedad.';
  end if;
  if jsonb_typeof(semanas) <> 'array' or jsonb_array_length(semanas) < 51 then
    raise exception 'RF-12.1 · la rejilla debe traer las 51 o 52 semanas completas del año.';
  end if;

  -- Las invariantes de la clasificación se comprueban antes de tocar nada (P0001).
  for semana in select * from jsonb_array_elements(semanas) loop
    if (semana ->> 'season') not in ('alta', 'media_alta', 'media', 'baja') then
      raise exception 'RF-12.2 · temporada desconocida: %.', semana ->> 'season';
    end if;
    if semana ->> 'peak_block' is not null then
      if (semana ->> 'peak_block') not in ('christmas', 'new_year', 'holy_week') then
        raise exception 'RF-12.2 · bloque pico desconocido: %.', semana ->> 'peak_block';
      end if;
      if (semana ->> 'season') <> 'alta' then
        raise exception 'RF-12.2 · un bloque pico solo cabe en una semana de temporada alta.';
      end if;
      if (semana ->> 'peak_block') = any (bloques) then
        raise exception 'RF-12.2 · el bloque pico % está marcado dos veces.', semana ->> 'peak_block';
      end if;
      bloques := bloques || (semana ->> 'peak_block');
    end if;
    indices := indices || (semana ->> 'index')::integer;
  end loop;

  insert into public.season_calendars (property_id, year, base_year, criteria, created_by)
  values (propiedad, anio, anio_base, coalesce(criterio, '{"alta": 1, "media_alta": 1, "media": 1, "baja": 3}'::jsonb), (select auth.uid()))
  on conflict (property_id, year) do update
    set base_year = excluded.base_year,
        criteria = excluded.criteria,
        updated_at = now()
  returning id into calendario;

  -- La rejilla se actualiza en sitio: las semanas ya publicadas conservan su
  -- identificador y con él sus asignaciones.
  insert into public.calendar_weeks (calendar_id, index, starts_on, ends_on, season, peak_block)
  select calendario, (s ->> 'index')::smallint, (s ->> 'starts_on')::date, (s ->> 'ends_on')::date, s ->> 'season', s ->> 'peak_block'
    from jsonb_array_elements(semanas) as s
  on conflict (calendar_id, index) do update
    set starts_on = excluded.starts_on,
        ends_on = excluded.ends_on,
        season = excluded.season,
        peak_block = excluded.peak_block;

  delete from public.calendar_weeks
   where calendar_id = calendario and not (index = any (indices));

  return calendario;
end;
$$;

revoke execute on function public.guardar_calendario(uuid, integer, integer, jsonb, jsonb) from public, anon;
grant execute on function public.guardar_calendario(uuid, integer, integer, jsonb, jsonb) to authenticated, service_role;

-- ── RF-12.3 · RF-12.9 · publicar el reparto ─────────────────────────────────
create or replace function public.publicar_calendario(
  calendario uuid,
  reparto jsonb,
  confirmar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  fila jsonb;
  idx integer;
  usadas integer[] := '{}';
  fracciones_vistas integer[] := '{}';
  conflictos jsonb;
begin
  select * into cal from public.season_calendars where id = calendario;
  if not found or not private.puede_gestionar_propiedad(cal.property_id) then
    raise exception 'CA-11.3 · solo el Administrador asignado publica el calendario de esta propiedad.';
  end if;

  -- RF-12.9 · con estadías vigentes, reconfigurar exige confirmación explícita.
  if not confirmar and exists (select 1 from public.stays where calendar_id = calendario and status = 'confirmed') then
    raise exception 'RF-12.9 · el calendario tiene estadías: la reconfiguración exige confirmación.';
  end if;

  -- Validación completa antes de tocar nada.
  for fila in select * from jsonb_array_elements(reparto) loop
    if (fila ->> 'fraction_number')::integer = any (fracciones_vistas) then
      raise exception 'RF-12.3 · la fracción % aparece dos veces en el reparto.', fila ->> 'fraction_number';
    end if;
    fracciones_vistas := fracciones_vistas || (fila ->> 'fraction_number')::integer;
    if not exists (select 1 from public.fractions f where f.property_id = cal.property_id and f.number = (fila ->> 'fraction_number')::integer) then
      raise exception 'RF-12.3 · la propiedad no tiene la fracción %.', fila ->> 'fraction_number';
    end if;
    for idx in select value::integer from jsonb_array_elements_text(fila -> 'weeks') loop
      if idx = any (usadas) then
        raise exception 'CA-12.3 · la semana % está asignada a dos fracciones.', idx;
      end if;
      if not exists (select 1 from public.calendar_weeks w where w.calendar_id = calendario and w.index = idx) then
        raise exception 'RF-12.3 · la semana % no existe en la rejilla.', idx;
      end if;
      usadas := usadas || idx;
    end loop;
  end loop;

  delete from public.allocations where calendar_id = calendario;

  -- Alias distinto de la variable `fila` del bloque: PL/pgSQL no sabría cuál es.
  insert into public.allocations (calendar_id, fraction_id, week_id)
  select calendario, f.id, w.id
    from jsonb_array_elements(reparto) as r
    join public.fractions f on f.property_id = cal.property_id and f.number = (r ->> 'fraction_number')::integer
    join jsonb_array_elements_text(r -> 'weeks') as s on true
    join public.calendar_weeks w on w.calendar_id = calendario and w.index = s.value::integer;

  update public.season_calendars
     set published_at = coalesce(published_at, now()), updated_at = now()
   where id = calendario;

  -- RF-12.9 · las estadías no se borran: las que quedaron fuera de su fracción se listan.
  select coalesce(jsonb_agg(jsonb_build_object(
           'stay_id', e.id,
           'fraction_number', f.number,
           'nights', e.nights::text
         )), '[]'::jsonb)
    into conflictos
    from public.stays e
    join public.fractions f on f.id = e.fraction_id
   where e.calendar_id = calendario
     and e.status = 'confirmed'
     and exists (
       select 1 from generate_series(lower(e.nights), upper(e.nights) - 1, interval '1 day') as n
        where not exists (
          select 1 from public.allocations a
            join public.calendar_weeks w on w.id = a.week_id
           where a.calendar_id = calendario
             and a.fraction_id = e.fraction_id
             and n::date >= w.starts_on and n::date < w.ends_on
        )
     );

  return jsonb_build_object('conflicts', conflictos);
end;
$$;

revoke execute on function public.publicar_calendario(uuid, jsonb, boolean) from public, anon;
grant execute on function public.publicar_calendario(uuid, jsonb, boolean) to authenticated, service_role;

-- ── RF-12.8 · liberación a 60 días, idempotente ─────────────────────────────
create or replace function public.liberar_noches_vencidas(hoy date default current_date, plazo integer default 60)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  liberadas integer := 0;
  aviso record;
begin
  with vencidas as (
    select a.calendar_id, a.fraction_id, c.property_id, n::date as night
      from public.allocations a
      join public.calendar_weeks w on w.id = a.week_id
      join public.season_calendars c on c.id = a.calendar_id
      cross join lateral generate_series(w.starts_on, w.ends_on - 1, interval '1 day') as n
     where c.published_at is not null
       and n::date >= hoy
       and n::date <= hoy + plazo
       and not exists (
         select 1 from public.stays e
          where e.fraction_id = a.fraction_id and e.status = 'confirmed' and e.nights @> n::date
       )
  ),
  insertadas as (
    insert into public.released_nights (calendar_id, fraction_id, property_id, night, reason)
    select calendar_id, fraction_id, property_id, night, 'expired' from vencidas
    on conflict (calendar_id, night) do nothing
    returning fraction_id, property_id, calendar_id
  )
  select count(*) into liberadas from insertadas;

  -- TR-03 · un aviso por fracción con titular y por pasada del día; idempotente
  -- por la clave del evento, así que repetir la tarea no repite el aviso.
  for aviso in
    select r.calendar_id, r.fraction_id, r.property_id, f.number, f.owner_id, p.name, count(*) as noches
      from public.released_nights r
      join public.fractions f on f.id = r.fraction_id
      join public.properties p on p.id = r.property_id
     where r.released_at >= now() - interval '1 minute'
       and f.owner_id is not null
     group by r.calendar_id, r.fraction_id, r.property_id, f.number, f.owner_id, p.name
  loop
    perform public.emitir_notificacion(
      'calendar_changed', 'released_nights',
      aviso.calendar_id::text || ':' || aviso.fraction_id::text || ':' || hoy::text,
      aviso.property_id,
      jsonb_build_object('property_name', aviso.name, 'fraction_number', aviso.number,
                         'detail', aviso.noches || ' noches sin estadía pasaron a la bolsa de renta'),
      array[aviso.owner_id]
    );
  end loop;

  return liberadas;
end;
$$;

comment on function public.liberar_noches_vencidas(date, integer) is
  'HU-12 · RF-12.8 · D-15 · pasa a la bolsa de renta las noches asignadas sin estadía a `plazo` días; idempotente y con aviso al titular (TR-03).';

revoke execute on function public.liberar_noches_vencidas(date, integer) from public, anon, authenticated;
grant execute on function public.liberar_noches_vencidas(date, integer) to service_role;

-- DT-09 · la tarea diaria vive junto al dato. 08:15 UTC son las 03:15 en Bogotá.
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'liberar-noches-vencidas';
    perform cron.schedule('liberar-noches-vencidas', '15 8 * * *', $job$ select public.liberar_noches_vencidas() $job$);
  end if;
end;
$$;

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger season_calendars_auditados
  after insert or update or delete on public.season_calendars
  for each row execute function public.registrar_auditoria('season_calendar');
create trigger stays_auditadas
  after insert or update or delete on public.stays
  for each row execute function public.registrar_auditoria('stay');
create trigger released_nights_auditadas
  after insert or delete on public.released_nights
  for each row execute function public.registrar_auditoria('released_night');
