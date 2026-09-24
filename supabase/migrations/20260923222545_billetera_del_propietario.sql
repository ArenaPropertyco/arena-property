-- HU-62 · RF-62.1…RF-62.14 · D-08, D-09, D-10, D-51 · TR-01, TR-02, TR-03 — la
-- billetera del Propietario: el corte mensual, el saldo derivado por propiedad, el
-- cobro por saldo negativo con su pago, el retiro del saldo positivo y los avisos.
--
-- Seis decisiones que conviene leer antes que el código:
--
-- 1. **El corte es una foto que no se retoca (RF-62.4, RF-62.5).** Un corte por
--    fracción y mes, garantizado por restricción única; cada cuota entra a lo sumo
--    una vez como cargo y una como reversa. Lo que llega tarde —una cuota causada
--    en un mes ya cortado, o la anulación de una ya liquidada— entra al corte
--    siguiente como ajuste de periodo anterior. Relanzar el corte no duplica.
--
-- 2. **El saldo se deriva, nunca se guarda (RF-62.2).** `owner_wallet_movements`
--    es el histórico: el neto de cada corte, cada pago confirmado y cada retiro
--    pagado, con su efecto en el saldo ya firmado. `private.saldo_de_propietario`
--    lo suma y la vista `owner_wallet_balances` lo expone. La misma regla vive en
--    `shared/finance/billetera.ts`.
--
-- 3. **Cada propiedad se liquida por separado (D-51).** El cobro nace del saldo
--    de una propiedad y solo por lo que ningún cobro abierto cubre ya; un saldo
--    positivo en otra propiedad no lo paga.
--
-- 4. **El estado del cobro se deriva de sus pagos (RF-62.8).** En revisión
--    mientras haya un pago reportado; pagado cuando lo confirmado lo cubre;
--    pendiente en cualquier otro caso. Solo el pago confirmado mueve el saldo.
--
-- 5. **Preparado para una pasarela sin instalarla (RF-62.11, D-10).** El pago
--    lleva canal, proveedor y referencia externa única por proveedor; los estados
--    son los que una pasarela devuelve. Hoy solo existe el canal manual.
--
-- 6. **Ni el pago ni el retiro devengan nada (D-51).** Saldan cuotas que HU-23 y
--    HU-40 ya causaron: dejan comprobante, movimiento de billetera, auditoría y
--    aviso, y ninguna fila entra a `movements`.

-- ── RF-62.3 · RF-62.4 · el corte ────────────────────────────────────────────
create table public.owner_statements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id),
  fraction_number smallint not null,
  -- El titular al momento del corte: solo sus cuotas se liquidan.
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- El primer día del mes cortado.
  period date not null,
  income bigint not null default 0,
  expenses bigint not null default 0,
  net bigint not null default 0,
  closed_at timestamptz not null default now(),

  constraint owner_statements_periodo_es_mes check (period = date_trunc('month', period)::date),
  constraint owner_statements_neto_coherente check (net = income - expenses),
  constraint owner_statements_unico_por_fraccion_y_mes unique (fraction_id, period)
);

comment on table public.owner_statements is
  'HU-62 · RF-62.3 · RF-62.4 · D-51 · el corte mensual de una fracción: ingresos, gastos y neto del mes, uno por fracción y periodo, que no se edita.';

create index owner_statements_propietario_idx on public.owner_statements (owner_id, property_id, period desc);
create index owner_statements_propiedad_idx on public.owner_statements (property_id, period desc);

create table public.owner_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.owner_statements (id) on delete cascade,
  share_id uuid not null references public.movement_shares (id),
  movement_id uuid not null references public.movements (id),
  kind public.movement_kind not null,
  -- Cómo entra: como cargo o como reversa de un cargo de un corte anterior.
  entry text not null,
  amount bigint not null,
  -- D-09 · el mes de causación de la cuota.
  origin_period date not null,
  -- RF-62.5 · nació en un mes anterior al del corte.
  adjustment boolean not null default false,

  constraint owner_statement_lines_entrada_valida check (entry in ('charge', 'reversal')),
  constraint owner_statement_lines_monto_positivo check (amount > 0),
  constraint owner_statement_lines_unica_por_cuota unique (share_id, entry)
);

comment on table public.owner_statement_lines is
  'HU-62 · RF-62.4 · RF-62.5 · las cuotas que forman un corte; cada una entra a lo sumo una vez como cargo y una como reversa.';

create index owner_statement_lines_corte_idx on public.owner_statement_lines (statement_id);

-- ── RF-62.2 · el histórico de la billetera ──────────────────────────────────
create table public.owner_wallet_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  fraction_id uuid references public.fractions (id),
  kind text not null,
  -- El efecto en el saldo, ya firmado: el neto del corte, el pago en positivo, el retiro en negativo.
  amount bigint not null,
  occurred_on date not null default current_date,
  statement_id uuid references public.owner_statements (id) on delete cascade,
  payment_id uuid,
  withdrawal_id uuid,
  created_at timestamptz not null default now(),

  constraint owner_wallet_movements_tipo_valido check (kind in ('statement_closed', 'payment_confirmed', 'withdrawal_paid')),
  -- Cada movimiento nace de un corte, de un pago o de un retiro, y de uno solo.
  constraint owner_wallet_movements_origen_coherente check (
    (kind = 'statement_closed' and statement_id is not null and payment_id is null and withdrawal_id is null)
    or (kind = 'payment_confirmed' and payment_id is not null and statement_id is null and withdrawal_id is null)
    or (kind = 'withdrawal_paid' and withdrawal_id is not null and statement_id is null and payment_id is null)
  ),
  constraint owner_wallet_movements_unico_por_corte unique (statement_id),
  constraint owner_wallet_movements_unico_por_pago unique (payment_id),
  constraint owner_wallet_movements_unico_por_retiro unique (withdrawal_id)
);

