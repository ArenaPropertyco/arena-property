-- HU-62 · RF-62.1…RF-62.14 · D-08, D-09, D-51 · TR-01, TR-02, TR-03 — la billetera
-- del Propietario en la base: el corte mensual idempotente, el saldo derivado por
-- propiedad, el cobro por saldo negativo, el pago reportado y confirmado, el
-- retiro del saldo positivo, la RLS, la auditoría y los avisos.
begin;
select plan(94);

/** Cuántos avisos de un tipo, sobre una entidad, le llegaron a una cuenta. */
-- `security definer` y creada por el superusuario antes de asumir ningún rol: así
-- cuenta los avisos de cualquiera, que la RLS de TR-03 solo deja leer a su destinatario.
create or replace function pg_temp.avisos(tipo text, entidad text, cuenta uuid)
returns bigint
language sql
security definer
as $$
  select count(*) from public.notifications n
    join public.notification_recipients r on r.notification_id = n.id
   where n.kind = tipo and n.entity_id = entidad and r.recipient_id = cuenta;
$$;

/** La carga del único aviso de un tipo sobre una entidad. */
create or replace function pg_temp.carga_de(tipo text, entidad text)
returns jsonb
language sql
security definer
as $$ select n.payload from public.notifications n where n.kind = tipo and n.entity_id = entidad $$;

/** El saldo de una propiedad para quien mira, a través de la vista. */
create or replace function pg_temp.saldo(propietario uuid, propiedad uuid)
returns bigint
language sql
as $$ select b.balance from public.owner_wallet_balances b where b.owner_id = propietario and b.property_id = propiedad $$;

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'owner_statements', 'RF-62.3 · existe owner_statements');
select has_table('public', 'owner_statement_lines', 'RF-62.4 · existe owner_statement_lines');
select has_table('public', 'owner_wallet_movements', 'RF-62.2 · existe owner_wallet_movements');
select has_table('public', 'owner_charges', 'RF-62.6 · existe owner_charges');
select has_table('public', 'owner_payments', 'RF-62.7 · existe owner_payments');
select has_table('public', 'owner_withdrawals', 'RF-62.9 · existe owner_withdrawals');
select col_is_unique('public', 'owner_statements', array['fraction_id', 'period'], 'RF-62.4 · un corte por fracción y periodo');
select col_is_unique('public', 'owner_statement_lines', array['share_id', 'entry'], 'RF-62.4 · una cuota entra a lo sumo una vez como cargo y una como reversa');
select col_is_unique('public', 'owner_payments', array['provider', 'external_reference'], 'CA-62.13 · la referencia externa es única por proveedor');
select has_function('public', 'close_owner_statements', array['date'], 'RF-62.3 · existe close_owner_statements');
select has_function('public', 'report_owner_payment', 'RF-62.7 · existe report_owner_payment');
select has_function('public', 'confirm_owner_payment', array['uuid'], 'RF-62.8 · existe confirm_owner_payment');
select has_function('public', 'request_owner_withdrawal', 'RF-62.9 · existe request_owner_withdrawal');
select has_view('public', 'owner_wallet_balances', 'RF-62.2 · el saldo se deriva en una vista, no se guarda');
select is((select bool_and(relforcerowsecurity) from pg_class where oid in (
  'public.owner_statements'::regclass, 'public.owner_statement_lines'::regclass, 'public.owner_wallet_movements'::regclass,
  'public.owner_charges'::regclass, 'public.owner_payments'::regclass, 'public.owner_withdrawals'::regclass)),
  true, 'RF-62.12 · las seis tablas fuerzan RLS');
select ok(not has_table_privilege('authenticated', 'public.owner_statements', 'INSERT')
  and not has_table_privilege('authenticated', 'public.owner_wallet_movements', 'INSERT')
  and not has_table_privilege('authenticated', 'public.owner_charges', 'INSERT')
  and not has_table_privilege('authenticated', 'public.owner_payments', 'INSERT'),
  'RF-62.2 · RF-62.6 · el corte, el saldo, el cobro y el pago los escribe solo la base');
select is((select count(*) from storage.buckets where id = 'owner-receipts' and not public), 1::bigint,
  'RF-62.7 · existe el bucket privado de comprobantes del Propietario');
select is((select count(*) from cron.job where jobname = 'cortar-billetera-propietarios'), 1::bigint,
  'RF-62.3 · el corte está programado para el día 1');
