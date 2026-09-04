-- HU-58 · RF-58.1…RF-58.8 y HU-06 · RF-06.2…RF-06.4 — plan de pagos, abonos,
-- cierre y anulación de la compra.
--
-- Seis decisiones que conviene leer antes que el código:
--
-- 1. **Nada de estado se guarda (DT-04, RF-58.3).** El estado del plan, el saldo y el
--    interruptor de calendario se derivan del precio pactado y de los abonos
--    vigentes: `public.derivar_estado_del_plan()` es la única fórmula, la vista
--    `payment_plan_overview` la aplica al leer y `private.derivar_plan()` al
--    escribir. Un abono anulado recalcula todo solo.
--
-- 2. **El precio pactado es un snapshot (RF-58.1, CA-58.5).** Se copia de la
--    invitación al cerrar y no se edita: un cambio posterior del precio de lista de
--    la fracción no lo toca. Es la base de la comisión porcentual (D-05).
--
-- 3. **Ni sobrepago ni abono sin comprobante (RF-58.2, RF-58.4).** Un disparador
--    rechaza el abono que deje lo abonado por encima del precio; `receipt_path` es
--    `not null` y no vacío. Un abono no se borra: se anula con motivo (RF-58.5).
--
-- 4. **Los eventos se emiten una sola vez (RF-58.6).** `payment_events` tiene un
--    único `(plan, tipo)`: recalcular el plan diez veces inserta el evento una vez
--    gracias a `on conflict do nothing`. Es lo que HU-54 consumirá para la comisión.
--
-- 5. **El calendario lo escribe solo la derivación (RF-58.7, D-31).** El disparador
--    de `fractions` sigue rechazando `calendar_active` a mano; se abre únicamente
--    cuando `app.derivando_calendario` está encendido, y eso lo enciende
--    `private.derivar_plan()` y nadie más.
--
-- 6. **Cerrar y anular la compra son funciones, no una secuencia de peticiones.**
--    `public.cerrar_compra()` da la titularidad y crea el plan en una transacción;
--    `public.anular_compra()` revierte todo con motivo. Las dos son SECURITY INVOKER:
--    la RLS de cada tabla sigue decidiendo, y solo el rol Propietario pasa por un
--    ayudante privado con privilegio, porque `user_roles` es del Superadmin.
--
-- Lo que esta migración deja preparado para historias posteriores:
--   · el medio de pago es texto; HU-23 lo referenciará a su maestra;
--   · la anulación de compra cancelará las estadías futuras cuando exista `stays`
--     (HU-14) y mandará las noches a la bolsa de renta (HU-39);
--   · la notificación de activación al Propietario la consumirá TR-03 desde
--     `payment_events`.

create type public.payment_event_kind as enum ('payment_completed', 'purchase_voided');

-- ── Plan de pagos ───────────────────────────────────────────────────────────
create table public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.purchase_invitations (id),
  fraction_id uuid not null references public.fractions (id),
  property_id uuid not null references public.properties (id),
  owner_id uuid not null references auth.users (id),

  -- RF-58.1 · snapshot del precio pactado, en pesos enteros (TR-02).
  agreed_price bigint not null,
  -- RF-06.4 · atribución de referido arrastrada a la compra (HU-51).
  referral_code text,

  closed_by uuid,
  closed_at timestamptz not null default now(),

  -- RF-58.8 · anulación con motivo; el plan no se borra.
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_plans_precio_positivo check (agreed_price > 0),
  constraint payment_plans_anulacion_coherente check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and length(btrim(coalesce(void_reason, ''))) > 0)
  )
);

comment on table public.payment_plans is
  'HU-58 · plan de pagos de una fracción vendida, con el precio pactado congelado. Sus estados se derivan de los abonos.';
comment on column public.payment_plans.agreed_price is
  'RF-58.1 · precio pactado al cerrar la compra. No cambia con el precio de lista (CA-58.5).';

-- Un solo plan vigente por fracción.
create unique index payment_plans_vigente_unico on public.payment_plans (fraction_id) where voided_at is null;
create index payment_plans_property_idx on public.payment_plans (property_id);
create index payment_plans_owner_idx on public.payment_plans (owner_id);

alter table public.payment_plans enable row level security;
alter table public.payment_plans force row level security;

revoke all on table public.payment_plans from anon, authenticated, service_role;
grant select, insert, update on table public.payment_plans to authenticated, service_role;

