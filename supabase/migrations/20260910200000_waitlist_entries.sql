-- HU-47 · RF-47.1…RF-47.5 · D-24 · D-25 — la lista de espera de una propiedad
-- sin fracciones disponibles.
--
-- 1. **El Visitante no escribe en la tabla.** El formulario pasa por una ruta
--    Nitro que valida con el esquema compartido, aplica el límite de tasa por IP
--    y correo (D-24) y persiste con la llave de servicio. Abrir INSERT a `anon`
--    convertiría la tabla en un buzón sin candado.
--
-- 2. **Un correo, una vez por propiedad.** La unicidad es por propiedad y
--    correo en minúsculas (RF-47.2, CA-47.2); el disparador normaliza al entrar.
--
-- 3. **El aviso lo pide un disparador y lo entrega el despacho.** Cuando una
--    fracción de la propiedad vuelve a `available` (RF-47.4), se marca la lista
--    como pendiente de aviso en orden de inscripción y una sola vez por persona
--    (CA-47.4); el correo sale por el mismo despacho de TR-03, con reintentos.
--
-- 4. **Consentimiento y retención.** Cada fila guarda cuándo y qué versión del
--    consentimiento aceptó; a los cinco años se anonimiza (D-25), por una tarea
--    mensual de pg_cron.

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text not null,
  locale text not null default 'es',

  -- RF-47.5 · D-25 · consentimiento explícito, con su versión y su caducidad.
  consent_at timestamptz not null default now(),
  consent_version text not null,
  retain_until timestamptz not null,
  anonymized_at timestamptz,

  -- D-24 · huella de la IP para auditar abuso sin guardar la IP en claro.
  ip_hash text,
  confirmation_sent_at timestamptz,

  -- RF-47.4 · el ciclo del aviso: pedido por el disparador, entregado por el despacho.
  notify_requested_at timestamptz,
  notified_at timestamptz,
  email_attempts integer not null default 0,
  email_last_error text,
  email_next_attempt_at timestamptz,

  created_at timestamptz not null default now(),

  constraint waitlist_entries_nombre_no_vacio check (length(btrim(full_name)) > 0),
  constraint waitlist_entries_correo_valido check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint waitlist_entries_telefono_no_vacio check (length(btrim(phone)) > 0),
  constraint waitlist_entries_idioma_valido check (locale in ('es', 'en')),
  constraint waitlist_entries_retencion check (retain_until > consent_at)
);

comment on table public.waitlist_entries is
  'HU-47 · lista de espera de una propiedad sin fracciones disponibles, con consentimiento y retención de cinco años (D-25). Solo escribe el servidor.';
comment on column public.waitlist_entries.notify_requested_at is
  'RF-47.4 · lo marca el disparador cuando una fracción vuelve a disponible; el despacho entrega el correo y fija notified_at.';

-- RF-47.2 · CA-47.2 · un correo no se inscribe dos veces en la misma propiedad.
create unique index waitlist_entries_correo_por_propiedad
  on public.waitlist_entries (property_id, lower(email));

-- RF-47.4 · el orden de inscripción es el orden del aviso.
create index waitlist_entries_orden_idx on public.waitlist_entries (property_id, created_at);

-- Lo que el despacho recorre: pedidos y aún no entregados.
create index waitlist_entries_pendientes_idx on public.waitlist_entries (notify_requested_at)
  where notify_requested_at is not null and notified_at is null;

-- D-25 · lo que la tarea de anonimización recorre.
create index waitlist_entries_retencion_idx on public.waitlist_entries (retain_until)
  where anonymized_at is null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.waitlist_entries enable row level security;
alter table public.waitlist_entries force row level security;

revoke all on table public.waitlist_entries from anon, authenticated, service_role;
grant select on table public.waitlist_entries to authenticated;
grant select, insert, update on table public.waitlist_entries to service_role;

-- Solo leen el Superadmin y el Administrador de la propiedad (plan §2.7).
create policy waitlist_entries_lectura_superadmin
  on public.waitlist_entries for select to authenticated
  using (private.es_superadmin());

create policy waitlist_entries_lectura_admin
  on public.waitlist_entries for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

-- ── Normalización al entrar ─────────────────────────────────────────────────
create or replace function private.normalizar_inscripcion_en_espera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.full_name := btrim(new.full_name);
  new.phone := btrim(new.phone);
  -- D-25 · cinco años desde el consentimiento; la misma cuenta que `shared/waitlist`.
  new.retain_until := coalesce(new.retain_until, new.consent_at + interval '5 years');
  return new;
end;
$$;

create trigger waitlist_entries_normalizar
  before insert on public.waitlist_entries
  for each row execute function private.normalizar_inscripcion_en_espera();

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger waitlist_entries_auditadas
  after insert or update on public.waitlist_entries
  for each row execute function public.registrar_auditoria('waitlist_entry');

-- ── RF-47.4 · CA-47.4 · el disparador de liberación ─────────────────────────
-- Cuando una fracción vuelve a `available` (venta anulada por HU-58 RF-58.7,
-- reserva vencida o cualquier otra vía), la lista de esa propiedad queda pedida
-- de aviso. Solo las filas que nunca se avisaron ni estaban ya pedidas: una sola
-- vez por persona, y la unicidad por correo garantiza que persona es correo.
create or replace function private.pedir_aviso_de_lista_de_espera()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'available' and old.status is distinct from 'available' then
    update public.waitlist_entries
       set notify_requested_at = now()
     where property_id = new.property_id
       and notified_at is null
       and notify_requested_at is null
       and anonymized_at is null;
  end if;
  return null;
end;
$$;

create trigger fractions_avisan_lista_de_espera
  after update of status on public.fractions
  for each row execute function private.pedir_aviso_de_lista_de_espera();

-- ── D-25 · anonimización a los cinco años ───────────────────────────────────
-- Se conserva la fila (y con ella el orden histórico), pero sin datos de
-- persona: el correo pasa a un valor inerte y único, el nombre y el teléfono a
-- marcas fijas.
create or replace function public.anonimizar_lista_de_espera(momento timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cuantas integer;
begin
  perform set_config('app.audit_reason', 'D-25 · anonimización por vencimiento de la retención', true);
  update public.waitlist_entries
     set full_name = 'anonimizado',
         email = 'anon-' || id::text || '@anonimizado.invalid',
         phone = '-',
         ip_hash = null,
         anonymized_at = momento
   where anonymized_at is null
     and retain_until <= momento;
  get diagnostics cuantas = row_count;
  perform set_config('app.audit_reason', '', true);
  return cuantas;
end;
$$;

comment on function public.anonimizar_lista_de_espera(timestamptz) is
  'HU-47 · RF-47.5 · D-25 · anonimiza las inscripciones cuya retención de cinco años venció.';

revoke execute on function public.anonimizar_lista_de_espera(timestamptz) from public, anon, authenticated;
grant execute on function public.anonimizar_lista_de_espera(timestamptz) to service_role;

-- El primer día de cada mes, de madrugada en Bogotá (08:00 UTC).
select cron.schedule('anonymize-waitlist', '0 8 1 * *', $$ select public.anonimizar_lista_de_espera(); $$);
