-- HU-55 · RF-55.1…RF-55.5 · D-02 · D-20 — la billetera del Embajador en la base:
-- los cuatro saldos derivados del histórico, la fecha en que lo en gracia pasa a
-- disponible, la reversa dentro de la gracia, el retiro pagado como movimiento,
-- el listado ordenado y la lectura acotada por RLS.
begin;
select plan(26);

/**
 * Corre la tarea de gracia y cuenta solo lo que liberó en la propiedad de esta
 * prueba. La tarea devuelve cuántas liberó en toda la base, y la base local
 * guarda datos reales: contar lo global haría depender la prueba de ellos.
 */
create or replace function pg_temp.liberadas_en(dia date, propiedad uuid)
returns integer
language plpgsql
security definer
as $$
declare
  antes integer;
  despues integer;
begin
  select count(*) into antes from public.commissions where property_id = propiedad and status = 'available';
  perform public.release_commissions_in_grace(dia);
  select count(*) into despues from public.commissions where property_id = propiedad and status = 'available';
  return despues - antes;
end;
$$;

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_view('public', 'wallet_listing', 'RF-55.3 · existe el listado de la billetera');
select has_view('public', 'wallet_balances', 'RF-55.1 · existen los saldos por Embajador');
select has_function('private', 'saldos_de_billetera', array['uuid'], 'RF-55.2 · los saldos se derivan con una función, no se guardan');
select has_column('public', 'commissions', 'withdrawn_amount', 'D-50 · la comisión sabe cuánto se le ha retirado');
select matches(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'wallet_movements_tipo_valido'),
  'withdrawal_requested.*withdrawal_approved.*withdrawal_paid',
  'RF-55.2 · el histórico admite solicitud, aprobación y pago del retiro además de lo de HU-54');

-- ── Cuentas: Superadmin, Ana y Luis (Embajadoras), tres prospectos ──────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5500000-0000-4000-8000-000000000001', 'super.bil55@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000002', 'ana.bil55@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000003', 'luis.bil55@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000004', 'pa.bil55@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000005', 'pb.bil55@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000006', 'pc.bil55@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5500000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5500000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');

set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
create temporary table emb55 as
  select a.user_id, a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a
   where a.user_id in ('c5500000-0000-4000-8000-000000000002', 'c5500000-0000-4000-8000-000000000003');
grant select on emb55 to authenticated, anon;

reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 55', 'percentage', null, 300, true);

-- Los tres prospectos son de Ana.
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000005';
select public.attribute_referral(null, (select code from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000006';
select public.attribute_referral(null, (select code from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002'));

set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5500000-0000-4000-8000-000000000001', 'Casa Billetera', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5500000-0000-4000-8000-000000000001', array[100000000::bigint]);
create temporary table fr55 as
  select number, id from public.fractions where property_id = 'a5500000-0000-4000-8000-000000000001';
grant select on fr55 to authenticated;

insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5500000-0000-4000-8000-000000000001', (select id from fr55 where number = 1), 'a5500000-0000-4000-8000-000000000001', 'pa.bil55@arena.co', 'c5500000-0000-4000-8000-000000000004', 100000000),
  ('e5500000-0000-4000-8000-000000000002', (select id from fr55 where number = 2), 'a5500000-0000-4000-8000-000000000001', 'pb.bil55@arena.co', 'c5500000-0000-4000-8000-000000000005', 80000000),
  ('e5500000-0000-4000-8000-000000000003', (select id from fr55 where number = 3), 'a5500000-0000-4000-8000-000000000001', 'pc.bil55@arena.co', 'c5500000-0000-4000-8000-000000000006', 50000000);

create temporary table planes55 (nombre text primary key, id uuid);
grant select, insert, update on planes55 to authenticated;

/** Los saldos de Ana tal como los ve quien consulta. */
create or replace function pg_temp.saldos_de_ana()
returns text
language sql
as $$
  select b.pending || '|' || b.in_grace || '|' || b.available || '|' || b.withdrawn || '|' || b.reversed || '|' || b.total_earned
    from public.wallet_balances b
   where b.ambassador_id = (select ambassador_id from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002');
$$;

-- ── RF-55.1 · la compra cerrada es saldo pendiente, todavía fuera de la billetera ──
insert into planes55 select 'A', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000001'));
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '3000000|0|0|0|0|0',
  'RF-55.1 · al cerrar la compra Ana tiene $3.000.000 pendientes y nada más');
select is((select count(*) from public.wallet_listing), 0::bigint,
  'RF-55.2 · lo pendiente no es un movimiento: aún no entró a la billetera');

-- ── CA-55.2 · el pago completo acredita en gracia, no en disponible ─────────
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes55 where nombre = 'A'), 'a5500000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/a55.pdf');

set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '0|3000000|0|0|0|3000000',
  'CA-55.2 · acreditada hoy, suma $3.000.000 al saldo en gracia y nada al disponible; ya cuenta como ganado');
select is(
  (select (l.kind, l.referral_label, l.property_name, l.fraction_number::integer, l.grace_ends_on) from public.wallet_listing l),
  ('commission_credited'::text, 'pa.bil55@arena.co'::text, 'Casa Billetera'::text, 1, current_date + 30),
  'CA-55.2 · RF-55.3 · el movimiento lleva el referido, la propiedad y la fecha en que pasará a disponible');

