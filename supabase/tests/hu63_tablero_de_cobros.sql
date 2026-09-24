-- HU-63 · RF-63.1, RF-63.4…RF-63.8, RF-63.10, RF-63.11 · D-08, D-51 · TR-01,
-- TR-03 — el tablero de cobros en la base: la vista de cuotas por fracción y mes
-- acotada a quien gestiona, la confirmación a prueba de doble clic con su autor
-- auditado, el rechazo con motivo, el abono parcial, el pago del saldo positivo y
-- los pagos de pasarela fuera del alcance del botón.
begin;
select plan(42);

/** Cuántos avisos de un tipo, sobre una entidad, le llegaron a una cuenta. */
create or replace function pg_temp.avisos(tipo text, entidad text, cuenta uuid)
returns bigint
language sql
security definer
as $$
  select count(*) from public.notifications n
    join public.notification_recipients r on r.notification_id = n.id
   where n.kind = tipo and n.entity_id = entidad and r.recipient_id = cuenta;
$$;

/** El saldo de un Propietario en una propiedad, para quien mira. */
create or replace function pg_temp.saldo(propietario uuid, propiedad uuid)
returns bigint
language sql
as $$ select b.balance from public.owner_wallet_balances b where b.owner_id = propietario and b.property_id = propiedad $$;

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_view('public', 'property_board_shares', 'RF-63.1 · existe la vista de cuotas por fracción y mes');
select is(
  (select 'security_invoker=true' = any (c.reloptions) from pg_class c where c.relname = 'property_board_shares'),
  true, 'RF-63.8 · la vista corre con los permisos de quien mira');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c6300000-0000-4000-8000-00000000000a', 'super.hu63@arena.co', '{}'),
  ('c6300000-0000-4000-8000-000000000001', 'admin.hu63@arena.co', '{}'),
  ('c6300000-0000-4000-8000-00000000000b', 'admin2.hu63@arena.co', '{}'),
  ('c6300000-0000-4000-8000-000000000003', 'ana.hu63@ejemplo.com', '{}'),
  ('c6300000-0000-4000-8000-000000000005', 'beto.hu63@ejemplo.com', '{}'),
  ('c6300000-0000-4000-8000-000000000007', 'dora.hu63@ejemplo.com', '{}');
insert into public.user_roles (user_id, role) values
  ('c6300000-0000-4000-8000-00000000000a', 'superadmin'),
  ('c6300000-0000-4000-8000-000000000001', 'property_admin'),
  ('c6300000-0000-4000-8000-00000000000b', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a6300000-0000-4000-8000-000000000001', 'Casa Tablero', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a6300000-0000-4000-8000-000000000001', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
-- Ana tiene la 1/8 y Beto la 3/8, activas desde enero; Dora tiene la 4/8 con el calendario inactivo.
update public.fractions set status = 'reserved'
 where property_id = 'a6300000-0000-4000-8000-000000000001' and number in (1, 3, 4);
update public.fractions set status = 'sold', owner_id = 'c6300000-0000-4000-8000-000000000003'
 where property_id = 'a6300000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c6300000-0000-4000-8000-000000000005'
 where property_id = 'a6300000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'c6300000-0000-4000-8000-000000000007'
 where property_id = 'a6300000-0000-4000-8000-000000000001' and number = 4;
update public.fractions set calendar_active = true, calendar_activated_at = '2026-01-01T12:00:00Z'
 where property_id = 'a6300000-0000-4000-8000-000000000001' and number in (1, 3);

create temporary table ctx63 as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as gasto,
    (select id from public.expense_categories where name = 'Renta a terceros' and kind = 'income') as renta,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta,
    (select id from public.fractions where property_id = 'a6300000-0000-4000-8000-000000000001' and number = 1) as f1,
    (select id from public.fractions where property_id = 'a6300000-0000-4000-8000-000000000001' and number = 3) as f3,
    null::uuid as cobro_junio,
    null::uuid as cobro_julio,
    null::uuid as pago_1,
    null::uuid as pago_2,
    null::uuid as pago_3,
    null::uuid as pago_pasarela,
    null::uuid as retiro;
grant select, update on ctx63 to authenticated;

-- ── Junio: gasto de $80.000 prorrateado, ingreso atribuido de $640.000 a la 3/8
--    e imputación de $40.000 a la 1/8 ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description) values
  ('a6300000-0000-4000-8000-000000000001', 'expense', 80000, (select gasto from ctx63), (select medio from ctx63), (select cuenta from ctx63), '2026-06-10', 'Jardín junio');
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description, allocation, fraction_id) values
  ('a6300000-0000-4000-8000-000000000001', 'expense', 40000, (select gasto from ctx63), (select medio from ctx63), (select cuenta from ctx63), '2026-06-15', 'Vidrio roto por la 1/8', 'single_fraction', (select f1 from ctx63));
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-00000000000a';
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description, allocation, fraction_id) values
  ('a6300000-0000-4000-8000-000000000001', 'income', 640000, (select renta from ctx63), (select medio from ctx63), (select cuenta from ctx63), '2026-06-05', 'Renta de semana liberada por la 3/8', 'single_fraction', (select f3 from ctx63));
