-- HU-39 · RF-39.1…RF-39.5 · D-25, D-33, D-39 — el tercero no propietario y la
-- semana de la bolsa de renta que se le alquila.
--
-- Cinco decisiones que conviene leer antes que el código:
--
-- 1. **El tercero es de la propiedad, no de la plataforma.** Sus datos personales
--    solo los ve quien gestiona esa propiedad: un Administrador no tiene por qué
--    conocer a los huéspedes de un inmueble ajeno (D-25). Por eso el registro lleva
--    `property_id` y su unicidad por documento se mide dentro de la propiedad.
--
-- 2. **Sin consentimiento no hay registro y a los 5 años se anonimiza (D-25).**
--    `consent_accepted_at` es obligatorio por construcción —la columna es `not
--    null`— y `anonymize_after` nace a cinco años del alta. `anonimizar_terceros()`
--    borra los datos personales dejando la fila: las reservas y los ingresos que la
--    referencian tienen que seguir cuadrando.
--
-- 3. **La unidad es la semana (D-33).** El modelo por noches con exclusión GIST
--    sobre `daterange` desapareció cuando la semana pasó a ser la única unidad de
--    uso: hoy el invariante «una semana, una ocupación» son índices únicos por
--    `week_id` —uno aquí y otro en `week_blocks`— más la comprobación cruzada del
--    disparador, que mira bloqueos y semanas con dueño.
--
-- 4. **La reserva guarda el origen de la semana y no lo recalcula (RF-39.2b).**
--    De qué fracción salía y con qué motivo entró a la bolsa se fija al crear, y es
--    el único dato con el que HU-40 decide de quién es el ingreso (D-39). Si se
--    recalculara después, un cambio posterior en el calendario movería dinero ya
--    liquidado.
--
-- 5. **Cancelar no borra (RF-39.4).** La reserva queda `cancelled` con motivo
--    auditado y la semana vuelve a la bolsa.
--
-- Las mismas reglas están en `shared/scheduling/terceros.ts`.

create type public.third_party_document as enum ('cc', 'ce', 'passport', 'nit');

-- RF-39.2b · D-39 · con qué motivo entró la semana a la bolsa de renta.
create type public.week_origin as enum ('voluntary', 'cancelled', 'expired', 'relocated', 'pool');

comment on type public.week_origin is
  'HU-39 · RF-39.2b · D-39 · origen de la semana rentada. Solo `voluntary` atribuye el ingreso a su fracción.';

-- ── RF-39.1 · RF-39.5 · el registro de terceros ─────────────────────────────
create table public.third_parties (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  full_name text not null,
  document_kind public.third_party_document not null,
  -- Guardado ya normalizado (sin puntos ni guiones) para que el duplicado no entre.
  document_number text not null,
  email text,
  phone text,
  -- D-25 · el consentimiento es condición de existir, no una casilla.
  consent_accepted_at timestamptz not null default now(),
  consent_version text not null default '2026-09-v1',
  -- D-25 · cinco años (plazo fiscal); después se anonimiza.
  anonymize_after date not null default (current_date + interval '5 years'),
  anonymized_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint third_parties_nombre check (btrim(full_name) <> '' and length(full_name) <= 120),
  constraint third_parties_documento check (document_number ~ '^[0-9A-Z]{4,30}$'),
  constraint third_parties_contacto check (
    anonymized_at is not null
    or btrim(coalesce(email, '')) <> '' or btrim(coalesce(phone, '')) <> ''
  )
);

comment on table public.third_parties is
  'HU-39 · RF-39.1, RF-39.5 · D-25 · terceros no propietarios de una propiedad, con consentimiento y fecha de anonimización.';
comment on column public.third_parties.anonymize_after is
  'D-25 · a los 5 años del alta se borran los datos personales; la fila queda para que reservas e ingresos cuadren.';

-- CA-39.3 · un documento, un tercero dentro de la propiedad.
create unique index third_parties_documento_unico
  on public.third_parties (property_id, document_kind, document_number)
  where anonymized_at is null;
create index third_parties_propiedad_idx on public.third_parties (property_id);
create index third_parties_por_anonimizar_idx on public.third_parties (anonymize_after) where anonymized_at is null;

