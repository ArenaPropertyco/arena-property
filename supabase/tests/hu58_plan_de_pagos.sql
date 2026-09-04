-- HU-58 · RF-58.1…RF-58.8 — plan de pagos, abonos, estados derivados, interruptor
-- de calendario y anulación de la compra.
-- Nivel N2: los invariantes los garantiza el motor, no la disciplina de código.
begin;
select plan(52);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'payment_plans', 'existe payment_plans');
select has_table('public', 'payments', 'existe payments');
select has_table('public', 'payment_events', 'RF-58.6 · existe payment_events');
select is((select relforcerowsecurity from pg_class where oid = 'public.payment_plans'::regclass), true,
  'payment_plans fuerza RLS al dueño');
select is((select relforcerowsecurity from pg_class where oid = 'public.payments'::regclass), true,
  'payments fuerza RLS al dueño');
select ok(not has_table_privilege('authenticated', 'public.payments', 'DELETE'),
  'RF-58.5 · un abono no se borra: se anula');
select ok(not has_table_privilege('authenticated', 'public.payment_plans', 'DELETE'),
  'RF-58.8 · un plan no se borra: se anula');
select ok(not has_table_privilege('authenticated', 'public.payment_events', 'INSERT'),
  'RF-58.6 · los eventos los escribe solo la derivación');

-- ── RF-58.2 · el bucket de comprobantes existe y es privado ─────────────────
select is((select public from storage.buckets where id = 'payment-receipts'), false,
  'RF-58.2 · el bucket de comprobantes es privado');
select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'payment_receipts_objetos_%' $$,
  'RF-58.2 · el bucket tiene políticas por rol');
select is(private.plan_de_objeto('a1000000-0000-4000-8000-000000000001/c1000000-0000-4000-8000-000000000001/x.pdf'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'RF-58.2 · la política extrae el plan de la segunda carpeta del objeto');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d5000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('d5000000-0000-4000-8000-000000000001', 'admin@arena.co'),
  ('d5000000-0000-4000-8000-000000000002', 'titular@ejemplo.com'),
  ('d5000000-0000-4000-8000-000000000003', 'otro@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d5000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d5000000-0000-4000-8000-000000000001', 'property_admin');

-- ── Propiedad, fracciones y una compra cerrada a $100.000.000 ──────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a7000000-0000-4000-8000-000000000001', 'Casa Plan', 'Propiedad de prueba.', 200, 'CO', 'La Guajira', 'Palomino');
select public.fraccionar_propiedad('a7000000-0000-4000-8000-000000000001', array[100000000::bigint]);

insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, agreed_price)
values ('e7000000-0000-4000-8000-000000000001',
        (select id from public.fractions where property_id = 'a7000000-0000-4000-8000-000000000001' and number = 1),
        'a7000000-0000-4000-8000-000000000001', 'titular@ejemplo.com', 100000000);

reset role;
create temporary table ctx as
  select (select id from public.fractions where property_id = 'a7000000-0000-4000-8000-000000000001' and number = 1) as fraccion,
         null::uuid as plan;
grant select, update on ctx to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000001';

update ctx set plan = (select id from public.cerrar_compra('e7000000-0000-4000-8000-000000000001'));

-- ── RF-58.1 · el plan nace sin abonos ───────────────────────────────────────
select is(public.estado_del_plan((select plan from ctx)), 'reserved',
  'CA-58.1 · un plan de $100.000.000 sin abonos deriva «Reservada»');

select throws_ok(
  $$ insert into public.payment_plans (invitation_id, fraction_id, property_id, owner_id, agreed_price)
     values ('e7000000-0000-4000-8000-000000000001', (select fraccion from ctx),
             'a7000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002', 1) $$,
  'P0001', null, 'RF-58.1 · un plan no se inserta a mano: nace del cierre de la compra');

-- ── CA-58.5 · el precio pactado es un snapshot ──────────────────────────────
update public.fractions set list_price = 200000000 where id = (select fraccion from ctx);
select is(
  (select agreed_price from public.payment_plans where id = (select plan from ctx)),
  100000000::bigint, 'CA-58.5 · cambiar el precio de lista de la fracción no altera el precio pactado');

select throws_ok(
  $$ update public.payment_plans set agreed_price = 90000000 where id = (select plan from ctx) $$,
  'P0001', null, 'CA-58.5 · el precio pactado tampoco se edita');

-- ── CA-58.6 · el comprobante es obligatorio ─────────────────────────────────
select throws_ok(
  $$ insert into public.payments (plan_id, amount, paid_on, payment_method, receipt_path)
     values ((select plan from ctx), 30000000, '2026-09-01', 'transfer', '   ') $$,
  '23514', null, 'CA-58.6 · un abono sin comprobante se rechaza');

