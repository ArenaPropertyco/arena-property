-- HU-14 · RF-14.1…RF-14.10 · HU-15 · RF-15.1…RF-15.5 · HU-13 · RF-13.3 —
-- estadías por noches y bloqueos del Administrador.
--
-- Cuatro decisiones que conviene leer antes que el código:
--
-- 1. **Las reglas viven en un disparador de `stays` (RF-14.10).** Calendario
--    activo (I-08), noches propias (RF-14.3), sin bloqueos ni bolsa de renta
--    (RF-14.4, RF-15.2), mínimo por temporada (RF-14.2), cupo por temporada
--    (RF-14.1, RF-14.1c) y plazo de cancelación (RF-14.6) se comprueban en la
--    base sea cual sea la vía de escritura. `declarar_estadia`, `cancelar_estadia`
--    y `liberar_noches` son las puertas del Propietario: añaden la advertencia de
--    huérfanas (RF-14.9) y la notificación (TR-03). El solapamiento entre
--    estadías no lo comprueba el disparador: es de la exclusión GIST (CA-14.9).
--
-- 2. **La fecha de activación es dato (RF-14.1c).** `fractions.calendar_activated_at`
--    se fija sola cuando el interruptor pasa a activo y se borra al apagarse; nadie
--    la edita a mano (misma guarda que `calendar_active`, D-31).
--
-- 3. **Un bloqueo no borra estadías (RF-15.4).** Pisa la estadía, la deja intacta y
--    escribe el conflicto con las noches exactas en `calendar_conflicts`, que HU-17
--    resolverá. Por eso los bloqueos solo se excluyen entre sí.
--
-- 4. **El motivo del bloqueo viaja a la auditoría (RF-15.5).** `crear_bloqueo` y
--    `levantar_bloqueo` fijan `app.audit_reason` antes de escribir; la acción está
--    en `audit_reason_required`, así que sin motivo no hay registro ni operación.

-- ── RF-14.1c · fecha de activación del calendario ───────────────────────────
alter table public.fractions add column calendar_activated_at timestamptz;

comment on column public.fractions.calendar_activated_at is
  'HU-14 · RF-14.1c · D-31 · cuándo se activó el derecho de uso; las noches asignadas anteriores no cuentan ese año. Se deriva, no se edita.';

create or replace function private.validar_transicion_de_fraccion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  manda_superadmin boolean := private.es_superadmin();
  hay_sesion boolean := (select auth.uid()) is not null;
  derivando boolean := coalesce(current_setting('app.derivando_calendario', true), '') = 'true';
begin
  if new.number <> old.number or new.property_id <> old.property_id then
    raise exception 'Ni el número ni la propiedad de una fracción se editan.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'available' and new.status = 'reserved')
      or (old.status = 'reserved' and new.status in ('available', 'sold'))
      or (old.status = 'sold' and new.status = 'available' and manda_superadmin)
    ) then
      raise exception 'Transición de fracción inválida: % → %.', old.status, new.status;
    end if;
  end if;

  if new.owner_id is distinct from old.owner_id
     and old.status = 'sold' and new.status = 'sold'
     and hay_sesion and not manda_superadmin then
    raise exception 'Solo el Superadmin traspasa el titular de una fracción vendida.';
  end if;

  -- D-31 · DT-04 · el derecho de uso lo deriva el plan de pagos (HU-58). Con sesión
  -- solo pasa cuando `private.derivar_plan()` lo está escribiendo.
  if new.calendar_active is distinct from old.calendar_active and hay_sesion and not derivando then
    raise exception 'El interruptor de calendario se deriva del plan de pagos (HU-58); no se marca a mano.';
  end if;

  -- RF-14.1c · la fecha de activación acompaña al interruptor y tampoco se edita.
  if new.calendar_activated_at is distinct from old.calendar_activated_at and hay_sesion and not derivando then
    raise exception 'La fecha de activación del calendario se deriva del plan de pagos (HU-58); no se marca a mano.';
  end if;
  if new.calendar_active and not old.calendar_active and new.calendar_activated_at is null then
    new.calendar_activated_at := now();
  elsif not new.calendar_active and old.calendar_active then
    new.calendar_activated_at := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ── Estadías: lo que HU-14 añade a la tabla de HU-12 ────────────────────────
