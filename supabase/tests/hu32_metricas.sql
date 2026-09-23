-- HU-32 · RF-32.1, RF-32.3 — las métricas globales salen de una sola función
-- reservada al Superadmin, sobre toda la plataforma y sin filtro de asignación.
-- La base local tiene datos reales, así que se comprueban las diferencias que
-- deja un juego de datos conocido, no los totales absolutos.
begin;
select plan(16);

select has_function('public', 'platform_metrics', array[]::text[], 'RF-32.1 · existe platform_metrics');
select ok(not has_function_privilege('anon', 'public.platform_metrics()', 'EXECUTE'), 'RF-32.3 · sin sesión no hay métricas');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c3200000-0000-4000-8000-000000000001', 'super.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000002', 'luis.admin.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000003', 'dueno1.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000004', 'dueno2.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000005', 'ana.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000006', 'pa.hu32@arena.co', '{}'),
  ('c3200000-0000-4000-8000-000000000007', 'pb.hu32@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c3200000-0000-4000-8000-000000000001', 'superadmin'),
  ('c3200000-0000-4000-8000-000000000001', 'property_admin'),
  ('c3200000-0000-4000-8000-000000000002', 'property_admin');

-- ── CA-32.3 · solo el Superadmin ────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000002';
select throws_like($$ select public.platform_metrics() $$, '%CA-32.3%', 'CA-32.3 · un Administrador no consulta las métricas globales');
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000003';
select throws_like($$ select public.platform_metrics() $$, '%CA-32.3%', 'CA-32.3 · un Usuario tampoco');

-- ── La foto de antes ────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
create temporary table antes as select public.platform_metrics() as m;
select ok((select m ? 'properties' and m ? 'fractions_total' and m ? 'fractions_sold' and m ? 'active_admins'
              and m ? 'owners' and m ? 'active_ambassadors' and m ? 'commissions' and m ? 'sales' and m ? 'commission_events' from antes),
  'RF-32.1 · la función devuelve los seis KPI, las comisiones por estado y las dos series');

-- ── Juego de datos conocido ─────────────────────────────────────────────────
-- Ana, Embajadora aprobada; V1 del 3 % como predeterminado.
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000005';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '32323232', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
create temporary table emb32 as
  select a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a where a.user_id = 'c3200000-0000-4000-8000-000000000005';
grant select on emb32 to authenticated;
reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 32', 'percentage', null, 300, true);
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000006';
select public.attribute_referral(null, (select code from emb32));
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000007';
select public.attribute_referral(null, (select code from emb32));

-- Una propiedad con 8 fracciones; Luis la administra.
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3200000-0000-4000-8000-000000000001', 'Casa Métricas', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a3200000-0000-4000-8000-000000000001', array[100000000::bigint]);
reset role;
set local request.jwt.claim.sub = '';
insert into public.property_admins (admin_id, property_id, assigned_by)
values ('c3200000-0000-4000-8000-000000000002', 'a3200000-0000-4000-8000-000000000001', 'c3200000-0000-4000-8000-000000000001');
create temporary table fr32 as
  select number, id from public.fractions where property_id = 'a3200000-0000-4000-8000-000000000001';
grant select on fr32 to authenticated;

-- Cuatro compras: dos sin referido y dos de los referidos de Ana (una pagada del todo).
set local role authenticated;
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e3200000-0000-4000-8000-000000000001', (select id from fr32 where number = 1), 'a3200000-0000-4000-8000-000000000001', 'dueno1.hu32@arena.co', 'c3200000-0000-4000-8000-000000000003', 100000000),
  ('e3200000-0000-4000-8000-000000000002', (select id from fr32 where number = 2), 'a3200000-0000-4000-8000-000000000001', 'dueno2.hu32@arena.co', 'c3200000-0000-4000-8000-000000000004', 100000000),
  ('e3200000-0000-4000-8000-000000000003', (select id from fr32 where number = 3), 'a3200000-0000-4000-8000-000000000001', 'pa.hu32@arena.co', 'c3200000-0000-4000-8000-000000000006', 100000000),
  ('e3200000-0000-4000-8000-000000000004', (select id from fr32 where number = 4), 'a3200000-0000-4000-8000-000000000001', 'pb.hu32@arena.co', 'c3200000-0000-4000-8000-000000000007', 80000000);
