-- HU-55 · RF-55.1…RF-55.5 · HU-56 · RF-56.1…RF-56.6 · HU-57 · RF-57.1…RF-57.4 ·
-- D-01, D-02, D-06, D-20, D-50 · TR-01, TR-03 — la billetera del Embajador, la
-- solicitud de retiro con su ciclo y los avisos que la acompañan.
--
-- Seis decisiones que conviene leer antes que el código:
--
-- 1. **Los saldos se derivan, nunca se guardan (RF-55.2).** `wallet_movements` es
--    el histórico completo: HU-54 ya escribía acreditación, paso a disponible y
--    reversa; aquí entran solicitud, aprobación y pago del retiro. Una sola
--    función (`private.saldos_de_billetera`) agrega el histórico y nada la
--    contradice: la validación del retiro y la vista `wallet_balances` la llaman.
--    La misma regla vive en `shared/referrals/wallet.ts`.
--
-- 2. **El disponible se descuenta al aprobarse (RF-56.3).** Solicitar no mueve el
--    saldo —el rechazo no descuenta— y pagar tampoco: paga lo ya comprometido.
--    Por eso el movimiento que resta es `withdrawal_approved`.
--
-- 3. **El retiro parcial se imputa por antigüedad (D-06, D-50).** Un retiro puede
--    no cubrir una comisión entera, así que cada comisión lleva cuánto se le ha
--    retirado; pasa a `retirada` cuando queda cubierta. Así HU-32 sigue midiendo
--    lo pagado y una reversa posterior (RF-54.7) solo alcanza lo que aún no se
--    entregó.
--
-- 4. **Una sola solicitud abierta, por restricción (CA-56.5).** El índice único
--    parcial lo garantiza aunque la función lo compruebe antes con un mensaje
--    legible.
--
-- 5. **El pago no devenga nada (RF-56.5, D-01).** El egreso ya se registró al
--    acreditarse la comisión; pagar deja el comprobante, el movimiento de
--    billetera y el aviso. Ninguna fila entra en `platform_ledger`.
--
-- 6. **Avisa aprobada y pagada, no el rechazo (RF-57.1, CA-57.3).** El rechazo
--    queda en la bandeja con su motivo. Cada aviso es idempotente por
--    `emitir_notificacion` (RF-57.4) y toda transición queda auditada con motivo.

-- ── HU-56 · RF-56.1 · D-06 · el mínimo configurable ────────────────────────
create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

comment on table public.platform_settings is
  'HU-56 · RF-56.1 · D-06 · ajustes de plataforma que fija el Superadmin; hoy, el mínimo de retiro. Lectura de cualquier cuenta, escritura solo por función.';

alter table public.platform_settings enable row level security;
alter table public.platform_settings force row level security;
revoke all on table public.platform_settings from anon, authenticated, service_role;
grant select on table public.platform_settings to authenticated, service_role;

create policy platform_settings_lectura on public.platform_settings for select to authenticated using (true);

create trigger platform_settings_auditados
  after insert or update on public.platform_settings
  for each row execute function public.registrar_auditoria('platform_setting');

insert into public.platform_settings (key, value) values ('withdrawal_minimum', to_jsonb(200000::bigint))
on conflict (key) do nothing;

create or replace function public.withdrawal_minimum()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select (s.value #>> '{}')::bigint from public.platform_settings s where s.key = 'withdrawal_minimum'),
    200000
  );
$$;

comment on function public.withdrawal_minimum() is
  'HU-56 · RF-56.1 · D-06 · el mínimo vigente de un retiro; $200.000 si nadie fijó otro.';

revoke execute on function public.withdrawal_minimum() from public, anon;
grant execute on function public.withdrawal_minimum() to authenticated, service_role;