alter table public.stays
  add column cancelled_at timestamptz,
  add column updated_at timestamptz not null default now();

alter table public.released_nights drop constraint released_nights_motivo_valido;
alter table public.released_nights add constraint released_nights_motivo_valido
  check (reason in ('expired', 'cancelled', 'voluntary', 'inactive'));

-- ── RF-15.1 · bloqueos ──────────────────────────────────────────────────────
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  -- D-11 · noches como rango [entrada, salida).
  nights daterange not null,
  reason text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id),
  lift_reason text,

  constraint blocks_motivo_obligatorio check (btrim(reason) <> ''),
  constraint blocks_rango_no_vacio check (not isempty(nights)),
  constraint blocks_levantado_con_motivo check (lifted_at is null or btrim(coalesce(lift_reason, '')) <> ''),
  -- Dos bloqueos vigentes no comparten noche; con estadías no se excluyen (RF-15.4).
  constraint blocks_sin_solape exclude using gist (property_id with =, nights with &&) where (lifted_at is null)
);

comment on table public.blocks is
  'HU-15 · RF-15.1 · noches bloqueadas por el Administrador con motivo obligatorio. Levantado con `lifted_at`, nunca borrado.';

create index blocks_propiedad_idx on public.blocks (property_id) where lifted_at is null;

-- ── RF-15.4 · conflictos para la bandeja de HU-17 ───────────────────────────
create table public.calendar_conflicts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  block_id uuid references public.blocks (id) on delete cascade,
  stay_id uuid not null references public.stays (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id) on delete cascade,
  -- Exactamente las noches de la estadía que el bloqueo pisa.
  nights daterange not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,

  constraint calendar_conflicts_estado_valido check (status in ('open', 'resolved')),
  constraint calendar_conflicts_rango_no_vacio check (not isempty(nights)),
  constraint calendar_conflicts_unico unique (block_id, stay_id)
);

comment on table public.calendar_conflicts is
  'HU-15 · RF-15.4 · CA-15.3 · estadía pisada por un bloqueo, con las noches exactas; HU-17 la reasigna.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.blocks enable row level security;
alter table public.blocks force row level security;
alter table public.calendar_conflicts enable row level security;
alter table public.calendar_conflicts force row level security;

revoke all on table public.blocks, public.calendar_conflicts from anon, authenticated, service_role;
grant select, insert, update on table public.blocks to authenticated, service_role;
grant select on table public.calendar_conflicts to authenticated, service_role;

-- RF-15.3 · D-16 · los bloqueos se ven con su motivo por todos los copropietarios.
create policy blocks_lectura on public.blocks for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

-- CA-15.4 · solo el Administrador asignado (o el Superadmin) bloquea y levanta.
create policy blocks_creacion on public.blocks for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy blocks_edicion on public.blocks for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

create policy calendar_conflicts_lectura on public.calendar_conflicts for select to authenticated
  using (private.puede_gestionar_propiedad(property_id)
         or exists (select 1 from public.fractions f where f.id = calendar_conflicts.fraction_id and f.owner_id = (select auth.uid())));

-- RF-15.5 · TR-01 · RF-A.4 · crear y levantar bloqueos exige motivo.
insert into public.audit_reason_required (action, source) values
  ('block.creada', 'HU-15'),
  ('block.actualizada', 'HU-15')
on conflict (action) do nothing;

create trigger blocks_auditados
  after insert or update or delete on public.blocks
  for each row execute function public.registrar_auditoria('block');
create trigger calendar_conflicts_auditados
  after insert or update or delete on public.calendar_conflicts
  for each row execute function public.registrar_auditoria('calendar_conflict');