select is((select schedule from cron.job where jobname = 'cortar-billetera-propietarios'), '5 5 1 * *',
  'RF-62.3 · D-51 · a las 00:05 de Bogotá del día 1');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c6200000-0000-4000-8000-00000000000a', 'super.hu62@arena.co', '{}'),
  ('c6200000-0000-4000-8000-000000000001', 'admin.hu62@arena.co', '{}'),
  ('c6200000-0000-4000-8000-00000000000b', 'admin2.hu62@arena.co', '{}'),
  ('c6200000-0000-4000-8000-000000000003', 'pedro.hu62@ejemplo.com', '{}'),
  ('c6200000-0000-4000-8000-000000000005', 'otro.hu62@ejemplo.com', '{}');
insert into public.user_roles (user_id, role) values
  ('c6200000-0000-4000-8000-00000000000a', 'superadmin'),
  ('c6200000-0000-4000-8000-000000000001', 'property_admin'),
  ('c6200000-0000-4000-8000-00000000000b', 'property_admin');

-- P1 la crea el Administrador (queda asignado); P2 la crea el Superadmin.
set local role authenticated;
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a6200000-0000-4000-8000-000000000001', 'Casa P1', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a6200000-0000-4000-8000-000000000001', array[100000000::bigint]);
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a6200000-0000-4000-8000-000000000002', 'Casa P2', 'Propiedad de prueba.', 150, 'CO', 'Magdalena', 'Santa Marta');
select public.fraccionar_propiedad('a6200000-0000-4000-8000-000000000002', array[80000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
-- P1: Pedro tiene la 3/8 (activa desde enero) y la 4/8 (vendida, calendario inactivo);
-- Otro tiene la 5/8. P2: Pedro tiene la 1/8, activa desde enero.
update public.fractions set status = 'reserved'
 where (property_id = 'a6200000-0000-4000-8000-000000000001' and number in (3, 4, 5))
    or (property_id = 'a6200000-0000-4000-8000-000000000002' and number = 1);
update public.fractions set status = 'sold', owner_id = 'c6200000-0000-4000-8000-000000000003'
 where (property_id = 'a6200000-0000-4000-8000-000000000001' and number in (3, 4))
    or (property_id = 'a6200000-0000-4000-8000-000000000002' and number = 1);
update public.fractions set status = 'sold', owner_id = 'c6200000-0000-4000-8000-000000000005'
 where property_id = 'a6200000-0000-4000-8000-000000000001' and number = 5;
update public.fractions set calendar_active = true, calendar_activated_at = '2026-01-01T12:00:00Z'
 where (property_id = 'a6200000-0000-4000-8000-000000000001' and number in (3, 5))
    or (property_id = 'a6200000-0000-4000-8000-000000000002' and number = 1);

create temporary table ctx62 as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as gasto,
    (select id from public.expense_categories where name = 'Renta a terceros' and kind = 'income') as renta,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta,
    (select id from public.fractions where property_id = 'a6200000-0000-4000-8000-000000000001' and number = 3) as f3,
    (select id from public.fractions where property_id = 'a6200000-0000-4000-8000-000000000001' and number = 4) as f4,
    (select id from public.fractions where property_id = 'a6200000-0000-4000-8000-000000000002' and number = 1) as g1,
    null::uuid as tardio,
    null::uuid as cobro_p1,
    null::uuid as cobro_julio,
    null::uuid as pago_1,
    null::uuid as pago_2,
    null::uuid as retiro_1,
    null::uuid as retiro_2,
    null::uuid as sin_uso;
grant select, update on ctx62 to authenticated;

-- ── Junio · P1: gasto de $800.000 e ingreso de $400.000 prorrateados (CA-62.1);
--    P2: ingreso atribuido de $640.000 (D-39) y gasto de $80.000 (CA-62.2) ─────
set local role authenticated;
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description) values
  ('a6200000-0000-4000-8000-000000000001', 'expense', 800000, (select gasto from ctx62), (select medio from ctx62), (select cuenta from ctx62), '2026-06-10', 'Piscina junio'),
  ('a6200000-0000-4000-8000-000000000001', 'income', 400000, (select renta from ctx62), (select medio from ctx62), (select cuenta from ctx62), '2026-06-20', 'Renta semana sobrante');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description, allocation, fraction_id) values
  ('a6200000-0000-4000-8000-000000000002', 'income', 640000, (select renta from ctx62), (select medio from ctx62), (select cuenta from ctx62), '2026-06-05', 'Renta de semana liberada por la 1/8', 'single_fraction', (select g1 from ctx62));
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description) values
  ('a6200000-0000-4000-8000-000000000002', 'expense', 80000, (select gasto from ctx62), (select medio from ctx62), (select cuenta from ctx62), '2026-06-12', 'Jardín junio');