-- ── Abonos ──────────────────────────────────────────────────────────────────
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans (id),
  -- Copia de la propiedad: las políticas y la auditoría la usan sin unir tablas.
  property_id uuid not null references public.properties (id),

  amount bigint not null,
  paid_on date not null,
  -- HU-23 · referenciará la maestra de medios de pago cuando exista.
  payment_method text not null,
  -- RF-58.2 · comprobante obligatorio, en el bucket `payment-receipts`.
  receipt_path text not null,
  note text,
  registered_by uuid,

  -- RF-58.5 · un abono no se elimina: se anula con motivo.
  voided_at timestamptz,
  voided_by uuid,
  void_reason text,

  created_at timestamptz not null default now(),

  constraint payments_monto_positivo check (amount > 0),
  constraint payments_medio_no_vacio check (length(btrim(payment_method)) > 0),
  constraint payments_comprobante_obligatorio check (length(btrim(receipt_path)) > 0),
  constraint payments_anulacion_coherente check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and length(btrim(coalesce(void_reason, ''))) > 0)
  )
);

comment on table public.payments is
  'HU-58 · abonos contra el precio pactado de un plan. Con fecha, medio y comprobante; se anulan, no se borran.';

create index payments_plan_idx on public.payments (plan_id);
create index payments_property_idx on public.payments (property_id);

alter table public.payments enable row level security;
alter table public.payments force row level security;

revoke all on table public.payments from anon, authenticated, service_role;
grant select, insert, update on table public.payments to authenticated, service_role;

-- ── Eventos del plan: una vez por plan y tipo ───────────────────────────────
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.payment_plans (id),
  property_id uuid not null references public.properties (id),
  kind public.payment_event_kind not null,
  payload jsonb not null default '{}'::jsonb,
  emitted_at timestamptz not null default now(),

  -- RF-58.6 · idempotencia por construcción.
  constraint payment_events_unico_por_plan unique (plan_id, kind)
);

comment on table public.payment_events is
  'HU-58 · RF-58.6, RF-58.8 · eventos que el plan emite una sola vez: pago completado y reversa. Los consume HU-54.';

alter table public.payment_events enable row level security;
alter table public.payment_events force row level security;

-- Solo los escribe la derivación; desde la API se leen.
revoke all on table public.payment_events from anon, authenticated, service_role;
grant select on table public.payment_events to authenticated, service_role;

-- ── RF-A.4 · anular un abono o un plan exige motivo ─────────────────────────
insert into public.audit_reason_required (action, source) values
  ('payment.actualizada', 'HU-58'),
  ('payment_plan.actualizada', 'HU-58')
on conflict (action) do nothing;

-- ── Quién es titular de un plan ─────────────────────────────────────────────
create or replace function private.es_titular_del_plan(plan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.payment_plans
    where id = plan and owner_id = (select auth.uid())
  );
$$;

revoke execute on function private.es_titular_del_plan(uuid) from public, anon;
grant execute on function private.es_titular_del_plan(uuid) to authenticated, service_role;

-- ── Políticas ───────────────────────────────────────────────────────────────
create policy payment_plans_lectura_gestion
  on public.payment_plans for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

-- RF-58.9 · el Propietario lee su propio plan.
create policy payment_plans_lectura_titular
  on public.payment_plans for select to authenticated
  using (owner_id = (select auth.uid()));

create policy payment_plans_creacion
  on public.payment_plans for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy payment_plans_edicion
  on public.payment_plans for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

create policy payments_lectura_gestion
  on public.payments for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

create policy payments_lectura_titular
  on public.payments for select to authenticated
  using (private.es_titular_del_plan(plan_id));

create policy payments_registro
  on public.payments for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy payments_anulacion
  on public.payments for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

create policy payment_events_lectura_gestion
  on public.payment_events for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

create policy payment_events_lectura_titular
  on public.payment_events for select to authenticated
  using (private.es_titular_del_plan(plan_id));

