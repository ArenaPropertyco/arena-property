-- HU-54 · RF-54.1…RF-54.7 · HU-53 · RF-53.1…RF-53.5 · D-01, D-02, D-04, D-07,
-- D-20 · DT-09 — el motor de comisiones: provisión, acreditación, gracia,
-- reversa, suspensión y el listado de referidos.
--
-- Seis decisiones que conviene leer antes que el código:
--
-- 1. **La comisión nace pendiente al cerrarse la compra (RF-53.3).** El disparador
--    de `payment_plans` congela el tipo del Embajador y el precio pactado (D-05,
--    D-37): un cambio posterior del catálogo no mueve lo ya provisionado. Sin tipo
--    aplicable, o con monto cero, no se inventa una comisión (principio 9).
--
-- 2. **Se acredita con el evento de pago completado (RF-54.2, RF-58.6).** Pasa a
--    gracia por 30 días (D-02) y es el único momento en que Arena devenga el egreso:
--    una fila en `platform_ledger`, jamás una cuota en la propiedad (RF-54.6, D-01).
--    Un índice único por comisión lo hace estructural.
--
-- 3. **Idempotencia por construcción (RF-54.4).** `payment_events` ya es único por
--    plan y tipo; además la acreditación solo actúa sobre una comisión pendiente,
--    cada movimiento de billetera es único por comisión y tipo, y la tarea de gracia
--    solo toca lo que sigue en gracia (DT-09).
--
-- 4. **La reversa depende del momento (RF-54.5, D-02).** Pendiente o en gracia se
--    reversa con contra-asiento en el libro de plataforma; disponible o retirada no
--    se toca y queda escrito que Arena asumió la pérdida.
--
-- 5. **La suspensión depende del motivo (RF-54.7, D-07).** Administrativa conserva
--    el saldo íntegro; por incumplimiento o fraude se reversan lo pendiente y lo en
--    gracia, y el Superadmin resuelve sobre lo disponible con motivo.
--
-- 6. **El listado es una vista con RLS (RF-53.5, D-20).** `referral_listing` corre
--    como quien consulta: el Embajador ve sus referidos y el Superadmin todos. El
--    prospecto, que sí lee su atribución, no entra aquí: la comisión es del
--    Embajador.
--
-- Las mismas reglas están en `shared/referrals/ledger.ts` y `listing.ts`.

-- ── RF-54.1 · el ciclo del saldo ────────────────────────────────────────────
create type public.commission_status as enum ('pending', 'in_grace', 'available', 'withdrawn', 'reversed');

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null references public.attributions (id) on delete cascade,
  ambassador_id uuid not null references public.ambassadors (id) on delete cascade,
  -- D-04 · la compra que la genera: una sola por prospecto.
  plan_id uuid not null references public.payment_plans (id),
  property_id uuid not null references public.properties (id),
  fraction_number smallint not null,
  -- RF-54.2 · D-05 · D-37 · el tipo y el precio con los que se calculó, congelados.
  commission_type_id uuid not null references public.commission_types (id),
  agreed_price bigint not null,
  amount bigint not null,
  status public.commission_status not null default 'pending',
  provisioned_on date not null default current_date,
  completed_on date,
  -- D-02 · el día en que pasa a disponible.
  grace_ends_on date,
  available_on date,
  reversed_at timestamptz,
  reversal_reason text,
  -- RF-54.5 · D-02 · anulada fuera de la gracia: Arena asumió la pérdida.
  loss_assumed_at timestamptz,
  -- RF-54.7 · D-07 · la decisión del Superadmin sobre lo disponible tras una suspensión.
  resolved_at timestamptz,
  resolved_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint commissions_precio_positivo check (agreed_price > 0),
  constraint commissions_monto_positivo check (amount > 0),
  constraint commissions_reversa_coherente check ((status = 'reversed') = (reversed_at is not null)),
  constraint commissions_reversa_con_motivo check ((reversed_at is null) = (reversal_reason is null)),
  constraint commissions_gracia_coherente check (
    status not in ('in_grace', 'available', 'withdrawn')
    or (completed_on is not null and grace_ends_on is not null)
  ),
  constraint commissions_disponible_coherente check (
    status not in ('available', 'withdrawn') or available_on is not null
  ),
  constraint commissions_resolucion_con_motivo check ((resolved_at is null) = (resolved_reason is null))
);