-- ── RF-62.3 · el corte de junio ─────────────────────────────────────────────
select throws_like(
  $$ select public.close_owner_statements(date_trunc('month', (now() at time zone 'America/Bogota')::date)::date) $$,
  '%RF-62.3%', 'RF-62.3 · D-51 · el mes en curso no se cierra');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.close_owner_statements('2026-06-01') $$,
  '%RF-62.3%', 'RF-62.3 · un Propietario no lanza el corte');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ select public.close_owner_statements('2026-06-01') $$,
  'RF-62.3 · el Superadmin relanza el corte de junio');

set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
select is(
  (select (s.income, s.expenses, s.net) from public.owner_statements s where s.fraction_id = (select f3 from ctx62) and s.period = '2026-06-01'),
  (50000::bigint, 100000::bigint, -50000::bigint),
  'CA-62.1 · el corte de junio de la 3/8 vale −$50.000: $50.000 de ingreso y $100.000 de gasto');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000001'), -50000::bigint,
  'CA-62.1 · la billetera de Pedro en P1 queda en −$50.000');
select is(
  (select (c.amount, c.status) from public.owner_charges c where c.owner_id = 'c6200000-0000-4000-8000-000000000003' and c.property_id = 'a6200000-0000-4000-8000-000000000001'),
  (50000::bigint, 'pending'::text),
  'CA-62.1 · RF-62.6 · nace un cobro pendiente por $50.000 exactos');
select is(
  (select s.net from public.owner_statements s where s.fraction_id = (select g1 from ctx62) and s.period = '2026-06-01'),
  630000::bigint, 'CA-62.2 · el corte de la 1/8 de P2 vale +$630.000');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000002'), 630000::bigint,
  'CA-62.2 · y la billetera de P2 queda en +$630.000, sin cobro');
select is((select count(*) from public.owner_charges where property_id = 'a6200000-0000-4000-8000-000000000002'), 0::bigint,
  'RF-62.6 · con saldo positivo no hay cobro');
select is(
  (select (s.net, (select count(*) from public.owner_statement_lines l where l.statement_id = s.id))
     from public.owner_statements s where s.fraction_id = (select f4 from ctx62) and s.period = '2026-06-01'),
  (0::bigint, 0::bigint),
  'CA-62.4 · D-08 · la 4/8, con calendario inactivo, no carga ninguna cuota a Pedro');
select is(
  (select count(*) from public.owner_wallet_movements w where w.owner_id = 'c6200000-0000-4000-8000-000000000003'),
  2::bigint, 'RF-62.2 · un corte en cero no entra al histórico: solo los dos con neto');

-- ── CA-62.3 · relanzar el corte no duplica nada ─────────────────────────────
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select lives_ok($$ select public.close_owner_statements('2026-06-01') $$, 'CA-62.3 · el corte de junio se ejecuta por segunda vez');
select is(
  (select count(*) from public.owner_statements s where s.owner_id = 'c6200000-0000-4000-8000-000000000003' and s.period = '2026-06-01'),
  3::bigint, 'CA-62.3 · sigue habiendo un solo corte por fracción');
select is(
  (select count(*) from public.owner_charges c where c.owner_id = 'c6200000-0000-4000-8000-000000000003'),
  1::bigint, 'CA-62.3 · y un solo cobro');
select is(pg_temp.avisos('owner_statement_closed', 'a6200000-0000-4000-8000-000000000001:c6200000-0000-4000-8000-000000000003:2026-06', 'c6200000-0000-4000-8000-000000000003'),
  1::bigint, 'CA-62.15 · RF-62.13 · Pedro recibe un solo aviso del corte de P1');
select is(pg_temp.carga_de('owner_statement_closed', 'a6200000-0000-4000-8000-000000000001:c6200000-0000-4000-8000-000000000003:2026-06') ->> 'action', 'pay',
  'RF-62.13 · el aviso de P1 dice que toca pagar');