comment on table public.owner_wallet_movements is
  'HU-62 · RF-62.2 · D-51 · el histórico de la billetera del Propietario por propiedad; el saldo es su suma y ninguna tabla lo guarda.';

create index owner_wallet_movements_propietario_idx on public.owner_wallet_movements (owner_id, property_id, occurred_on desc);

-- ── RF-62.6 · el cobro ──────────────────────────────────────────────────────
create table public.owner_charges (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  -- El mes cuyo corte lo emitió.
  period date not null,
  amount bigint not null,
  -- Lo ya confirmado contra este cobro.
  paid_amount bigint not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint owner_charges_monto_positivo check (amount > 0),
  constraint owner_charges_pagado_acotado check (paid_amount >= 0 and paid_amount <= amount),
  constraint owner_charges_estado_valido check (status in ('pending', 'under_review', 'paid')),
  constraint owner_charges_pagado_coherente check ((status = 'paid') = (paid_amount = amount)),
  constraint owner_charges_pagado_con_fecha check ((status = 'paid') = (paid_at is not null)),
  -- CA-62.3 · un cobro por Propietario, propiedad y corte.
  constraint owner_charges_unico_por_corte unique (owner_id, property_id, period)
);

comment on table public.owner_charges is
  'HU-62 · RF-62.6 · D-51 · el cobro por saldo negativo de una propiedad tras el corte; su estado se deriva de sus pagos.';

create index owner_charges_propiedad_idx on public.owner_charges (property_id, status, period desc);

-- ── RF-62.7 · RF-62.11 · el pago ────────────────────────────────────────────
create table public.owner_payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.owner_charges (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  amount bigint not null,
  paid_on date not null,
  -- RF-62.7 · de la maestra de HU-23; obligatorio en el canal manual.
  payment_method_id uuid references public.payment_methods (id),
  description text not null,
  -- RF-62.7 · en el bucket owner-receipts; obligatorio en el canal manual.
  receipt_path text,
  -- RF-62.11 · D-10 · por dónde llegó: manual hoy, pasarela después.
  channel text not null default 'manual',
  provider text,
  -- La clave de idempotencia de una pasarela: única por proveedor.
  external_reference text,
  status text not null default 'reported',
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint owner_payments_monto_positivo check (amount > 0),
  constraint owner_payments_descripcion check (btrim(description) <> '' and length(description) <= 500),
  constraint owner_payments_canal_valido check (channel in ('manual', 'gateway')),
  constraint owner_payments_estado_valido check (status in ('reported', 'confirmed', 'rejected')),
  -- CA-62.13 · el manual lleva comprobante y medio y no lleva proveedor; la pasarela, proveedor y referencia.
  constraint owner_payments_canal_coherente check (
    (channel = 'manual' and provider is null and external_reference is null and receipt_path is not null and payment_method_id is not null)
    or (channel = 'gateway' and provider is not null and external_reference is not null)
  ),
  constraint owner_payments_rechazo_con_motivo check ((status = 'rejected') = (rejection_reason is not null)),
  constraint owner_payments_resuelto_con_fecha check ((status = 'reported') = (resolved_at is null)),
  constraint owner_payments_provider_external_reference_key unique (provider, external_reference)
);

comment on table public.owner_payments is
  'HU-62 · RF-62.7 · RF-62.8 · RF-62.11 · el pago de un cobro: reportado por el Propietario con comprobante y medio, confirmado o rechazado por la administración; con canal, proveedor y referencia para una pasarela futura.';

create index owner_payments_cobro_idx on public.owner_payments (charge_id, status);

alter table public.owner_wallet_movements
  add constraint owner_wallet_movements_payment_id_fkey foreign key (payment_id) references public.owner_payments (id) on delete cascade;

-- ── RF-62.9 · el retiro ─────────────────────────────────────────────────────
create table public.owner_withdrawals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  amount bigint not null,
  status text not null default 'requested',
  bank text not null,
  account_kind text not null,
  account_number text not null,
  holder text not null,
  requested_on date not null default current_date,
  paid_at timestamptz,
  rejected_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  rejection_reason text,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint owner_withdrawals_monto_positivo check (amount > 0),
  constraint owner_withdrawals_estado_valido check (status in ('requested', 'paid', 'rejected')),
  constraint owner_withdrawals_tipo_de_cuenta_valido check (account_kind in ('savings', 'checking')),
  constraint owner_withdrawals_cuenta_completa check (btrim(bank) <> '' and btrim(account_number) <> '' and btrim(holder) <> ''),
  constraint owner_withdrawals_rechazo_con_motivo check ((status = 'rejected') = (rejection_reason is not null)),
  constraint owner_withdrawals_pago_con_comprobante check (status <> 'paid' or receipt_path is not null),
  constraint owner_withdrawals_fechas_coherentes check (
    (status = 'requested' and paid_at is null and rejected_at is null)
    or (status = 'paid' and paid_at is not null and rejected_at is null)
    or (status = 'rejected' and rejected_at is not null and paid_at is null)
  )
);

comment on table public.owner_withdrawals is
  'HU-62 · RF-62.9 · D-51 · el retiro del saldo positivo de una propiedad: solicitado → pagado con comprobante, o solicitado → rechazado con motivo.';