-- ── RF-39.2 · RF-39.2b · RF-39.3 · la reserva a tercero ─────────────────────
create table public.third_party_bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  calendar_id uuid not null references public.season_calendars (id) on delete cascade,
  week_id uuid not null references public.calendar_weeks (id) on delete cascade,
  third_party_id uuid not null references public.third_parties (id),

  -- RF-39.2b · D-39 · el origen, fijado al crear y nunca recalculado.
  origin_reason public.week_origin not null,
  origin_fraction_id uuid references public.fractions (id),

  status text not null default 'confirmed',
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  cancel_reason text,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint third_party_bookings_estado check (status in ('confirmed', 'cancelled')),
  -- Una semana sobrante de la rejilla no salió de ninguna fracción.
  constraint third_party_bookings_origen_coherente check ((origin_reason = 'pool') = (origin_fraction_id is null)),
  constraint third_party_bookings_cancelacion check (
    (status = 'confirmed' and cancelled_at is null and cancel_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and btrim(coalesce(cancel_reason, '')) <> '')
  )
);

comment on table public.third_party_bookings is
  'HU-39 · RF-39.2, RF-39.2b, RF-39.3 · D-39 · renta de una semana de la bolsa a un tercero, con la fracción y el motivo de origen.';
comment on column public.third_party_bookings.origin_reason is
  'RF-39.2b · D-39 · se fija al crear la reserva; HU-40 decide con él si el ingreso se prorratea o se atribuye.';

-- D-33 · «una semana, una ocupación»: el equivalente por semanas de la exclusión
-- que el modelo por noches hacía con GIST. El otro lado lo pone `week_blocks`.
create unique index third_party_bookings_semana_vigente
  on public.third_party_bookings (week_id) where status = 'confirmed';
create index third_party_bookings_propiedad_idx on public.third_party_bookings (property_id, created_at desc);
create index third_party_bookings_tercero_idx on public.third_party_bookings (third_party_id);
create index third_party_bookings_fraccion_idx on public.third_party_bookings (origin_fraction_id) where origin_fraction_id is not null;

-- ── Marca de actualización ──────────────────────────────────────────────────
create trigger third_parties_actualizados
  before update on public.third_parties
  for each row execute function private.marcar_actualizacion();
create trigger third_party_bookings_actualizadas
  before update on public.third_party_bookings
  for each row execute function private.marcar_actualizacion();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- D-25 · los datos del tercero son de quien gestiona la propiedad y de nadie más.
-- La ocupación, en cambio, la ven los copropietarios: es su calendario (CA-39.2),
-- pero por `third_party_bookings`, que no lleva datos personales.
alter table public.third_parties enable row level security;
alter table public.third_parties force row level security;
alter table public.third_party_bookings enable row level security;
alter table public.third_party_bookings force row level security;

revoke all on table public.third_parties, public.third_party_bookings from anon, authenticated, service_role;
grant select, insert, update on table public.third_parties to authenticated, service_role;
grant select, insert, update on table public.third_party_bookings to authenticated, service_role;

create policy third_parties_lectura on public.third_parties for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));
create policy third_parties_creacion on public.third_parties for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));
create policy third_parties_edicion on public.third_parties for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- CA-39.2 · la semana rentada aparece ocupada en el calendario de todos.
create policy third_party_bookings_lectura on public.third_party_bookings for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));
create policy third_party_bookings_creacion on public.third_party_bookings for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));
create policy third_party_bookings_edicion on public.third_party_bookings for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- ── TR-01 · RF-A.3, RF-A.4 · reservas y cancelaciones auditadas ─────────────
insert into public.audit_reason_required (action, source) values
  ('third_party_booking.actualizada', 'HU-39')
on conflict (action) do nothing;

create trigger third_parties_auditados
  after insert or update or delete on public.third_parties
  for each row execute function public.registrar_auditoria('third_party');
create trigger third_party_bookings_auditadas
  after insert or update or delete on public.third_party_bookings
  for each row execute function public.registrar_auditoria('third_party_booking');

-- ── RF-39.2 · CA-39.1 · solo se renta lo que está en la bolsa ───────────────
create or replace function private.validar_reserva_a_tercero()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.calendar_weeks;
  cal public.season_calendars;
  a public.allocations;
  tercero public.third_parties;
