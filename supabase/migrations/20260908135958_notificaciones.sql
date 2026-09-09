-- TR-03 · RF-N.1, RF-N.4, RF-N.5, RF-N.6 — canal de notificaciones y bandeja.
--
-- Cuatro decisiones que conviene leer antes que el código:
--
-- 1. **Una notificación, muchos destinatarios, un estado por cabeza (RF-N.1).**
--    `notifications` es el hecho; `notification_recipients` dice a quién llegó y
--    si ya lo leyó. Marcar como leída es escribir en la fila propia y nada más.
--
-- 2. **Idempotencia por construcción (RF-N.4).** Un evento se identifica por tipo
--    más entidad de origen y es único; un destinatario es único por notificación.
--    `public.emitir_notificacion()` inserta con `on conflict do nothing`: reprocesar
--    el mismo evento no duplica nada (CA-N.3).
--
-- 3. **Nadie inserta directo.** La emisión es una función SECURITY DEFINER que
--    ejecutan el servidor (llave de servicio) y los disparadores del negocio, como
--    la activación del calendario (RF-58.7). `authenticated` solo lee lo suyo y
--    marca lo suyo.
--
-- 4. **El correo va aparte (RF-N.6).** La fila del destinatario lleva el estado del
--    envío: intentos, último error y cuándo volver a intentar. Nitro lo despacha;
--    si el proveedor falla, la notificación in-app ya existe y no se toca.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  property_id uuid references public.properties (id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  -- RF-N.2 · si además de la bandeja exige correo.
  requires_email boolean not null default true,
  created_at timestamptz not null default now(),

  constraint notifications_tipo_valido check (kind in (
    'stay_confirmed', 'calendar_changed', 'calendar_activated', 'announcement_published', 'broadcast',
    'referral_in_progress', 'referral_paid', 'commission_available', 'withdrawal_approved', 'withdrawal_paid'
  )),
  constraint notifications_entidad_no_vacia check (length(btrim(entity_type)) > 0 and length(btrim(entity_id)) > 0),
  -- RF-N.4 · un evento de negocio es una sola notificación.
  constraint notifications_evento_unico unique (kind, entity_type, entity_id)
);

comment on table public.notifications is
  'TR-03 · RF-N.1 · el hecho notificado: tipo, entidad de origen, propiedad y carga tipada. Única por evento (RF-N.4).';

create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz,
  -- RF-N.6 · estado del correo, aparte del hecho.
  email_sent_at timestamptz,
  email_attempts smallint not null default 0,
  email_last_error text,
  email_next_attempt_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notification_recipients_unico unique (notification_id, recipient_id)
);

comment on table public.notification_recipients is
  'TR-03 · RF-N.1 · a quién llegó cada notificación y si la leyó; lleva además el estado del correo (RF-N.6).';

create index notification_recipients_bandeja_idx
  on public.notification_recipients (recipient_id, read_at, created_at desc);
create index notification_recipients_correo_idx
  on public.notification_recipients (email_next_attempt_at)
  where email_sent_at is null;

alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.notification_recipients enable row level security;
alter table public.notification_recipients force row level security;

revoke all on table public.notifications from anon, authenticated, service_role;
revoke all on table public.notification_recipients from anon, authenticated, service_role;
grant select on table public.notifications to authenticated;
grant select, update on table public.notification_recipients to authenticated;
grant select, insert, update on table public.notifications to service_role;
grant select, insert, update on table public.notification_recipients to service_role;

-- ── Políticas: cada quien lo suyo (RF-N.5) ──────────────────────────────────
-- `notifications.id` va calificado: dentro de la subconsulta, un `id` a secas se
-- resolvería contra la fila de `notification_recipients` y la política no vería nada.
create policy notifications_lectura_destinatario
  on public.notifications for select to authenticated
  using (exists (
    select 1 from public.notification_recipients r
     where r.notification_id = notifications.id and r.recipient_id = (select auth.uid())
  ));

create policy notification_recipients_lectura_propia
  on public.notification_recipients for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notification_recipients_marcar_propia
  on public.notification_recipients for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- El destinatario solo puede tocar `read_at`; el estado del correo es del servidor.
-- SECURITY INVOKER a propósito: con DEFINER `current_user` sería el dueño de la
-- función y la guarda no distinguiría al destinatario del servidor.
create or replace function private.proteger_estado_de_correo()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
       new.notification_id <> old.notification_id
    or new.recipient_id <> old.recipient_id
    or new.email_sent_at is distinct from old.email_sent_at
    or new.email_attempts <> old.email_attempts
    or new.email_last_error is distinct from old.email_last_error
    or new.email_next_attempt_at is distinct from old.email_next_attempt_at
  ) then
    raise exception 'RF-N.5 · el destinatario solo marca su lectura; el estado del correo lo lleva el servidor.';
  end if;
  -- Una lectura no se «desmarca».
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    new.read_at := old.read_at;
  end if;
  return new;
end;
$$;

create trigger notification_recipients_proteger
  before update on public.notification_recipients
  for each row execute function private.proteger_estado_de_correo();