-- CA-62.10 · una sola solicitud abierta por Propietario y propiedad, por restricción.
create unique index owner_withdrawals_abierta_unica
  on public.owner_withdrawals (owner_id, property_id) where status = 'requested';
create index owner_withdrawals_propiedad_idx on public.owner_withdrawals (property_id, status, created_at desc);

alter table public.owner_wallet_movements
  add constraint owner_wallet_movements_withdrawal_id_fkey foreign key (withdrawal_id) references public.owner_withdrawals (id) on delete cascade;

-- ── RF-62.12 · RLS ──────────────────────────────────────────────────────────
alter table public.owner_statements enable row level security;
alter table public.owner_statements force row level security;
alter table public.owner_statement_lines enable row level security;
alter table public.owner_statement_lines force row level security;
alter table public.owner_wallet_movements enable row level security;
alter table public.owner_wallet_movements force row level security;
alter table public.owner_charges enable row level security;
alter table public.owner_charges force row level security;
alter table public.owner_payments enable row level security;
alter table public.owner_payments force row level security;
alter table public.owner_withdrawals enable row level security;
alter table public.owner_withdrawals force row level security;

revoke all on table public.owner_statements, public.owner_statement_lines, public.owner_wallet_movements,
  public.owner_charges, public.owner_payments, public.owner_withdrawals from anon, authenticated, service_role;
-- Todo se escribe por función; la aplicación solo lee.
grant select on table public.owner_statements, public.owner_statement_lines, public.owner_wallet_movements,
  public.owner_charges, public.owner_payments, public.owner_withdrawals to authenticated, service_role;

