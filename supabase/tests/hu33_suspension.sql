-- HU-33 · RF-33.1…RF-33.6 · HU-54 · RF-54.7 · D-07 · TR-01 — suspender y
-- reactivar cuentas en la base: motivo y tipo obligatorios, la RLS deja sin roles a
-- la cuenta suspendida, el código del Embajador deja de atribuir, el saldo sigue
-- el tipo de suspensión, las semanas confirmadas del Propietario no se tocan, y
-- los dos eventos quedan auditados.
begin;
select plan(36);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_function('public', 'suspend_account', array['uuid', 'suspension_kind', 'text'], 'RF-33.1 · existe suspend_account');
select has_function('public', 'reactivate_account', array['uuid'], 'RF-33.5 · existe reactivate_account');
select ok(not has_function_privilege('anon', 'public.suspend_account(uuid, public.suspension_kind, text)', 'EXECUTE'),
  'RF-33.6 · sin sesión no se suspende a nadie');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c3300000-0000-4000-8000-000000000001', 'super.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000002', 'ana.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000003', 'luis.admin.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000004', 'pa.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000005', 'pb.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000006', 'pc.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000007', 'super2.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000008', 'nuevo1.hu33@arena.co', '{}'),
  ('c3300000-0000-4000-8000-000000000009', 'nuevo2.hu33@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c3300000-0000-4000-8000-000000000001', 'superadmin'),
  ('c3300000-0000-4000-8000-000000000001', 'property_admin'),
  ('c3300000-0000-4000-8000-000000000007', 'superadmin'),
  ('c3300000-0000-4000-8000-000000000003', 'property_admin');

-- Ana se inscribe como Embajadora y el Superadmin la aprueba.
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000002';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '33333333', 'Ana Ruiz');
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
create temporary table emb33 as
  select a.id as ambassador_id, public.approve_ambassador(a.id, true, null) as code
    from public.ambassadors a where a.user_id = 'c3300000-0000-4000-8000-000000000002';
grant select on emb33 to authenticated;

-- Tipo de comisión V1 del 3 % como predeterminado (la base local puede traer otros).
reset role;
set local request.jwt.claim.sub = '';
update public.commission_types set is_default = false where is_default;
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select public.create_commission_type('V1 pgTAP 33', 'percentage', null, 300, true);

-- Tres prospectos atribuidos a Ana.
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000004';
select public.attribute_referral(null, (select code from emb33));
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000005';
select public.attribute_referral(null, (select code from emb33));
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000006';
select public.attribute_referral(null, (select code from emb33));

-- Propiedad, fracciones y tres compras: A se paga y libera, C se paga y queda en gracia, B queda pendiente.
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3300000-0000-4000-8000-000000000001', 'Casa Suspensión', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a3300000-0000-4000-8000-000000000001', array[100000000::bigint]);
create temporary table fr33 as
  select number, id from public.fractions where property_id = 'a3300000-0000-4000-8000-000000000001';
grant select on fr33 to authenticated;
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price) values
  ('e3300000-0000-4000-8000-000000000001', (select id from fr33 where number = 1), 'a3300000-0000-4000-8000-000000000001', 'pa.hu33@arena.co', 'c3300000-0000-4000-8000-000000000004', 100000000),
  ('e3300000-0000-4000-8000-000000000002', (select id from fr33 where number = 2), 'a3300000-0000-4000-8000-000000000001', 'pb.hu33@arena.co', 'c3300000-0000-4000-8000-000000000005', 80000000),
  ('e3300000-0000-4000-8000-000000000003', (select id from fr33 where number = 3), 'a3300000-0000-4000-8000-000000000001', 'pc.hu33@arena.co', 'c3300000-0000-4000-8000-000000000006', 50000000);
create temporary table planes33 (nombre text primary key, id uuid);
grant select, insert on planes33 to authenticated;
insert into planes33 select 'A', (select id from public.cerrar_compra('e3300000-0000-4000-8000-000000000001'));
insert into planes33 select 'B', (select id from public.cerrar_compra('e3300000-0000-4000-8000-000000000002'));
insert into planes33 select 'C', (select id from public.cerrar_compra('e3300000-0000-4000-8000-000000000003'));
reset role;
set local request.jwt.claim.sub = '';
-- A se paga y se libera a los 31 días; C se paga después, así que queda en gracia.
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path) values
  ((select id from planes33 where nombre = 'A'), 'a3300000-0000-4000-8000-000000000001', 100000000, current_date, 'transferencia', 'payment-receipts/a33.pdf');
select public.release_commissions_in_grace(current_date + 31) as liberada_la_a;
insert into public.payments (plan_id, property_id, amount, paid_on, payment_method, receipt_path) values
  ((select id from planes33 where nombre = 'C'), 'a3300000-0000-4000-8000-000000000001', 50000000, current_date, 'transferencia', 'payment-receipts/c33.pdf');