comment on table public.commissions is
  'HU-54 · RF-54.1 · D-02 · D-04 · la comisión de un referido: monto congelado sobre el precio pactado y su ciclo pendiente → en gracia → disponible → retirada, o reversada.';
comment on column public.commissions.grace_ends_on is
  'D-02 · pasa a disponible este día; hasta entonces no es retirable (RT-08).';
comment on column public.commissions.loss_assumed_at is
  'RF-54.5 · D-02 · la compra se anuló después de la gracia: no se reversa y Arena asume la pérdida.';

-- D-04 · CA-54.6 · una atribución tiene a lo sumo una comisión viva.
create unique index commissions_viva_por_atribucion on public.commissions (attribution_id) where status <> 'reversed';
create index commissions_plan_idx on public.commissions (plan_id);
create index commissions_embajador_idx on public.commissions (ambassador_id, status);
create index commissions_gracia_idx on public.commissions (grace_ends_on) where status = 'in_grace';

-- ── RF-54.1 · RF-55.2 · el histórico de billetera ───────────────────────────
-- HU-55 deriva los saldos de aquí; HU-56 añade los movimientos de retiro.
create table public.wallet_movements (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors (id) on delete cascade,
  commission_id uuid references public.commissions (id) on delete cascade,
  kind text not null,
  amount bigint not null,
  occurred_on date not null default current_date,
  note text,
  created_at timestamptz not null default now(),

  constraint wallet_movements_tipo_valido check (kind in ('commission_credited', 'commission_available', 'commission_reversed')),
  constraint wallet_movements_monto_positivo check (amount > 0),
  -- RF-54.4 · una comisión se acredita, se libera y se reversa a lo sumo una vez.
  constraint wallet_movements_unico_por_comision unique (commission_id, kind)
);

comment on table public.wallet_movements is
  'HU-54 · RF-54.1 · HU-55 · RF-55.2 · cada transición del saldo del Embajador; los saldos se derivan de aquí y nunca se guardan como contadores.';

create index wallet_movements_embajador_idx on public.wallet_movements (ambassador_id, occurred_on desc);

-- ── RLS · D-20 · el Embajador lo suyo, el Superadmin todo ───────────────────
create or replace function private.es_embajador(ambassador uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.ambassadors a
     where a.id = ambassador and a.user_id = (select auth.uid())
  );
$$;

revoke execute on function private.es_embajador(uuid) from public, anon;
grant execute on function private.es_embajador(uuid) to authenticated, service_role;

alter table public.commissions enable row level security;
alter table public.commissions force row level security;
alter table public.wallet_movements enable row level security;
alter table public.wallet_movements force row level security;

revoke all on table public.commissions, public.wallet_movements from anon, authenticated, service_role;
grant select on table public.commissions, public.wallet_movements to authenticated, service_role;

create policy commissions_lectura on public.commissions for select to authenticated
  using (private.es_superadmin() or private.es_embajador(ambassador_id));

create policy wallet_movements_lectura on public.wallet_movements for select to authenticated
  using (private.es_superadmin() or private.es_embajador(ambassador_id));

-- ── TR-01 · auditoría: toda transición lleva motivo ─────────────────────────
create trigger commissions_auditadas
  after insert or update on public.commissions
  for each row execute function public.registrar_auditoria('commission');

create trigger wallet_movements_auditados
  after insert on public.wallet_movements
  for each row execute function public.registrar_auditoria('wallet_movement');

insert into public.audit_reason_required (action, source) values
  ('commission.actualizada', 'HU-54')
on conflict (action) do nothing;

-- ── D-01 · RF-54.6 · la categoría del libro y el devengo único ──────────────
insert into public.expense_categories (name, kind, scope) values
  ('Comisión de Embajador', 'expense', 'platform')