create or replace function public.set_withdrawal_minimum(amount bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'RF-56.1 · D-06 · solo el Superadmin fija el mínimo de retiro.';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'RF-56.1 · el mínimo de retiro debe ser un entero mayor que cero.';
  end if;

  perform set_config('app.audit_reason', 'El Superadmin fija el mínimo de retiro en ' || amount || ' pesos (D-06)', true);
  insert into public.platform_settings (key, value, updated_by)
  values ('withdrawal_minimum', to_jsonb(amount), (select auth.uid()))
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
  perform set_config('app.audit_reason', '', true);

  return amount;
end;
$$;

comment on function public.set_withdrawal_minimum(bigint) is
  'HU-56 · RF-56.1 · D-06 · el Superadmin fija el mínimo de retiro; queda auditado.';

revoke execute on function public.set_withdrawal_minimum(bigint) from public, anon;
grant execute on function public.set_withdrawal_minimum(bigint) to authenticated, service_role;

-- ── HU-56 · RF-56.2 · RF-56.3 · la solicitud de retiro ─────────────────────
create table public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors (id) on delete cascade,
  amount bigint not null,
  status text not null default 'requested',
  requested_on date not null default current_date,
  approved_at timestamptz,
  rejected_at timestamptz,
  paid_at timestamptz,
  -- El Superadmin que resolvió (aprobó o rechazó) y, si la pagó, el mismo.
  resolved_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  -- RF-56.4 · el comprobante en el bucket withdrawal-receipts, bajo la carpeta del Embajador.
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint withdrawal_requests_monto_positivo check (amount > 0),
  constraint withdrawal_requests_estado_valido check (status in ('requested', 'approved', 'paid', 'rejected')),
  -- CA-56.4 · rechazada si y solo si hay motivo.
  constraint withdrawal_requests_rechazo_con_motivo check ((status = 'rejected') = (rejection_reason is not null)),
  -- CA-56.6 · pagada exige comprobante.
  constraint withdrawal_requests_pago_con_comprobante check (status <> 'paid' or receipt_path is not null),
  -- RF-56.2 · cada estado lleva exactamente las fechas de su camino.
  constraint withdrawal_requests_fechas_coherentes check (
    (status = 'requested' and approved_at is null and rejected_at is null and paid_at is null)
    or (status = 'approved' and approved_at is not null and rejected_at is null and paid_at is null)
    or (status = 'paid' and approved_at is not null and paid_at is not null and rejected_at is null)
    or (status = 'rejected' and rejected_at is not null and approved_at is null and paid_at is null)
  )
);

comment on table public.withdrawal_requests is
  'HU-56 · RF-56.2 · D-06 · la solicitud de retiro del Embajador: solicitada → aprobada → pagada, o solicitada → rechazada con motivo.';
comment on column public.withdrawal_requests.receipt_path is
  'HU-56 · RF-56.4 · CA-56.6 · el comprobante del pago en Storage; sin él no hay paso a pagada.';

-- CA-56.5 · RF-56.3 · una sola solicitud abierta por Embajador, por restricción.
create unique index withdrawal_requests_abierta_unica
  on public.withdrawal_requests (ambassador_id) where status in ('requested', 'approved');
create index withdrawal_requests_bandeja_idx on public.withdrawal_requests (status, created_at desc);

alter table public.withdrawal_requests enable row level security;
alter table public.withdrawal_requests force row level security;
revoke all on table public.withdrawal_requests from anon, authenticated, service_role;
grant select on table public.withdrawal_requests to authenticated, service_role;

-- D-20 · el Embajador la suya; el Superadmin todas, porque las resuelve.
create policy withdrawal_requests_lectura on public.withdrawal_requests for select to authenticated
  using (private.es_superadmin() or private.es_embajador(ambassador_id));

-- TR-01 · RF-56.6 · toda transición lleva motivo.
create trigger withdrawal_requests_auditadas
  after insert or update on public.withdrawal_requests
  for each row execute function public.registrar_auditoria('withdrawal_request');

insert into public.audit_reason_required (action, source) values
  ('withdrawal_request.actualizada', 'HU-56')
on conflict (action) do nothing;

-- ── HU-55 · RF-55.2 · el histórico completo de la billetera ────────────────
alter table public.wallet_movements
  add column withdrawal_id uuid references public.withdrawal_requests (id) on delete cascade;

comment on column public.wallet_movements.withdrawal_id is
  'HU-56 · la solicitud de retiro que origina el movimiento; nula en los de comisión.';

