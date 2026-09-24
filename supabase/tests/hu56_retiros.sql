-- HU-56 · RF-56.1…RF-56.6 · D-01 · D-06 · D-20 · D-50 · TR-01 — la solicitud de
-- retiro en la base: mínimo configurable, retiro parcial, una sola abierta por
-- restricción, la máquina de estados, el descuento al aprobar, el pago con
-- comprobante sin un segundo egreso, y la auditoría de cada transición.
begin;
select plan(57);

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
select has_table('public', 'withdrawal_requests', 'RF-56.2 · existe withdrawal_requests');
select is((select relforcerowsecurity from pg_class where oid = 'public.withdrawal_requests'::regclass), true,
  'RF-56.2 · la solicitud fuerza RLS');
select ok(not has_table_privilege('authenticated', 'public.withdrawal_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.withdrawal_requests', 'UPDATE'),
  'RF-56.2 · la solicitud se escribe solo por función');
select has_index('public', 'withdrawal_requests', 'withdrawal_requests_abierta_unica',
  'CA-56.5 · RF-56.3 · la solicitud abierta única es un índice de la base');
select matches(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'withdrawal_requests_pago_con_comprobante'),
  'receipt_path IS NOT NULL', 'CA-56.6 · pagada exige comprobante también por restricción');
select has_table('public', 'platform_settings', 'RF-56.1 · D-06 · existe el ajuste del mínimo');
select is(public.withdrawal_minimum(), 200000::bigint, 'D-06 · el mínimo inicial es $200.000');
select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('request_withdrawal', 'approve_withdrawal', 'reject_withdrawal', 'pay_withdrawal', 'set_withdrawal_minimum')),
  5::bigint, 'RF-56.2 · existen las cinco funciones del ciclo');
select is((select public from storage.buckets where id = 'withdrawal-receipts'), false, 'RF-56.4 · el bucket de comprobantes es privado');

-- ── Cuentas: Superadmin, Ana y Luis (Embajadores), un prospecto ─────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5600000-0000-4000-8000-000000000001', 'super.ret56@arena.co', '{}'),
  ('c5600000-0000-4000-8000-000000000002', 'ana.ret56@arena.co', '{}'),
  ('c5600000-0000-4000-8000-000000000003', 'luis.ret56@arena.co', '{}'),
  ('c5600000-0000-4000-8000-000000000004', 'pa.ret56@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5600000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5600000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');

set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
create temporary table emb56 as
  select a.user_id, a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a
   where a.user_id in ('c5600000-0000-4000-8000-000000000002', 'c5600000-0000-4000-8000-000000000003');
grant select on emb56 to authenticated, anon;

-- Un tipo fijo de $1.000.000 para que el disponible de Ana sea exacto (CA-56.2).
reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select public.create_commission_type('Fijo pgTAP 56', 'fixed', 1000000, null, true);

set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb56 where user_id = 'c5600000-0000-4000-8000-000000000002'));

set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5600000-0000-4000-8000-000000000001', 'Casa Retiro', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5600000-0000-4000-8000-000000000001', array[100000000::bigint]);
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5600000-0000-4000-8000-000000000001', (select id from public.fractions where property_id = 'a5600000-0000-4000-8000-000000000001' and number = 1), 'a5600000-0000-4000-8000-000000000001', 'pa.ret56@arena.co', 'c5600000-0000-4000-8000-000000000004', 100000000);

create temporary table plan56 as select id from public.cerrar_compra('e5600000-0000-4000-8000-000000000001');
grant select on plan56 to authenticated;
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from plan56), 'a5600000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/a56.pdf');

reset role;
set local request.jwt.claim.sub = '';
select is(pg_temp.liberadas_en(current_date + 30, 'a5600000-0000-4000-8000-000000000001'), 1, 'D-02 · la comisión de Ana pasa a disponible');

create temporary table ana56 as select ambassador_id, user_id from emb56 where user_id = 'c5600000-0000-4000-8000-000000000002';
grant select on ana56 to authenticated, anon;