select public.close_owner_statements('2026-06-01');
update ctx63 set cobro_junio = (select id from public.owner_charges where owner_id = 'c6300000-0000-4000-8000-000000000003' and period = '2026-06-01');

-- ── RF-63.1 · RF-63.7 · la vista de cuotas por fracción y mes ───────────────
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select is(
  (select (v.responsible, v.owner_id, v.income, v.expenses, v.net) from public.property_board_shares v
    where v.property_id = 'a6300000-0000-4000-8000-000000000001' and v.fraction_number = 1 and v.period = '2026-06-01'),
  ('owner'::text, 'c6300000-0000-4000-8000-000000000003'::uuid, 0::bigint, 50000::bigint, -50000::bigint),
  'CA-63.1 · la 1/8 responde por $50.000 de gastos en junio: cobro');
select is(
  (select v.net from public.property_board_shares v
    where v.property_id = 'a6300000-0000-4000-8000-000000000001' and v.fraction_number = 3 and v.period = '2026-06-01'),
  630000::bigint, 'CA-63.1 · la 3/8 queda con +$630.000: pago');
select is(
  (select (v.responsible, v.owner_id, v.net) from public.property_board_shares v
    where v.property_id = 'a6300000-0000-4000-8000-000000000001' and v.fraction_number = 4 and v.period = '2026-06-01'),
  ('inventory_holder'::text, null::uuid, -10000::bigint),
  'CA-63.9 · D-08 · la 4/8, con calendario inactivo, es del titular del inventario y su cuota se ve');
select is(
  (select count(*) from public.owner_charges c where c.owner_id = 'c6300000-0000-4000-8000-000000000007'),
  0::bigint, 'CA-63.9 · y no genera cobro a Dora');
select is(
  (select count(*) from public.property_board_shares v
    where v.property_id = 'a6300000-0000-4000-8000-000000000001' and v.period = '2026-06-01' and v.responsible = 'inventory_holder'),
  6::bigint, 'RF-63.7 · las seis fracciones sin Propietario activo aparecen como del titular');
select is(
  (select (c.amount, c.status) from public.owner_charges c where c.id = (select cobro_junio from ctx63)),
  (50000::bigint, 'pending'::text), 'RF-63.1 · el cobro de junio de Ana está pendiente por $50.000');