select throws_ok(
  $$ insert into public.payments (plan_id, amount, paid_on, payment_method, receipt_path)
     values ((select plan from ctx), 30000000, '2026-09-01', 'transfer', null) $$,
  '23502', null, 'CA-58.6 · ni siquiera con el comprobante en nulo');

-- ── CA-58.1 · los estados se derivan de los abonos ──────────────────────────
select lives_ok(
  $$ insert into public.payments (id, plan_id, amount, paid_on, payment_method, receipt_path)
     values ('f7000000-0000-4000-8000-000000000001', (select plan from ctx), 30000000, '2026-09-01', 'transfer',
             'a7000000-0000-4000-8000-000000000001/plan/uno.pdf') $$,
  'RF-58.2 · el Administrador registra un abono de $30.000.000 con comprobante');

select is(public.estado_del_plan((select plan from ctx)), 'in_progress',
  'CA-58.1 · con un abono de $30.000.000 el plan deriva «En proceso de pago»');

select is(
  (select (paid_total, balance, status) from public.payment_plan_overview where id = (select plan from ctx)),
  (30000000::bigint, 70000000::bigint, 'in_progress'::text),
  'RF-58.9 · la vista trae abonado, saldo y estado ya derivados');

-- ── CA-58.2 · sobrepago ─────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.payments (plan_id, amount, paid_on, payment_method, receipt_path)
     values ((select plan from ctx), 70000001, '2026-09-02', 'transfer',
             'a7000000-0000-4000-8000-000000000001/plan/dos.pdf') $$,
  'P0001', null, 'CA-58.2 · un abono que superaría el precio pactado se rechaza');

select is(public.estado_del_plan((select plan from ctx)), 'in_progress',
  'CA-58.2 · y el estado no cambia');

select throws_ok(
  $$ insert into public.payments (plan_id, amount, paid_on, payment_method, receipt_path)
     values ((select plan from ctx), 0, '2026-09-02', 'transfer', 'a7000000-0000-4000-8000-000000000001/plan/cero.pdf') $$,
  '23514', null, 'RF-58.2 · un abono de cero no es un abono');

-- ── CA-58.8 · «Pago completado» activa el calendario ────────────────────────
select is(
  (select calendar_active from public.fractions where id = (select fraccion from ctx)),
  false, 'D-31 · antes de completar el pago el calendario está inactivo');

select lives_ok(
  $$ insert into public.payments (id, plan_id, amount, paid_on, payment_method, receipt_path)
     values ('f7000000-0000-4000-8000-000000000002', (select plan from ctx), 70000000, '2026-09-02', 'transfer',
             'a7000000-0000-4000-8000-000000000001/plan/dos.pdf') $$,
  'RF-58.2 · el abono que deja el saldo en cero entra');

select is(public.estado_del_plan((select plan from ctx)), 'completed',
  'CA-58.1 · con abonos que suman $100.000.000 el plan deriva «Pago completado»');

select is(
  (select calendar_active from public.fractions where id = (select fraccion from ctx)),
  true, 'CA-58.8 · al derivar «Pago completado» el calendario de la fracción queda activo');

select is(
  (select count(*) from public.payment_events where plan_id = (select plan from ctx) and kind = 'payment_completed'),
  1::bigint, 'RF-58.6 · se emite el evento de pago completado');

-- ── CA-58.4 · CA-58.9 · recalcular no repite ni evento ni activación ────────
reset role;
select private.derivar_plan((select plan from ctx));
select private.derivar_plan((select plan from ctx));
select private.derivar_plan((select plan from ctx));
set local role authenticated;
set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000001';

select is(
  (select count(*) from public.payment_events where plan_id = (select plan from ctx) and kind = 'payment_completed'),
  1::bigint, 'CA-58.4 · recalculado tres veces sobre un plan completo, el evento se emitió una sola vez');

select is(
  (select count(*) from public.audit_log
    where action = 'fraction.actualizada' and entity_id = (select fraccion from ctx)
      and (previous_state ->> 'calendar_active')::boolean = false
      and (next_state ->> 'calendar_active')::boolean = true),
  1::bigint, 'CA-58.9 · la activación del calendario se registró una sola vez');

-- ── RF-58.5 · un abono no se edita ni se borra ──────────────────────────────
select throws_ok(
  $$ update public.payments set amount = 1 where id = 'f7000000-0000-4000-8000-000000000002' $$,
  'P0001', null, 'RF-58.5 · el monto de un abono no se edita');

select throws_ok(
  $$ select public.anular_abono('f7000000-0000-4000-8000-000000000002', '   ') $$,
  'P0001', null, 'RF-58.5 · un abono no se anula sin motivo');

-- ── CA-58.3 · anular el abono que completaba el pago ────────────────────────
select lives_ok(
  $$ select public.anular_abono('f7000000-0000-4000-8000-000000000002', 'Transferencia devuelta por el banco.') $$,
  'RF-58.5 · el abono se anula con motivo');