create temporary table planes32 (nombre text primary key, id uuid);
grant select, insert on planes32 to authenticated;
insert into planes32 select 'D1', (select id from public.cerrar_compra('e3200000-0000-4000-8000-000000000001'));
insert into planes32 select 'D2', (select id from public.cerrar_compra('e3200000-0000-4000-8000-000000000002'));
insert into planes32 select 'PA', (select id from public.cerrar_compra('e3200000-0000-4000-8000-000000000003'));
insert into planes32 select 'PB', (select id from public.cerrar_compra('e3200000-0000-4000-8000-000000000004'));
reset role;
set local request.jwt.claim.sub = '';
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path)
values ((select id from planes32 where nombre = 'PA'), 'a3200000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/pa32.pdf');

-- ── CA-32.1 · las diferencias son exactamente las del juego de datos ────────
set local role authenticated;
set local request.jwt.claim.sub = 'c3200000-0000-4000-8000-000000000001';
create temporary table despues as select public.platform_metrics() as m;
create or replace function pg_temp.delta(clave text) returns bigint language sql as $$
  select ((select m ->> clave from despues)::bigint - (select m ->> clave from antes)::bigint);
$$;
select is(pg_temp.delta('properties'), 1::bigint, 'CA-32.1 · una propiedad más');
select is(pg_temp.delta('fractions_total'), 8::bigint, 'CA-32.1 · ocho fracciones más');
select is(pg_temp.delta('fractions_sold'), 4::bigint, 'CA-32.1 · cuatro vendidas más');
-- Luis, asignado a mano, y el Superadmin, que tiene el rol y quedó asignado al crear la propiedad (RF-08.6).
select is(pg_temp.delta('active_admins'), 2::bigint, 'CA-32.1 · dos Administradores activos más: los dos con rol y asignación vigente');
select is(pg_temp.delta('owners'), 4::bigint, 'CA-32.1 · cuatro Propietarios más');
select is(pg_temp.delta('active_ambassadors'), 1::bigint, 'CA-32.1 · una Embajadora activa más');
select is(
  (select jsonb_build_object(
     'pending', ((m -> 'commissions' ->> 'pending')::bigint - (select (m -> 'commissions' ->> 'pending')::bigint from antes)),
     'in_grace', ((m -> 'commissions' ->> 'in_grace')::bigint - (select (m -> 'commissions' ->> 'in_grace')::bigint from antes)))
   from despues),
  '{"pending": 2400000, "in_grace": 3000000}'::jsonb,
  'CA-32.1 · RF-32.1 · $2.400.000 pendientes y $3.000.000 en gracia, cada comisión en un solo estado');
select is(
  (select jsonb_array_length(m -> 'sales') from despues) - (select jsonb_array_length(m -> 'sales') from antes),
  4, 'RF-32.2 · la serie de ventas trae las cuatro compras cerradas');
select is(
  (select jsonb_array_length(m -> 'commission_events') from despues) - (select jsonb_array_length(m -> 'commission_events') from antes),
  2, 'RF-32.2 · la serie de comisiones trae las dos generadas');

-- ── RF-32.3 · una cuenta suspendida deja de contar como activa ──────────────
select public.suspend_account('c3200000-0000-4000-8000-000000000004', 'administrative', 'Cuotas en mora.');
create temporary table tras_suspension as select public.platform_metrics() as m;
select is(
  (select (m ->> 'owners')::bigint from tras_suspension) - (select (m ->> 'owners')::bigint from antes),
  3::bigint, 'RF-32.1 · HU-33 · el Propietario suspendido no cuenta entre los activos');
select is(
  (select (m ->> 'fractions_sold')::bigint from tras_suspension) - (select (m ->> 'fractions_sold')::bigint from antes),
  4::bigint, 'RF-32.1 · pero su fracción sigue vendida');

select * from finish();
rollback;