alter table public.wallet_movements drop constraint wallet_movements_tipo_valido;
alter table public.wallet_movements add constraint wallet_movements_tipo_valido check (kind in (
  'commission_credited', 'commission_available', 'commission_reversed',
  'withdrawal_requested', 'withdrawal_approved', 'withdrawal_paid'
));
-- Cada movimiento nace de una comisión o de un retiro, nunca de los dos ni de ninguno.
alter table public.wallet_movements add constraint wallet_movements_origen_coherente check (
  (kind like 'commission!_%' escape '!' and commission_id is not null and withdrawal_id is null)
  or (kind like 'withdrawal!_%' escape '!' and withdrawal_id is not null and commission_id is null)
);
-- RF-56.6 · un retiro se solicita, se aprueba y se paga a lo sumo una vez.
alter table public.wallet_movements add constraint wallet_movements_unico_por_retiro unique (withdrawal_id, kind);

create index wallet_movements_retiro_idx on public.wallet_movements (withdrawal_id) where withdrawal_id is not null;

-- ── D-50 · cuánto de cada comisión se ha retirado ───────────────────────────
alter table public.commissions
  add column withdrawn_amount bigint not null default 0,
  add constraint commissions_retiro_acotado check (withdrawn_amount >= 0 and withdrawn_amount <= amount),
  add constraint commissions_retirada_coherente check (status <> 'withdrawn' or withdrawn_amount = amount);

comment on column public.commissions.withdrawn_amount is
  'HU-56 · D-06 · D-50 · lo ya imputado a retiros aprobados; la comisión pasa a retirada cuando iguala su monto.';

-- ── RF-55.2 · la agregación de los saldos ───────────────────────────────────
-- Misma regla que `walletBalances` en `shared/referrals/wallet.ts`:
--   por comisión: acreditado − reversado, en gracia mientras no se libere;
--   disponible = lo liberado y no reversado − lo aprobado en retiros;
--   ganado = acreditado − reversado; pendiente sale de las comisiones, que
--   todavía no han entrado a la billetera (RF-54.1).
create or replace function private.saldos_de_billetera(ambassador uuid)
returns table (pending bigint, in_grace bigint, available bigint, withdrawn bigint, reversed bigint, total_earned bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with por_comision as (
    select w.commission_id,
           coalesce(sum(w.amount) filter (where w.kind = 'commission_credited'), 0) as acreditado,
           coalesce(sum(w.amount) filter (where w.kind = 'commission_reversed'), 0) as reversado,
           bool_or(w.kind = 'commission_available') as liberada
      from public.wallet_movements w
     where w.ambassador_id = ambassador and w.commission_id is not null
     group by w.commission_id
  ),
  retiros as (
    select coalesce(sum(w.amount) filter (where w.kind = 'withdrawal_approved'), 0) as aprobado
      from public.wallet_movements w
     where w.ambassador_id = ambassador and w.withdrawal_id is not null
  )
  select
    (select coalesce(sum(c.amount), 0) from public.commissions c where c.ambassador_id = ambassador and c.status = 'pending'),
    coalesce(sum(acreditado - reversado) filter (where not liberada), 0),
    coalesce(sum(acreditado - reversado) filter (where liberada), 0) - (select aprobado from retiros),
    (select aprobado from retiros),
    coalesce(sum(reversado), 0),
    coalesce(sum(acreditado), 0) - coalesce(sum(reversado), 0)
  from por_comision;
$$;

comment on function private.saldos_de_billetera(uuid) is
  'HU-55 · RF-55.2 · CA-55.1 · los saldos derivados del histórico; ninguna tabla los guarda.';

revoke execute on function private.saldos_de_billetera(uuid) from public, anon;
grant execute on function private.saldos_de_billetera(uuid) to authenticated, service_role;

-- RF-55.4 · D-20 · los saldos de cada Embajador: los suyos, y el Superadmin todos.
create view public.wallet_balances
with (security_invoker = true) as
select a.id as ambassador_id, a.user_id, b.pending, b.in_grace, b.available, b.withdrawn, b.reversed, b.total_earned
  from public.ambassadors a
  cross join lateral private.saldos_de_billetera(a.id) b
 where private.es_superadmin() or private.es_embajador(a.id);

comment on view public.wallet_balances is
  'HU-55 · RF-55.1 · RF-55.4 · D-20 · los cuatro saldos por Embajador, derivados; el Superadmin ve los de todos.';

revoke all on public.wallet_balances from anon, authenticated, service_role;
grant select on public.wallet_balances to authenticated, service_role;

-- RF-55.3 · cada movimiento con su referido, su propiedad y, si es de retiro, el estado de la solicitud.
create view public.wallet_listing
with (security_invoker = true) as
select
  w.id,
  w.ambassador_id,
  w.kind,
  w.amount,
  w.occurred_on,
  w.created_at,
  w.commission_id,
  w.withdrawal_id,
  w.note,
  a.prospect_email as referral_label,
  private.nombre_de_propiedad(c.property_id) as property_name,
  c.fraction_number,
  c.grace_ends_on,
  r.status as withdrawal_status
from public.wallet_movements w
left join public.commissions c on c.id = w.commission_id
left join public.attributions a on a.id = c.attribution_id
left join public.withdrawal_requests r on r.id = w.withdrawal_id
where private.es_superadmin() or private.es_embajador(w.ambassador_id);

comment on view public.wallet_listing is
  'HU-55 · RF-55.3 · D-20 · el histórico de la billetera listo para leerse; el Embajador el suyo y el Superadmin todos.';

revoke all on public.wallet_listing from anon, authenticated, service_role;
grant select on public.wallet_listing to authenticated, service_role;

-- ── RF-56.4 · el comprobante del pago ───────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'withdrawal-receipts', 'withdrawal-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- La primera carpeta de la ruta es el Embajador dueño del comprobante.
create or replace function private.embajador_de_objeto(ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_input_is_valid((storage.foldername(ruta))[1], 'uuid')
      then ((storage.foldername(ruta))[1])::uuid
    else null
  end;
$$;

-- Lo lee el Superadmin y el Embajador al que le pagaron.
create policy withdrawal_receipts_objetos_lectura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'withdrawal-receipts'
    and (private.es_superadmin() or private.es_embajador(private.embajador_de_objeto(name)))
  );

-- Solo el Superadmin registra pagos, así que solo él sube comprobantes.
create policy withdrawal_receipts_objetos_carga
  on storage.objects for insert to authenticated
  with check (bucket_id = 'withdrawal-receipts' and private.es_superadmin());

-- Solo se retira un comprobante que ninguna solicitud referencia: el de una carga fallida.
create policy withdrawal_receipts_objetos_limpieza
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'withdrawal-receipts'
    and private.es_superadmin()
    and not exists (select 1 from public.withdrawal_requests r where r.receipt_path = name)
  );