/** El disponible de Ana según la base. */
create or replace function pg_temp.disponible_de_ana()
returns bigint
language sql
as $$ select b.available from private.saldos_de_billetera((select ambassador_id from ana56)) b $$;

select is(pg_temp.disponible_de_ana(), 1000000::bigint, 'CA-56.2 · Ana parte con $1.000.000 disponibles');

-- ── CA-56.1 · lo que impide solicitar ───────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select throws_like($$ select public.request_withdrawal(100000) $$, '%CA-56.1%',
  'CA-56.1 · por debajo del mínimo se rechaza');
select throws_like($$ select public.request_withdrawal(1000001) $$, '%CA-56.1%',
  'CA-56.1 · por encima del disponible se rechaza');
select throws_like($$ select public.request_withdrawal(0) $$, '%CA-56.1%',
  'CA-56.1 · un monto en cero se rechaza');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000003';
select throws_like($$ select public.request_withdrawal(200000) $$, '%CA-56.1%',
  'CA-56.1 · RT-08 · Luis, sin nada disponible, no puede retirar el mínimo');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000004';
select throws_like($$ select public.request_withdrawal(200000) $$, '%RF-56.1%',
  'RF-56.1 · quien no es Embajador no solicita');

-- ── RF-56.1 · D-06 · el mínimo lo fija el Superadmin ────────────────────────
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000003';
select throws_like($$ select public.set_withdrawal_minimum(250000) $$, '%RF-56.1%',
  'RF-56.1 · un Embajador no fija el mínimo');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select throws_like($$ select public.set_withdrawal_minimum(0) $$, '%RF-56.1%',
  'RF-56.1 · el mínimo tiene que ser mayor que cero');
select is(public.set_withdrawal_minimum(250000), 250000::bigint, 'D-06 · el Superadmin sube el mínimo a $250.000');
select is(public.withdrawal_minimum(), 250000::bigint, 'D-06 · y es el que rige desde ese momento');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select throws_like($$ select public.request_withdrawal(240000) $$, '%CA-56.1%',
  'CA-56.1 · D-06 · el mínimo vigente es el que manda');

-- ── CA-56.2 · el retiro parcial se acepta y no descuenta hasta aprobarse ────
create temporary table retiro56 (nombre text primary key, id uuid);
grant select, insert, update on retiro56 to authenticated;
insert into retiro56 select 'R1', public.request_withdrawal(300000);
select is(
  (select (r.status, r.amount) from public.withdrawal_requests r where r.id = (select id from retiro56 where nombre = 'R1')),
  ('requested'::text, 300000::bigint), 'CA-56.2 · con $1.000.000 disponibles, $300.000 se aceptan como solicitada');
select is(pg_temp.disponible_de_ana(), 1000000::bigint, 'RF-56.3 · solicitar no descuenta el disponible');
select is(
  (select w.kind from public.wallet_movements w where w.withdrawal_id = (select id from retiro56 where nombre = 'R1')),
  'withdrawal_requested', 'RF-55.2 · la solicitud queda en el histórico de la billetera');

-- ── CA-56.5 · una sola solicitud abierta ────────────────────────────────────
select throws_like($$ select public.request_withdrawal(250000) $$, '%CA-56.5%',
  'CA-56.5 · con una abierta, otra solicitud se rechaza');
reset role;
set local request.jwt.claim.sub = '';
select throws_like(
  $$ insert into public.withdrawal_requests (ambassador_id, amount) values ((select ambassador_id from ana56), 250000) $$,
  '%withdrawal_requests_abierta_unica%',
  'CA-56.5 · RF-56.3 · y la base la rechaza por restricción aunque alguien salte la función');

-- ── CA-56.3 · la máquina de estados ─────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select throws_like($$ select public.pay_withdrawal((select id from retiro56 where nombre = 'R1'), 'x/y.pdf') $$, '%CA-56.3%',
  'CA-56.3 · no se paga sin aprobar');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000003';