begin
  if tg_op = 'UPDATE' then
    -- RF-39.4 · sobre una reserva solo cabe cancelarla, y con motivo.
    if (to_jsonb(new) - 'status' - 'cancelled_at' - 'cancelled_by' - 'cancel_reason' - 'updated_at')
       <> (to_jsonb(old) - 'status' - 'cancelled_at' - 'cancelled_by' - 'cancel_reason' - 'updated_at') then
      raise exception 'RF-39.4 · una reserva a tercero no se edita: se cancela y se crea otra.';
    end if;
    if old.status = 'cancelled' then
      raise exception 'RF-39.4 · la reserva ya estaba cancelada.';
    end if;
    if new.status <> 'cancelled' then
      raise exception 'RF-39.4 · el único cambio admitido sobre una reserva es cancelarla.';
    end if;
    return new;
  end if;

  select * into w from public.calendar_weeks where id = new.week_id;
  select * into cal from public.season_calendars where id = new.calendar_id;
  if w.id is null or cal.id is null or w.calendar_id <> cal.id or cal.property_id <> new.property_id then
    raise exception 'RF-39.2 · la semana no pertenece al calendario de esta propiedad.';
  end if;
  if cal.published_at is null then
    raise exception 'RF-12.3 · el calendario del año no está publicado.';
  end if;

  select * into tercero from public.third_parties where id = new.third_party_id;
  if tercero.id is null or tercero.property_id <> new.property_id then
    raise exception 'RF-39.1 · el tercero no está registrado en esta propiedad.';
  end if;
  if tercero.anonymized_at is not null then
    raise exception 'D-25 · los datos de ese tercero ya fueron anonimizados: regístralo de nuevo.';
  end if;

  -- RF-15.2 · una semana bloqueada por el Administrador no se renta.
  if exists (select 1 from public.week_blocks b where b.week_id = new.week_id and b.lifted_at is null) then
    raise exception 'CA-39.1 · RF-15.2 · la semana está bloqueada por el Administrador.';
  end if;

  -- RF-39.2 · CA-39.1 · elegida y no liberada es de su fracción, confirmada o no.
  select * into a from public.allocations where week_id = new.week_id and calendar_id = new.calendar_id;
  if a.id is not null and a.released_at is null then
    raise exception 'CA-39.1 · RF-39.2 · la semana es de la fracción que la eligió: no está en la bolsa de renta.';
  end if;

  -- RF-39.2b · CA-39.5 · el origen sale del estado de la semana, no de quien llama.
  if a.id is not null then
    new.origin_reason := a.release_reason::public.week_origin;
    new.origin_fraction_id := a.fraction_id;
  else
    new.origin_reason := 'pool';
    new.origin_fraction_id := null;
  end if;

  new.status := 'confirmed';
  new.cancelled_at := null;
  new.cancelled_by := null;
  new.cancel_reason := null;
  return new;
end;
$$;

create trigger third_party_bookings_validadas
  before insert or update on public.third_party_bookings
  for each row execute function private.validar_reserva_a_tercero();

-- ── RF-39.1 · CA-39.3 · registrar al tercero sin duplicarlo ─────────────────
-- `SECURITY INVOKER`: la RLS de `third_parties` sigue decidiendo quién registra.
create or replace function public.registrar_tercero(
  propiedad uuid,
  nombre text,
  tipo_documento public.third_party_document,
  documento text,
  correo text default null,
  telefono text default null,
  consentimiento boolean default false
)
returns public.third_parties
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalizado text := upper(regexp_replace(coalesce(documento, ''), '[^0-9A-Za-z]', '', 'g'));
  existente public.third_parties;
  resultado public.third_parties;
begin
  if not consentimiento then
    raise exception 'RF-39.5 · D-25 · sin consentimiento explícito no se registran los datos del tercero.';
  end if;

  -- CA-39.3 · si ya está, se reutiliza: no se duplica por documento.
  select * into existente from public.third_parties t
   where t.property_id = propiedad and t.document_kind = tipo_documento
     and t.document_number = normalizado and t.anonymized_at is null;
  if existente.id is not null then
    return existente;
  end if;

  insert into public.third_parties (property_id, full_name, document_kind, document_number, email, phone)
  values (propiedad, btrim(nombre), tipo_documento, normalizado, nullif(btrim(coalesce(correo, '')), ''), nullif(btrim(coalesce(telefono, '')), ''))
  returning * into resultado;

  return resultado;
end;
$$;

comment on function public.registrar_tercero(uuid, text, public.third_party_document, text, text, text, boolean) is
  'HU-39 · RF-39.1, RF-39.5 · CA-39.3 · da de alta al tercero o devuelve el ya registrado con ese documento.';