-- ── CA-63.10 · quién ve el tablero ──────────────────────────────────────────
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-00000000000b';
select is((select count(*) from public.property_board_shares where property_id = 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.10 · un Administrador sin la propiedad asignada no ve su tablero');
select is((select count(*) from public.owner_charges where property_id = 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.10 · ni sus cobros');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000003';
select is((select count(*) from public.property_board_shares where property_id = 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.10 · un Propietario no accede a ningún tablero');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-00000000000a';
select is((select count(*) from public.property_board_shares where property_id = 'a6300000-0000-4000-8000-000000000001' and period = '2026-06-01'), 8::bigint,
  'CA-63.10 · el Superadmin ve las ocho filas de junio');

-- ── CA-63.3 · CA-63.4 · el pago reportado y su confirmación ─────────────────
reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name) values
  ('owner-receipts', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-1.pdf'),
  ('owner-receipts', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-2.pdf'),
  ('owner-receipts', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-3.pdf'),
  ('owner-receipts', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000005/retiro-1.pdf');
set local role authenticated;
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.owner_payments p where p.charge_id = (select cobro_junio from ctx63) and p.status = 'reported'),
  0::bigint, 'CA-63.3 · sin pago reportado, el cobro no tiene comprobante que revisar');
select throws_like(
  $$ select public.confirm_owner_payment(gen_random_uuid()) $$,
  '%RF-62.8%', 'CA-63.3 · sin comprobante no hay nada que confirmar');

set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000003';
update ctx63 set pago_1 = public.report_owner_payment((select cobro_junio from ctx63), 50000, '2026-07-05', (select medio from ctx63), 'Transferencia Bancolombia', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-1.pdf');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select is(
  (select (p.amount, p.receipt_path is not null, p.channel) from public.owner_payments p where p.id = (select pago_1 from ctx63)),
  (50000::bigint, true, 'manual'::text), 'CA-63.3 · el Administrador ve el pago reportado con su comprobante');

set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-00000000000b';
select throws_like(
  $$ select public.confirm_owner_payment((select pago_1 from ctx63)) $$,
  '%RF-62.12%', 'CA-63.10 · el Administrador de otra propiedad no confirma');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select lives_ok($$ select public.confirm_owner_payment((select pago_1 from ctx63)) $$, 'CA-63.4 · el Administrador de la propiedad confirma');
select is((select (status, paid_amount) from public.owner_charges where id = (select cobro_junio from ctx63)), ('paid'::text, 50000::bigint),
  'CA-63.4 · el cobro queda pagado');
select is(pg_temp.saldo('c6300000-0000-4000-8000-000000000003', 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.4 · y el saldo de la fracción en $0');
select throws_like(
  $$ select public.confirm_owner_payment((select pago_1 from ctx63)) $$,
  '%CA-62.9%', 'CA-63.5 · confirmarlo otra vez se rechaza');
select is(pg_temp.saldo('c6300000-0000-4000-8000-000000000003', 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.5 · y el saldo no cambia');

-- ── Julio: $400.000 prorrateados → cobro de $50.000 a Ana ───────────────────
insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description) values
  ('a6300000-0000-4000-8000-000000000001', 'expense', 400000, (select gasto from ctx63), (select medio from ctx63), (select cuenta from ctx63), '2026-07-10', 'Piscina julio');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-00000000000a';
select public.close_owner_statements('2026-07-01');
update ctx63 set cobro_julio = (select id from public.owner_charges where owner_id = 'c6300000-0000-4000-8000-000000000003' and period = '2026-07-01');
select is((select amount from public.owner_charges where id = (select cobro_julio from ctx63)), 50000::bigint, 'RF-63.1 · julio deja un cobro de $50.000');

-- ── CA-63.6 · el rechazo exige motivo ───────────────────────────────────────
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000003';
update ctx63 set pago_2 = public.report_owner_payment((select cobro_julio from ctx63), 20000, '2026-08-05', (select medio from ctx63), 'Consignación', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-2.pdf');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reject_owner_payment((select pago_2 from ctx63), null) $$,
  '%CA-62.8%', 'CA-63.6 · sin motivo el rechazo no procede');
select lives_ok($$ select public.reject_owner_payment((select pago_2 from ctx63), 'Comprobante ilegible.') $$, 'CA-63.6 · con motivo, se rechaza');
select is((select (status, paid_amount) from public.owner_charges where id = (select cobro_julio from ctx63)), ('pending'::text, 0::bigint),
  'CA-63.6 · el cobro vuelve a pendiente');
select is(pg_temp.saldo('c6300000-0000-4000-8000-000000000003', 'a6300000-0000-4000-8000-000000000001'), -50000::bigint,
  'CA-63.6 · y el saldo no cambia');

-- ── CA-63.7 · el abono parcial confirmado deja el cobro pendiente por la diferencia ─
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000003';
update ctx63 set pago_3 = public.report_owner_payment((select cobro_julio from ctx63), 20000, '2026-08-06', (select medio from ctx63), 'Consignación', 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000003/pago-3.pdf');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select lives_ok($$ select public.confirm_owner_payment((select pago_3 from ctx63)) $$, 'CA-63.7 · se confirma el abono de $20.000');
select is((select (status, paid_amount, amount - paid_amount) from public.owner_charges where id = (select cobro_julio from ctx63)), ('pending'::text, 20000::bigint, 30000::bigint),
  'CA-63.7 · el cobro sigue pendiente por $30.000');
select is(pg_temp.saldo('c6300000-0000-4000-8000-000000000003', 'a6300000-0000-4000-8000-000000000001'), -30000::bigint,
  'CA-63.7 · y el saldo baja a −$30.000');

-- ── CA-63.12 · un pago de pasarela no se resuelve desde el tablero ──────────
reset role;
set local request.jwt.claim.sub = '';
insert into public.owner_payments (id, charge_id, owner_id, property_id, amount, paid_on, description, channel, provider, external_reference)
values ('d6300000-0000-4000-8000-000000000001', (select cobro_julio from ctx63), 'c6300000-0000-4000-8000-000000000003', 'a6300000-0000-4000-8000-000000000001', 30000, '2026-08-07', 'Pago por pasarela', 'gateway', 'wompi', 'TX-63-001');
set local role authenticated;
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select is(
  (select (p.channel, p.provider, p.external_reference) from public.owner_payments p where p.id = 'd6300000-0000-4000-8000-000000000001'),
  ('gateway'::text, 'wompi'::text, 'TX-63-001'::text), 'CA-63.12 · el tablero ve el canal y la referencia externa del pago de pasarela');
select throws_like(
  $$ select public.confirm_owner_payment('d6300000-0000-4000-8000-000000000001') $$,
  '%RF-63.10%', 'CA-63.12 · el botón de confirmación no aplica a un pago de pasarela');
select throws_like(
  $$ select public.reject_owner_payment('d6300000-0000-4000-8000-000000000001', 'No.') $$,
  '%RF-63.10%', 'CA-63.12 · ni el de rechazo');

-- ── CA-63.8 · el pago del saldo positivo de la 3/8: +$630.000 de junio −$50.000 de julio ──────────────────────────
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000005';
update ctx63 set retiro = public.request_owner_withdrawal('a6300000-0000-4000-8000-000000000001', 580000, 'Bancolombia', 'savings', '33333333', 'Beto Ríos');
set local request.jwt.claim.sub = 'c6300000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.pay_owner_withdrawal((select retiro from ctx63), '') $$,
  '%CA-62.10%', 'CA-63.8 · sin comprobante el pago se rechaza');
select lives_ok(
  $$ select public.pay_owner_withdrawal((select retiro from ctx63), 'a6300000-0000-4000-8000-000000000001/c6300000-0000-4000-8000-000000000005/retiro-1.pdf') $$,
  'CA-63.8 · con comprobante, el Administrador paga');
select is(pg_temp.saldo('c6300000-0000-4000-8000-000000000005', 'a6300000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-63.8 · el saldo de la fracción baja en ese monto');
select is(
  (select count(*) from public.movements where property_id = 'a6300000-0000-4000-8000-000000000001'),
  4::bigint, 'D-51 · RF-63.6 · el pago no genera un egreso nuevo en la maestra');

-- ── RF-63.11 · auditoría con autor y avisos ─────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select l.actor_id from public.audit_log l where l.entity_type = 'owner_payment' and l.entity_id = (select pago_1 from ctx63) and l.action = 'owner_payment.actualizada'),
  'c6300000-0000-4000-8000-000000000001'::uuid, 'CA-63.4 · RF-63.11 · la confirmación queda auditada con su autor');
select is(
  (select l.reason from public.audit_log l where l.entity_type = 'owner_payment' and l.entity_id = (select pago_2 from ctx63) and l.action = 'owner_payment.actualizada'),
  'Pago rechazado: Comprobante ilegible.', 'RF-63.11 · el rechazo, con su motivo');
select is(
  (select l.actor_id from public.audit_log l where l.entity_type = 'owner_withdrawal' and l.entity_id = (select retiro from ctx63) and l.action = 'owner_withdrawal.actualizada'),
  'c6300000-0000-4000-8000-000000000001'::uuid, 'RF-63.11 · el pago a la fracción queda auditado con su autor');
select is(pg_temp.avisos('owner_payment_confirmed', (select pago_1 from ctx63)::text, 'c6300000-0000-4000-8000-000000000003'), 1::bigint,
  'RF-63.11 · Ana recibe un solo aviso de la confirmación');
select is(pg_temp.avisos('owner_payment_rejected', (select pago_2 from ctx63)::text, 'c6300000-0000-4000-8000-000000000003'), 1::bigint,
  'RF-63.11 · y uno del rechazo');
select is(pg_temp.avisos('owner_withdrawal_paid', (select retiro from ctx63)::text, 'c6300000-0000-4000-8000-000000000005'), 1::bigint,
  'RF-63.11 · Beto recibe un solo aviso del pago de su saldo');

select * from finish();
rollback;
