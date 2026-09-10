-- HU-51 · RF-51.1…RF-51.7 · D-03, D-04 — la atribución del referido en la base:
-- ventana de 90 días, primera atribución gana, sin auto-referencia, código
-- inhabilitado sin bloquear, ciclo de vida atado a la compra y una sola comisión
-- por prospecto.
begin;
select plan(35);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'attributions', 'RF-51.1 · existe attributions');
select has_table('public', 'referral_clicks', 'RF-51.1 · existe el registro de clics');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.attributions'::regclass, 'public.referral_clicks'::regclass)),
  true, 'RF-51.1 · la atribución y los clics fuerzan RLS');
select col_is_unique('public', 'attributions', 'prospect_id', 'CA-51.1 · RF-51.3 · un prospecto tiene una sola atribución');
select has_function('public', 'record_referral_click', array['uuid', 'text'], 'RF-51.1 · existe record_referral_click');
select has_function('public', 'attribute_referral', array['uuid', 'text'], 'RF-51.2 · existe attribute_referral');

-- ── Cuentas: dos Embajadores aprobados y varios prospectos ──────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5100000-0000-4000-8000-000000000001', 'super.atr@arena.co', '{}'),
  ('c5100000-0000-4000-8000-000000000002', 'ana.atr@arena.co', '{}'),
  ('c5100000-0000-4000-8000-000000000003', 'luis.atr@arena.co', '{}'),
  ('c5100000-0000-4000-8000-000000000004', 'prospecto.atr@arena.co', '{}'),
  ('c5100000-0000-4000-8000-000000000005', 'tardio.atr@arena.co', '{}'),
  ('c5100000-0000-4000-8000-000000000006', 'sincodigo.atr@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5100000-0000-4000-8000-000000000001', 'superadmin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');

set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000001';
create temporary table codigos as
  select a.user_id, public.approve_ambassador(a.id, true, null) as code, a.id as ambassador_id
    from public.ambassadors a
   where a.user_id in ('c5100000-0000-4000-8000-000000000002', 'c5100000-0000-4000-8000-000000000003');
grant select on codigos to authenticated, anon;

select is((select count(*) from codigos where code is not null), 2::bigint,
  'RF-50.1 · los dos Embajadores quedan con código');

