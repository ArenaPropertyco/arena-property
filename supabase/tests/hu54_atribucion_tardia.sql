-- HU-54 · RF-54.2, RF-54.3 · HU-51 · RF-51.3 · D-02, D-04 — la comisión del
-- referido cuya atribución llegó después de su compra.
--
-- Quien hace clic, se registra sin escribir el código y compra antes de entrar al
-- panel queda atribuido cuando su compra ya estaba cerrada. Sin la puesta al día,
-- el Embajador perdía la comisión que su enlace sí generó.
begin;
select plan(27);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_function('private', 'provisionar_comision_de_plan', array['uuid'],
  'RF-54.3 · la provisión es una función invocable, no solo un disparador');
select has_function('private', 'recuperar_comision_del_referido', array['uuid'],
  'RF-54.2 · existe la puesta al día de una atribución tardía');
select has_function('private', 'liberar_comision', array['uuid', 'date'],
  'CA-54.2 · la liberación es una función por comisión');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5500000-0000-4000-8000-000000000001', 'super.tar@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000002', 'ana.tar@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000003', 'hoy.tar@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000004', 'vieja.tar@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000005', 'proceso.tar@arena.co', '{}'),
  ('c5500000-0000-4000-8000-000000000006', 'anulada.tar@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5500000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5500000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
create temporary table emb55 as
  select a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a where a.user_id = 'c5500000-0000-4000-8000-000000000002';
grant select on emb55 to authenticated, anon;

-- RF-52.3 · la base local puede traer tipos sembrados: V1 del 3 % manda aquí.
reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 55', 'percentage', null, 300, true);

-- ── Propiedad, fracciones e invitaciones ────────────────────────────────────
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5500000-0000-4000-8000-000000000001', 'Casa Tardía', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5500000-0000-4000-8000-000000000001', array[100000000::bigint]);

create temporary table fr55 as
  select number, id from public.fractions where property_id = 'a5500000-0000-4000-8000-000000000001';
grant select on fr55 to authenticated;

insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5500000-0000-4000-8000-000000000001', (select id from fr55 where number = 1), 'a5500000-0000-4000-8000-000000000001', 'hoy.tar@arena.co', 'c5500000-0000-4000-8000-000000000003', 100000000),
  ('e5500000-0000-4000-8000-000000000002', (select id from fr55 where number = 2), 'a5500000-0000-4000-8000-000000000001', 'vieja.tar@arena.co', 'c5500000-0000-4000-8000-000000000004', 100000000),
  ('e5500000-0000-4000-8000-000000000003', (select id from fr55 where number = 3), 'a5500000-0000-4000-8000-000000000001', 'proceso.tar@arena.co', 'c5500000-0000-4000-8000-000000000005', 100000000),
  ('e5500000-0000-4000-8000-000000000004', (select id from fr55 where number = 4), 'a5500000-0000-4000-8000-000000000001', 'anulada.tar@arena.co', 'c5500000-0000-4000-8000-000000000006', 100000000),
  ('e5500000-0000-4000-8000-000000000005', (select id from fr55 where number = 5), 'a5500000-0000-4000-8000-000000000001', 'hoy.tar@arena.co', 'c5500000-0000-4000-8000-000000000003', 80000000);

create temporary table planes55 (nombre text primary key, id uuid);
grant select, insert, update on planes55 to authenticated;

-- ── Las cuatro compras se cierran SIN que nadie esté atribuido todavía ──────
insert into planes55 select 'hoy', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000001'));
insert into planes55 select 'vieja', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000002'));
insert into planes55 select 'proceso', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000003'));
insert into planes55 select 'anulada', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000004'));

insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path) values
  ((select id from planes55 where nombre = 'hoy'), 'a5500000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/hoy.pdf'),
  ((select id from planes55 where nombre = 'vieja'), 'a5500000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/vieja.pdf');

select public.anular_compra((select id from planes55 where nombre = 'anulada'), 'Desistimiento firmado.');

-- El pago de «vieja» se completó hace 40 días: su gracia ya habría vencido.
reset role;
set local request.jwt.claim.sub = '';
update public.payment_events set emitted_at = now() - interval '40 days'
 where plan_id = (select id from planes55 where nombre = 'vieja') and kind = 'payment_completed';

select is(
  (select count(*) from public.commissions where property_id = 'a5500000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-54.3 · sin atribución al cerrarse la compra, el cauce normal no provisiona nada');

-- ── Los clics existían desde antes; la atribución llega ahora ───────────────
set local role anon;
select public.record_referral_click('55550000-0000-4000-8000-000000000003', (select code from emb55));
select public.record_referral_click('55550000-0000-4000-8000-000000000004', (select code from emb55));
select public.record_referral_click('55550000-0000-4000-8000-000000000005', (select code from emb55));
select public.record_referral_click('55550000-0000-4000-8000-000000000006', (select code from emb55));

-- ── RF-54.2 · el referido con el pago completado hoy ────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000003';
select isnt(
  (select public.attribute_referral('55550000-0000-4000-8000-000000000003', null)),
  null, 'RF-51.2 · el prospecto queda atribuido al entrar por primera vez al panel');

-- Las comisiones son del Embajador (D-20): el prospecto no las ve, así que la
-- comprobación se hace fuera de su sesión.
reset role;
set local request.jwt.claim.sub = '';

select is(
  (select (c.amount, c.status::text, c.completed_on, c.grace_ends_on)
     from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'hoy')),
  (3000000::bigint, 'in_grace'::text, current_date, current_date + 30),
  'RF-54.2 · D-02 · la comisión se recupera acreditada en gracia, con los 30 días desde el pago completo');

