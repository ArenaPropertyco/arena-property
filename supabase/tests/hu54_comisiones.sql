-- HU-54 · RF-54.1…RF-54.7 · D-01, D-02, D-04, D-07 · DT-09 — el motor de
-- comisiones en la base: provisión al cerrar la compra, acreditación en gracia con
-- devengo único en el libro de plataforma, paso a disponible por tarea idempotente,
-- reversa según el momento y efecto de la suspensión según su tipo.
begin;
select plan(55);

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
select has_table('public', 'commissions', 'RF-54.1 · existe commissions');
select has_table('public', 'wallet_movements', 'RF-54.1 · existe wallet_movements');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.commissions'::regclass, 'public.wallet_movements'::regclass)),
  true, 'RF-54.1 · comisiones y billetera fuerzan RLS');
select is(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum where enumtypid = 'public.commission_status'::regtype),
  array['pending', 'in_grace', 'available', 'withdrawn', 'reversed'],
  'RF-54.1 · los estados son exactamente pendiente, en gracia, disponible, retirada y reversada');
select ok(not has_table_privilege('authenticated', 'public.commissions', 'INSERT'),
  'RF-54.1 · la comisión la escribe solo el motor');
select ok(not has_table_privilege('authenticated', 'public.wallet_movements', 'INSERT'),
  'RF-54.1 · la billetera la escribe solo el motor');
select has_function('public', 'release_commissions_in_grace', array['date'], 'CA-54.2 · DT-09 · existe la tarea de gracia');
select has_function('public', 'resolve_available_commissions', array['uuid', 'boolean', 'text'], 'RF-54.7 · existe la decisión sobre lo disponible');

-- ── Cuentas: Superadmin/Administrador, Ana y Luis (Embajadores), prospectos ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5400000-0000-4000-8000-000000000001', 'super.com54@arena.co', '{}'),
  ('c5400000-0000-4000-8000-000000000002', 'ana.com54@arena.co', '{}'),
  ('c5400000-0000-4000-8000-000000000003', 'luis.com54@arena.co', '{}'),
  ('c5400000-0000-4000-8000-000000000004', 'pa.com54@arena.co', '{}'),
  ('c5400000-0000-4000-8000-000000000005', 'pb.com54@arena.co', '{}'),
  ('c5400000-0000-4000-8000-000000000006', 'pc.com54@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5400000-0000-4000-8000-000000000001', 'superadmin'),
  ('c5400000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '11111111', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000003';
select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '22222222', 'Luis Mora');

set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
create temporary table emb54 as
  select a.user_id, a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a
   where a.user_id in ('c5400000-0000-4000-8000-000000000002', 'c5400000-0000-4000-8000-000000000003');
grant select on emb54 to authenticated, anon;

-- RF-52.3 · la base local puede traer tipos: V1 del 3 % pasa a ser el predeterminado.
reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 54', 'percentage', null, 300, true);