-- ── CA-55.3 · la reversa dentro de la gracia ────────────────────────────────
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into planes55 select 'B', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000002'));
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes55 where nombre = 'B'), 'a5500000-0000-4000-8000-000000000001', 80000000, current_date, 'transferencia', 'payment-receipts/b55.pdf');
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '0|5400000|0|0|0|5400000',
  'CA-55.3 · con la segunda comisión hay $5.400.000 en gracia y ganados');

set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select public.anular_compra((select id from planes55 where nombre = 'B'), 'Desistimiento firmado.');
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '0|3000000|0|0|2400000|3000000',
  'CA-55.3 · reversada dentro de la gracia, el saldo en gracia baja y el total ganado se ajusta');

-- ── D-02 · a los 30 días pasa a disponible ──────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(pg_temp.liberadas_en(current_date + 30, 'a5500000-0000-4000-8000-000000000001'), 1, 'D-02 · la tarea libera la comisión de Ana');
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '0|0|3000000|0|2400000|3000000',
  'CA-55.1 · liberada, los $3.000.000 pasan de gracia a disponible');

-- ── CA-55.4 · un retiro pagado aparece como movimiento y baja el disponible ──
create temporary table retiro55 as select public.request_withdrawal(1000000) as id;
grant select on retiro55 to authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select public.approve_withdrawal((select id from retiro55));
reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name)
values ('withdrawal-receipts', (select ambassador_id from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002') || '/' || (select id from retiro55) || '.pdf');
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select public.pay_withdrawal((select id from retiro55),
  (select ambassador_id from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002') || '/' || (select id from retiro55) || '.pdf');

set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(
  (select (l.kind, l.amount, l.withdrawal_status) from public.wallet_listing l where l.kind = 'withdrawal_paid'),
  ('withdrawal_paid'::text, 1000000::bigint, 'paid'::text),
  'CA-55.4 · el retiro pagado aparece como movimiento con el estado de su solicitud');
select is(pg_temp.saldos_de_ana(), '0|0|2000000|1000000|2400000|3000000',
  'CA-55.4 · y el disponible bajó exactamente en ese monto');
select is(
  (select b.available from public.wallet_balances b where b.user_id = 'c5500000-0000-4000-8000-000000000002'),
  (select (5400000 - b.in_grace - b.withdrawn - b.reversed)::bigint from public.wallet_balances b where b.user_id = 'c5500000-0000-4000-8000-000000000002'),
  'CA-55.1 · disponible = acreditado − en gracia − retirado − reversado');

-- ── RF-55.3 · el listado sale del más reciente al más antiguo ───────────────
-- Dentro de una misma transacción todo `created_at` es el mismo instante, así que
-- aquí solo se puede comprobar el primer criterio del orden (la fecha); el
-- desempate por instante lo prueba `sortWalletEntries` en Vitest.
select is(
  (select array_agg(l.kind order by l.occurred_on desc, l.kind) from public.wallet_listing l),
  array['commission_available', 'commission_credited', 'commission_credited', 'commission_reversed', 'withdrawal_approved', 'withdrawal_paid', 'withdrawal_requested'],
  'RF-55.3 · CA-55.4 · siete movimientos: primero el liberado, fechado a 30 días, y luego los seis de hoy');
select is((select count(*) from public.wallet_listing l where l.kind in ('withdrawal_requested', 'withdrawal_approved', 'withdrawal_paid')), 3::bigint,
  'RF-55.2 · el retiro dejó solicitud, aprobación y pago en el histórico');

-- ── RF-55.1 · una nueva compra vuelve a sumar pendiente sin tocar el histórico ──
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into planes55 select 'C', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000003'));
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select is(pg_temp.saldos_de_ana(), '1500000|0|2000000|1000000|2400000|3000000',
  'RF-55.1 · la tercera compra suma $1.500.000 pendientes y no toca lo demás');
select is((select count(*) from public.wallet_listing), 7::bigint, 'RF-55.2 · y el histórico sigue en siete movimientos');

-- ── CA-55.5 · cada quien lo suyo; el Superadmin, en lectura ─────────────────
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000003';
select is((select count(*) from public.wallet_listing), 0::bigint, 'CA-55.5 · Luis no ve ni un movimiento de Ana');
select is((select count(*) from public.wallet_balances where user_id = 'c5500000-0000-4000-8000-000000000002'), 0::bigint,
  'CA-55.5 · ni sus saldos');
select is((select b.available from public.wallet_balances b where b.user_id = 'c5500000-0000-4000-8000-000000000003'), 0::bigint,
  'RF-55.4 · Luis ve su propia billetera, en cero');
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select is((select b.available from public.wallet_balances b where b.user_id = 'c5500000-0000-4000-8000-000000000002'), 2000000::bigint,
  'CA-55.5 · D-20 · el Superadmin ve los saldos de Ana');
select is((select count(*) from public.wallet_listing l where l.ambassador_id = (select ambassador_id from emb55 where user_id = 'c5500000-0000-4000-8000-000000000002')), 7::bigint,
  'CA-55.5 · D-20 · y su histórico completo');
select ok(not has_table_privilege('authenticated', 'public.wallet_movements', 'INSERT')
  and not has_table_privilege('authenticated', 'public.wallet_movements', 'UPDATE'),
  'RF-55.2 · nadie escribe la billetera a mano: ni el Superadmin');

select * from finish();
rollback;