-- ── RF-51.1 · los clics se registran sin sesión ─────────────────────────────
set local role anon;
set local request.jwt.claim.sub = '';
select lives_ok(
  $$ select public.record_referral_click('11111111-0000-4000-8000-000000000001',
       (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000002')) $$,
  'RF-51.1 · un visitante sin sesión deja registrado su clic');
select lives_ok(
  $$ select public.record_referral_click('11111111-0000-4000-8000-000000000001', 'NOEXISTE') $$,
  'CA-51.5 · RF-51.6 · un código inexistente no rompe el registro del clic');
reset role;
select is(
  (select count(*) from public.referral_clicks where visitor_id = '11111111-0000-4000-8000-000000000001'),
  1::bigint, 'CA-51.5 · pero solo se guarda el clic del código que existe');
set local role anon;

-- CA-51.1 · el mismo visitante entra después con el código de Luis.
reset role;
set local request.jwt.claim.sub = '';
update public.referral_clicks set clicked_at = now() - interval '30 days'
 where visitor_id = '11111111-0000-4000-8000-000000000001';
set local role anon;
select public.record_referral_click('11111111-0000-4000-8000-000000000001',
  (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000003'));
reset role;
select is(
  (select count(*) from public.referral_clicks where visitor_id = '11111111-0000-4000-8000-000000000001'),
  2::bigint, 'RF-51.3 · quedan los dos clics, en orden');

-- ── CA-51.1 · RF-51.3 · la primera atribución gana ──────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000004';
select is(
  (select public.attribute_referral('11111111-0000-4000-8000-000000000001', null)),
  (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000002'),
  'CA-51.1 · con el código de Ana primero y el de Luis después, gana Ana');
select is(
  (select count(*) from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  1::bigint, 'CA-51.1 · y queda una sola atribución');
select is(
  (select public.attribute_referral('11111111-0000-4000-8000-000000000001',
     (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000003'))),
  (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000002'),
  'CA-51.1 · RF-51.3 · un ingreso posterior con otro código no la sobreescribe');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  'registered', 'RF-51.5 · el referido nace en «registrado»');

-- ── CA-51.6 · D-03 · la ventana de 90 días ──────────────────────────────────
set local role anon;
set local request.jwt.claim.sub = '';
select public.record_referral_click('22222222-0000-4000-8000-000000000002',
  (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000002'));
reset role;
set local request.jwt.claim.sub = '';
update public.referral_clicks set clicked_at = now() - interval '89 days'
 where visitor_id = '22222222-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000005';
select isnt(
  (select public.attribute_referral('22222222-0000-4000-8000-000000000002', null)),
  null, 'CA-51.6 · un clic de hace 89 días todavía atribuye');

reset role;
set local request.jwt.claim.sub = '';
delete from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000005';
update public.referral_clicks set clicked_at = now() - interval '91 days'
 where visitor_id = '22222222-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000005';
select is(
  (select public.attribute_referral('22222222-0000-4000-8000-000000000002', null)),
  null, 'CA-51.6 · un clic de hace 91 días ya no atribuye');
select is(
  (select count(*) from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000005'),
  0::bigint, 'CA-51.6 · fuera de la ventana no queda atribución');

-- ── CA-51.2 · RF-51.4 · sin auto-referencia ─────────────────────────────────
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000002';
select is(
  (select public.attribute_referral(null, (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000002'))),
  null, 'CA-51.2 · un Embajador que usa su propio código no crea atribución');
select is(
  (select count(*) from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000002'),
  0::bigint, 'CA-51.2 · y no queda rastro de atribución');

-- ── CA-51.5 · RF-51.6 · código inhabilitado ─────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
update public.referral_codes set enabled = false
 where ambassador_id = (select ambassador_id from codigos where user_id = 'c5100000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000006';
select is(
  (select public.attribute_referral(null, (select code from codigos where user_id = 'c5100000-0000-4000-8000-000000000003'))),
  null, 'CA-51.5 · un código inhabilitado no crea atribución');
select is(
  (select count(*) from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000006'),
  0::bigint, 'CA-51.5 · el registro procede sin atribución y sin error');
select is(
  (select public.attribute_referral(null, 'NOEXISTE')),
  null, 'CA-51.5 · un código inexistente tampoco bloquea el flujo');
reset role;
set local request.jwt.claim.sub = '';
update public.referral_codes set enabled = true
 where ambassador_id = (select ambassador_id from codigos where user_id = 'c5100000-0000-4000-8000-000000000003');

-- ── CA-51.3 · RF-51.5 · el ciclo sigue a la compra ──────────────────────────
insert into public.user_roles (user_id, role) values ('c5100000-0000-4000-8000-000000000001', 'property_admin');
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5100000-0000-4000-8000-000000000001', 'Casa Referido', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5100000-0000-4000-8000-000000000001', array[100000000::bigint]);
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price)
select 'e5100000-0000-4000-8000-000000000001',
       (select id from public.fractions where property_id = 'a5100000-0000-4000-8000-000000000001' and number = 1),
       'a5100000-0000-4000-8000-000000000001', 'prospecto.atr@arena.co', 'c5100000-0000-4000-8000-000000000004', 100000000;
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price)
select 'e5100000-0000-4000-8000-000000000002',
       (select id from public.fractions where property_id = 'a5100000-0000-4000-8000-000000000001' and number = 2),
       'a5100000-0000-4000-8000-000000000001', 'prospecto.atr@arena.co', 'c5100000-0000-4000-8000-000000000004', 80000000;

select public.cerrar_compra('e5100000-0000-4000-8000-000000000001');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  'payment_in_progress', 'CA-51.3 · al cerrar la compra el referido pasa a «en proceso de pago»');

create temporary table plan1 as
  select id from public.payment_plans where invitation_id = 'e5100000-0000-4000-8000-000000000001';
grant select on plan1 to authenticated;

insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from plan1), 'a5100000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/uno.pdf');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  'paid', 'CA-51.3 · completado el pago, el referido pasa a «pago completado»');

-- ── CA-51.7 · D-04 · una sola comisión por prospecto ────────────────────────
select is(
  (select commissioned_purchase_id from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  (select id from plan1), 'CA-51.7 · la primera compra queda marcada como la que genera comisión');

select public.cerrar_compra('e5100000-0000-4000-8000-000000000002');
create temporary table plan2 as
  select id from public.payment_plans where invitation_id = 'e5100000-0000-4000-8000-000000000002';
grant select on plan2 to authenticated;
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from plan2), 'a5100000-0000-4000-8000-000000000001', 80000000, current_date, 'transferencia', 'payment-receipts/dos.pdf');

select is(
  (select commissioned_purchase_id from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  (select id from plan1), 'CA-51.7 · D-04 · la segunda compra no genera una comisión nueva');
select is(
  (select count(*) from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  1::bigint, 'CA-51.7 · el prospecto sigue teniendo una sola atribución');

-- ── CA-51.4 · las transiciones inválidas se rechazan ────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select throws_like(
  $$ select private.advance_referral('c5100000-0000-4000-8000-000000000004', 'purchase_started', null) $$,
  '%CA-51.4%', 'CA-51.4 · desde «pago completado» no se vuelve a empezar la compra');
update public.attributions set stage = 'registered' where prospect_id = 'c5100000-0000-4000-8000-000000000004';
select throws_like(
  $$ select private.advance_referral('c5100000-0000-4000-8000-000000000004', 'payment_completed', null) $$,
  '%CA-51.4%', 'CA-51.4 · desde «registrado» no se salta al pago completado');
select is(
  (select stage::text from public.attributions where prospect_id = 'c5100000-0000-4000-8000-000000000004'),
  'registered', 'CA-51.4 · la etapa no se movió con la transición inválida');

-- ── RF-51.5 · quién ve las atribuciones ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.attributions), 1::bigint,
  'RF-51.5 · Ana ve el referido que le pertenece');
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.attributions), 0::bigint,
  'RF-51.5 · Luis no ve los referidos de Ana');
set local request.jwt.claim.sub = 'c5100000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.attributions), 1::bigint,
  'RF-51.5 · el propio prospecto ve su atribución');

reset role;
set local request.jwt.claim.sub = '';
select ok(
  (select count(*) from public.audit_log where entity_type = 'attribution') >= 1,
  'RF-51.1 · TR-01 · la atribución queda auditada');

select * from finish();
rollback;