select is(pg_temp.carga_de('owner_statement_closed', 'a6200000-0000-4000-8000-000000000002:c6200000-0000-4000-8000-000000000003:2026-06') ->> 'action', 'withdraw',
  'RF-62.13 · el de P2 dice que puede retirar');

-- ── CA-62.5 · un gasto de junio registrado tras el corte entra en julio como ajuste ─
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description) values
  ('a6200000-0000-4000-8000-000000000001', 'expense', 240000, (select gasto from ctx62), (select medio from ctx62), (select cuenta from ctx62), '2026-06-20', 'Factura tardía de junio');
update ctx62 set tardio = (select id from public.movements where description = 'Factura tardía de junio');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select lives_ok($$ select public.close_owner_statements('2026-07-01') $$, 'RF-62.3 · se cierra julio');
select is(
  (select s.net from public.owner_statements s where s.fraction_id = (select f3 from ctx62) and s.period = '2026-06-01'),
  -50000::bigint, 'CA-62.5 · el corte de junio no cambia');
select is(
  (select (l.origin_period, l.adjustment, l.entry, l.amount)
     from public.owner_statement_lines l join public.owner_statements s on s.id = l.statement_id
    where s.fraction_id = (select f3 from ctx62) and s.period = '2026-07-01'),
  ('2026-06-01'::date, true, 'charge'::text, 30000::bigint),
  'CA-62.5 · julio lo incluye como ajuste de periodo anterior con origen junio');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000001'), -80000::bigint,
  'CA-62.5 · la billetera de P1 queda en −$80.000');
select is(
  (select c.amount from public.owner_charges c where c.owner_id = 'c6200000-0000-4000-8000-000000000003' and c.property_id = 'a6200000-0000-4000-8000-000000000001' and c.period = '2026-07-01'),
  30000::bigint, 'CA-62.3 · RF-62.6 · el cobro de julio es solo por lo nuevo: lo de junio ya estaba cobrado');
update ctx62 set cobro_p1 = (select id from public.owner_charges where owner_id = 'c6200000-0000-4000-8000-000000000003' and property_id = 'a6200000-0000-4000-8000-000000000001' and period = '2026-06-01');
update ctx62 set cobro_julio = (select id from public.owner_charges where owner_id = 'c6200000-0000-4000-8000-000000000003' and property_id = 'a6200000-0000-4000-8000-000000000001' and period = '2026-07-01');

-- ── RF-62.5 · la anulación de un gasto ya liquidado entra como reversa en agosto ─
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
select public.anular_movimiento((select tardio from ctx62), 'Factura duplicada.');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select lives_ok($$ select public.close_owner_statements('2026-08-01') $$, 'RF-62.3 · se cierra agosto');
select is(
  (select (l.entry, l.adjustment, s.net)
     from public.owner_statement_lines l join public.owner_statements s on s.id = l.statement_id
    where s.fraction_id = (select f3 from ctx62) and s.period = '2026-08-01'),
  ('reversal'::text, true, 30000::bigint),
  'RF-62.5 · agosto trae la reversa de la cuota anulada y el corte vale +$30.000');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000001'), -50000::bigint,
  'RF-62.5 · la billetera de P1 vuelve a −$50.000');