-- ── Los tres prospectos se atribuyen a Ana ──────────────────────────────────
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000005';
select public.attribute_referral(null, (select code from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'));
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000006';
select public.attribute_referral(null, (select code from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'));

-- ── CA-54.7 · registrado, sin compra: ningún saldo ──────────────────────────
select is(
  (select count(*) from public.commissions c join public.attributions a on a.id = c.attribution_id
    where a.prospect_id = 'c5400000-0000-4000-8000-000000000004'),
  0::bigint, 'CA-54.7 · un referido «Registrado» no tiene saldo pendiente, en gracia ni disponible');

-- ── Propiedad y compras ─────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5400000-0000-4000-8000-000000000001', 'Casa Comisión', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5400000-0000-4000-8000-000000000001', array[100000000::bigint]);

create temporary table fr54 as
  select number, id from public.fractions where property_id = 'a5400000-0000-4000-8000-000000000001';
grant select on fr54 to authenticated;

insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e5400000-0000-4000-8000-000000000001', (select id from fr54 where number = 1), 'a5400000-0000-4000-8000-000000000001', 'pa.com54@arena.co', 'c5400000-0000-4000-8000-000000000004', 100000000),
  ('e5400000-0000-4000-8000-000000000002', (select id from fr54 where number = 2), 'a5400000-0000-4000-8000-000000000001', 'pb.com54@arena.co', 'c5400000-0000-4000-8000-000000000005', 80000000),
  ('e5400000-0000-4000-8000-000000000003', (select id from fr54 where number = 3), 'a5400000-0000-4000-8000-000000000001', 'pa.com54@arena.co', 'c5400000-0000-4000-8000-000000000004', 90000000),
  ('e5400000-0000-4000-8000-000000000004', (select id from fr54 where number = 4), 'a5400000-0000-4000-8000-000000000001', 'pc.com54@arena.co', 'c5400000-0000-4000-8000-000000000006', 50000000);

create temporary table planes54 (nombre text primary key, id uuid);
grant select, insert, update on planes54 to authenticated;

insert into planes54 select 'A', (select id from public.cerrar_compra('e5400000-0000-4000-8000-000000000001'));

-- ── RF-53.3 · al cerrar la compra la comisión queda pendiente ───────────────
select is(
  (select (c.status::text, c.amount, c.agreed_price, c.fraction_number::integer) from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A')),
  ('pending'::text, 3000000::bigint, 100000000::bigint, 1),
  'RF-53.3 · RF-54.2 · al cerrar la compra queda pendiente el 3 % de V1 sobre el precio pactado: $3.000.000');
select is(
  (select t.name from public.commissions c join public.commission_types t on t.id = c.commission_type_id
    where c.plan_id = (select id from planes54 where nombre = 'A')),
  'V1 pgTAP 54', 'RF-54.2 · D-37 · el tipo aplicado queda congelado en la comisión');
select is(
  (select count(*) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes54 where nombre = 'A')),
  0::bigint, 'RF-54.1 · pendiente todavía no es un movimiento de billetera');

-- ── CA-54.1 · el pago completo acredita en gracia ───────────────────────────
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes54 where nombre = 'A'), 'a5400000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/a.pdf');

select is(
  (select (c.status::text, c.amount, c.completed_on, c.grace_ends_on) from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A')),
  ('in_grace'::text, 3000000::bigint, current_date, current_date + 30),
  'CA-54.1 · completado el pago se acreditan exactamente $3.000.000 en gracia, con habilitación a 30 días');
select is(
  (select coalesce(sum(amount), 0)::bigint from public.commissions where ambassador_id = (select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002') and status = 'pending'),
  0::bigint, 'CA-54.1 · y el saldo pendiente baja en ese monto');
select is(
  (select (w.kind, w.amount, w.occurred_on) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes54 where nombre = 'A')),
  ('commission_credited'::text, 3000000::bigint, current_date),
  'RF-54.1 · la acreditación es un movimiento de billetera');

-- ── CA-54.5 · devengo único en el libro de plataforma, nada en la propiedad ─
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select is(
  (select (l.kind::text, l.amount, l.accrued_on, l.reversed_at is null) from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A'))),
  ('expense'::text, 3000000::bigint, current_date, true),
  'CA-54.5 · existe exactamente un egreso de $3.000.000 en el libro de plataforma');
select is(
  (select count(*) from public.movements where property_id = 'a5400000-0000-4000-8000-000000000001'),
  0::bigint, 'CA-54.5 · RF-54.6 · y ningún movimiento en la maestra de la propiedad');
select is(
  (select count(*) from public.movement_shares where property_id = 'a5400000-0000-4000-8000-000000000001'),
  0::bigint, 'CA-54.5 · ni una sola cuota prorrateada entre las fracciones');

-- ── CA-54.3 · reprocesar el evento no acredita dos veces ────────────────────
reset role;
set local request.jwt.claim.sub = '';
select private.procesar_evento_de_comision((select id from planes54 where nombre = 'A'), 'payment_completed');
select private.procesar_evento_de_comision((select id from planes54 where nombre = 'A'), 'payment_completed');
select private.derivar_plan((select id from planes54 where nombre = 'A'));
select is(
  (select count(*) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes54 where nombre = 'A') and w.kind = 'commission_credited'),
  1::bigint, 'CA-54.3 · el mismo evento procesado tres veces acredita una sola vez');
select is(
  (select count(*) from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A'))),
  1::bigint, 'CA-54.3 · RF-54.6 · y el libro de plataforma sigue con un solo egreso');
select is(
  (select count(*) from public.notifications n join public.notification_recipients r on r.notification_id = n.id
    where n.kind = 'referral_paid' and r.recipient_id = 'c5400000-0000-4000-8000-000000000002'
      and n.entity_id = (select c.id::text from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A'))),
  1::bigint, 'RF-54.1 · TR-03 · Ana recibe una sola notificación de pago completado');

-- ── CA-54.2 · de gracia a disponible a los 30 días, por tarea idempotente ───
select is(pg_temp.liberadas_en(current_date, 'a5400000-0000-4000-8000-000000000001'), 0, 'CA-54.2 · el día del pago la tarea no libera nada');
select is(pg_temp.liberadas_en(current_date + 29, 'a5400000-0000-4000-8000-000000000001'), 0, 'CA-54.2 · a los 29 días sigue en gracia');
select is(
  (select status::text from public.commissions where plan_id = (select id from planes54 where nombre = 'A')),
  'in_grace', 'CA-54.2 · y no es retirable');

-- ── CA-54.4 · anulación al «día 10», dentro de la gracia ────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select public.anular_compra((select id from planes54 where nombre = 'A'), 'Desistimiento firmado.');

select is(
  (select (c.status::text, c.reversal_reason) from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A')),
  ('reversed'::text, 'Compra anulada: Desistimiento firmado.'::text),
  'CA-54.4 · anulada dentro de la gracia, la comisión se reversa con su motivo');
select is(
  (select coalesce(sum(amount), 0)::bigint from public.commissions
    where ambassador_id = (select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002')
      and status in ('pending', 'in_grace', 'available')),
  0::bigint, 'CA-54.4 · y el saldo de Ana vuelve al estado previo');
select is(
  (select (w.kind, w.amount) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes54 where nombre = 'A') and w.kind = 'commission_reversed'),
  ('commission_reversed'::text, 3000000::bigint), 'RF-54.5 · la reversa es un movimiento de billetera');
select is(
  (select (l.reversed_at is not null, l.reverse_reason) from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'A'))),
  (true, 'Compra anulada: Desistimiento firmado.'::text),
  'RF-54.5 · D-01 · y deja el contra-asiento en el libro de plataforma');

-- ── CA-54.6 · una segunda compra del mismo referido no acredita otra ────────
insert into planes54 select 'A2', (select id from public.cerrar_compra('e5400000-0000-4000-8000-000000000003'));
select is(
  (select count(*) from public.commissions where plan_id = (select id from planes54 where nombre = 'A2')),
  0::bigint, 'CA-54.6 · D-04 · la segunda fracción del referido no genera una segunda comisión');
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes54 where nombre = 'A2'), 'a5400000-0000-4000-8000-000000000001', 90000000, current_date, 'transferencia', 'payment-receipts/a2.pdf');
select is(
  (select count(*) from public.commissions c join public.attributions a on a.id = c.attribution_id
    where a.prospect_id = 'c5400000-0000-4000-8000-000000000004' and c.status <> 'reversed'),
  0::bigint, 'CA-54.6 · ni siquiera al completar su pago');

-- ── CA-54.4 · anulación al «día 45»: lo disponible no se toca ───────────────
insert into planes54 select 'B', (select id from public.cerrar_compra('e5400000-0000-4000-8000-000000000002'));
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes54 where nombre = 'B'), 'a5400000-0000-4000-8000-000000000001', 80000000, current_date, 'transferencia', 'payment-receipts/b.pdf');
select is(
  (select (status::text, amount) from public.commissions where plan_id = (select id from planes54 where nombre = 'B')),
  ('in_grace'::text, 2400000::bigint), 'CA-54.1 · el segundo referido acredita $2.400.000 sobre sus $80.000.000');

reset role;
set local request.jwt.claim.sub = '';
select is(pg_temp.liberadas_en(current_date + 30, 'a5400000-0000-4000-8000-000000000001'), 1, 'CA-54.2 · a los 30 días la tarea libera la comisión');
select is(
  (select (status::text, available_on) from public.commissions where plan_id = (select id from planes54 where nombre = 'B')),
  ('available'::text, current_date + 30), 'CA-54.2 · y queda disponible con su fecha');
select is(pg_temp.liberadas_en(current_date + 31, 'a5400000-0000-4000-8000-000000000001'), 0, 'DT-09 · correrla otra vez no libera nada más');
select is(
  (select count(*) from public.wallet_movements w join public.commissions c on c.id = w.commission_id
    where c.plan_id = (select id from planes54 where nombre = 'B') and w.kind = 'commission_available'),
  1::bigint, 'DT-09 · y el movimiento de disponible es uno solo');
select is(
  (select count(*) from public.notifications n where n.kind = 'commission_available'
    and n.entity_id = (select c.id::text from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'B'))),
  1::bigint, 'RF-54.1 · TR-03 · se notifica que el saldo está disponible');