select is(
  (select (stage::text, commissioned_purchase_id) from public.attributions where prospect_id = 'c5500000-0000-4000-8000-000000000003'),
  ('paid'::text, (select id from planes55 where nombre = 'hoy')),
  'RF-51.3 · D-04 · el referido se pone al día hasta «pago completado» y esa compra queda comisionada');

select is(
  (select count(*) from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'hoy'))),
  1::bigint, 'CA-54.5 · D-01 · la recuperación devenga una sola vez en el libro de plataforma');

select is(
  (select count(*) from public.notifications n
    where n.kind = 'referral_paid'
      and n.entity_id = (select c.id::text from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'hoy'))),
  1::bigint, 'TR-03 · el Embajador se entera de que su referido completó el pago');

-- ── RF-54.4 · repetir la atribución no duplica nada ─────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000003';
select is(
  (select public.attribute_referral('55550000-0000-4000-8000-000000000003', null)),
  (select code from emb55), 'CA-51.1 · volver a entrar al panel devuelve la misma atribución');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.commissions where plan_id = (select id from planes55 where nombre = 'hoy')),
  1::bigint, 'RF-54.4 · y no crea una segunda comisión');
select is(
  (select count(*) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes55 where nombre = 'hoy')),
  1::bigint, 'RF-54.4 · ni un segundo movimiento de billetera');

-- ── CA-54.6 · D-04 · una segunda compra del mismo referido no paga ──────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into planes55 select 'hoy2', (select id from public.cerrar_compra('e5500000-0000-4000-8000-000000000005'));
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.commissions where plan_id = (select id from planes55 where nombre = 'hoy2')),
  0::bigint, 'CA-54.6 · D-04 · la segunda fracción del mismo referido no genera otra comisión');

-- ── D-02 · el referido cuyo pago se completó hace 40 días ───────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000004';
select isnt(
  (select public.attribute_referral('55550000-0000-4000-8000-000000000004', null)),
  null, 'RF-51.2 · también se atribuye quien compró y pagó hace tiempo');

reset role;
set local request.jwt.claim.sub = '';

select is(
  (select (c.status::text, c.completed_on, c.grace_ends_on, c.available_on)
     from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'vieja')),
  ('available'::text, current_date - 40, current_date - 10, current_date),
  'D-02 · con la gracia ya vencida, el saldo recuperado sale a disponible en el acto');

select is(
  (select array_agg(w.kind order by w.kind) from public.wallet_movements w
    join public.commissions c on c.id = w.commission_id
   where c.plan_id = (select id from planes55 where nombre = 'vieja')),
  array['commission_available', 'commission_credited'],
  'RF-54.1 · con sus dos movimientos de billetera: acreditada y disponible');

select is(
  (select count(*) from public.notifications n
    where n.kind = 'commission_available'
      and n.entity_id = (select c.id::text from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'vieja'))),
  1::bigint, 'TR-03 · y con el aviso de saldo disponible para retirar');

select is(
  (select count(*) from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'vieja'))
      and l.accrued_on = current_date - 40),
  1::bigint, 'D-09 · D-01 · el devengo se imputa al día en que el pago se completó');

-- ── RF-53.3 · el referido cuya compra sigue en proceso de pago ──────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000005';
select isnt(
  (select public.attribute_referral('55550000-0000-4000-8000-000000000005', null)),
  null, 'RF-51.2 · se atribuye quien compró y todavía está pagando');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select (c.status::text, c.amount) from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'proceso')),
  ('pending'::text, 3000000::bigint),
  'RF-53.3 · su comisión se recupera pendiente, que es lo que corresponde a una compra sin pagar');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5500000-0000-4000-8000-000000000005'),
  'payment_in_progress', 'RF-51.3 · y el referido se pone al día solo hasta «en proceso de pago»');
select is(
  (select count(*) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes55 where nombre = 'proceso')),
  0::bigint, 'RF-54.1 · lo pendiente todavía no toca la billetera');

-- Al completar el pago sigue el cauce normal: se acredita con la fecha de hoy.
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000001';
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes55 where nombre = 'proceso'), 'a5500000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/proceso.pdf');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select (c.status::text, c.grace_ends_on) from public.commissions c where c.plan_id = (select id from planes55 where nombre = 'proceso')),
  ('in_grace'::text, current_date + 30),
  'RF-54.2 · completado el pago, la comisión recuperada se acredita por el cauce de siempre');

-- ── RF-58.8 · una compra anulada no recupera nada ───────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5500000-0000-4000-8000-000000000006';
select isnt(
  (select public.attribute_referral('55550000-0000-4000-8000-000000000006', null)),
  null, 'RF-51.2 · quien tuvo una compra anulada también queda atribuido');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.commissions c join public.attributions a on a.id = c.attribution_id
    where a.prospect_id = 'c5500000-0000-4000-8000-000000000006'),
  0::bigint, 'RF-58.8 · pero una compra anulada no recupera comisión alguna');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5500000-0000-4000-8000-000000000006'),
  'registered', 'RF-58.8 · y su referido se queda en «registrado»');

-- ── TR-01 · la recuperación queda auditada con motivo ───────────────────────
select is(
  (select count(*) from public.audit_log
    where entity_type = 'commission' and action = 'commission.actualizada' and coalesce(btrim(reason), '') = ''),
  0::bigint, 'TR-01 · ninguna transición de una comisión recuperada quedó sin motivo');

select * from finish();
rollback;