-- ── RF-62.12 · quién ve qué ─────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000005';
select is((select count(*) from public.owner_charges where owner_id = 'c6200000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-62.14 · Otro no ve los cobros de Pedro');
select is((select count(*) from public.owner_statements where owner_id = 'c6200000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-62.14 · ni sus cortes');
select is((select count(*) from public.owner_statements where owner_id = 'c6200000-0000-4000-8000-000000000005' and period = '2026-06-01'), 1::bigint,
  'RF-62.12 · pero sí el suyo');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
select is((select count(*) from public.owner_statements where property_id = 'a6200000-0000-4000-8000-000000000001' and period = '2026-06-01'), 3::bigint,
  'RF-62.12 · el Administrador de P1 ve los tres cortes de junio de P1');
select is((select count(*) from public.owner_statements where property_id = 'a6200000-0000-4000-8000-000000000002'), 0::bigint,
  'RF-62.12 · y ninguno de P2, que no administra');

-- ── RF-62.7 · el reporte del pago ───────────────────────────────────────────
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.report_owner_payment((select cobro_p1 from ctx62), 50000, '2026-07-05', (select medio from ctx62), 'Transferencia', null) $$,
  '%CA-62.6%', 'CA-62.6 · sin comprobante se rechaza');
select throws_like(
  $$ select public.report_owner_payment((select cobro_p1 from ctx62), 50000, '2026-07-05', null, 'Transferencia', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/x.pdf') $$,
  '%CA-62.6%', 'CA-62.6 · sin medio de pago se rechaza');
select throws_like(
  $$ select public.report_owner_payment((select cobro_p1 from ctx62), 60000, '2026-07-05', (select medio from ctx62), 'Transferencia', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/x.pdf') $$,
  '%CA-62.6%', 'CA-62.6 · por $60.000 sobre un cobro de $50.000 se rechaza');
select is((select status from public.owner_charges where id = (select cobro_p1 from ctx62)), 'pending',
  'CA-62.6 · y el cobro no cambia');

-- El comprobante ya está en el bucket, bajo la propiedad y el Propietario.
reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name) values
  ('owner-receipts', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/pago-1.pdf'),
  ('owner-receipts', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/pago-2.pdf'),
  ('owner-receipts', 'a6200000-0000-4000-8000-000000000002/c6200000-0000-4000-8000-000000000003/retiro-1.pdf');
set local role authenticated;
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000005';
select throws_like(
  $$ select public.report_owner_payment((select cobro_p1 from ctx62), 50000, '2026-07-05', (select medio from ctx62), 'Transferencia', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/pago-1.pdf') $$,
  '%RF-62.12%', 'CA-62.14 · Otro no reporta un pago sobre el cobro de Pedro');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
update ctx62 set pago_1 = public.report_owner_payment((select cobro_p1 from ctx62), 50000, '2026-07-05', (select medio from ctx62), 'Transferencia Bancolombia', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/pago-1.pdf');
select is((select (status, paid_amount) from public.owner_charges where id = (select cobro_p1 from ctx62)), ('under_review'::text, 0::bigint),
  'CA-62.7 · reportado, el cobro pasa a revisión sin tocar lo pagado');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000001'), -50000::bigint,
  'CA-62.7 · el saldo no cambia hasta que se confirme');
select is((select (channel, provider) from public.owner_payments where id = (select pago_1 from ctx62)), ('manual'::text, null::text),
  'CA-62.13 · el pago manual se guarda con canal manual y sin proveedor');
select is(pg_temp.avisos('owner_payment_reported', (select pago_1 from ctx62)::text, 'c6200000-0000-4000-8000-000000000001'), 1::bigint,
  'RF-62.13 · el Administrador de P1 recibe el aviso del pago reportado');

-- ── RF-62.8 · confirmación ──────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000b';
select throws_like(
  $$ select public.confirm_owner_payment((select pago_1 from ctx62)) $$,
  '%RF-62.12%', 'CA-62.14 · un Administrador de otra propiedad no confirma');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
select lives_ok($$ select public.confirm_owner_payment((select pago_1 from ctx62)) $$, 'RF-62.8 · el Administrador de P1 confirma');
select is((select (status, paid_amount) from public.owner_charges where id = (select cobro_p1 from ctx62)), ('paid'::text, 50000::bigint),
  'CA-62.7 · confirmado, el cobro queda pagado');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-62.7 · y la billetera de P1 en $0');
select is(
  (select (w.kind, w.amount) from public.owner_wallet_movements w where w.payment_id = (select pago_1 from ctx62)),
  ('payment_confirmed'::text, 50000::bigint), 'RF-62.2 · el pago confirmado es un movimiento de la billetera');
select throws_like(
  $$ select public.confirm_owner_payment((select pago_1 from ctx62)) $$,
  '%CA-62.9%', 'CA-62.9 · un pago confirmado no se confirma dos veces');
select throws_like(
  $$ select public.reject_owner_payment((select pago_1 from ctx62), 'Tarde.') $$,
  '%CA-62.9%', 'CA-62.9 · ni se rechaza después de confirmado');
select is(pg_temp.avisos('owner_payment_confirmed', (select pago_1 from ctx62)::text, 'c6200000-0000-4000-8000-000000000003'), 1::bigint,
  'CA-62.15 · Pedro recibe un solo aviso de la confirmación');

-- ── CA-62.8 · rechazo con motivo ────────────────────────────────────────────
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
update ctx62 set pago_2 = public.report_owner_payment((select cobro_julio from ctx62), 30000, '2026-08-05', (select medio from ctx62), 'Consignación', 'a6200000-0000-4000-8000-000000000001/c6200000-0000-4000-8000-000000000003/pago-2.pdf');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reject_owner_payment((select pago_2 from ctx62), '  ') $$,
  '%CA-62.8%', 'CA-62.8 · sin motivo el rechazo no procede');
select lives_ok($$ select public.reject_owner_payment((select pago_2 from ctx62), 'El comprobante no corresponde.') $$, 'CA-62.8 · con motivo, se rechaza');
select is((select (status, paid_amount) from public.owner_charges where id = (select cobro_julio from ctx62)), ('pending'::text, 0::bigint),
  'CA-62.8 · el cobro vuelve a pendiente y lo pagado no cambia');
select is((select rejection_reason from public.owner_payments where id = (select pago_2 from ctx62)), 'El comprobante no corresponde.',
  'CA-62.8 · el motivo queda en el pago');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
select is((select rejection_reason from public.owner_payments where id = (select pago_2 from ctx62)), 'El comprobante no corresponde.',
  'CA-62.8 · y Pedro lo ve');
select is(pg_temp.avisos('owner_payment_rejected', (select pago_2 from ctx62)::text, 'c6200000-0000-4000-8000-000000000003'), 1::bigint,
  'CA-62.15 · Pedro recibe el aviso del rechazo');

-- ── CA-62.13 · la referencia externa de una pasarela es única por proveedor ─
reset role;
set local request.jwt.claim.sub = '';
select throws_like(
  $$ insert into public.owner_payments (charge_id, owner_id, property_id, amount, paid_on, description, channel, provider, external_reference)
     select id, owner_id, property_id, 1000, '2026-08-06'::date, 'Pasarela', 'gateway', 'wompi', 'TX-001' from public.owner_charges where id = (select cobro_julio from ctx62)
     union all
     select id, owner_id, property_id, 1000, '2026-08-06'::date, 'Pasarela', 'gateway', 'wompi', 'TX-001' from public.owner_charges where id = (select cobro_julio from ctx62) $$,
  '%owner_payments_provider_external_reference_key%', 'CA-62.13 · dos pagos con el mismo proveedor y referencia no coexisten');
select throws_like(
  $$ insert into public.owner_payments (charge_id, owner_id, property_id, amount, paid_on, description, channel, provider, external_reference, payment_method_id, receipt_path)
     select id, owner_id, property_id, 1000, '2026-08-06', 'Manual con proveedor', 'manual', 'wompi', null, (select medio from ctx62), 'x' from public.owner_charges where id = (select cobro_julio from ctx62) $$,
  '%owner_payments_canal_coherente%', 'CA-62.13 · un pago manual no lleva proveedor');

-- ── RF-62.9 · el retiro del saldo positivo de P2 ────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.request_owner_withdrawal('a6200000-0000-4000-8000-000000000002', 700000, 'Bancolombia', 'savings', '11111111', 'Pedro Pérez') $$,
  '%CA-62.10%', 'CA-62.10 · con +$630.000 no se retiran $700.000');
select throws_like(
  $$ select public.request_owner_withdrawal('a6200000-0000-4000-8000-000000000001', 1000, 'Bancolombia', 'savings', '11111111', 'Pedro Pérez') $$,
  '%CA-62.10%', 'RF-62.9 · con saldo cero en P1 no hay nada que retirar');
update ctx62 set retiro_1 = public.request_owner_withdrawal('a6200000-0000-4000-8000-000000000002', 300000, 'Bancolombia', 'savings', '11111111', 'Pedro Pérez');
select throws_like(
  $$ select public.request_owner_withdrawal('a6200000-0000-4000-8000-000000000002', 100000, 'Bancolombia', 'savings', '11111111', 'Pedro Pérez') $$,
  '%CA-62.10%', 'CA-62.10 · con una solicitud abierta, la segunda se rechaza');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000002'), 630000::bigint,
  'RF-62.9 · solicitar no mueve el saldo');

set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.pay_owner_withdrawal((select retiro_1 from ctx62), 'a6200000-0000-4000-8000-000000000002/c6200000-0000-4000-8000-000000000003/retiro-1.pdf') $$,
  '%RF-62.12%', 'CA-62.14 · el Administrador de P1 no paga un retiro de P2');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select throws_like(
  $$ select public.pay_owner_withdrawal((select retiro_1 from ctx62), null) $$,
  '%CA-62.10%', 'CA-62.10 · pagar sin comprobante se rechaza');
select lives_ok(
  $$ select public.pay_owner_withdrawal((select retiro_1 from ctx62), 'a6200000-0000-4000-8000-000000000002/c6200000-0000-4000-8000-000000000003/retiro-1.pdf') $$,
  'RF-62.9 · el Superadmin registra el pago con comprobante');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000002'), 330000::bigint,
  'CA-62.10 · el saldo de P2 queda en $330.000');
