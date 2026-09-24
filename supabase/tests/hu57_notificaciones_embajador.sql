-- HU-57 · RF-57.1…RF-57.4 · TR-03 · D-19 — lo que se le avisa al Embajador en la
-- base: exactamente cinco eventos, cada uno solo a quien le pertenece, una sola
-- vez, y el rechazo del retiro sin aviso.
begin;
select plan(18);

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

/** Cuántas notificaciones existen sobre una entidad, del tipo que sean. */
create or replace function pg_temp.avisos_de_entidad(entidad text)
returns bigint
language sql
security definer
as $$ select count(*) from public.notifications n where n.entity_id = entidad $$;

/** La carga del único aviso de un tipo sobre una entidad. */
create or replace function pg_temp.carga_de(tipo text, entidad text)
returns jsonb
language sql
security definer
as $$ select n.payload from public.notifications n where n.kind = tipo and n.entity_id = entidad $$;

/** La comisión viva del plan. */
create or replace function pg_temp.comision_de(plan uuid)
returns text
language sql
as $$ select c.id::text from public.commissions c where c.plan_id = plan and c.status <> 'reversed' $$;

-- ── Cuentas: Superadmin, Ana (E) y Luis (F), un prospecto de cada una ───────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5700000-0000-4000-8000-000000000001', 'super.not57@arena.co', '{}'),
  ('c5700000-0000-4000-8000-000000000002', 'ana.not57@arena.co', '{}'),
  ('c5700000-0000-4000-8000-000000000003', 'luis.not57@arena.co', '{}'),
  ('c5700000-0000-4000-8000-000000000004', 'pa.not57@arena.co', '{}'),
  ('c5700000-0000-4000-8000-000000000005', 'pf.not57@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5700000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5700000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');

set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
create temporary table emb57 as
  select a.user_id, a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a
   where a.user_id in ('c5700000-0000-4000-8000-000000000002', 'c5700000-0000-4000-8000-000000000003');
grant select on emb57 to authenticated, anon;

reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 57', 'percentage', null, 300, true);

set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb57 where user_id = 'c5700000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000005';
select public.attribute_referral(null, (select code from emb57 where user_id = 'c5700000-0000-4000-8000-000000000003'));

set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5700000-0000-4000-8000-000000000001', 'Casa Aviso', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5700000-0000-4000-8000-000000000001', array[100000000::bigint]);
create temporary table fr57 as
  select number, id from public.fractions where property_id = 'a5700000-0000-4000-8000-000000000001';
grant select on fr57 to authenticated;
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5700000-0000-4000-8000-000000000001', (select id from fr57 where number = 1), 'a5700000-0000-4000-8000-000000000001', 'pa.not57@arena.co', 'c5700000-0000-4000-8000-000000000004', 100000000),
  ('e5700000-0000-4000-8000-000000000002', (select id from fr57 where number = 2), 'a5700000-0000-4000-8000-000000000001', 'pf.not57@arena.co', 'c5700000-0000-4000-8000-000000000005', 50000000);

create temporary table planes57 (nombre text primary key, id uuid);
grant select, insert, update on planes57 to authenticated;