-- El Propietario lo suyo; el Administrador lo de sus propiedades; el Superadmin todo.
create or replace function private.ve_billetera_de_propietario(propietario uuid, propiedad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select propietario = (select auth.uid()) or private.puede_gestionar_propiedad(propiedad);
$$;

revoke execute on function private.ve_billetera_de_propietario(uuid, uuid) from public, anon;
grant execute on function private.ve_billetera_de_propietario(uuid, uuid) to authenticated, service_role;

create policy owner_statements_lectura on public.owner_statements for select to authenticated
  using (private.ve_billetera_de_propietario(owner_id, property_id));
create policy owner_statement_lines_lectura on public.owner_statement_lines for select to authenticated
  using (exists (select 1 from public.owner_statements s where s.id = owner_statement_lines.statement_id
                  and private.ve_billetera_de_propietario(s.owner_id, s.property_id)));
create policy owner_wallet_movements_lectura on public.owner_wallet_movements for select to authenticated
  using (private.ve_billetera_de_propietario(owner_id, property_id));
create policy owner_charges_lectura on public.owner_charges for select to authenticated
  using (private.ve_billetera_de_propietario(owner_id, property_id));
create policy owner_payments_lectura on public.owner_payments for select to authenticated
  using (private.ve_billetera_de_propietario(owner_id, property_id));
create policy owner_withdrawals_lectura on public.owner_withdrawals for select to authenticated
  using (private.ve_billetera_de_propietario(owner_id, property_id));

-- ── TR-01 · RF-62.13 · auditoría ────────────────────────────────────────────
create trigger owner_statements_auditados
  after insert or update or delete on public.owner_statements
  for each row execute function public.registrar_auditoria('owner_statement');
create trigger owner_charges_auditados
  after insert or update or delete on public.owner_charges
  for each row execute function public.registrar_auditoria('owner_charge');
create trigger owner_payments_auditados
  after insert or update or delete on public.owner_payments
  for each row execute function public.registrar_auditoria('owner_payment');
create trigger owner_withdrawals_auditados
  after insert or update or delete on public.owner_withdrawals
  for each row execute function public.registrar_auditoria('owner_withdrawal');

insert into public.audit_reason_required (action, source) values
  ('owner_charge.actualizada', 'HU-62'),
  ('owner_payment.actualizada', 'HU-62'),
  ('owner_withdrawal.actualizada', 'HU-62')
on conflict (action) do nothing;

-- ── TR-03 · RF-62.13 · los avisos del Propietario y de la administración ────
alter table public.notifications drop constraint notifications_tipo_valido;
alter table public.notifications add constraint notifications_tipo_valido check (kind in (
  'stay_confirmed', 'calendar_changed', 'calendar_activated', 'announcement_published', 'broadcast',
  'referral_in_progress', 'referral_paid', 'commission_available', 'withdrawal_approved', 'withdrawal_paid',
  'owner_statement_closed', 'owner_payment_reported', 'owner_payment_confirmed', 'owner_payment_rejected',
  'owner_withdrawal_paid', 'owner_withdrawal_rejected'
));

-- Los administradores vigentes de la propiedad; si no hay ninguno, los Superadmin (D-40).
create or replace function private.administracion_de_propiedad(propiedad uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    nullif((select array_agg(distinct pa.admin_id) from public.property_admins pa where pa.property_id = propiedad and pa.revoked_at is null), '{}'),
    (select array_agg(distinct r.user_id) from public.user_roles r where r.role = 'superadmin')
  );
$$;

revoke execute on function private.administracion_de_propiedad(uuid) from public, anon, authenticated;
grant execute on function private.administracion_de_propiedad(uuid) to service_role;

-- ── RF-62.2 · el saldo se deriva ────────────────────────────────────────────
create or replace function private.saldo_de_propietario(propietario uuid, propiedad uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(w.amount), 0)
    from public.owner_wallet_movements w
   where w.owner_id = propietario and w.property_id = propiedad;
$$;

comment on function private.saldo_de_propietario(uuid, uuid) is
  'HU-62 · RF-62.2 · D-51 · el saldo de la billetera de un Propietario en una propiedad: la suma de su histórico.';

revoke execute on function private.saldo_de_propietario(uuid, uuid) from public, anon;
grant execute on function private.saldo_de_propietario(uuid, uuid) to authenticated, service_role;

-- RF-62.1 · un saldo por Propietario y propiedad: las fracciones vendidas y, por si
-- hubo traspaso, todo par que tenga histórico.
create view public.owner_wallet_balances
with (security_invoker = true) as
select pares.owner_id, pares.property_id, private.nombre_de_propiedad(pares.property_id) as property_name,
       private.saldo_de_propietario(pares.owner_id, pares.property_id) as balance
  from (
    select f.owner_id, f.property_id from public.fractions f where f.status = 'sold' and f.owner_id is not null
    union
    select w.owner_id, w.property_id from public.owner_wallet_movements w
  ) pares
 where private.ve_billetera_de_propietario(pares.owner_id, pares.property_id);

comment on view public.owner_wallet_balances is
  'HU-62 · RF-62.1 · RF-62.2 · el saldo derivado de cada Propietario en cada propiedad; el Propietario los suyos, la administración los de sus propiedades.';

revoke all on public.owner_wallet_balances from anon, authenticated, service_role;
grant select on public.owner_wallet_balances to authenticated, service_role;

-- RF-62.14 · el histórico listo para leerse: con la propiedad, la fracción y el mes.
create view public.owner_wallet_listing
with (security_invoker = true) as
select w.id, w.owner_id, w.property_id, private.nombre_de_propiedad(w.property_id) as property_name,
       w.kind, w.amount, w.occurred_on, w.created_at,
       s.fraction_number, s.period, w.statement_id, w.payment_id, w.withdrawal_id
  from public.owner_wallet_movements w
  left join public.owner_statements s on s.id = w.statement_id
 where private.ve_billetera_de_propietario(w.owner_id, w.property_id);

comment on view public.owner_wallet_listing is
  'HU-62 · RF-62.14 · el histórico de la billetera del Propietario, con propiedad, fracción y mes.';

revoke all on public.owner_wallet_listing from anon, authenticated, service_role;
grant select on public.owner_wallet_listing to authenticated, service_role;

-- ── RF-62.3 · RF-62.4 · RF-62.5 · el corte de una fracción ─────────────────
-- Misma regla que `cortar` en `shared/finance/billetera.ts`: entran las cuotas a
-- cargo del titular causadas hasta el mes que ningún corte liquidó (las de meses
-- anteriores, como ajuste), y las reversas de cuotas ya liquidadas cuyo movimiento
-- se anuló. Un corte ya hecho se devuelve tal cual.
create or replace function private.cortar_fraccion(fraccion uuid, periodo date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  corte uuid;
  ingresos bigint;
  gastos bigint;
begin
  select * into f from public.fractions where id = fraccion;
  if f.id is null or f.owner_id is null or f.status <> 'sold' then
    return null;
  end if;

  select s.id into corte from public.owner_statements s where s.fraction_id = f.id and s.period = periodo;
  if corte is not null then
    return corte;
  end if;

  perform set_config('app.audit_reason', 'Corte mensual de ' || to_char(periodo, 'YYYY-MM') || ' (RF-62.3, D-51)', true);
  insert into public.owner_statements (property_id, fraction_id, fraction_number, owner_id, period)
  values (f.property_id, f.id, f.number, f.owner_id, periodo)
  returning id into corte;

  -- Cargos: cuotas del titular, vivas, causadas hasta el mes, que ningún corte liquidó.
  insert into public.owner_statement_lines (statement_id, share_id, movement_id, kind, entry, amount, origin_period, adjustment)
  select corte, s.id, s.movement_id, m.kind, 'charge', s.amount,
         date_trunc('month', m.incurred_on)::date, date_trunc('month', m.incurred_on)::date <> periodo
    from public.movement_shares s
    join public.movements m on m.id = s.movement_id
   where s.fraction_id = f.id and s.payer = 'owner' and s.payer_id = f.owner_id and s.reversed_at is null
     and date_trunc('month', m.incurred_on)::date <= periodo
     and not exists (select 1 from public.owner_statement_lines l where l.share_id = s.id and l.entry = 'charge');

  -- Reversas: cuotas anuladas que sí se habían liquidado y aún no se revirtieron.
  insert into public.owner_statement_lines (statement_id, share_id, movement_id, kind, entry, amount, origin_period, adjustment)
  select corte, s.id, s.movement_id, m.kind, 'reversal', s.amount, date_trunc('month', m.incurred_on)::date, true
    from public.movement_shares s
    join public.movements m on m.id = s.movement_id
   where s.fraction_id = f.id and s.payer = 'owner' and s.payer_id = f.owner_id and s.reversed_at is not null
     and exists (select 1 from public.owner_statement_lines l where l.share_id = s.id and l.entry = 'charge')
     and not exists (select 1 from public.owner_statement_lines l where l.share_id = s.id and l.entry = 'reversal');

  select
    coalesce(sum(case when l.entry = 'charge' then l.amount else -l.amount end) filter (where l.kind = 'income'), 0),
    coalesce(sum(case when l.entry = 'charge' then l.amount else -l.amount end) filter (where l.kind = 'expense'), 0)
    into ingresos, gastos
    from public.owner_statement_lines l where l.statement_id = corte;

  update public.owner_statements set income = ingresos, expenses = gastos, net = ingresos - gastos where id = corte;

  -- RF-62.2 · un corte en cero no mueve el saldo: no entra al histórico.
  if ingresos - gastos <> 0 then
    insert into public.owner_wallet_movements (owner_id, property_id, fraction_id, kind, amount, occurred_on, statement_id)
    values (f.owner_id, f.property_id, f.id, 'statement_closed', ingresos - gastos, current_date, corte)
    on conflict (statement_id) do nothing;
  end if;
  perform set_config('app.audit_reason', '', true);

  return corte;
end;
$$;

comment on function private.cortar_fraccion(uuid, date) is
  'HU-62 · RF-62.3 · RF-62.4 · RF-62.5 · CA-62.1…CA-62.5 · el corte de una fracción en un mes; idempotente.';

revoke execute on function private.cortar_fraccion(uuid, date) from public, anon, authenticated;
grant execute on function private.cortar_fraccion(uuid, date) to service_role;

-- ── RF-62.3 · RF-62.6 · RF-62.13 · el corte de todos, el cobro y el aviso ───
-- Lo lanza la tarea del día 1 (sin sesión) o el Superadmin a mano. Cierra siempre
-- un mes ya terminado: por omisión, el anterior al día de hoy en Bogotá.
create or replace function public.close_owner_statements(periodo date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hoy date := (now() at time zone 'America/Bogota')::date;
  mes date := coalesce(periodo, (date_trunc('month', hoy) - interval '1 month')::date);
  fr record;
  par record;
  saldo bigint;
  cobrado bigint;
  deficit bigint;
  neto bigint;
  cortes integer := 0;
begin
  if (select auth.uid()) is not null and not private.es_superadmin() then
    raise exception 'RF-62.3 · solo la tarea programada o el Superadmin lanzan el corte mensual.';
  end if;
  if mes <> date_trunc('month', mes)::date then
    raise exception 'RF-62.3 · el periodo debe ser el primer día de un mes; llegó %.', mes;
  end if;
  if (mes + interval '1 month')::date > hoy then
    raise exception 'RF-62.3 · D-51 · el mes % aún no termina: el corte cierra solo meses cumplidos.', to_char(mes, 'YYYY-MM');
  end if;

  for fr in
    select f.id from public.fractions f
     where f.status = 'sold' and f.owner_id is not null
     order by f.property_id, f.number
  loop
    if not exists (select 1 from public.owner_statements s where s.fraction_id = fr.id and s.period = mes) then
      cortes := cortes + 1;
    end if;
    perform private.cortar_fraccion(fr.id, mes);
  end loop;

  -- D-51 · por cada Propietario y propiedad: el cobro por lo que falta y el aviso.
  for par in
    select distinct s.owner_id, s.property_id
      from public.owner_statements s
     where s.period = mes
  loop
    saldo := private.saldo_de_propietario(par.owner_id, par.property_id);
    select coalesce(sum(c.amount - c.paid_amount), 0) into cobrado
      from public.owner_charges c
     where c.owner_id = par.owner_id and c.property_id = par.property_id and c.status <> 'paid';
    deficit := -saldo - cobrado;

    if saldo < 0 and deficit > 0 then
      perform set_config('app.audit_reason', 'Cobro del corte de ' || to_char(mes, 'YYYY-MM') || ' por saldo negativo (RF-62.6, D-51)', true);
      insert into public.owner_charges (owner_id, property_id, period, amount)
      values (par.owner_id, par.property_id, mes, deficit)
      on conflict (owner_id, property_id, period) do nothing;
      perform set_config('app.audit_reason', '', true);
    end if;

    select coalesce(sum(s.net), 0) into neto
      from public.owner_statements s
     where s.owner_id = par.owner_id and s.property_id = par.property_id and s.period = mes;

    -- TR-03 · RF-62.13 · un aviso por Propietario, propiedad y mes.
    perform public.emitir_notificacion(
      'owner_statement_closed', 'owner_statement',
      par.property_id::text || ':' || par.owner_id::text || ':' || to_char(mes, 'YYYY-MM'),
      par.property_id,
      jsonb_build_object(
        'property_name', private.nombre_de_propiedad(par.property_id),
        'period', to_char(mes, 'YYYY-MM'),
        'amount', neto,
        'balance', saldo,
        'action', case when saldo < 0 then 'pay' when saldo > 0 then 'withdraw' else 'none' end
      ),
      array[par.owner_id]
    );
  end loop;

  return cortes;
end;
$$;

comment on function public.close_owner_statements(date) is
  'HU-62 · RF-62.3 · RF-62.6 · CA-62.3 · D-51 · cierra un mes cumplido para todas las fracciones vendidas, emite los cobros y avisa; idempotente.';

revoke execute on function public.close_owner_statements(date) from public, anon;
grant execute on function public.close_owner_statements(date) to authenticated, service_role;

-- RF-62.3 · D-51 · el día 1 a las 00:05 de Bogotá (05:05 UTC) se cierra el mes anterior.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cortar-billetera-propietarios';
    perform cron.schedule('cortar-billetera-propietarios', '5 5 1 * *', $job$ select public.close_owner_statements() $job$);
  end if;
end;
$$;

-- ── RF-62.7 · el comprobante del Propietario ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'owner-receipts', 'owner-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- La ruta es `propiedad/propietario/archivo`: la primera carpeta la lee
-- `private.propiedad_de_objeto`; la segunda es el Propietario dueño.
create or replace function private.propietario_de_objeto(ruta text)
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

-- Lo leen el Propietario dueño, el Administrador de la propiedad y el Superadmin.
create policy owner_receipts_objetos_lectura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'owner-receipts'
    and private.ve_billetera_de_propietario(private.propietario_de_objeto(name), private.propiedad_de_objeto(name))
  );

-- Sube el Propietario (su pago) o la administración (el pago de un retiro).
create policy owner_receipts_objetos_carga
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'owner-receipts'
    and private.ve_billetera_de_propietario(private.propietario_de_objeto(name), private.propiedad_de_objeto(name))
  );

-- Solo se retira un comprobante que nada referencia: el de una carga fallida.
create policy owner_receipts_objetos_limpieza
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'owner-receipts'
    and private.ve_billetera_de_propietario(private.propietario_de_objeto(name), private.propiedad_de_objeto(name))
    and not exists (select 1 from public.owner_payments p where p.receipt_path = name)
    and not exists (select 1 from public.owner_withdrawals r where r.receipt_path = name)
  );