on conflict (kind, lower(btrim(name))) do nothing;

-- CA-54.5 · una comisión devenga una sola vez en el libro de plataforma.
create unique index platform_ledger_comision_unica
  on public.platform_ledger (source_id) where source_type = 'ambassador_commission';

-- ── RF-53.1 · ayudantes de lectura acotados ─────────────────────────────────
-- `profiles` solo deja leer el propio y `properties` solo lo publicado o gestionado:
-- el listado del Embajador necesita el nombre de su referido y el de la propiedad
-- que compró, y nada más de ninguno de los dos.
create or replace function private.nombre_de_cuenta(cuenta uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select nullif(btrim(full_name), '') from public.profiles where id = cuenta;
$$;

create or replace function private.nombre_de_propiedad(propiedad uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select name from public.properties where id = propiedad;
$$;

revoke execute on function private.nombre_de_cuenta(uuid), private.nombre_de_propiedad(uuid) from public, anon;
grant execute on function private.nombre_de_cuenta(uuid), private.nombre_de_propiedad(uuid) to authenticated, service_role;

-- ── RF-53.3 · RF-54.3 · D-04 · la provisión al cerrarse la compra ───────────
create or replace function private.provisionar_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  atr public.attributions;
  tipo record;
  emb public.ambassadors;
  monto bigint;
  numero smallint;
  nombre text;
  nueva uuid;
begin
  select * into atr from public.attributions where prospect_id = new.owner_id;
  -- CA-54.7 · sin atribución en proceso de pago no hay nada que provisionar;
  -- CA-54.6 · D-04 · y quien ya generó su única comisión tampoco.
  if atr.id is null or atr.stage <> 'payment_in_progress' or atr.commissioned_purchase_id is not null then
    return new;
  end if;
  if exists (select 1 from public.commissions c where c.attribution_id = atr.id and c.status <> 'reversed') then
    return new;
  end if;

  -- RF-52.5 · el tipo que le toca hoy al Embajador; queda congelado en la fila.
  select * into tipo from public.commission_type_for(atr.ambassador_id);
  if tipo.id is null then
    return new;
  end if;
  -- RF-D.4 · truncado al peso; el producto cabe en bigint sin redondeo intermedio.
  monto := case
    when tipo.kind = 'fixed' then tipo.amount
    else (new.agreed_price * tipo.basis_points) / 10000
  end;
  if coalesce(monto, 0) <= 0 then
    return new;
  end if;

  select f.number into numero from public.fractions f where f.id = new.fraction_id;
  select p.name into nombre from public.properties p where p.id = new.property_id;

  perform set_config('app.audit_reason', 'Comisión provisionada al cerrarse la compra del referido', true);
  insert into public.commissions (
    attribution_id, ambassador_id, plan_id, property_id, fraction_number,
    commission_type_id, agreed_price, amount
  ) values (
    atr.id, atr.ambassador_id, new.id, new.property_id, numero,
    tipo.id, new.agreed_price, monto
  ) returning id into nueva;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · HU-57 · el Embajador se entera de que su referido empezó a pagar.
  select * into emb from public.ambassadors where id = atr.ambassador_id;
  perform public.emitir_notificacion(
    'referral_in_progress', 'commission', nueva::text, new.property_id,
    jsonb_build_object('referral_label', atr.prospect_email, 'property_name', nombre, 'amount', monto),
    array[emb.user_id]
  );

  return new;
end;
$$;

-- Corre después de `payment_plans_mueven_el_referido` (orden alfabético de los
-- disparadores), que es quien pone al referido «en proceso de pago».
create trigger payment_plans_provisionan_comision
  after insert on public.payment_plans
  for each row execute function private.provisionar_comision();

-- ── RF-54.2 · RF-54.4 · RF-54.6 · la acreditación ───────────────────────────
create or replace function private.acreditar_comision(plan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  emb public.ambassadors;
  categoria uuid;
  habilitada date := current_date + 30;
begin
  -- CA-54.3 · RF-54.4 · solo una comisión pendiente se acredita: reprocesar no repite.
  select * into c from public.commissions where plan_id = plan and status = 'pending';
  if c.id is null then
    return;
  end if;

  perform set_config('app.audit_reason', 'Pago completado del referido: comisión acreditada en gracia (D-02)', true);
  update public.commissions
     set status = 'in_grace', completed_on = current_date, grace_ends_on = habilitada, updated_at = now()
   where id = c.id;

  -- RF-54.1 · el movimiento de billetera.
  insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on)
  values (c.ambassador_id, c.id, 'commission_credited', c.amount, current_date)
  on conflict (commission_id, kind) do nothing;

  -- CA-54.5 · D-01 · el devengo, una sola vez y en el libro de Arena.
  select id into categoria from public.expense_categories
   where kind = 'expense' and scope = 'platform' and lower(btrim(name)) = lower('Comisión de Embajador');
  insert into public.platform_ledger (kind, amount, category_id, property_id, source_type, source_id, accrued_on, note)
  select 'expense', c.amount, categoria, c.property_id, 'ambassador_commission', c.id, current_date,
         'Comisión de Embajador por la compra de la fracción ' || c.fraction_number || '/8'
   where not exists (
     select 1 from public.platform_ledger l where l.source_type = 'ambassador_commission' and l.source_id = c.id
   );
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el Embajador se entera del monto y de cuándo podrá retirarlo.
  select * into emb from public.ambassadors where id = c.ambassador_id;
  perform public.emitir_notificacion(
    'referral_paid', 'commission', c.id::text, c.property_id,
    jsonb_build_object(
      'referral_label', (select a.prospect_email from public.attributions a where a.id = c.attribution_id),
      'amount', c.amount, 'available_on', habilitada
    ),
    array[emb.user_id]
  );
end;
$$;

-- ── RF-54.5 · RF-54.7 · la reversa de una comisión concreta ─────────────────
/**
 * Pendiente: solo cambia de estado, porque nunca entró a la billetera ni al
 * libro. En gracia: movimiento de billetera y contra-asiento en el libro.
 * Disponible o retirada: no se toca; queda escrito que Arena asume la pérdida.
 */
create or replace function private.reversar_comision(comision uuid, motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
begin
  select * into c from public.commissions where id = comision;
  if c.id is null or c.status = 'reversed' then
    return;
  end if;

  if c.status in ('available', 'withdrawn') then
    if c.loss_assumed_at is null then
      perform set_config('app.audit_reason', 'Anulación fuera de la gracia: Arena asume la pérdida (D-02). ' || motivo, true);
      update public.commissions set loss_assumed_at = now(), updated_at = now() where id = c.id;
      perform set_config('app.audit_reason', '', true);
    end if;
    return;
  end if;

  perform set_config('app.audit_reason', motivo, true);
  update public.commissions
     set status = 'reversed', reversed_at = now(), reversal_reason = motivo, updated_at = now()
   where id = c.id;

  if c.status = 'in_grace' then
    insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on, note)
    values (c.ambassador_id, c.id, 'commission_reversed', c.amount, current_date, motivo)
    on conflict (commission_id, kind) do nothing;

    -- D-01 · el contra-asiento: la fila del devengo queda reversada, no borrada.
    update public.platform_ledger
       set reversed_at = now(), reverse_reason = motivo
     where source_type = 'ambassador_commission' and source_id = c.id and reversed_at is null;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- Lo disponible o retirado también se reversa cuando el Superadmin lo decide
-- (RF-54.7): es la única puerta para hacerlo, y deja contra-asiento.
create or replace function private.reversar_disponible(comision uuid, motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
begin
  select * into c from public.commissions where id = comision and status = 'available';
  if c.id is null then
    return;
  end if;

  perform set_config('app.audit_reason', motivo, true);
  update public.commissions
     set status = 'reversed', reversed_at = now(), reversal_reason = motivo,
         resolved_at = now(), resolved_reason = motivo, updated_at = now()
   where id = c.id;
  insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on, note)
  values (c.ambassador_id, c.id, 'commission_reversed', c.amount, current_date, motivo)
  on conflict (commission_id, kind) do nothing;
  update public.platform_ledger
     set reversed_at = now(), reverse_reason = motivo
   where source_type = 'ambassador_commission' and source_id = c.id and reversed_at is null;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ── RF-54.2 · RF-54.5 · los eventos del plan mueven la comisión ─────────────
create or replace function private.procesar_evento_de_comision(plan uuid, evento text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  motivo text;
begin
  if evento = 'payment_completed' then
    perform private.acreditar_comision(plan);
  elsif evento = 'purchase_voided' then
    select * into c from public.commissions where plan_id = plan and status <> 'reversed';
    if c.id is null then
      return;
    end if;
    select 'Compra anulada: ' || coalesce(p.void_reason, 'sin motivo registrado') into motivo
      from public.payment_plans p where p.id = plan;
    perform private.reversar_comision(c.id, motivo);
  end if;
end;
$$;

revoke execute on function
  private.acreditar_comision(uuid), private.reversar_comision(uuid, text),
  private.reversar_disponible(uuid, text), private.procesar_evento_de_comision(uuid, text)
from public, anon, authenticated;

create or replace function private.comision_tras_evento_de_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.procesar_evento_de_comision(new.plan_id, new.kind::text);
  return new;
end;
$$;

-- Corre después de `payment_events_mueven_el_referido`, que marca la compra
-- comisionada en la atribución (D-04).
create trigger payment_events_mueven_la_comision
  after insert on public.payment_events
  for each row execute function private.comision_tras_evento_de_plan();

-- ── CA-54.2 · DT-09 · de gracia a disponible, por tarea programada ──────────
create or replace function public.release_commissions_in_grace(hoy date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  liberadas integer := 0;
begin
  perform set_config('app.audit_reason', 'Fin del periodo de gracia: comisión disponible para retiro (D-02)', true);
  for c in
    select x.id, x.ambassador_id, x.amount, x.property_id, a.user_id
      from public.commissions x
      join public.ambassadors a on a.id = x.ambassador_id
     where x.status = 'in_grace' and x.grace_ends_on <= hoy
     order by x.grace_ends_on, x.created_at
  loop
    update public.commissions set status = 'available', available_on = hoy, updated_at = now() where id = c.id;
    insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on)
    values (c.ambassador_id, c.id, 'commission_available', c.amount, hoy)
    on conflict (commission_id, kind) do nothing;
    -- TR-03 · el Embajador se entera de que ya puede retirar.
    perform public.emitir_notificacion(
      'commission_available', 'commission', c.id::text, c.property_id,
      jsonb_build_object('amount', c.amount), array[c.user_id]
    );
    liberadas := liberadas + 1;
  end loop;
  perform set_config('app.audit_reason', '', true);
  return liberadas;
end;
$$;

comment on function public.release_commissions_in_grace(date) is
  'HU-54 · RF-54.1 · CA-54.2 · D-02 · DT-09 · pasa a disponible toda comisión cuya gracia venció; idempotente, corre a diario en pg_cron.';

revoke execute on function public.release_commissions_in_grace(date) from public, anon, authenticated;
grant execute on function public.release_commissions_in_grace(date) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'release-commissions-in-grace';
    perform cron.schedule('release-commissions-in-grace', '20 5 * * *', $job$ select public.release_commissions_in_grace() $job$);
  end if;
end;
$$;

-- ── CA-54.8 · RF-54.7 · D-07 · la suspensión según su tipo ──────────────────
create or replace function private.comisiones_tras_suspension()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  emb public.ambassadors;
  c record;
  motivo text;
begin
  if new.status <> 'suspended' or old.status = 'suspended' or new.suspension_kind <> 'breach_or_fraud' then
    -- Administrativa, o sin cambio de estado: el saldo se conserva íntegro.
    return new;
  end if;
  select * into emb from public.ambassadors where user_id = new.id;
  if emb.id is null then
    return new;
  end if;

  motivo := 'Suspensión por incumplimiento o fraude: ' || new.suspension_reason;
  for c in
    select id from public.commissions
     where ambassador_id = emb.id and status in ('pending', 'in_grace')
     order by created_at
  loop
    perform private.reversar_comision(c.id, motivo);
  end loop;
  return new;
end;
$$;

create trigger profiles_comisiones_tras_suspension
  after update of status on public.profiles
  for each row execute function private.comisiones_tras_suspension();

-- RF-54.7 · lo disponible lo resuelve el Superadmin, con motivo: lo retira o lo
-- conserva, y en los dos casos queda constancia.
create or replace function public.resolve_available_commissions(ambassador uuid, forfeit boolean, reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  motivo text := nullif(btrim(coalesce(reason, '')), '');
  c record;
  resueltas integer := 0;
begin
  if not private.es_superadmin() then
    raise exception 'RF-54.7 · solo el Superadmin resuelve sobre el saldo disponible de un Embajador suspendido.';
  end if;
  if motivo is null then
    raise exception 'RF-54.7 · RF-A.4 · la decisión sobre el saldo disponible exige un motivo.';
  end if;
  if not exists (
    select 1 from public.ambassadors a join public.profiles p on p.id = a.user_id
     where a.id = ambassador and p.status = 'suspended'
  ) then
    raise exception 'RF-54.7 · D-07 · solo se resuelve el saldo de un Embajador suspendido.';
  end if;

  for c in
    select id from public.commissions where ambassador_id = ambassador and status = 'available' order by created_at
  loop
    if forfeit then
      perform private.reversar_disponible(c.id, 'Decisión del Superadmin tras la suspensión: ' || motivo);
    else
      perform set_config('app.audit_reason', 'El Superadmin conserva el saldo disponible: ' || motivo, true);
      update public.commissions set resolved_at = now(), resolved_reason = motivo, updated_at = now() where id = c.id;
      perform set_config('app.audit_reason', '', true);
    end if;
    resueltas := resueltas + 1;
  end loop;
  return resueltas;
end;
$$;

comment on function public.resolve_available_commissions(uuid, boolean, text) is
  'HU-54 · RF-54.7 · CA-54.8 · D-07 · el Superadmin retira o conserva, con motivo, el saldo disponible de un Embajador suspendido.';

revoke execute on function public.resolve_available_commissions(uuid, boolean, text) from public, anon;
grant execute on function public.resolve_available_commissions(uuid, boolean, text) to authenticated, service_role;

-- ── HU-53 · RF-53.1…RF-53.5 · el listado de referidos ───────────────────────
-- Cada referido con su etapa (HU-51) y, si compró, la comisión viva o, en su
-- defecto, la última reversada. `security_invoker`: las políticas de
-- `attributions` y `commissions` siguen mandando, y el filtro acota a quien lista.
create view public.referral_listing
with (security_invoker = true) as
select
  a.id,
  a.ambassador_id,
  a.prospect_id,
  a.prospect_email,
  private.nombre_de_cuenta(a.prospect_id) as prospect_name,
  (a.registered_at at time zone 'America/Bogota')::date as referred_on,
  a.stage,
  c.id as commission_id,
  c.plan_id,
  c.property_id,
  private.nombre_de_propiedad(c.property_id) as property_name,
  c.fraction_number,
  c.amount as commission_amount,
  c.status as commission_status,
  c.grace_ends_on
from public.attributions a
left join lateral (
  select x.* from public.commissions x
   where x.attribution_id = a.id
   order by (x.status <> 'reversed') desc, x.created_at desc
   limit 1
) c on true
where private.es_superadmin() or private.es_embajador(a.ambassador_id);

comment on view public.referral_listing is
  'HU-53 · RF-53.1…RF-53.5 · D-20 · los referidos de un Embajador con su etapa y su comisión; el Superadmin los ve todos.';

revoke all on public.referral_listing from anon, authenticated, service_role;
grant select on public.referral_listing to authenticated, service_role;