select throws_like($$ select public.approve_withdrawal((select id from retiro56 where nombre = 'R1')) $$, '%RF-56.2%',
  'RF-56.2 · D-20 · solo el Superadmin aprueba');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
create temporary table metricas56 as select ((public.platform_metrics() -> 'commissions' ->> 'withdrawn')::bigint) as retirado;
select lives_ok($$ select public.approve_withdrawal((select id from retiro56 where nombre = 'R1')) $$, 'RF-56.2 · solicitada → aprobada');
select throws_like($$ select public.approve_withdrawal((select id from retiro56 where nombre = 'R1')) $$, '%CA-56.3%',
  'CA-56.3 · aprobada no se aprueba dos veces');
select throws_like($$ select public.reject_withdrawal((select id from retiro56 where nombre = 'R1'), 'Tarde.') $$, '%CA-56.3%',
  'CA-56.3 · aprobada ya no se rechaza');

-- ── CA-56.2 · RF-56.3 · D-50 · aprobada descuenta e imputa ──────────────────
select is(pg_temp.disponible_de_ana(), 700000::bigint, 'CA-56.2 · al aprobarse el disponible queda en $700.000');
select is(
  (select (c.status::text, c.withdrawn_amount) from public.commissions c where c.plan_id = (select id from plan56)),
  ('available'::text, 300000::bigint), 'D-50 · la comisión sigue disponible con $300.000 imputados');
select is(
  (select w.amount from public.wallet_movements w where w.withdrawal_id = (select id from retiro56 where nombre = 'R1') and w.kind = 'withdrawal_approved'),
  300000::bigint, 'RF-56.3 · la aprobación es el movimiento que descuenta');
select is(
  ((public.platform_metrics() -> 'commissions' ->> 'withdrawn')::bigint) - (select retirado from metricas56),
  300000::bigint, 'HU-32 · RF-32.1 · D-50 · las métricas globales cuentan lo retirado por importe');
-- Los avisos solo los lee su destinatario (RLS de TR-03): se miran como Ana.
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.notifications n join public.notification_recipients r on r.notification_id = n.id
    where n.kind = 'withdrawal_approved' and n.entity_id = (select id from retiro56 where nombre = 'R1')::text
      and r.recipient_id = 'c5600000-0000-4000-8000-000000000002'),
  1::bigint, 'RF-56.6 · TR-03 · Ana recibe un aviso de retiro aprobado');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';

-- ── CA-56.6 · el pago exige comprobante ─────────────────────────────────────
select throws_like($$ select public.pay_withdrawal((select id from retiro56 where nombre = 'R1'), null) $$, '%CA-56.6%',
  'CA-56.6 · sin comprobante no hay pago');
select throws_like($$ select public.pay_withdrawal((select id from retiro56 where nombre = 'R1'), 'no/existe.pdf') $$, '%CA-56.6%',
  'CA-56.6 · una ruta que no está en el bucket tampoco vale');
reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name)
values ('withdrawal-receipts', (select ambassador_id from ana56) || '/' || (select id from retiro56 where nombre = 'R1') || '.pdf');
set local role authenticated;
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.pay_withdrawal((select id from retiro56 where nombre = 'R1'), (select ambassador_id from ana56) || '/' || (select id from retiro56 where nombre = 'R1') || '.pdf') $$,
  'RF-56.4 · con comprobante, aprobada → pagada');
select is(
  (select (r.status, r.paid_at is not null, r.receipt_path is not null) from public.withdrawal_requests r where r.id = (select id from retiro56 where nombre = 'R1')),
  ('paid'::text, true, true), 'RF-56.4 · queda pagada con su fecha y su comprobante');
select is(pg_temp.disponible_de_ana(), 700000::bigint, 'RF-56.3 · pagar no vuelve a descontar');