-- ── Ayudas privadas ─────────────────────────────────────────────────────────
/** Las noches de un rango, una por fila. */
create or replace function private.noches_de(rango daterange)
returns setof date
language sql
immutable
set search_path = ''
as $$
  select n::date from generate_series(lower(rango), upper(rango) - 1, interval '1 day') as n;
$$;

/** La temporada de una noche según la rejilla del calendario; null fuera de ella. */
create or replace function private.temporada_de(calendario uuid, noche date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select w.season from public.calendar_weeks w
   where w.calendar_id = calendario and noche >= w.starts_on and noche < w.ends_on
   limit 1;
$$;

/** Orden de exigencia de las temporadas: la alta manda (RF-14.2). */
create or replace function private.rango_de_temporada(temporada text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(array['alta', 'media_alta', 'media', 'baja'], temporada);
$$;

/** D-29 · P-08 · noches mínimas por temporada. */
create or replace function private.minimo_de_estadia(temporada text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case temporada when 'alta' then 3 when 'media_alta' then 2 else 1 end;
$$;

revoke execute on function private.noches_de(daterange), private.temporada_de(uuid, date), private.rango_de_temporada(text), private.minimo_de_estadia(text) from public, anon;
grant execute on function private.noches_de(daterange), private.temporada_de(uuid, date), private.rango_de_temporada(text), private.minimo_de_estadia(text) to authenticated, service_role;

-- ── RF-14.10 · las reglas, en la base, sea cual sea la vía ──────────────────
create or replace function private.validar_estadia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  cal public.season_calendars;
  temporada_max text;
  minimo integer;
  noches integer;
  temporada text;
  activado date;
  disponibles integer;
  consumidas integer;
  pedidas integer;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    if new.fraction_id <> old.fraction_id or new.property_id <> old.property_id or new.calendar_id <> old.calendar_id then
      raise exception 'RF-14.10 · una estadía no cambia de fracción, propiedad ni calendario.';
    end if;
    if old.status = 'cancelled' then
      raise exception 'RF-14.6 · una estadía cancelada no se reactiva.';
    end if;
  end if;

  if new.status = 'cancelled' and tg_op = 'INSERT' then
    raise exception 'RF-14.1 · una estadía nace confirmada.';
  end if;

  select * into f from public.fractions where id = new.fraction_id;
  select * into cal from public.season_calendars where id = new.calendar_id;
  if f.id is null or cal.id is null or f.property_id <> new.property_id or cal.property_id <> new.property_id then
    raise exception 'RF-14.10 · la estadía no cuadra con su fracción y su calendario.';
  end if;

  -- CA-14.0 · I-08 · D-31 · sin calendario activo no se declara, cancela ni libera.
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción no tiene el calendario activo.';
  end if;

  -- RF-14.6 · D-14 · P-10 · cancelar, total o parcialmente, hasta 30 días antes.
  if tg_op = 'UPDATE' and (new.status = 'cancelled' or new.nights <> old.nights) then
    if lower(old.nights) - current_date < 30 then
      raise exception 'CA-14.5 · RF-14.6 · la cancelación se cierra 30 días antes del inicio.';
    end if;
    if new.status = 'cancelled' then
      new.cancelled_at := coalesce(new.cancelled_at, now());
      return new;
    end if;
    if not (old.nights @> new.nights) then
      raise exception 'RF-14.6 · el remanente de una cancelación parcial es un tramo de la propia estadía.';
    end if;
  elsif tg_op = 'UPDATE' then
    return new;
  end if;

  -- Desde aquí: una estadía confirmada nueva o recortada.
  if cal.published_at is null then
    raise exception 'RF-12.3 · el calendario del año no está publicado.';
  end if;
  if tg_op = 'INSERT' and lower(new.nights) < current_date then
    raise exception 'RF-14.1 · no se declaran noches pasadas.';
  end if;

  -- RF-14.3 · las noches son de la fracción (reparto); reubicación y comodín traen sus reglas (HU-59, HU-60).
  if new.origin = 'owner' and exists (
    select 1 from private.noches_de(new.nights) as n
     where not exists (
       select 1 from public.allocations a
         join public.calendar_weeks w on w.id = a.week_id
        where a.calendar_id = new.calendar_id and a.fraction_id = new.fraction_id
          and n >= w.starts_on and n < w.ends_on
     )
  ) then
    raise exception 'CA-14.4 · RF-14.3 · hay noches que no pertenecen a la fracción.';
  end if;

  -- RF-15.2 · CA-15.2 · bloqueos del Administrador.
  if exists (select 1 from public.blocks b where b.property_id = new.property_id and b.lifted_at is null and b.nights && new.nights) then
    raise exception 'CA-15.2 · RF-15.2 · hay noches bloqueadas por el Administrador.';
  end if;

  -- RF-14.4 · bolsa de renta a terceros.
  if exists (select 1 from public.released_nights r where r.calendar_id = new.calendar_id and r.night <@ new.nights) then
    raise exception 'CA-14.4 · RF-14.4 · hay noches que ya están en la bolsa de renta.';
  end if;

  -- RF-14.2 · D-29 · el mínimo lo dicta la temporada más alta que la estadía toca.
  select w.season into temporada_max
    from public.calendar_weeks w
   where w.calendar_id = new.calendar_id and w.starts_on < upper(new.nights) and w.ends_on > lower(new.nights)
   order by private.rango_de_temporada(w.season)
   limit 1;
  noches := upper(new.nights) - lower(new.nights);
  minimo := private.minimo_de_estadia(temporada_max);
  if noches < minimo then
    raise exception 'CA-14.1 · RF-14.2 · en temporada % la estadía mínima es de % noches.', temporada_max, minimo;
  end if;

  -- RF-14.1 · RF-14.1c · CA-14.3 · cada noche descuenta del cupo de su temporada, con
  -- tope en el criterio (I-02) y contando solo lo asignado desde la activación.
  activado := coalesce(f.calendar_activated_at::date, '-infinity'::date);
  for temporada in
    select distinct w.season from public.calendar_weeks w
     where w.calendar_id = new.calendar_id and w.starts_on < upper(new.nights) and w.ends_on > lower(new.nights)
  loop
    select least((cal.criteria ->> temporada)::integer * 7, count(*))::integer into disponibles
      from public.allocations a
      join public.calendar_weeks w on w.id = a.week_id
      cross join private.noches_de(daterange(w.starts_on, w.ends_on)) as n
     where a.calendar_id = new.calendar_id and a.fraction_id = new.fraction_id and w.season = temporada
       and n >= activado
       and not exists (select 1 from public.released_nights r where r.calendar_id = new.calendar_id and r.night = n)
       and not exists (select 1 from public.blocks b where b.property_id = new.property_id and b.lifted_at is null and b.nights @> n);

    select count(*)::integer into consumidas
      from public.stays s
      cross join private.noches_de(s.nights) as n
     where s.calendar_id = new.calendar_id and s.fraction_id = new.fraction_id and s.status = 'confirmed' and s.id <> new.id
       and private.temporada_de(new.calendar_id, n) = temporada;

    select count(*)::integer into pedidas
      from private.noches_de(new.nights) as n
     where private.temporada_de(new.calendar_id, n) = temporada;

    if consumidas + pedidas > disponibles then
      raise exception 'CA-14.3 · RF-14.1 · el cupo de temporada % está agotado (% de % noches).', temporada, consumidas, disponibles;
    end if;
  end loop;

  return new;
end;
$$;

create trigger stays_validadas
  before insert or update on public.stays
  for each row execute function private.validar_estadia();

-- ── RF-14.1 · RF-14.9 · declarar ────────────────────────────────────────────
/** Una noche asignada a la fracción que nadie ocupa: ni estadía, ni bloqueo, ni bolsa de renta. */
create or replace function private.noche_libre_de(calendario uuid, fraccion uuid, noche date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allocations a
      join public.calendar_weeks w on w.id = a.week_id
     where a.calendar_id = calendario and a.fraction_id = fraccion and noche >= w.starts_on and noche < w.ends_on
  )
  and not exists (select 1 from public.stays s where s.calendar_id = calendario and s.status = 'confirmed' and s.nights @> noche)
  and not exists (select 1 from public.released_nights r where r.calendar_id = calendario and r.night = noche)
  and not exists (
    select 1 from public.blocks b join public.season_calendars c on c.id = calendario
     where b.property_id = c.property_id and b.lifted_at is null and b.nights @> noche
  );
$$;

revoke execute on function private.noche_libre_de(uuid, uuid, date) from public, anon;
grant execute on function private.noche_libre_de(uuid, uuid, date) to authenticated, service_role;

create or replace function public.declarar_estadia(fraccion uuid, entrada date, salida date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  p public.properties;
  cal public.season_calendars;
  estadia uuid;
  huerfanas date[] := '{}';
  sueltas date[];
  noche date;
begin
  select * into f from public.fractions where id = fraccion;
  if f.id is null or f.owner_id is distinct from (select auth.uid()) then
    raise exception 'CA-14.0 · RF-14.1 · solo el titular de la fracción declara sus estadías.';
  end if;
  if entrada is null or salida is null or salida <= entrada then
    raise exception 'RF-14.1 · una estadía es de una o más noches consecutivas.';
  end if;
  select * into cal from public.season_calendars
   where property_id = f.property_id and year = extract(year from entrada)::integer;
  if cal.id is null or cal.published_at is null then
    raise exception 'RF-12.3 · el calendario de % no está publicado.', extract(year from entrada)::integer;
  end if;

  insert into public.stays (calendar_id, fraction_id, property_id, nights, created_by)
  values (cal.id, fraccion, f.property_id, daterange(entrada, salida), f.owner_id)
  returning id into estadia;

  -- RF-14.9 · CA-14.8 · una o dos noches propias sueltas a cada lado: se advierte, no se bloquea.
  sueltas := '{}';
  noche := entrada - 1;
  while private.noche_libre_de(cal.id, fraccion, noche) loop
    sueltas := noche || sueltas;
    noche := noche - 1;
  end loop;
  if coalesce(array_length(sueltas, 1), 0) between 1 and 2 then
    huerfanas := huerfanas || sueltas;
  end if;

  sueltas := '{}';
  noche := salida;
  while private.noche_libre_de(cal.id, fraccion, noche) loop
    sueltas := sueltas || noche;
    noche := noche + 1;
  end loop;
  if coalesce(array_length(sueltas, 1), 0) between 1 and 2 then
    huerfanas := huerfanas || sueltas;
  end if;

  -- TR-03 · HU-16 · RF-16.1 · CA-16.3 · la reserva propia confirmada, una sola vez.
  select * into p from public.properties where id = f.property_id;
  perform public.emitir_notificacion(
    'stay_confirmed', 'stay', estadia::text, f.property_id,
    jsonb_build_object('property_name', p.name, 'fraction_number', f.number, 'check_in', entrada::text, 'check_out', salida::text, 'stay_id', estadia),
    array[f.owner_id]
  );

  return jsonb_build_object(
    'id', estadia,
    'orphan_nights', (select coalesce(jsonb_agg(to_jsonb(h::text) order by h), '[]'::jsonb) from unnest(huerfanas) as h)
  );
end;
$$;

comment on function public.declarar_estadia(uuid, date, date) is
  'HU-14 · RF-14.1, RF-14.9 · el titular declara una estadía [entrada, salida); devuelve el id y las noches huérfanas que deja. Las reglas las aplica el disparador.';

revoke execute on function public.declarar_estadia(uuid, date, date) from public, anon;
grant execute on function public.declarar_estadia(uuid, date, date) to authenticated, service_role;

-- ── RF-14.6 · cancelar, total o parcialmente ────────────────────────────────
create or replace function public.cancelar_estadia(estadia uuid, conservar_desde date default null, conservar_hasta date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stays;
  f public.fractions;
  p public.properties;
  remanente daterange;
  liberadas integer;
begin
  select * into s from public.stays where id = estadia;
  select * into f from public.fractions where id = s.fraction_id;
  if s.id is null or f.owner_id is distinct from (select auth.uid()) then
    raise exception 'RF-14.6 · solo el titular de la fracción cancela sus estadías.';
  end if;
  if s.status <> 'confirmed' then
    raise exception 'RF-14.6 · la estadía ya estaba cancelada.';
  end if;

  if conservar_desde is null then
    update public.stays set status = 'cancelled' where id = estadia;
    remanente := null;
  else
    remanente := daterange(conservar_desde, coalesce(conservar_hasta, conservar_desde + 1));
    if isempty(remanente) or not (s.nights @> remanente) then
      raise exception 'RF-14.6 · el remanente de una cancelación parcial es un tramo de la propia estadía.';
    end if;
    update public.stays set nights = remanente where id = estadia;
  end if;

  -- D-14 · las noches canceladas pasan a la bolsa de renta a terceros.
  with canceladas as (
    select n from private.noches_de(s.nights) as n
     where remanente is null or not (remanente @> n)
  ),
  insertadas as (
    insert into public.released_nights (calendar_id, fraction_id, property_id, night, reason)
    select s.calendar_id, s.fraction_id, s.property_id, n, 'cancelled' from canceladas
    on conflict (calendar_id, night) do nothing
    returning night
  )
  select count(*)::integer into liberadas from insertadas;

  -- TR-03 · el titular recibe constancia del cambio, una vez por cancelación.
  select * into p from public.properties where id = s.property_id;
  perform public.emitir_notificacion(
    'calendar_changed', 'stay_cancellation', estadia::text || ':' || coalesce(remanente::text, 'all'), s.property_id,
    jsonb_build_object('property_name', p.name, 'fraction_number', f.number, 'stay_id', estadia,
                       'detail', case when remanente is null
                                      then 'la estadía ' || s.nights::text || ' fue cancelada y sus noches pasaron a la bolsa de renta'
                                      else 'la estadía ' || s.nights::text || ' se recortó a ' || remanente::text end),
    array[f.owner_id]
  );

  return jsonb_build_object('released', liberadas, 'remaining', remanente::text);
end;
$$;

comment on function public.cancelar_estadia(uuid, date, date) is
  'HU-14 · RF-14.6 · D-14 · cancela una estadía (o la recorta al tramo [conservar_desde, conservar_hasta)); las noches van a la bolsa de renta. El plazo y el mínimo los aplica el disparador.';

revoke execute on function public.cancelar_estadia(uuid, date, date) from public, anon;
grant execute on function public.cancelar_estadia(uuid, date, date) to authenticated, service_role;

-- ── RF-14.7 · liberación voluntaria ─────────────────────────────────────────
create or replace function public.liberar_noches(fraccion uuid, desde date, hasta date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  p public.properties;
  cal public.season_calendars;
  liberadas integer;
begin
  select * into f from public.fractions where id = fraccion;
  if f.id is null or f.owner_id is distinct from (select auth.uid()) then
    raise exception 'RF-14.7 · solo el titular de la fracción libera sus noches.';
  end if;
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción no tiene el calendario activo.';
  end if;
  if desde is null or hasta is null or hasta <= desde then
    raise exception 'RF-14.7 · se libera una o más noches consecutivas.';
  end if;
  if desde < current_date then
    raise exception 'RF-14.7 · no se liberan noches pasadas.';
  end if;
  select * into cal from public.season_calendars
   where property_id = f.property_id and year = extract(year from desde)::integer;
  if cal.id is null or cal.published_at is null then
    raise exception 'RF-12.3 · el calendario de % no está publicado.', extract(year from desde)::integer;
  end if;

  -- Solo noches propias y libres: lo demás no es suyo o ya está ocupado.
  if exists (
    select 1 from private.noches_de(daterange(desde, hasta)) as n
     where not exists (
       select 1 from public.allocations a join public.calendar_weeks w on w.id = a.week_id
        where a.calendar_id = cal.id and a.fraction_id = fraccion and n >= w.starts_on and n < w.ends_on)
  ) then
    raise exception 'CA-14.4 · RF-14.3 · hay noches que no pertenecen a la fracción.';
  end if;
  if exists (
    select 1 from private.noches_de(daterange(desde, hasta)) as n
     where not private.noche_libre_de(cal.id, fraccion, n)
  ) then
    raise exception 'RF-14.7 · hay noches con estadía, bloqueo o ya liberadas.';
  end if;

  with insertadas as (
    insert into public.released_nights (calendar_id, fraction_id, property_id, night, reason)
    select cal.id, fraccion, f.property_id, n, 'voluntary' from private.noches_de(daterange(desde, hasta)) as n
    on conflict (calendar_id, night) do nothing
    returning night
  )
  select count(*)::integer into liberadas from insertadas;

  select * into p from public.properties where id = f.property_id;
  perform public.emitir_notificacion(
    'calendar_changed', 'voluntary_release', fraccion::text || ':' || daterange(desde, hasta)::text, f.property_id,
    jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                       'detail', liberadas || ' noches liberadas a la bolsa de renta (' || daterange(desde, hasta)::text || ')'),
    array[f.owner_id]
  );

  return liberadas;
end;
$$;

comment on function public.liberar_noches(uuid, date, date) is
  'HU-14 · RF-14.7 · D-15 · el titular pasa a la bolsa de renta noches propias, libres y futuras del rango [desde, hasta).';

revoke execute on function public.liberar_noches(uuid, date, date) from public, anon;
grant execute on function public.liberar_noches(uuid, date, date) to authenticated, service_role;

-- ── RF-15.1 · RF-15.4 · RF-15.5 · crear un bloqueo ──────────────────────────
create or replace function public.crear_bloqueo(propiedad uuid, desde date, hasta date, motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.properties;
  bloque uuid;
  conflicto record;
  conflictos jsonb := '[]'::jsonb;
begin
  if not private.puede_gestionar_propiedad(propiedad) then
    raise exception 'CA-15.4 · solo el Administrador asignado bloquea noches de esta propiedad.';
  end if;
  if btrim(coalesce(motivo, '')) = '' then
    raise exception 'CA-15.1 · RF-15.1 · el bloqueo exige un motivo.';
  end if;
  if desde is null or hasta is null or hasta <= desde then
    raise exception 'RF-15.1 · un bloqueo es de una o más noches consecutivas.';
  end if;
  if desde < current_date then
    raise exception 'RF-15.1 · no se bloquean noches pasadas.';
  end if;

  -- RF-15.5 · el motivo viaja a la auditoría (TR-01 · RF-A.4).
  perform set_config('app.audit_reason', btrim(motivo), true);

  insert into public.blocks (property_id, nights, reason, created_by)
  values (propiedad, daterange(desde, hasta), btrim(motivo), (select auth.uid()))
  returning id into bloque;

  -- RF-15.4 · CA-15.3 · las estadías pisadas persisten; el conflicto lleva las noches exactas.
  insert into public.calendar_conflicts (property_id, block_id, stay_id, fraction_id, nights)
  select propiedad, bloque, s.id, s.fraction_id, s.nights * daterange(desde, hasta)
    from public.stays s
   where s.property_id = propiedad and s.status = 'confirmed' and s.nights && daterange(desde, hasta);

  perform set_config('app.audit_reason', '', true);

  select * into p from public.properties where id = propiedad;
  for conflicto in
    select c.stay_id, c.nights, f.number, f.owner_id
      from public.calendar_conflicts c
      join public.fractions f on f.id = c.fraction_id
     where c.block_id = bloque
  loop
    conflictos := conflictos || jsonb_build_object('stay_id', conflicto.stay_id, 'fraction_number', conflicto.number, 'nights', conflicto.nights::text);
    -- HU-16 · RF-16.1 · el titular afectado se entera antes o junto con el cambio.
    if conflicto.owner_id is not null then
      perform public.emitir_notificacion(
        'calendar_changed', 'block', bloque::text || ':' || conflicto.stay_id::text, propiedad,
        jsonb_build_object('property_name', p.name, 'fraction_number', conflicto.number, 'block_id', bloque,
                           'detail', 'un bloqueo del Administrador (' || btrim(motivo) || ') pisa las noches ' || conflicto.nights::text || ' de tu estadía'),
        array[conflicto.owner_id]
      );
    end if;
  end loop;

  return jsonb_build_object('id', bloque, 'conflicts', conflictos);
end;
$$;

comment on function public.crear_bloqueo(uuid, date, date, text) is
  'HU-15 · RF-15.1, RF-15.4, RF-15.5 · bloquea [desde, hasta) con motivo; devuelve el id y los conflictos con estadías declaradas.';

revoke execute on function public.crear_bloqueo(uuid, date, date, text) from public, anon;
grant execute on function public.crear_bloqueo(uuid, date, date, text) to authenticated, service_role;

-- ── RF-15.5 · levantar un bloqueo ───────────────────────────────────────────
create or replace function public.levantar_bloqueo(bloque uuid, motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.blocks;
begin
  select * into b from public.blocks where id = bloque;
  if b.id is null or not private.puede_gestionar_propiedad(b.property_id) then
    raise exception 'CA-15.4 · solo el Administrador asignado levanta bloqueos de esta propiedad.';
  end if;
  if btrim(coalesce(motivo, '')) = '' then
    raise exception 'CA-15.1 · RF-15.5 · levantar un bloqueo exige un motivo.';
  end if;
  if b.lifted_at is not null then
    return;
  end if;

  perform set_config('app.audit_reason', btrim(motivo), true);
  update public.blocks
     set lifted_at = now(), lifted_by = (select auth.uid()), lift_reason = btrim(motivo)
   where id = bloque;
  update public.calendar_conflicts
     set status = 'resolved', resolved_at = now()
   where block_id = bloque and status = 'open';
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.levantar_bloqueo(uuid, text) is
  'HU-15 · RF-15.5 · levanta un bloqueo con motivo; resuelve sus conflictos abiertos. El bloqueo no se borra.';

revoke execute on function public.levantar_bloqueo(uuid, text) from public, anon;
grant execute on function public.levantar_bloqueo(uuid, text) to authenticated, service_role;

-- ── HU-13 · RF-13.3 · D-16 · copropietarios por nombre y fracción, sin contacto ─
create or replace function public.copropietarios_de(propiedad uuid)
returns table (fraction_number smallint, owner_name text, calendar_active boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- CA-13.3 · quien no tiene fracción ni gestiona la propiedad no ve a sus copropietarios.
  if not (private.es_copropietario(propiedad) or private.puede_gestionar_propiedad(propiedad)) then
    raise exception 'CA-13.3 · RF-13.1 · solo los copropietarios ven el calendario de esta propiedad.';
  end if;

  return query
    select f.number, pr.full_name, f.calendar_active
      from public.fractions f
      left join public.profiles pr on pr.id = f.owner_id
     where f.property_id = propiedad
     order by f.number;
end;
$$;

comment on function public.copropietarios_de(uuid) is
  'HU-13 · RF-13.3 · D-16 · nombre y número de fracción de cada copropietario; nunca correo ni teléfono.';

revoke execute on function public.copropietarios_de(uuid) from public, anon;
grant execute on function public.copropietarios_de(uuid) to authenticated, service_role;