-- ── RF-58.3 · la fórmula única del estado ───────────────────────────────────
-- Espejo exacto de `shared/payments/plan.ts`. `abonado > precio` no puede darse:
-- el disparador de abonos lo impide antes de que exista la fila.
create or replace function public.derivar_estado_del_plan(precio bigint, abonado bigint, anulado boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when anulado then 'voided'
    when coalesce(abonado, 0) = 0 then 'reserved'
    when abonado >= precio then 'completed'
    else 'in_progress'
  end;
$$;

comment on function public.derivar_estado_del_plan(bigint, bigint, boolean) is
  'HU-58 · RF-58.3 · reserved → in_progress → completed, derivado de precio y abonos; voided si el plan se anuló.';

create or replace function public.estado_del_plan(plan uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select public.derivar_estado_del_plan(
    p.agreed_price,
    coalesce((select sum(a.amount) from public.payments a where a.plan_id = p.id and a.voided_at is null), 0)::bigint,
    p.voided_at is not null
  )
  from public.payment_plans p
  where p.id = plan;
$$;

revoke execute on function public.derivar_estado_del_plan(bigint, bigint, boolean), public.estado_del_plan(uuid) from public, anon;
grant execute on function public.derivar_estado_del_plan(bigint, bigint, boolean), public.estado_del_plan(uuid) to authenticated, service_role;

-- ── RF-58.7 · el disparador de fracciones deja pasar solo a la derivación ───
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

  new.updated_at := now();
  return new;
end;
$$;

-- ── La derivación: calendario y eventos, desde los hechos ───────────────────
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

revoke execute on function private.derivar_plan(uuid) from public, anon, authenticated;
grant execute on function private.derivar_plan(uuid) to service_role;

create or replace function private.derivar_plan_tras_abono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.derivar_plan(new.plan_id);
  return null;
end;
$$;

create or replace function private.derivar_plan_tras_cambio()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.derivar_plan(new.id);
  return null;
end;
$$;

-- ── Guardas del plan ────────────────────────────────────────────────────────
create or replace function private.validar_alta_de_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- RF-06.3 · RF-58.1 · el plan nace del cierre de la compra y de nada más.
  if coalesce(current_setting('app.cerrando_compra', true), '') <> 'true' then
    raise exception 'RF-58.1 · un plan de pagos se crea cerrando la compra con public.cerrar_compra().';
  end if;

  new.closed_by := coalesce(new.closed_by, (select auth.uid()));
  new.voided_at := null;
  new.voided_by := null;
  new.void_reason := null;
  return new;
end;
$$;

create trigger payment_plans_validar_alta
  before insert on public.payment_plans
  for each row execute function private.validar_alta_de_plan();

create or replace function private.validar_cambio_de_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- CA-58.5 · el precio pactado y el resto del snapshot no se editan.
  if new.invitation_id <> old.invitation_id
     or new.fraction_id <> old.fraction_id
     or new.property_id <> old.property_id
     or new.owner_id <> old.owner_id
     or new.agreed_price <> old.agreed_price
     or new.referral_code is distinct from old.referral_code
     or new.closed_by is distinct from old.closed_by
     or new.closed_at <> old.closed_at then
    raise exception 'RF-58.1 · el plan de pagos es un snapshot: no se edita, se anula.';
  end if;

  if old.voided_at is not null then
    raise exception 'Un plan anulado no cambia.';
  end if;

  if new.voided_at is null then
    raise exception 'El único cambio posible en un plan es anularlo.';
  end if;

  -- RF-58.8 · anular la compra es del Superadmin, y siempre con motivo.
  if (select auth.uid()) is not null and not private.es_superadmin() then
    raise exception 'RF-58.8 · solo el Superadmin anula una compra.';
  end if;
  if length(btrim(coalesce(new.void_reason, ''))) = 0 then
    raise exception 'RF-A.4 · la anulación de una compra no se registra sin motivo.';
  end if;

  new.voided_by := coalesce(new.voided_by, (select auth.uid()));
  if nullif(btrim(coalesce(current_setting('app.audit_reason', true), '')), '') is null then
    perform set_config('app.audit_reason', new.void_reason, true);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger payment_plans_validar_cambio
  before update on public.payment_plans
  for each row execute function private.validar_cambio_de_plan();

create trigger payment_plans_derivar
  after insert or update on public.payment_plans
  for each row execute function private.derivar_plan_tras_cambio();

-- ── Guardas del abono ───────────────────────────────────────────────────────
create or replace function private.validar_alta_de_abono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payment_plans;
  vigente bigint;
begin
  select * into p from public.payment_plans where id = new.plan_id;
  if not found then
    raise exception 'El plan de pagos no existe.';
  end if;
  if p.voided_at is not null then
    raise exception 'RF-58.8 · sobre un plan anulado no se registran abonos.';
  end if;

  new.property_id := p.property_id;
  new.registered_by := coalesce(new.registered_by, (select auth.uid()));
  new.voided_at := null;
  new.voided_by := null;
  new.void_reason := null;

  -- CA-58.2 · RF-58.4 · el abono que superaría el precio pactado se rechaza.
  select coalesce(sum(amount), 0) into vigente
  from public.payments where plan_id = new.plan_id and voided_at is null;

  if vigente + new.amount > p.agreed_price then
    raise exception 'RF-58.4 · el abono de % dejaría lo abonado (%) por encima del precio pactado (%).',
      new.amount, vigente + new.amount, p.agreed_price;
  end if;

  return new;
end;
$$;

create trigger payments_validar_alta
  before insert on public.payments
  for each row execute function private.validar_alta_de_abono();

create or replace function private.validar_anulacion_de_abono()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.plan_id <> old.plan_id
     or new.property_id <> old.property_id
     or new.amount <> old.amount
     or new.paid_on <> old.paid_on
     or new.payment_method <> old.payment_method
     or new.receipt_path <> old.receipt_path
     or new.note is distinct from old.note
     or new.registered_by is distinct from old.registered_by
     or new.created_at <> old.created_at then
    raise exception 'RF-58.5 · un abono no se edita: se anula con motivo y se registra otro.';
  end if;

  if old.voided_at is not null then
    raise exception 'Un abono anulado no cambia.';
  end if;
  if new.voided_at is null then
    raise exception 'El único cambio posible en un abono es anularlo.';
  end if;
  if length(btrim(coalesce(new.void_reason, ''))) = 0 then
    raise exception 'RF-58.5 · RF-A.4 · un abono no se anula sin motivo.';
  end if;

  new.voided_by := coalesce(new.voided_by, (select auth.uid()));
  -- El motivo viaja al registro de auditoría de esta misma operación (TR-01).
  if nullif(btrim(coalesce(current_setting('app.audit_reason', true), '')), '') is null then
    perform set_config('app.audit_reason', new.void_reason, true);
  end if;

  return new;
end;
$$;

create trigger payments_validar_anulacion
  before update on public.payments
  for each row execute function private.validar_anulacion_de_abono();

create trigger payments_derivar
  after insert or update on public.payments
  for each row execute function private.derivar_plan_tras_abono();

-- ── Rol Propietario: lo da y lo quita la titularidad, no una pantalla ───────
-- `user_roles` solo lo escribe el Superadmin por RLS; el cierre lo hace el
-- Administrador. Estos ayudantes tienen privilegio, pero solo conceden lo que los
-- hechos justifican: hay (o no hay) una fracción vendida a nombre de la cuenta.
create or replace function private.otorgar_rol_propietario(cuenta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.fractions where owner_id = cuenta and status = 'sold') then
    raise exception 'RF-06.2 · el rol Propietario solo se otorga a quien tiene una fracción vendida a su nombre.';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (cuenta, 'owner', (select auth.uid()))
  on conflict (user_id, role) do nothing;
end;
$$;

create or replace function private.retirar_rol_propietario(cuenta uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sigue siendo Propietario por otra fracción: el rol se queda.
  if exists (select 1 from public.fractions where owner_id = cuenta and status = 'sold') then
    return;
  end if;

  delete from public.user_roles where user_id = cuenta and role = 'owner';
end;
$$;

revoke execute on function private.otorgar_rol_propietario(uuid), private.retirar_rol_propietario(uuid) from public, anon;
grant execute on function private.otorgar_rol_propietario(uuid), private.retirar_rol_propietario(uuid) to authenticated, service_role;

-- ── RF-06.4 · la atribución del comprador, legible por quien cierra la venta ─
-- `profiles` solo deja leer el propio; el Administrador necesita el código con el
-- que llegó el comprador para arrastrarlo al plan, y nada más del perfil.
create or replace function private.atribucion_de(cuenta uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select referred_by_code from public.profiles where id = cuenta;
$$;

revoke execute on function private.atribucion_de(uuid) from public, anon;
grant execute on function private.atribucion_de(uuid) to authenticated, service_role;

-- ── RF-06.2 · RF-06.3 · RF-06.4 · cierre de la compra ───────────────────────
create or replace function public.cerrar_compra(invitacion uuid, precio_pactado bigint default null)
returns public.payment_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inv public.purchase_invitations;
  fraccion public.fractions;
  comprador uuid;
  codigo text;
  precio bigint;
  plan public.payment_plans;
begin
  select * into inv from public.purchase_invitations where id = invitacion;
  if not found then
    raise exception 'La invitación no existe o no es visible para esta cuenta.';
  end if;
  if inv.status <> 'pending' then
    raise exception 'La invitación ya está %.', inv.status;
  end if;
  if not private.puede_gestionar_propiedad(inv.property_id) then
    raise exception 'CA-06.1 · solo el Administrador asignado cierra compras de esta propiedad.';
  end if;

  comprador := coalesce(inv.invitee_id, private.cuenta_por_correo(inv.invitee_email));
  if comprador is null then
    raise exception 'El invitado todavía no tiene cuenta: la compra se cierra cuando la tenga.';
  end if;

  select * into fraccion from public.fractions where id = inv.fraction_id;
  if fraccion.status not in ('available', 'reserved') then
    raise exception 'RF-06.5 · la fracción ya está %; no se vuelve a vender.', fraccion.status;
  end if;

  precio := coalesce(precio_pactado, inv.agreed_price);
  if precio is null or precio <= 0 then
    raise exception 'RF-58.1 · el precio pactado debe ser mayor que cero.';
  end if;

  -- RF-06.4 · la atribución del comprador se arrastra a la compra (HU-51).
  codigo := private.atribucion_de(comprador);

  -- RF-09.2 · la máquina de la fracción no se salta: de disponible, por reservada.
  if fraccion.status = 'available' then
    update public.fractions set status = 'reserved' where id = fraccion.id;
  end if;

  -- RF-06.2 · D-31 · eje 1: vendida y vinculada a su titular. El calendario no se toca.
  update public.fractions
     set status = 'sold', owner_id = comprador
   where id = fraccion.id;

  perform private.otorgar_rol_propietario(comprador);

  -- RF-06.3 · RF-58.1 · el plan, con el precio pactado congelado.
  perform set_config('app.cerrando_compra', 'true', true);

  insert into public.payment_plans (invitation_id, fraction_id, property_id, owner_id, agreed_price, referral_code)
  values (inv.id, fraccion.id, inv.property_id, comprador, precio, codigo)
  returning * into plan;

  update public.purchase_invitations
     set status = 'accepted', accepted_at = now(), invitee_id = comprador
   where id = inv.id;

  perform set_config('app.cerrando_compra', 'false', true);

  return plan;
end;
$$;

comment on function public.cerrar_compra(uuid, bigint) is
  'HU-06 · RF-06.2, RF-06.3, RF-06.4 · cierra la compra: fracción vendida y asignada, rol Propietario, plan de pagos con precio pactado. El calendario queda inactivo (D-31).';

revoke execute on function public.cerrar_compra(uuid, bigint) from public, anon;
grant execute on function public.cerrar_compra(uuid, bigint) to authenticated, service_role;

-- ── RF-58.5 · anulación de un abono, con motivo ─────────────────────────────
create or replace function public.anular_abono(abono uuid, motivo text)
returns public.payments
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.payments;
begin
  if length(btrim(coalesce(motivo, ''))) = 0 then
    raise exception 'RF-58.5 · un abono no se anula sin motivo.';
  end if;

  perform set_config('app.audit_reason', motivo, true);

  update public.payments
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = motivo
   where id = abono
  returning * into resultado;

  perform set_config('app.audit_reason', '', true);

  if resultado.id is null then
    raise exception 'El abono no existe o no es visible para esta cuenta.';
  end if;

  return resultado;
end;
$$;

comment on function public.anular_abono(uuid, text) is
  'HU-58 · RF-58.5 · anula un abono con motivo; el estado del plan y el calendario se recalculan solos.';

revoke execute on function public.anular_abono(uuid, text) from public, anon;
grant execute on function public.anular_abono(uuid, text) to authenticated, service_role;

-- ── RF-58.8 · anulación de la compra, con todos sus efectos ─────────────────
create or replace function public.anular_compra(plan uuid, motivo text)
returns public.payment_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.payment_plans;
  resultado public.payment_plans;
begin
  if not private.es_superadmin() then
    raise exception 'RF-58.8 · solo el Superadmin anula una compra.';
  end if;
  if length(btrim(coalesce(motivo, ''))) = 0 then
    raise exception 'RF-A.4 · la anulación de una compra no se registra sin motivo.';
  end if;

  select * into p from public.payment_plans where id = plan;
  if not found then
    raise exception 'El plan de pagos no existe.';
  end if;
  if p.voided_at is not null then
    raise exception 'La compra ya estaba anulada.';
  end if;

  perform set_config('app.audit_reason', motivo, true);

  -- 1 · El plan queda anulado. Su derivación apaga el calendario y emite la reversa.
  update public.payment_plans
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = motivo
   where id = plan
  returning * into resultado;

  -- 2 · La titularidad se revierte y la fracción vuelve a disponible (D-31).
  update public.fractions
     set status = 'available', owner_id = null
   where id = p.fraction_id;

  -- 3 · El rol Propietario se retira si no le queda otra fracción.
  perform private.retirar_rol_propietario(p.owner_id);

  -- 4 · Estadías futuras y bolsa de renta: cuando existan `stays` (HU-14) y la
  --     bolsa (HU-39), sus migraciones amplían esta función. Hasta entonces no
  --     hay estadías que cancelar.

  perform set_config('app.audit_reason', '', true);

  return resultado;
end;
$$;

comment on function public.anular_compra(uuid, text) is
  'HU-58 · RF-58.8 · D-31 · el Superadmin anula una compra con motivo: calendario inactivo, fracción disponible, plan anulado y evento de reversa.';

revoke execute on function public.anular_compra(uuid, text) from public, anon;
grant execute on function public.anular_compra(uuid, text) to authenticated, service_role;

-- ── RF-58.9 · el plan con sus derivados, listo para leer ────────────────────
-- `security_invoker`: cada quien ve por la vista lo que su RLS le deja ver.
create view public.payment_plan_overview
with (security_invoker = true) as
select
  p.id,
  p.invitation_id,
  p.fraction_id,
  p.property_id,
  p.owner_id,
  p.agreed_price,
  p.referral_code,
  p.closed_by,
  p.closed_at,
  p.voided_at,
  p.voided_by,
  p.void_reason,
  f.number as fraction_number,
  f.calendar_active,
  pr.name as property_name,
  coalesce(sum(a.amount) filter (where a.voided_at is null), 0)::bigint as paid_total,
  (p.agreed_price - coalesce(sum(a.amount) filter (where a.voided_at is null), 0))::bigint as balance,
  public.derivar_estado_del_plan(
    p.agreed_price,
    coalesce(sum(a.amount) filter (where a.voided_at is null), 0)::bigint,
    p.voided_at is not null
  ) as status,
  count(a.id) filter (where a.voided_at is null) as payment_count
from public.payment_plans p
left join public.fractions f on f.id = p.fraction_id
left join public.properties pr on pr.id = p.property_id
left join public.payments a on a.plan_id = p.id
group by p.id, f.number, f.calendar_active, pr.name;

comment on view public.payment_plan_overview is
  'HU-58 · RF-58.3, RF-58.9 · plan con abonado, saldo y estado derivados. RLS por security_invoker.';

revoke all on public.payment_plan_overview from anon, authenticated, service_role;
grant select on public.payment_plan_overview to authenticated, service_role;

-- ── RF-58.2 · bucket de comprobantes, privado ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts', 'payment-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Segunda carpeta del objeto → plan.
create or replace function private.plan_de_objeto(ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_input_is_valid((storage.foldername(ruta))[2], 'uuid')
      then ((storage.foldername(ruta))[2])::uuid
    else null
  end;
$$;

revoke execute on function private.plan_de_objeto(text) from public, anon;
grant execute on function private.plan_de_objeto(text) to authenticated, service_role;

create policy payment_receipts_objetos_lectura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (
      private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
      or private.es_titular_del_plan(private.plan_de_objeto(name))
    )
  );

create policy payment_receipts_objetos_carga
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

-- Solo se retira un comprobante que ningún abono referencia: el de una carga que
-- no llegó a registrarse. El de un abono, anulado o no, es evidencia y se queda.
create policy payment_receipts_objetos_limpieza
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-receipts'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
    and not exists (select 1 from public.payments where receipt_path = name)
  );

-- ── TR-01 · RF-A.3 · todo queda auditado con su propiedad ───────────────────
create trigger payment_plans_auditada
  after insert or update or delete on public.payment_plans
  for each row execute function public.registrar_auditoria('payment_plan');

create trigger payments_auditada
  after insert or update or delete on public.payments
  for each row execute function public.registrar_auditoria('payment');

create trigger payment_events_auditada
  after insert or update or delete on public.payment_events
  for each row execute function public.registrar_auditoria('payment_event');