-- ── RF-62.8 · el estado del cobro se deriva de sus pagos ────────────────────
create or replace function private.derivar_cobro(cobro uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.owner_charges;
  confirmado bigint;
  en_revision boolean;
  estado text;
begin
  select * into c from public.owner_charges where id = cobro for update;
  select coalesce(sum(p.amount) filter (where p.status = 'confirmed'), 0), bool_or(p.status = 'reported')
    into confirmado, en_revision
    from public.owner_payments p where p.charge_id = c.id;

  estado := case
    when confirmado >= c.amount then 'paid'
    when coalesce(en_revision, false) then 'under_review'
    else 'pending'
  end;

  update public.owner_charges
     set paid_amount = least(confirmado, amount),
         status = estado,
         paid_at = case when estado = 'paid' then coalesce(paid_at, now()) else null end,
         updated_at = now()
   where id = c.id;
end;
$$;

revoke execute on function private.derivar_cobro(uuid) from public, anon, authenticated;
grant execute on function private.derivar_cobro(uuid) to service_role;

-- ── RF-62.7 · CA-62.6 · el reporte del pago ─────────────────────────────────
create or replace function public.report_owner_payment(
  charge uuid,
  amount bigint,
  paid_on date,
  payment_method uuid,
  description text,
  receipt_path text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.owner_charges;
  ruta text := nullif(btrim(coalesce(receipt_path, '')), '');
  descripcion text := nullif(btrim(coalesce(description, '')), '');
  reportable bigint;
  nuevo uuid;
begin
  select * into c from public.owner_charges where id = charge and owner_id = (select auth.uid()) for update;
  if c.id is null then
    raise exception 'RF-62.12 · el cobro no existe o no es de esta cuenta.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = c.owner_id and p.status = 'active') then
    raise exception 'RF-33.3 · la cuenta está suspendida.';
  end if;
  if c.status = 'paid' then
    raise exception 'RF-62.7 · el cobro ya está pagado.';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'CA-62.6 · RF-62.7 · el monto del pago debe ser un entero mayor que cero.';
  end if;
  select c.amount - c.paid_amount - coalesce(sum(p.amount), 0) into reportable
    from public.owner_payments p where p.charge_id = c.id and p.status = 'reported';
  if amount > reportable then
    raise exception 'CA-62.6 · RF-62.7 · el monto supera lo pendiente del cobro (% pesos).', reportable;
  end if;
  if paid_on is null then
    raise exception 'RF-62.7 · el pago lleva la fecha en que se hizo.';
  end if;
  if payment_method is null or not exists (select 1 from public.payment_methods m where m.id = payment_method and m.active) then
    raise exception 'CA-62.6 · RF-62.7 · el medio de pago debe ser uno activo de la maestra.';
  end if;
  if descripcion is null then
    raise exception 'RF-62.7 · el pago lleva una descripción.';
  end if;
  if ruta is null then
    raise exception 'CA-62.6 · RF-62.7 · el pago exige el comprobante.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'owner-receipts' and o.name = ruta) then
    raise exception 'CA-62.6 · RF-62.7 · el comprobante no está en el bucket owner-receipts.';
  end if;

  perform set_config('app.audit_reason', 'Pago reportado por el Propietario por ' || amount || ' pesos (RF-62.7)', true);
  insert into public.owner_payments (charge_id, owner_id, property_id, amount, paid_on, payment_method_id, description, receipt_path, channel)
  values (c.id, c.owner_id, c.property_id, amount, paid_on, payment_method, descripcion, ruta, 'manual')
  returning id into nuevo;
  perform private.derivar_cobro(c.id);
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · RF-62.13 · la administración de la propiedad revisa.
  perform public.emitir_notificacion(
    'owner_payment_reported', 'owner_payment', nuevo::text, c.property_id,
    jsonb_build_object('amount', amount, 'property_name', private.nombre_de_propiedad(c.property_id), 'reason', null),
    private.administracion_de_propiedad(c.property_id)
  );

  return nuevo;
end;
$$;

comment on function public.report_owner_payment(uuid, bigint, date, uuid, text, text) is
  'HU-62 · RF-62.7 · CA-62.6 · CA-62.7 · el Propietario reporta el pago de un cobro con comprobante, medio, fecha, monto y descripción; el cobro pasa a revisión.';

revoke execute on function public.report_owner_payment(uuid, bigint, date, uuid, text, text) from public, anon;
grant execute on function public.report_owner_payment(uuid, bigint, date, uuid, text, text) to authenticated, service_role;

-- ── RF-62.8 · CA-62.7 · la confirmación ─────────────────────────────────────
create or replace function public.confirm_owner_payment(payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.owner_payments;
begin
  select * into p from public.owner_payments where id = payment for update;
  if p.id is null then
    raise exception 'RF-62.8 · el pago no existe.';
  end if;
  if not private.puede_gestionar_propiedad(p.property_id) then
    raise exception 'RF-62.12 · RF-62.8 · solo el Administrador de la propiedad o el Superadmin confirma un pago.';
  end if;
  if p.status <> 'reported' then
    raise exception 'CA-62.9 · RF-62.8 · solo se confirma un pago reportado (está %).', p.status;
  end if;

  perform set_config('app.audit_reason', 'Pago confirmado tras revisar el comprobante (RF-62.8); sin movimiento en la maestra (D-51)', true);
  update public.owner_payments
     set status = 'confirmed', resolved_at = now(), resolved_by = (select auth.uid()), updated_at = now()
   where id = p.id;
  -- RF-62.2 · CA-62.7 · solo ahora entra a la billetera.
  insert into public.owner_wallet_movements (owner_id, property_id, kind, amount, occurred_on, payment_id)
  values (p.owner_id, p.property_id, 'payment_confirmed', p.amount, current_date, p.id)
  on conflict (payment_id) do nothing;
  perform private.derivar_cobro(p.charge_id);
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_payment_confirmed', 'owner_payment', p.id::text, p.property_id,
    jsonb_build_object('amount', p.amount, 'property_name', private.nombre_de_propiedad(p.property_id), 'reason', null),
    array[p.owner_id]
  );
end;
$$;

comment on function public.confirm_owner_payment(uuid) is
  'HU-62 · RF-62.8 · CA-62.7 · CA-62.9 · D-51 · la administración confirma un pago reportado: entra a la billetera y el cobro se deriva.';

revoke execute on function public.confirm_owner_payment(uuid) from public, anon;
grant execute on function public.confirm_owner_payment(uuid) to authenticated, service_role;

-- ── RF-62.8 · CA-62.8 · el rechazo ──────────────────────────────────────────
create or replace function public.reject_owner_payment(payment uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.owner_payments;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
begin
  if motivo is null then
    raise exception 'CA-62.8 · RF-62.8 · el rechazo exige un motivo.';
  end if;
  select * into p from public.owner_payments where id = payment for update;
  if p.id is null then
    raise exception 'RF-62.8 · el pago no existe.';
  end if;
  if not private.puede_gestionar_propiedad(p.property_id) then
    raise exception 'RF-62.12 · RF-62.8 · solo el Administrador de la propiedad o el Superadmin rechaza un pago.';
  end if;
  if p.status <> 'reported' then
    raise exception 'CA-62.9 · RF-62.8 · solo se rechaza un pago reportado (está %).', p.status;
  end if;

  perform set_config('app.audit_reason', 'Pago rechazado: ' || motivo, true);
  update public.owner_payments
     set status = 'rejected', rejection_reason = motivo, resolved_at = now(), resolved_by = (select auth.uid()), updated_at = now()
   where id = p.id;
  -- CA-62.8 · sin movimiento: el saldo no cambia; el cobro vuelve a pendiente si nada más está en revisión.
  perform private.derivar_cobro(p.charge_id);
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_payment_rejected', 'owner_payment', p.id::text, p.property_id,
    jsonb_build_object('amount', p.amount, 'property_name', private.nombre_de_propiedad(p.property_id), 'reason', motivo),
    array[p.owner_id]
  );
end;
$$;

comment on function public.reject_owner_payment(uuid, text) is
  'HU-62 · RF-62.8 · CA-62.8 · la administración rechaza un pago con motivo; el saldo no se toca y el Propietario se entera.';

revoke execute on function public.reject_owner_payment(uuid, text) from public, anon;
grant execute on function public.reject_owner_payment(uuid, text) to authenticated, service_role;

-- ── RF-62.9 · CA-62.10 · la solicitud de retiro ─────────────────────────────
create or replace function public.request_owner_withdrawal(
  property uuid,
  amount bigint,
  bank text,
  account_kind text,
  account_number text,
  holder text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  propietario uuid := (select auth.uid());
  saldo bigint;
  nueva uuid;
begin
  if propietario is null or not exists (select 1 from public.profiles p where p.id = propietario and p.status = 'active') then
    raise exception 'RF-62.9 · solo una cuenta activa solicita retiros.';
  end if;
  if not exists (select 1 from public.fractions f where f.property_id = property and f.owner_id = propietario) then
    raise exception 'RF-62.12 · RF-62.9 · no tienes fracciones en esa propiedad.';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'CA-62.10 · RF-62.9 · el monto del retiro debe ser un entero mayor que cero.';
  end if;
  if btrim(coalesce(bank, '')) = '' or btrim(coalesce(account_number, '')) = '' or btrim(coalesce(holder, '')) = ''
     or account_kind not in ('savings', 'checking') then
    raise exception 'RF-62.9 · el retiro exige la cuenta de destino completa.';
  end if;

  saldo := private.saldo_de_propietario(propietario, property);
  if saldo <= 0 or amount > saldo then
    raise exception 'CA-62.10 · RF-62.9 · el monto supera el saldo disponible de la propiedad (% pesos).', greatest(saldo, 0);
  end if;
  if exists (select 1 from public.owner_withdrawals r where r.owner_id = propietario and r.property_id = property and r.status = 'requested') then
    raise exception 'CA-62.10 · RF-62.9 · ya hay una solicitud de retiro abierta sobre esta propiedad.';
  end if;

  perform set_config('app.audit_reason', 'Solicitud de retiro del Propietario por ' || amount || ' pesos (RF-62.9)', true);
  insert into public.owner_withdrawals (owner_id, property_id, amount, bank, account_kind, account_number, holder)
  values (propietario, property, amount, btrim(bank), account_kind, btrim(account_number), btrim(holder))
  returning id into nueva;
  perform set_config('app.audit_reason', '', true);

  return nueva;
end;
$$;

comment on function public.request_owner_withdrawal(uuid, bigint, text, text, text, text) is
  'HU-62 · RF-62.9 · CA-62.10 · D-51 · el Propietario pide retirar hasta el saldo positivo de una propiedad; una sola solicitud abierta por propiedad.';

revoke execute on function public.request_owner_withdrawal(uuid, bigint, text, text, text, text) from public, anon;
grant execute on function public.request_owner_withdrawal(uuid, bigint, text, text, text, text) to authenticated, service_role;

-- ── RF-62.9 · el pago del retiro, con comprobante ───────────────────────────
create or replace function public.pay_owner_withdrawal(request uuid, receipt_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.owner_withdrawals;
  ruta text := nullif(btrim(coalesce(receipt_path, '')), '');
  saldo bigint;
begin
  select * into r from public.owner_withdrawals where id = request for update;
  if r.id is null then
    raise exception 'RF-62.9 · la solicitud de retiro no existe.';
  end if;
  if not private.puede_gestionar_propiedad(r.property_id) then
    raise exception 'RF-62.12 · RF-62.9 · solo el Administrador de la propiedad o el Superadmin paga un retiro.';
  end if;
  if r.status <> 'requested' then
    raise exception 'CA-62.9 · RF-62.9 · solo se paga una solicitud abierta (está %).', r.status;
  end if;
  if ruta is null then
    raise exception 'CA-62.10 · RF-62.9 · el pago exige el comprobante.';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'owner-receipts' and o.name = ruta) then
    raise exception 'CA-62.10 · RF-62.9 · el comprobante no está en el bucket owner-receipts.';
  end if;
  -- El saldo pudo bajar desde la solicitud: se vuelve a mirar.
  saldo := private.saldo_de_propietario(r.owner_id, r.property_id);
  if r.amount > saldo then
    raise exception 'RF-62.9 · el saldo de la propiedad (% pesos) ya no cubre el retiro.', saldo;
  end if;

  perform set_config('app.audit_reason', 'Retiro pagado con comprobante; sin movimiento en la maestra (D-51)', true);
  update public.owner_withdrawals
     set status = 'paid', paid_at = now(), receipt_path = ruta, resolved_by = (select auth.uid()), updated_at = now()
   where id = r.id;
  insert into public.owner_wallet_movements (owner_id, property_id, kind, amount, occurred_on, withdrawal_id)
  values (r.owner_id, r.property_id, 'withdrawal_paid', -r.amount, current_date, r.id)
  on conflict (withdrawal_id) do nothing;
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_withdrawal_paid', 'owner_withdrawal', r.id::text, r.property_id,
    jsonb_build_object('amount', r.amount, 'property_name', private.nombre_de_propiedad(r.property_id), 'reason', null),
    array[r.owner_id]
  );
end;
$$;

comment on function public.pay_owner_withdrawal(uuid, text) is
  'HU-62 · RF-62.9 · CA-62.10 · D-51 · la administración paga un retiro con su comprobante; resta del saldo y no devenga nada.';

revoke execute on function public.pay_owner_withdrawal(uuid, text) from public, anon;
grant execute on function public.pay_owner_withdrawal(uuid, text) to authenticated, service_role;

-- ── RF-62.9 · el rechazo del retiro, con motivo ─────────────────────────────
create or replace function public.reject_owner_withdrawal(request uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.owner_withdrawals;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
begin
  if motivo is null then
    raise exception 'RF-62.9 · el rechazo de un retiro exige un motivo.';
  end if;
  select * into r from public.owner_withdrawals where id = request for update;
  if r.id is null then
    raise exception 'RF-62.9 · la solicitud de retiro no existe.';
  end if;
  if not private.puede_gestionar_propiedad(r.property_id) then
    raise exception 'RF-62.12 · RF-62.9 · solo el Administrador de la propiedad o el Superadmin rechaza un retiro.';
  end if;
  if r.status <> 'requested' then
    raise exception 'CA-62.9 · RF-62.9 · solo se rechaza una solicitud abierta (está %).', r.status;
  end if;

  perform set_config('app.audit_reason', 'Retiro rechazado: ' || motivo, true);
  update public.owner_withdrawals
     set status = 'rejected', rejected_at = now(), rejection_reason = motivo, resolved_by = (select auth.uid()), updated_at = now()
   where id = r.id;
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_withdrawal_rejected', 'owner_withdrawal', r.id::text, r.property_id,
    jsonb_build_object('amount', r.amount, 'property_name', private.nombre_de_propiedad(r.property_id), 'reason', motivo),
    array[r.owner_id]
  );
end;
$$;

comment on function public.reject_owner_withdrawal(uuid, text) is
  'HU-62 · RF-62.9 · la administración rechaza un retiro con motivo; el saldo no se toca y el Propietario se entera.';

revoke execute on function public.reject_owner_withdrawal(uuid, text) from public, anon;
grant execute on function public.reject_owner_withdrawal(uuid, text) to authenticated, service_role;