-- ── RF-N.4 · emisión idempotente ────────────────────────────────────────────
create or replace function public.emitir_notificacion(
  tipo text,
  entidad text,
  entidad_id text,
  propiedad uuid,
  carga jsonb,
  destinatarios uuid[],
  requiere_correo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notificacion uuid;
begin
  insert into public.notifications (kind, entity_type, entity_id, property_id, payload, requires_email)
  values (tipo, entidad, entidad_id, propiedad, coalesce(carga, '{}'::jsonb), requiere_correo)
  on conflict (kind, entity_type, entity_id) do nothing
  returning id into notificacion;

  if notificacion is null then
    select id into notificacion from public.notifications
     where kind = tipo and entity_type = entidad and entity_id = entidad_id;
  end if;

  -- CA-N.3 · un destinatario por cuenta, aunque la lista repita o el evento vuelva.
  insert into public.notification_recipients (notification_id, recipient_id, email_next_attempt_at)
  select notificacion, d, now()
    from unnest(destinatarios) as d
  on conflict (notification_id, recipient_id) do nothing;

  return notificacion;
end;
$$;

comment on function public.emitir_notificacion(text, text, text, uuid, jsonb, uuid[], boolean) is
  'TR-03 · RF-N.4 · emite una notificación a sus destinatarios de forma idempotente: el mismo evento nunca duplica.';

revoke execute on function public.emitir_notificacion(text, text, text, uuid, jsonb, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.emitir_notificacion(text, text, text, uuid, jsonb, uuid[], boolean) to service_role;

-- ── RF-N.5 · marcar lo propio ───────────────────────────────────────────────
create or replace function public.marcar_leida(destinatario uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cuando timestamptz;
begin
  update public.notification_recipients
     set read_at = coalesce(read_at, now())
   where id = destinatario
     and recipient_id = (select auth.uid())
  returning read_at into cuando;
  return cuando;
end;
$$;

create or replace function public.marcar_todas_leidas()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cuantas integer;
begin
  update public.notification_recipients
     set read_at = now()
   where recipient_id = (select auth.uid())
     and read_at is null;
  get diagnostics cuantas = row_count;
  return cuantas;
end;
$$;

revoke execute on function public.marcar_leida(uuid) from public, anon;
revoke execute on function public.marcar_todas_leidas() from public, anon;
grant execute on function public.marcar_leida(uuid) to authenticated, service_role;
grant execute on function public.marcar_todas_leidas() to authenticated, service_role;

-- ── La bandeja: lo que cada cuenta ve, con el nombre de la propiedad ────────
create view public.notification_inbox
with (security_invoker = true) as
select
  r.id,
  r.notification_id,
  r.recipient_id,
  n.kind,
  n.property_id,
  p.name as property_name,
  n.entity_type,
  n.entity_id,
  n.payload,
  n.created_at,
  r.read_at
from public.notification_recipients r
join public.notifications n on n.id = r.notification_id
left join public.properties p on p.id = n.property_id;

comment on view public.notification_inbox is
  'TR-03 · RF-N.5 · la bandeja de la cuenta que consulta; RLS por security_invoker.';

revoke all on public.notification_inbox from anon, authenticated, service_role;
grant select on public.notification_inbox to authenticated, service_role;

-- ── HU-58 · RF-58.7 · la activación del calendario notifica al Propietario ──
-- Misma función de derivación, con la emisión al final. Es idempotente por la
-- clave del evento: recalcular el plan mil veces deja una sola notificación.
create or replace function private.derivar_plan(plan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payment_plans;
  estado text;
  activo boolean;
  fraccion public.fractions;
  propiedad public.properties;
begin
  select * into p from public.payment_plans where id = plan;
  if not found then
    return;
  end if;

  estado := public.estado_del_plan(plan);
  activo := estado = 'completed';

  -- RF-58.7 · CA-58.8 · CA-58.9 · idempotente: solo escribe si el valor cambia.
  perform set_config('app.derivando_calendario', 'true', true);
  update public.fractions
     set calendar_active = activo
   where id = p.fraction_id
     and owner_id = p.owner_id
     and calendar_active is distinct from activo;
  perform set_config('app.derivando_calendario', 'false', true);

  -- RF-58.6 · CA-58.4 · el evento, una sola vez por plan.
  if estado = 'completed' then
    insert into public.payment_events (plan_id, property_id, kind, payload)
    values (plan, p.property_id, 'payment_completed', jsonb_build_object(
      'fraction_id', p.fraction_id,
      'owner_id', p.owner_id,
      'agreed_price', p.agreed_price,
      'referral_code', p.referral_code
    ))
    on conflict (plan_id, kind) do nothing;

    -- TR-03 · el Propietario se entera de que ya puede reservar.
    select * into fraccion from public.fractions where id = p.fraction_id;
    select * into propiedad from public.properties where id = p.property_id;
    perform public.emitir_notificacion(
      'calendar_activated', 'payment_plan', plan::text, p.property_id,
      jsonb_build_object('property_name', propiedad.name, 'fraction_number', fraccion.number, 'plan_id', plan),
      array[p.owner_id]
    );
  end if;

  -- RF-58.8 · CA-58.7 · la reversa, también una sola vez.
  if estado = 'voided' then
    insert into public.payment_events (plan_id, property_id, kind, payload)
    values (plan, p.property_id, 'purchase_voided', jsonb_build_object(
      'fraction_id', p.fraction_id,
      'owner_id', p.owner_id,
      'agreed_price', p.agreed_price,
      'referral_code', p.referral_code,
      'reason', p.void_reason
    ))
    on conflict (plan_id, kind) do nothing;
  end if;
end;
$$;