select is(
  (select (w.kind, w.amount) from public.owner_wallet_movements w where w.withdrawal_id = (select retiro_1 from ctx62)),
  ('withdrawal_paid'::text, -300000::bigint), 'RF-62.2 · el retiro pagado es un movimiento de la billetera');
select throws_like(
  $$ select public.reject_owner_withdrawal((select retiro_1 from ctx62), 'Tarde.') $$,
  '%CA-62.9%', 'CA-62.9 · pagado → rechazado se rechaza');
select is(pg_temp.avisos('owner_withdrawal_paid', (select retiro_1 from ctx62)::text, 'c6200000-0000-4000-8000-000000000003'), 1::bigint,
  'CA-62.15 · Pedro recibe el aviso del retiro pagado');

set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-000000000003';
update ctx62 set retiro_2 = public.request_owner_withdrawal('a6200000-0000-4000-8000-000000000002', 100000, 'Bancolombia', 'savings', '11111111', 'Pedro Pérez');
set local request.jwt.claim.sub = 'c6200000-0000-4000-8000-00000000000a';
select throws_like(
  $$ select public.reject_owner_withdrawal((select retiro_2 from ctx62), '') $$,
  '%RF-62.9%', 'RF-62.9 · rechazar exige motivo');
select lives_ok($$ select public.reject_owner_withdrawal((select retiro_2 from ctx62), 'Cuenta inválida.') $$, 'RF-62.9 · con motivo, se rechaza');
select is(pg_temp.saldo('c6200000-0000-4000-8000-000000000003', 'a6200000-0000-4000-8000-000000000002'), 330000::bigint,
  'RF-62.9 · el rechazo no mueve el saldo');
