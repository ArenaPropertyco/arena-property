-- HU-53 · RF-53.1…RF-53.5 · D-20 — el listado de referidos en la base: cada
-- referido con su etapa, la comisión desde «En proceso de pago» y nunca antes, y
-- una RLS que deja a cada Embajador lo suyo y al Superadmin todo.
begin;
select plan(13);

select has_view('public', 'referral_listing', 'RF-53.1 · existe la vista referral_listing');
select is(
  (select reloptions::text[] @> array['security_invoker=true'] from pg_class where oid = 'public.referral_listing'::regclass),
  true, 'RF-53.5 · la vista corre con los permisos de quien consulta');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5300000-0000-4000-8000-000000000001', 'super.ref53@arena.co', '{}'),
  ('c5300000-0000-4000-8000-000000000002', 'ana.ref53@arena.co', '{}'),
  ('c5300000-0000-4000-8000-000000000003', 'luis.ref53@arena.co', '{}'),
  ('c5300000-0000-4000-8000-000000000004', 'reg.ref53@arena.co', '{"full_name": "Rita Registrada"}'),
  ('c5300000-0000-4000-8000-000000000005', 'pago.ref53@arena.co', '{"full_name": "Pedro Pagando"}'),
  ('c5300000-0000-4000-8000-000000000006', 'deluis.ref53@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5300000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5300000-0000-4000-8000-000000000001', 'property_admin');
update public.profiles set full_name = 'Pedro Pagando' where id = 'c5300000-0000-4000-8000-000000000005';

set local role authenticated;
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000001';
create temporary table emb53 as
  select a.user_id, a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a
   where a.user_id in ('c5300000-0000-4000-8000-000000000002', 'c5300000-0000-4000-8000-000000000003');
grant select on emb53 to authenticated, anon;

reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 53', 'percentage', null, 300, true);

-- Rita y Pedro son de Ana; el tercero es de Luis.
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb53 where user_id = 'c5300000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000005';
select public.attribute_referral(null, (select code from emb53 where user_id = 'c5300000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000006';
select public.attribute_referral(null, (select code from emb53 where user_id = 'c5300000-0000-4000-8000-000000000003'));

-- Pedro compra la 5/8 de Casa Listado a $100.000.000.
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5300000-0000-4000-8000-000000000001', 'Casa Listado', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5300000-0000-4000-8000-000000000001', array[100000000::bigint]);
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5300000-0000-4000-8000-000000000001',
   (select id from public.fractions where property_id = 'a5300000-0000-4000-8000-000000000001' and number = 5),
   'a5300000-0000-4000-8000-000000000001', 'pago.ref53@arena.co', 'c5300000-0000-4000-8000-000000000005', 100000000);
select public.cerrar_compra('e5300000-0000-4000-8000-000000000001');

-- ── RF-53.1 · RF-53.2 · CA-53.3 · lo que ve Ana ─────────────────────────────
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.referral_listing),
  2::bigint, 'RF-53.5 · Ana ve exactamente sus dos referidos');
select is(
  (select array_agg(stage::text order by prospect_email) from public.referral_listing),
  array['payment_in_progress', 'registered'],
  'RF-53.2 · cada uno con su etapa: Pedro en proceso de pago y Rita registrada');
select is(
  (select (prospect_name, property_name, fraction_number::integer, commission_amount, commission_status::text)
     from public.referral_listing where prospect_id = 'c5300000-0000-4000-8000-000000000005'),
  ('Pedro Pagando'::text, 'Casa Listado'::text, 5, 3000000::bigint, 'pending'::text),
  'CA-53.3 · RF-53.1 · Pedro, en proceso de pago bajo V1, muestra $3.000.000 sobre el precio pactado, su propiedad y su fracción');
select is(
  (select (commission_amount, commission_status::text, property_name)
     from public.referral_listing where prospect_id = 'c5300000-0000-4000-8000-000000000004'),
  (null::bigint, null::text, null::text),
  'CA-53.3 · RF-53.3 · Rita, registrada, no muestra monto ni propiedad');
select is(
  (select referred_on from public.referral_listing where prospect_id = 'c5300000-0000-4000-8000-000000000004'),
  (now() at time zone 'America/Bogota')::date, 'RF-53.1 · la fecha de referencia es la del registro');

-- ── CA-53.4 · RF-53.5 · los referidos de otro Embajador no aparecen ─────────
select is(
  (select count(*) from public.referral_listing where prospect_id = 'c5300000-0000-4000-8000-000000000006'),
  0::bigint, 'CA-53.4 · el referido de Luis no aparece en el listado de Ana');
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000003';
select is(
  (select array_agg(prospect_email) from public.referral_listing),
  array['deluis.ref53@arena.co'], 'CA-53.4 · Luis ve solo el suyo');
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.referral_listing),
  0::bigint, 'RF-53.5 · el prospecto no entra al listado: la comisión es del Embajador');
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.referral_listing where ambassador_id in (select ambassador_id from emb53)),
  3::bigint, 'RF-53.5 · D-20 · el Superadmin ve los tres');

-- ── Pago completado: la etapa y el estado de saldo avanzan juntos ───────────
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
select p.id, p.property_id, 100000000, current_date, 'transferencia', 'payment-receipts/pedro.pdf'
  from public.payment_plans p where p.invitation_id = 'e5300000-0000-4000-8000-000000000001';
set local request.jwt.claim.sub = 'c5300000-0000-4000-8000-000000000002';
select is(
  (select (stage::text, commission_status::text, grace_ends_on)
     from public.referral_listing where prospect_id = 'c5300000-0000-4000-8000-000000000005'),
  ('paid'::text, 'in_grace'::text, current_date + 30),
  'RF-53.3 · con el pago completado muestra en gracia y la fecha de habilitación');
select ok(
  not has_table_privilege('authenticated', 'public.referral_listing', 'INSERT'),
  'RF-53.5 · el listado solo se lee');

select * from finish();
rollback;