-- ── RF-56.1 · CA-56.1 · CA-56.5 · la solicitud ──────────────────────────────
create or replace function public.request_withdrawal(amount bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  emb public.ambassadors;
  minimo bigint;
  disponible bigint;
  nueva uuid;
begin
  select a.* into emb
    from public.ambassadors a
    join public.profiles p on p.id = a.user_id
   where a.user_id = (select auth.uid()) and a.status = 'approved' and p.status = 'active';
  if emb.id is null then
    raise exception 'RF-56.1 · solo un Embajador aprobado y activo solicita retiros.';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'CA-56.1 · RF-56.1 · el monto del retiro debe ser un entero mayor que cero.';
  end if;

  minimo := public.withdrawal_minimum();
  if amount < minimo then
    raise exception 'CA-56.1 · RF-56.1 · D-06 · el retiro mínimo es de % pesos.', minimo;
  end if;

  -- RT-08 · solo lo disponible: ni lo pendiente ni lo en gracia se retira.
  select b.available into disponible from private.saldos_de_billetera(emb.id) b;
  if amount > disponible then
    raise exception 'CA-56.1 · RF-56.1 · el monto supera el saldo disponible (% pesos).', disponible;
  end if;

  if exists (
    select 1 from public.withdrawal_requests r
     where r.ambassador_id = emb.id and r.status in ('requested', 'approved')
  ) then
    raise exception 'CA-56.5 · RF-56.3 · ya hay una solicitud de retiro abierta; espera a que se resuelva.';
  end if;

  perform set_config('app.audit_reason', 'Solicitud de retiro del Embajador por ' || amount || ' pesos', true);
  insert into public.withdrawal_requests (ambassador_id, amount) values (emb.id, amount) returning id into nueva;
  -- RF-55.2 · queda en el histórico, pero no descuenta: eso es de la aprobación (RF-56.3).
  insert into public.wallet_movements (ambassador_id, withdrawal_id, kind, amount, occurred_on)
  values (emb.id, nueva, 'withdrawal_requested', amount, current_date)
  on conflict (withdrawal_id, kind) do nothing;
  perform set_config('app.audit_reason', '', true);

  return nueva;
end;
$$;

comment on function public.request_withdrawal(bigint) is
  'HU-56 · RF-56.1 · CA-56.1 · CA-56.5 · D-06 · el Embajador pide retirar parte o todo su disponible, nunca por debajo del mínimo ni con otra solicitud abierta.';

revoke execute on function public.request_withdrawal(bigint) from public, anon;
grant execute on function public.request_withdrawal(bigint) to authenticated, service_role;

-- ── RF-56.2 · RF-56.3 · D-50 · la aprobación descuenta e imputa ─────────────
create or replace function public.approve_withdrawal(request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.withdrawal_requests;
  emb public.ambassadors;
  disponible bigint;
  restante bigint;
  parte bigint;
  c record;
begin
  if not private.es_superadmin() then
    raise exception 'RF-56.2 · D-20 · solo el Superadmin aprueba un retiro.';
  end if;
  select * into r from public.withdrawal_requests where id = request for update;
  if r.id is null then
    raise exception 'RF-56.2 · la solicitud de retiro no existe.';
  end if;
  if r.status <> 'requested' then
    raise exception 'CA-56.3 · RF-56.2 · solo se aprueba una solicitud en estado solicitada (está %).', r.status;
  end if;

  select * into emb from public.ambassadors where id = r.ambassador_id;
  if not exists (select 1 from public.profiles p where p.id = emb.user_id and p.status = 'active') then
    raise exception 'RF-33.3 · D-07 · la cuenta del Embajador está suspendida: resuelve primero su saldo.';
  end if;

  -- El saldo pudo bajar desde la solicitud (una reversa, por ejemplo): se vuelve a mirar.
  select b.available into disponible from private.saldos_de_billetera(r.ambassador_id) b;
  if r.amount > disponible then
    raise exception 'RF-56.3 · el saldo disponible (% pesos) ya no cubre el retiro.', disponible;
  end if;

  perform set_config('app.audit_reason', 'Retiro aprobado por el Superadmin: el disponible se descuenta (RF-56.3)', true);

  -- D-50 · se imputa a las comisiones disponibles de la más antigua a la más nueva.
  restante := r.amount;
  for c in
    select x.id, x.amount, x.withdrawn_amount
      from public.commissions x
     where x.ambassador_id = r.ambassador_id and x.status = 'available'
     order by x.available_on, x.created_at
  loop
    exit when restante <= 0;
    parte := least(restante, c.amount - c.withdrawn_amount);
    if parte > 0 then
      update public.commissions
         set withdrawn_amount = withdrawn_amount + parte,
             status = case when withdrawn_amount + parte = amount then 'withdrawn'::public.commission_status else status end,
             updated_at = now()
       where id = c.id;
      restante := restante - parte;
    end if;
  end loop;
  if restante > 0 then
    raise exception 'RF-56.3 · las comisiones disponibles no cubren el retiro: el saldo está inconsistente.';
  end if;

  update public.withdrawal_requests
     set status = 'approved', approved_at = now(), resolved_by = (select auth.uid()), updated_at = now()
   where id = r.id;
  insert into public.wallet_movements (ambassador_id, withdrawal_id, kind, amount, occurred_on)
  values (r.ambassador_id, r.id, 'withdrawal_approved', r.amount, current_date)
  on conflict (withdrawal_id, kind) do nothing;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · HU-57 · RF-57.1 · el Embajador se entera; una sola vez (RF-57.4).
  perform public.emitir_notificacion(
    'withdrawal_approved', 'withdrawal_request', r.id::text, null,
    jsonb_build_object('amount', r.amount), array[emb.user_id]
  );
end;
$$;

comment on function public.approve_withdrawal(uuid) is
  'HU-56 · RF-56.2 · RF-56.3 · CA-56.2 · CA-56.3 · D-50 · el Superadmin aprueba: descuenta el disponible, imputa por antigüedad y avisa.';

revoke execute on function public.approve_withdrawal(uuid) from public, anon;
grant execute on function public.approve_withdrawal(uuid) to authenticated, service_role;

-- ── RF-56.2 · CA-56.4 · el rechazo, con motivo y sin descuento ──────────────
create or replace function public.reject_withdrawal(request uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.withdrawal_requests;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
begin
  if not private.es_superadmin() then
    raise exception 'RF-56.2 · D-20 · solo el Superadmin rechaza un retiro.';
  end if;
  if motivo is null then
    raise exception 'CA-56.4 · RF-56.2 · el rechazo exige un motivo.';
  end if;
  select * into r from public.withdrawal_requests where id = request for update;
  if r.id is null then
    raise exception 'RF-56.2 · la solicitud de retiro no existe.';
  end if;
  if r.status <> 'requested' then
    raise exception 'CA-56.3 · RF-56.2 · solo se rechaza una solicitud en estado solicitada (está %).', r.status;
  end if;

  perform set_config('app.audit_reason', 'Retiro rechazado: ' || motivo, true);
  update public.withdrawal_requests
     set status = 'rejected', rejected_at = now(), rejection_reason = motivo,
         resolved_by = (select auth.uid()), updated_at = now()
   where id = r.id;
  perform set_config('app.audit_reason', '', true);
  -- CA-56.4 · sin movimiento: el disponible no cambia. CA-57.3 · sin aviso: se ve en la bandeja.
end;
$$;

comment on function public.reject_withdrawal(uuid, text) is
  'HU-56 · RF-56.2 · CA-56.4 · el Superadmin rechaza con motivo; el disponible no se toca y no se notifica (CA-57.3).';

revoke execute on function public.reject_withdrawal(uuid, text) from public, anon;
grant execute on function public.reject_withdrawal(uuid, text) to authenticated, service_role;

-- ── RF-56.4 · RF-56.5 · CA-56.6 · CA-56.7 · el pago con comprobante ─────────
create or replace function public.pay_withdrawal(request uuid, receipt_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.withdrawal_requests;
  emb public.ambassadors;
  ruta text := nullif(btrim(coalesce(receipt_path, '')), '');
begin
  if not private.es_superadmin() then
    raise exception 'RF-56.4 · D-20 · solo el Superadmin registra el pago de un retiro.';
  end if;
  select * into r from public.withdrawal_requests where id = request for update;
  if r.id is null then
    raise exception 'RF-56.2 · la solicitud de retiro no existe.';
  end if;
  if r.status <> 'approved' then
    raise exception 'CA-56.3 · RF-56.2 · solo se paga una solicitud aprobada (está %).', r.status;
  end if;
  if ruta is null then
    raise exception 'CA-56.6 · RF-56.4 · el pago exige el comprobante.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'withdrawal-receipts' and o.name = ruta) then
    raise exception 'CA-56.6 · RF-56.4 · el comprobante no está en el bucket withdrawal-receipts.';
  end if;

  select * into emb from public.ambassadors where id = r.ambassador_id;

  perform set_config('app.audit_reason', 'Retiro pagado con comprobante; sin egreso nuevo (RF-56.5, D-01)', true);
  update public.withdrawal_requests
     set status = 'paid', paid_at = now(), receipt_path = ruta, updated_at = now()
   where id = r.id;
  -- CA-55.4 · aparece en la billetera; CA-56.7 · nada entra en platform_ledger.
  insert into public.wallet_movements (ambassador_id, withdrawal_id, kind, amount, occurred_on)
  values (r.ambassador_id, r.id, 'withdrawal_paid', r.amount, current_date)
  on conflict (withdrawal_id, kind) do nothing;
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'withdrawal_paid', 'withdrawal_request', r.id::text, null,
    jsonb_build_object('amount', r.amount), array[emb.user_id]
  );
end;
$$;

comment on function public.pay_withdrawal(uuid, text) is
  'HU-56 · RF-56.4 · RF-56.5 · CA-56.6 · CA-56.7 · D-01 · el Superadmin registra el pago con su comprobante; solo tesorería y billetera, ningún egreso nuevo.';

revoke execute on function public.pay_withdrawal(uuid, text) from public, anon;
grant execute on function public.pay_withdrawal(uuid, text) to authenticated, service_role;

-- ── RF-54.7 · D-50 · la reversa de lo disponible respeta lo ya retirado ─────
-- Solo se reversa lo que aún no se entregó. Si parte ya se pagó, el egreso de
-- esa parte es real y el contra-asiento del libro no procede (D-01).
create or replace function private.reversar_disponible(comision uuid, motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  restante bigint;
begin
  select * into c from public.commissions where id = comision and status = 'available';
  if c.id is null then
    return;
  end if;
  restante := c.amount - c.withdrawn_amount;
  if restante <= 0 then
    return;
  end if;

  perform set_config('app.audit_reason', motivo, true);
  update public.commissions
     set status = 'reversed', reversed_at = now(), reversal_reason = motivo,
         resolved_at = now(), resolved_reason = motivo, updated_at = now()
   where id = c.id;
  insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on, note)
  values (c.ambassador_id, c.id, 'commission_reversed', restante, current_date, motivo)
  on conflict (commission_id, kind) do nothing;
  if c.withdrawn_amount = 0 then
    update public.platform_ledger
       set reversed_at = now(), reverse_reason = motivo
     where source_type = 'ambassador_commission' and source_id = c.id and reversed_at is null;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

-- ── HU-32 · RF-32.1 · D-50 · las métricas leen lo retirado por importe ──────
create or replace function public.platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-32.3 · RF-32.3 · solo el Superadmin consulta las métricas globales.';
  end if;

  return jsonb_build_object(
    'properties', (select count(*) from public.properties),
    'fractions_total', (select count(*) from public.fractions),
    'fractions_sold', (select count(*) from public.fractions where status = 'sold'),
    -- HU-05 · activo: con el rol, cuenta activa y alguna asignación vigente.
    'active_admins', (
      select count(distinct pa.admin_id)
        from public.property_admins pa
        join public.profiles p on p.id = pa.admin_id
        join public.user_roles r on r.user_id = pa.admin_id and r.role = 'property_admin'
       where pa.revoked_at is null and p.status = 'active'
    ),
    'owners', (
      select count(distinct f.owner_id)
        from public.fractions f
        join public.profiles p on p.id = f.owner_id
       where f.status = 'sold' and p.status = 'active'
    ),
    -- HU-49 · activo: aprobado y con la cuenta activa.
    'active_ambassadors', (
      select count(*)
        from public.ambassadors a
        join public.profiles p on p.id = a.user_id
       where a.status = 'approved' and p.status = 'active'
    ),
    -- RF-32.1 · D-50 · cada comisión está en un solo estado; lo retirado se mide
    -- por importe imputado, porque un retiro parcial deja la comisión disponible
    -- por el resto.
    'commissions', (
      select jsonb_build_object(
        'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
        'in_grace', coalesce(sum(amount) filter (where status = 'in_grace'), 0),
        'available', coalesce(sum(amount - withdrawn_amount) filter (where status = 'available'), 0),
        'withdrawn', coalesce(sum(withdrawn_amount) filter (where status in ('available', 'withdrawn')), 0)
      ) from public.commissions
    ),
    -- RF-32.2 · una venta es una compra cerrada y no anulada, en la fecha de Bogotá.
    'sales', (
      select coalesce(jsonb_agg(jsonb_build_object('on', (pp.closed_at at time zone 'America/Bogota')::date) order by pp.closed_at), '[]'::jsonb)
        from public.payment_plans pp
       where pp.voided_at is null
    ),
    'commission_events', (
      select coalesce(jsonb_agg(jsonb_build_object('on', c.provisioned_on, 'amount', c.amount) order by c.provisioned_on), '[]'::jsonb)
        from public.commissions c
       where c.status <> 'reversed'
    )
  );
end;
$$;