select is(pg_temp.avisos('owner_withdrawal_rejected', (select retiro_2 from ctx62)::text, 'c6200000-0000-4000-8000-000000000003'), 1::bigint,
  'CA-62.15 · Pedro recibe el aviso del rechazo del retiro');

-- ── TR-01 · D-51 · todo queda auditado y nada entra a la maestra ────────────
reset role;
set local request.jwt.claim.sub = '';
select is((select count(*) from public.movements where property_id in ('a6200000-0000-4000-8000-000000000001', 'a6200000-0000-4000-8000-000000000002')), 5::bigint,
  'D-51 · ni el pago ni el retiro crean movimientos en la maestra: siguen los cinco registrados');
select is(
  (select count(*) > 0 from public.audit_log where entity_type = 'owner_statement' and action = 'owner_statement.creada'
     and entity_id = (select id from public.owner_statements where fraction_id = (select f3 from ctx62) and period = '2026-06-01')),
  true, 'CA-62.15 · el corte queda auditado');
select is(
  (select count(*) from public.audit_log where entity_type = 'owner_payment' and entity_id = (select pago_1 from ctx62) and action = 'owner_payment.actualizada' and reason is not null),
  1::bigint, 'CA-62.15 · la confirmación del pago queda auditada con motivo');
select is(
  (select reason from public.audit_log where entity_type = 'owner_payment' and entity_id = (select pago_2 from ctx62) and action = 'owner_payment.actualizada'),
  'Pago rechazado: El comprobante no corresponde.', 'CA-62.15 · y el rechazo, con el motivo dado');
select is(
  (select count(*) from public.audit_log where entity_type = 'owner_withdrawal' and entity_id = (select retiro_1 from ctx62) and action = 'owner_withdrawal.actualizada'),
  1::bigint, 'CA-62.15 · el pago del retiro queda auditado');

select * from finish();
rollback;