create temporary table saldos_antes as
  select status::text as status, sum(amount)::bigint as total from public.commissions
   where ambassador_id = (select ambassador_id from emb33) group by status;
select is(
  (select array_agg(status || ':' || total order by status) from saldos_antes),
  array['available:3000000', 'in_grace:1500000', 'pending:2400000'],
  'CA-33.5 · antes de suspender: $3.000.000 disponibles, $1.500.000 en gracia y $2.400.000 pendientes');

-- pa es Propietario con calendario activo: elige y confirma una semana de 2028.
create or replace function pg_temp.rejilla(ancla date) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (ancla + i * 7)::text, 'ends_on', (ancla + i * 7 + 7)::text,
    'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
    'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
  ) order by i) from generate_series(0, 51) as i;
$$;
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select public.guardar_calendario('a3300000-0000-4000-8000-000000000001', 2028, 2027, null, pg_temp.rejilla('2028-01-01'));
create temporary table cal33 as
  select id from public.season_calendars where property_id = 'a3300000-0000-4000-8000-000000000001' and year = 2028;
grant select on cal33 to authenticated;
select public.open_calendar_selection((select id from cal33), array[1, 2, 3]);
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000004';
select public.select_weeks((select id from cal33), (select id from fr33 where number = 1), array[0, 8, 16, 24, 25, 26]);
select public.confirm_week((select id from cal33), (select id from fr33 where number = 1), 24);

-- ── CA-33.1 · RF-33.3 · RF-33.6 · quién suspende y qué exige ────────────────
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', 'administrative', 'Porque sí.') $$,
  '%RF-33.6%', 'RF-33.6 · un Administrador no suspende cuentas');
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', 'administrative', '   ') $$,
  '%CA-33.1%', 'CA-33.1 · una suspensión sin motivo se rechaza');
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', null, 'Documentos vencidos.') $$,
  '%RF-33.3%', 'RF-33.3 · una suspensión sin tipo se rechaza');
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000001', 'administrative', 'Me voy.') $$,
  '%RF-33.6%', 'RF-33.6 · el Superadmin no se suspende a sí mismo');
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000007', 'administrative', 'Rivalidad.') $$,
  '%RF-33.6%', 'RF-33.6 · un Superadmin no se suspende desde la plataforma');
select is(
  (select status::text from public.profiles where id = 'c3300000-0000-4000-8000-000000000002'),
  'active', 'CA-33.1 · tras los rechazos, Ana sigue activa');

-- ── RF-33.1 · RF-33.2 · CA-33.5 · suspensión administrativa ─────────────────
select lives_ok(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', 'administrative', 'Documentos vencidos.') $$,
  'RF-33.1 · el Superadmin suspende con motivo y tipo');
select is(
  (select (status::text, suspension_kind::text, suspension_reason) from public.profiles where id = 'c3300000-0000-4000-8000-000000000002'),
  ('suspended'::text, 'administrative'::text, 'Documentos vencidos.'::text),
  'RF-33.3 · la cuenta queda suspendida con su tipo y su motivo');
select throws_like(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', 'administrative', 'Otra vez.') $$,
  '%ya está suspendida%', 'RF-33.1 · una cuenta suspendida no se suspende dos veces');
reset role;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000002';
select is(
  private.roles_efectivos(), '{}'::public.app_role[],
  'CA-33.2 · RF-33.1 · para la RLS, la cuenta suspendida no tiene ningún rol');
set local request.jwt.claim.sub = '';
select is(
  (select (a.status::text, rc.enabled) from public.ambassadors a join public.referral_codes rc on rc.ambassador_id = a.id where a.user_id = 'c3300000-0000-4000-8000-000000000002'),
  ('suspended'::text, false),
  'RF-33.2 · el Embajador queda suspendido y su código inhabilitado');
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000008';
select is(
  (select public.attribute_referral(null, (select code from emb33))),
  null, 'CA-33.3 · el código de un Embajador suspendido no crea atribución');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.attributions where prospect_id = 'c3300000-0000-4000-8000-000000000008'),
  0::bigint, 'CA-33.3 · y no queda rastro de atribución');
select is(
  (select array_agg(status::text || ':' || amount order by status::text, amount) from public.commissions
    where ambassador_id = (select ambassador_id from emb33)),
  array['available:3000000', 'in_grace:1500000', 'pending:2400000'],
  'CA-33.5 · RF-54.7 · D-07 · la suspensión administrativa conserva los cuatro saldos');

-- ── RF-33.5 · CA-33.4 · reactivación ────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.reactivate_account('c3300000-0000-4000-8000-000000000002') $$,
  '%RF-33.6%', 'RF-33.6 · un Administrador no reactiva cuentas');
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.reactivate_account('c3300000-0000-4000-8000-000000000002') $$,
  'RF-33.5 · el Superadmin reactiva la cuenta');