-- ── RF-57.1 · CA-57.2 · «en proceso de pago»: solo a la Embajadora del referido ──
insert into planes57 select 'A', (select id from public.cerrar_compra('e5700000-0000-4000-8000-000000000001'));
select is(pg_temp.avisos('referral_in_progress', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'RF-57.1 · el paso a «en proceso de pago» de su referido le avisa a Ana');
select is(pg_temp.avisos('referral_in_progress', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-57.2 · RF-57.2 · y a Luis no le llega nada de un referido de Ana');

-- ── CA-57.1 · «pago completado» con el monto y la fecha de salida de gracia ──
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes57 where nombre = 'A'), 'a5700000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/a57.pdf');
select is(pg_temp.avisos('referral_paid', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'CA-57.1 · el pago completado de su referido genera un aviso para Ana');
select is(
  (select (c ->> 'amount')::bigint || '|' || (c ->> 'available_on') || '|' || (c ->> 'referral_label')
     from pg_temp.carga_de('referral_paid', pg_temp.comision_de((select id from planes57 where nombre = 'A'))) as c),
  '3000000|' || (current_date + 30)::text || '|pa.not57@arena.co',
  'CA-57.1 · RF-57.1 · el aviso lleva el monto liberado, la fecha en que sale de gracia y el referido');
select is(pg_temp.avisos('referral_paid', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-57.2 · Luis no recibe el pago completado del referido de Ana');

-- ── CA-57.2 · el referido de Luis avisa a Luis y no a Ana ───────────────────
insert into planes57 select 'F', (select id from public.cerrar_compra('e5700000-0000-4000-8000-000000000002'));
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes57 where nombre = 'F'), 'a5700000-0000-4000-8000-000000000001', 50000000, current_date, 'transferencia', 'payment-receipts/f57.pdf');
select is(pg_temp.avisos('referral_paid', pg_temp.comision_de((select id from planes57 where nombre = 'F')), 'c5700000-0000-4000-8000-000000000003'), 1::bigint,
  'CA-57.2 · el pago del referido de Luis le avisa a Luis');
select is(pg_temp.avisos('referral_paid', pg_temp.comision_de((select id from planes57 where nombre = 'F')), 'c5700000-0000-4000-8000-000000000002'), 0::bigint,
  'CA-57.2 · RF-57.2 · y no a Ana');

-- ── RF-57.1 · el paso a disponible avisa a cada una por lo suyo ─────────────
reset role;
set local request.jwt.claim.sub = '';
select is(pg_temp.liberadas_en(current_date + 30, 'a5700000-0000-4000-8000-000000000001'), 2, 'D-02 · las dos comisiones pasan a disponible');
select is(pg_temp.avisos('commission_available', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'RF-57.1 · Ana recibe el aviso de que su comisión está disponible');
select is(pg_temp.avisos('commission_available', pg_temp.comision_de((select id from planes57 where nombre = 'A')), 'c5700000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-57.2 · Luis no recibe el de Ana');

-- ── RF-57.1 · CA-57.3 · los retiros: aprobada y pagada avisan; solicitar y rechazar, no ──
set local role authenticated;
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000002';
create temporary table retiro57 (nombre text primary key, id uuid);
grant select, insert, update on retiro57 to authenticated;
insert into retiro57 select 'R1', public.request_withdrawal(300000);
select is(pg_temp.avisos_de_entidad((select id from retiro57 where nombre = 'R1')::text), 0::bigint,
  'RF-57.1 · solicitar un retiro no está entre los cinco eventos: no avisa');

set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
select public.approve_withdrawal((select id from retiro57 where nombre = 'R1'));
select is(pg_temp.avisos('withdrawal_approved', (select id from retiro57 where nombre = 'R1')::text, 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'RF-57.1 · el retiro aprobado avisa a Ana');
select is(pg_temp.avisos('withdrawal_approved', (select id from retiro57 where nombre = 'R1')::text, 'c5700000-0000-4000-8000-000000000003'), 0::bigint,
  'CA-57.2 · RF-57.2 · y no a Luis');

reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name)
values ('withdrawal-receipts', (select ambassador_id from emb57 where user_id = 'c5700000-0000-4000-8000-000000000002') || '/' || (select id from retiro57 where nombre = 'R1') || '.pdf');
set local role authenticated;
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
select public.pay_withdrawal((select id from retiro57 where nombre = 'R1'),
  (select ambassador_id from emb57 where user_id = 'c5700000-0000-4000-8000-000000000002') || '/' || (select id from retiro57 where nombre = 'R1') || '.pdf');
select is(pg_temp.avisos('withdrawal_paid', (select id from retiro57 where nombre = 'R1')::text, 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'RF-57.1 · el retiro pagado avisa a Ana');

set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000002';
insert into retiro57 select 'R2', public.request_withdrawal(250000);
set local request.jwt.claim.sub = 'c5700000-0000-4000-8000-000000000001';
select public.reject_withdrawal((select id from retiro57 where nombre = 'R2'), 'Datos bancarios incompletos.');
select is(pg_temp.avisos_de_entidad((select id from retiro57 where nombre = 'R2')::text), 0::bigint,
  'CA-57.3 · un rechazo no genera notificación de este módulo: se ve en la bandeja de solicitudes');

-- ── CA-57.4 · el mismo evento dos veces avisa una sola vez ──────────────────
reset role;
set local request.jwt.claim.sub = '';
select public.emitir_notificacion('withdrawal_paid', 'withdrawal_request', (select id from retiro57 where nombre = 'R1')::text, null,
  jsonb_build_object('amount', 300000), array['c5700000-0000-4000-8000-000000000002'::uuid]);
select is((select count(*) from public.notifications n where n.kind = 'withdrawal_paid' and n.entity_id = (select id from retiro57 where nombre = 'R1')::text), 1::bigint,
  'CA-57.4 · RF-57.4 · reprocesar el pago no crea una segunda notificación');
select is(pg_temp.avisos('withdrawal_paid', (select id from retiro57 where nombre = 'R1')::text, 'c5700000-0000-4000-8000-000000000002'), 1::bigint,
  'CA-57.4 · ni un segundo destinatario');

-- ── RF-57.1 · los cinco van in-app y por correo ─────────────────────────────
select is(
  (select bool_and(n.requires_email) from public.notifications n
    join public.notification_recipients r on r.notification_id = n.id
   where r.recipient_id = 'c5700000-0000-4000-8000-000000000002'
     and n.kind in ('referral_in_progress', 'referral_paid', 'commission_available', 'withdrawal_approved', 'withdrawal_paid')),
  true, 'RF-57.1 · TR-03 · cada uno de los cinco avisos de Ana exige correo además de la bandeja');

select * from finish();
rollback;