select is(public.estado_del_plan((select plan from ctx)), 'in_progress',
  'CA-58.3 · el estado vuelve a «En proceso de pago»');

select is(
  (select calendar_active from public.fractions where id = (select fraccion from ctx)),
  false, 'CA-58.8 · y el calendario vuelve a inactivo');

select is(
  (select reason from public.audit_log
    where action = 'payment.actualizada' and entity_id = 'f7000000-0000-4000-8000-000000000002'),
  'Transferencia devuelta por el banco.', 'CA-58.3 · queda el registro de auditoría con el motivo');

select throws_ok(
  $$ select public.anular_abono('f7000000-0000-4000-8000-000000000002', 'Otra vez.') $$,
  'P0001', null, 'un abono anulado no se anula dos veces');

-- Se completa de nuevo: el calendario se reactiva, el evento no se repite (RF-58.6).
insert into public.payments (id, plan_id, amount, paid_on, payment_method, receipt_path)
values ('f7000000-0000-4000-8000-000000000003', (select plan from ctx), 70000000, '2026-09-03', 'cash',
        'a7000000-0000-4000-8000-000000000001/plan/tres.pdf');

select is(
  (select (public.estado_del_plan((select plan from ctx)),
           (select calendar_active from public.fractions where id = (select fraccion from ctx)),
           (select count(*) from public.payment_events where plan_id = (select plan from ctx)))),
  ('completed'::text, true, 1::bigint),
  'RF-58.6 · RF-58.7 · completado de nuevo: calendario activo y un solo evento en la vida del plan');

-- ── RF-58.9 · el Propietario lee su plan; otro Usuario, nada ────────────────
set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000002';
select is(
  (select (status, paid_total) from public.payment_plan_overview where id = (select plan from ctx)),
  ('completed'::text, 100000000::bigint), 'RF-58.9 · el Propietario ve su propio plan con su estado');
select is(
  (select count(*) from public.payments where plan_id = (select plan from ctx) and voided_at is null),
  2::bigint, 'RF-58.9 · y sus abonos vigentes');
select throws_ok(
  $$ select public.anular_abono('f7000000-0000-4000-8000-000000000003', 'Yo no pagué eso.') $$,
  'P0001', null, 'RF-58.2 · el Propietario lee sus abonos pero no los toca: anular es del Administrador');

set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.payment_plan_overview where id = (select plan from ctx)),
  0::bigint, 'RF-58.9 · un Usuario ajeno no alcanza el plan');

-- ── CA-58.7 · anulación de la compra, solo del Superadmin ───────────────────
set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ select public.anular_compra((select plan from ctx), 'Fraude.') $$,
  'P0001', null, 'RF-58.8 · un Administrador no anula una compra');

set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-00000000000a';
select throws_ok(
  $$ select public.anular_compra((select plan from ctx), '') $$,
  'P0001', null, 'RF-A.4 · el Superadmin tampoco la anula sin motivo');

select lives_ok(
  $$ select public.anular_compra((select plan from ctx), 'Desistimiento firmado.') $$,
  'RF-58.8 · el Superadmin anula la compra con motivo');

select is(
  (select (status::text, owner_id, calendar_active) from public.fractions where id = (select fraccion from ctx)),
  ('available'::text, null::uuid, false),
  'CA-58.7 · la fracción vuelve a disponible, sin titular y con el calendario inactivo');

select is(
  (select (public.estado_del_plan((select plan from ctx)), void_reason) from public.payment_plans where id = (select plan from ctx)),
  ('voided'::text, 'Desistimiento firmado.'::text),
  'CA-58.7 · el plan queda anulado con su motivo');

select is(
  (select count(*) from public.payment_events where plan_id = (select plan from ctx) and kind = 'purchase_voided'),
  1::bigint, 'CA-58.7 · se emite exactamente un evento de reversa');

select is(
  (select count(*) from public.user_roles
    where user_id = 'd5000000-0000-4000-8000-000000000002' and role = 'owner'),
  0::bigint, 'D-31 · sin fracción vendida a su nombre, el comprador deja de ser Propietario');

select is(
  (select reason from public.audit_log
    where action = 'payment_plan.actualizada' and entity_id = (select plan from ctx)),
  'Desistimiento firmado.', 'TR-01 · la anulación queda auditada con su motivo');

select throws_ok(
  $$ select public.anular_compra((select plan from ctx), 'Otra vez.') $$,
  'P0001', null, 'una compra anulada no se anula dos veces');

set local request.jwt.claim.sub = 'd5000000-0000-4000-8000-000000000001';
select throws_ok(
  $$ insert into public.payments (plan_id, amount, paid_on, payment_method, receipt_path)
     values ((select plan from ctx), 1, '2026-09-03', 'cash', 'a7000000-0000-4000-8000-000000000001/plan/y.pdf') $$,
  'P0001', null, 'RF-58.8 · sobre un plan anulado no se registran abonos');

reset role;
select * from finish();
rollback;