select is(
  (select (status::text, suspension_kind is null, suspension_reason is null, suspended_at is null) from public.profiles where id = 'c3300000-0000-4000-8000-000000000002'),
  ('active'::text, true, true, true),
  'CA-33.4 · la cuenta vuelve a estar activa y sin rastro de suspensión en su fila');
reset role;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000002';
select ok(
  'ambassador' = any (private.roles_efectivos()),
  'CA-33.4 · para la RLS, la cuenta recupera sus roles');
set local request.jwt.claim.sub = '';
select is(
  (select (a.status::text, rc.enabled) from public.ambassadors a join public.referral_codes rc on rc.ambassador_id = a.id where a.user_id = 'c3300000-0000-4000-8000-000000000002'),
  ('approved'::text, true),
  'CA-33.4 · RF-33.5 · el Embajador vuelve a aprobado y su código opera');
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000009';
select is(
  (select public.attribute_referral(null, (select code from emb33))),
  (select code from emb33), 'CA-33.4 · el código vuelve a atribuir');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log where entity_type = 'profile' and entity_id = 'c3300000-0000-4000-8000-000000000002'
     and action = 'profile.actualizada' and reason like 'Suspensión administrativa: Documentos vencidos.%'),
  1::bigint, 'CA-33.4 · TR-01 · la suspensión queda auditada con su motivo');
select is(
  (select count(*) from public.audit_log where entity_type = 'profile' and entity_id = 'c3300000-0000-4000-8000-000000000002'
     and action = 'profile.actualizada' and reason = 'Reactivación de la cuenta por el Superadmin'),
  1::bigint, 'CA-33.4 · TR-01 · la reactivación también');
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.reactivate_account('c3300000-0000-4000-8000-000000000002') $$,
  'RF-33.5 · reactivar una cuenta activa no hace nada');

-- ── CA-33.5 · suspensión por incumplimiento o fraude ────────────────────────
select lives_ok(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000002', 'breach_or_fraud', 'Autorreferencia probada.') $$,
  'RF-33.3 · el Superadmin suspende por incumplimiento o fraude');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select array_agg(status::text || ':' || amount order by status::text, amount) from public.commissions
    where ambassador_id = (select ambassador_id from emb33)),
  array['available:3000000', 'reversed:1500000', 'reversed:2400000'],
  'CA-33.5 · D-07 · por fraude se pierden lo pendiente y lo en gracia; lo disponible queda');
select is(
  (select count(*) from public.commissions where ambassador_id = (select ambassador_id from emb33)
     and status = 'reversed' and reversal_reason = 'Suspensión por incumplimiento o fraude: Autorreferencia probada.'),
  2::bigint, 'CA-33.5 · y queda el registro con el motivo');
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
select is(
  public.resolve_available_commissions((select ambassador_id from emb33), true, 'Fraude confirmado por el comité.'),
  1, 'CA-33.5 · RF-54.7 · el Superadmin resuelve sobre lo disponible dejando constancia');
select is(
  (select resolved_reason from public.commissions where plan_id = (select id from planes33 where nombre = 'A')),
  'Decisión del Superadmin tras la suspensión: Fraude confirmado por el comité.',
  'CA-33.5 · la constancia queda en la comisión');

-- ── RF-33.4 · suspender a un Propietario no cancela sus semanas ─────────────
create temporary table semanas_antes as
  select a.id, a.confirmed_at from public.allocations a
   where a.calendar_id = (select id from cal33) and a.fraction_id = (select id from fr33 where number = 1);
select lives_ok(
  $$ select public.suspend_account('c3300000-0000-4000-8000-000000000004', 'administrative', 'Cuotas de gastos en mora.') $$,
  'RF-33.4 · se suspende al Propietario con semanas confirmadas');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.allocations a join semanas_antes s on s.id = a.id
     where a.confirmed_at is not distinct from s.confirmed_at and a.released_at is null),
  6::bigint, 'RF-33.4 · sus seis semanas siguen elegidas y la confirmada sigue confirmada');
select is(
  (select f.status::text || ':' || (f.owner_id = 'c3300000-0000-4000-8000-000000000004')::text from public.fractions f where f.id = (select id from fr33 where number = 1)),
  'sold:true', 'RF-33.4 · la fracción sigue siendo suya');
set local role authenticated;
set local request.jwt.claim.sub = 'c3300000-0000-4000-8000-000000000001';
-- La decisión sobre esas semanas es del Administrador, caso por caso, y queda auditada
-- por las funciones de HU-14/HU-17 que ya existen; aquí se comprueba que nadie decidió por él.
select is(
  (select count(*) from public.audit_log where entity_type = 'allocation'
     and entity_id in (select id from semanas_antes) and occurred_at > (select suspended_at from public.profiles where id = 'c3300000-0000-4000-8000-000000000004')),
  0::bigint, 'RF-33.4 · la suspensión no deja ninguna decisión sobre las semanas: esa es del Administrador');

select * from finish();
rollback;