-- ── CA-56.7 · el pago no genera un segundo egreso (D-01) ────────────────────
select is(
  (select count(*) from public.platform_ledger l where l.source_type = 'ambassador_commission'
    and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from plan56))),
  1::bigint, 'CA-56.7 · el egreso de la comisión sigue siendo uno solo');
select is((select count(*) from public.platform_ledger l where l.source_type like 'withdrawal%'), 0::bigint,
  'CA-56.7 · RF-56.5 · D-01 · y ningún egreso nace del retiro');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.notifications n where n.kind = 'withdrawal_paid' and n.entity_id = (select id from retiro56 where nombre = 'R1')::text),
  1::bigint, 'RF-56.6 · TR-03 · el pago avisa una vez');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';

-- ── CA-56.4 · el rechazo no descuenta y deja el motivo ──────────────────────
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
insert into retiro56 select 'R2', public.request_withdrawal(250000);
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select throws_like($$ select public.reject_withdrawal((select id from retiro56 where nombre = 'R2'), '  ') $$, '%CA-56.4%',
  'CA-56.4 · rechazar exige motivo');
select lives_ok($$ select public.reject_withdrawal((select id from retiro56 where nombre = 'R2'), 'Cuenta bancaria inválida.') $$,
  'RF-56.2 · solicitada → rechazada con motivo');
select is(
  (select (r.status, r.rejection_reason) from public.withdrawal_requests r where r.id = (select id from retiro56 where nombre = 'R2')),
  ('rejected'::text, 'Cuenta bancaria inválida.'::text), 'CA-56.4 · el motivo queda registrado');
select is(pg_temp.disponible_de_ana(), 700000::bigint, 'CA-56.4 · y el disponible no cambia');
select is(
  (select array_agg(w.kind) from public.wallet_movements w where w.withdrawal_id = (select id from retiro56 where nombre = 'R2')),
  array['withdrawal_requested'], 'CA-56.4 · el rechazo no deja movimiento de descuento');

-- ── D-50 · un retiro que cubre el resto deja la comisión retirada ───────────
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
insert into retiro56 select 'R3', public.request_withdrawal(700000);
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000001';
select public.approve_withdrawal((select id from retiro56 where nombre = 'R3'));
select is(
  (select (c.status::text, c.withdrawn_amount) from public.commissions c where c.plan_id = (select id from plan56)),
  ('withdrawn'::text, 1000000::bigint), 'D-50 · RF-54.1 · cubierta entera, la comisión pasa a retirada');
select is(pg_temp.disponible_de_ana(), 0::bigint, 'RF-56.3 · y el disponible queda en cero');

-- ── RLS · D-20 · cada quien lo suyo ─────────────────────────────────────────
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000003';
select is((select count(*) from public.withdrawal_requests), 0::bigint, 'RF-55.4 · Luis no ve las solicitudes de Ana');
select is((select count(*) from storage.objects where bucket_id = 'withdrawal-receipts'), 0::bigint, 'RF-56.4 · ni su comprobante');
set local request.jwt.claim.sub = 'c5600000-0000-4000-8000-000000000002';
select is((select count(*) from public.withdrawal_requests), 3::bigint, 'RF-55.4 · Ana ve sus tres solicitudes');
select is((select count(*) from storage.objects where bucket_id = 'withdrawal-receipts'), 1::bigint, 'RF-56.4 · y el comprobante de su pago');

-- ── TR-01 · RF-56.6 · cada transición quedó auditada con motivo ─────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log a
    where a.entity_type = 'withdrawal_request' and a.action = 'withdrawal_request.actualizada'
      and a.entity_id in (select id from retiro56)),
  4::bigint, 'RF-56.6 · TR-01 · aprobar, pagar, rechazar y aprobar son cuatro transiciones auditadas');
select is(
  (select count(*) from public.audit_log a
    where a.entity_type = 'withdrawal_request' and coalesce(btrim(a.reason), '') = ''),
  0::bigint, 'RF-56.6 · TR-01 · ninguna quedó sin motivo');

select * from finish();
rollback;