set local role authenticated;
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select public.anular_compra((select id from planes54 where nombre = 'B'), 'Desistimiento tardío.');
select is(
  (select (status::text, loss_assumed_at is not null) from public.commissions where plan_id = (select id from planes54 where nombre = 'B')),
  ('available'::text, true), 'CA-54.4 · anulada después de la gracia, el saldo disponible no se toca y Arena asume la pérdida');
select is(
  (select l.reversed_at from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'B'))),
  null, 'RF-54.5 · D-02 · el egreso sigue devengado: no hay contra-asiento fuera de la gracia');

-- ── CA-54.8 · la suspensión según su tipo ───────────────────────────────────
-- Ana queda con: B disponible ($2.400.000) y C pendiente ($1.500.000). Se le
-- suma una en gracia directamente, como la dejaría otro pago completo.
insert into planes54 select 'C', (select id from public.cerrar_compra('e5400000-0000-4000-8000-000000000004'));
reset role;
set local request.jwt.claim.sub = '';
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes54 where nombre = 'C'), 'a5400000-0000-4000-8000-000000000001', 20000000, current_date, 'transferencia', 'payment-receipts/c.pdf');

create temporary table saldos54 as
  select status::text as status, sum(amount)::bigint as total from public.commissions
   where ambassador_id = (select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002')
   group by status;
select is(
  (select array_agg(status || ':' || total order by status) from saldos54),
  array['available:2400000', 'pending:1500000', 'reversed:3000000'],
  'CA-54.8 · antes de suspender: $2.400.000 disponibles y $1.500.000 pendientes');

update public.profiles set status = 'suspended', suspension_kind = 'administrative', suspension_reason = 'Documentos vencidos.', suspended_at = now()
 where id = 'c5400000-0000-4000-8000-000000000002';
select is(
  (select array_agg(status::text || ':' || amount order by status::text, amount) from public.commissions
    where ambassador_id = (select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002')),
  array['available:2400000', 'pending:1500000', 'reversed:3000000'],
  'CA-54.8 · una suspensión administrativa conserva el saldo íntegro');

update public.profiles set status = 'active', suspension_kind = null, suspension_reason = null, suspended_at = null
 where id = 'c5400000-0000-4000-8000-000000000002';
update public.profiles set status = 'suspended', suspension_kind = 'breach_or_fraud', suspension_reason = 'Autorreferencia probada.', suspended_at = now()
 where id = 'c5400000-0000-4000-8000-000000000002';
select is(
  (select (status::text, reversal_reason) from public.commissions where plan_id = (select id from planes54 where nombre = 'C')),
  ('reversed'::text, 'Suspensión por incumplimiento o fraude: Autorreferencia probada.'::text),
  'CA-54.8 · una suspensión por fraude cancela lo pendiente y queda el registro con motivo');
select is(
  (select status::text from public.commissions where plan_id = (select id from planes54 where nombre = 'B')),
  'available', 'CA-54.8 · y no toca lo disponible, que queda a decisión del Superadmin');

-- RF-54.7 · el Superadmin resuelve sobre lo disponible, con motivo.
set local role authenticated;
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.resolve_available_commissions((select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'), true, 'Yo decido.') $$,
  '%RF-54.7%', 'RF-54.7 · otro Embajador no decide sobre el saldo ajeno');
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.resolve_available_commissions((select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'), true, '  ') $$,
  '%RF-54.7%', 'RF-54.7 · la decisión exige motivo');
select throws_like(
  $$ select public.resolve_available_commissions((select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000003'), true, 'Sin suspender.') $$,
  '%D-07%', 'RF-54.7 · solo se resuelve el saldo de un Embajador suspendido');
select is(
  public.resolve_available_commissions((select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002'), true, 'Fraude confirmado por el comité.'),
  1, 'RF-54.7 · el Superadmin retira lo disponible dejando constancia');
select is(
  (select (status::text, resolved_reason, reversal_reason) from public.commissions where plan_id = (select id from planes54 where nombre = 'B')),
  ('reversed'::text, 'Decisión del Superadmin tras la suspensión: Fraude confirmado por el comité.'::text,
   'Decisión del Superadmin tras la suspensión: Fraude confirmado por el comité.'::text),
  'RF-54.7 · D-07 · lo disponible retirado queda reversado con la constancia');
select is(
  (select l.reversed_at is not null from public.platform_ledger l
    where l.source_type = 'ambassador_commission'
      and l.source_id = (select c.id from public.commissions c where c.plan_id = (select id from planes54 where nombre = 'B'))),
  true, 'RF-54.7 · D-01 · y Arena deja de deberlo: contra-asiento en el libro');

-- ── RLS · D-20 · cada quien lo suyo, el Superadmin todo ─────────────────────
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.commissions where property_id = 'a5400000-0000-4000-8000-000000000001'),
  3::bigint, 'RF-54.1 · Ana ve sus tres comisiones, reversadas incluidas');
select is(
  (select count(*) from public.wallet_movements where ambassador_id = (select ambassador_id from emb54 where user_id = 'c5400000-0000-4000-8000-000000000002')),
  5::bigint, 'RF-54.1 · y sus cinco movimientos de billetera');
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.commissions where property_id = 'a5400000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-54.1 · Luis no ve las comisiones de Ana');
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.commissions where property_id = 'a5400000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-54.1 · el prospecto tampoco ve lo que gana su Embajador');
set local request.jwt.claim.sub = 'c5400000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.commissions where property_id = 'a5400000-0000-4000-8000-000000000001'),
  3::bigint, 'D-20 · el Superadmin ve todas');

-- ── TR-01 · todo quedó auditado con motivo ──────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log
    where entity_type = 'commission' and action = 'commission.actualizada' and coalesce(btrim(reason), '') = ''),
  0::bigint, 'RF-54.1 · TR-01 · ninguna transición de comisión quedó sin motivo');
select ok(
  (select count(*) from public.audit_log where entity_type = 'wallet_movement') >= 5,
  'RF-54.1 · TR-01 · cada movimiento de billetera quedó auditado');

select * from finish();
rollback;