-- ── RF-39.2 · RF-39.3 · rentar una semana de la bolsa ───────────────────────
create or replace function public.rentar_semana(
  calendario uuid,
  indice_de_semana integer,
  tercero uuid
)
returns public.third_party_bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cal public.season_calendars;
  w public.calendar_weeks;
  resultado public.third_party_bookings;
begin
  select * into cal from public.season_calendars where id = calendario;
  if cal.id is null then
    raise exception 'RF-39.2 · el calendario no existe o no es visible para esta cuenta.';
  end if;

  select * into w from public.calendar_weeks where calendar_id = calendario and index = indice_de_semana;
  if w.id is null then
    raise exception 'RF-39.2 · la semana % no existe en la rejilla de ese año.', indice_de_semana;
  end if;

  perform set_config('app.audit_reason', 'Semana rentada a un tercero', true);
  -- `origin_reason` lo fija el disparador a partir del estado de la semana; el
  -- valor que va aquí es solo el que la columna exige para entrar.
  insert into public.third_party_bookings (property_id, calendar_id, week_id, third_party_id, origin_reason)
  values (cal.property_id, calendario, w.id, tercero, 'pool')
  returning * into resultado;
  perform set_config('app.audit_reason', '', true);

  return resultado;
end;
$$;

comment on function public.rentar_semana(uuid, integer, uuid) is
  'HU-39 · RF-39.2, RF-39.2b · CA-39.5 · renta una semana de la bolsa a un tercero y le fija su origen.';

-- ── RF-39.4 · CA-39.4 · cancelar la reserva ─────────────────────────────────
create or replace function public.cancelar_reserva_a_tercero(reserva uuid, motivo text)
returns public.third_party_bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.third_party_bookings;
begin
  if length(btrim(coalesce(motivo, ''))) = 0 then
    raise exception 'CA-39.4 · RF-A.4 · una reserva a tercero no se cancela sin motivo.';
  end if;

  perform set_config('app.audit_reason', motivo, true);
  update public.third_party_bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = (select auth.uid()), cancel_reason = motivo
   where id = reserva
  returning * into resultado;
  perform set_config('app.audit_reason', '', true);

  if resultado.id is null then
    raise exception 'La reserva no existe o no es visible para esta cuenta.';
  end if;

  return resultado;
end;
$$;

comment on function public.cancelar_reserva_a_tercero(uuid, text) is
  'HU-39 · RF-39.4 · CA-39.4 · cancela la reserva con motivo; la semana vuelve a la bolsa y queda auditado.';

-- ── D-25 · RF-39.5 · anonimización a los 5 años ─────────────────────────────
create or replace function public.anonimizar_terceros(hoy date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  anonimizados integer := 0;
begin
  perform set_config('app.audit_reason', 'Datos de tercero anonimizados a los 5 años (D-25)', true);
  with vencidos as (
    update public.third_parties
       set full_name = 'Tercero anonimizado',
           document_number = 'ANON' || upper(substr(replace(id::text, '-', ''), 1, 20)),
           email = null,
           phone = null,
           anonymized_at = now()
     where anonymized_at is null and anonymize_after <= hoy
    returning id
  )
  select count(*) into anonimizados from vencidos;
  perform set_config('app.audit_reason', '', true);

  return anonimizados;
end;
$$;

comment on function public.anonimizar_terceros(date) is
  'HU-39 · RF-39.5 · D-25 · borra los datos personales de los terceros que cumplieron 5 años; la fila queda.';

revoke execute on function
  public.registrar_tercero(uuid, text, public.third_party_document, text, text, text, boolean),
  public.rentar_semana(uuid, integer, uuid),
  public.cancelar_reserva_a_tercero(uuid, text)
  from public, anon;
grant execute on function
  public.registrar_tercero(uuid, text, public.third_party_document, text, text, text, boolean),
  public.rentar_semana(uuid, integer, uuid),
  public.cancelar_reserva_a_tercero(uuid, text)
  to authenticated, service_role;

revoke execute on function public.anonimizar_terceros(date) from public, anon, authenticated;
grant execute on function public.anonimizar_terceros(date) to service_role;

-- DT-09 · la anonimización es una tarea diaria idempotente, como la caducidad.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'anonimizar-terceros';
    perform cron.schedule('anonimizar-terceros', '30 8 * * *', $job$ select public.anonimizar_terceros() $job$);
  end if;
end;
$$;
