-- HU-49 · RF-49.1…RF-49.6 y HU-50 · RF-50.1, RF-50.2 — la inscripción al
-- Programa de Referidos y el código único e inmutable que la aprobación genera.
begin;
select plan(38);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'ambassadors', 'RF-49.2 · existe ambassadors');
select has_table('public', 'referral_codes', 'RF-50.1 · existe referral_codes');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.ambassadors'::regclass, 'public.referral_codes'::regclass)),
  true, 'RF-49.2 · la inscripción y el código fuerzan RLS');
select has_column('public', 'ambassadors', 'terms_version', 'RF-49.2 · se guarda la versión de términos aceptada');
select col_is_unique('public', 'referral_codes', 'code', 'CA-50.1 · el código es único por restricción de base de datos');
select has_function('public', 'enroll_as_ambassador', array['text', 'text', 'text', 'text', 'text'], 'RF-49.1 · existe enroll_as_ambassador');
select has_function('public', 'approve_ambassador', array['uuid', 'boolean', 'text'], 'RF-49.4 · existe approve_ambassador');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c4900000-0000-4000-8000-000000000001', 'super.emb@arena.co', '{}'),
  ('c4900000-0000-4000-8000-000000000002', 'admin.emb@arena.co', '{}'),
  ('c4900000-0000-4000-8000-000000000003', 'propietario.emb@arena.co', '{}'),
  ('c4900000-0000-4000-8000-000000000004', 'usuario.emb@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c4900000-0000-4000-8000-000000000001', 'superadmin'),
  ('c4900000-0000-4000-8000-000000000002', 'property_admin'),
  ('c4900000-0000-4000-8000-000000000003', 'owner');

set local role authenticated;

-- ── CA-49.4 · RF-49.1 · los roles operativos no se inscriben ────────────────
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '12345678901', 'Luis Mora') $$,
  '%CA-49.4%', 'CA-49.4 · un Administrador de Propiedad no se inscribe');
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '12345678901', 'Super') $$,
  '%CA-49.4%', 'CA-49.4 · el Superadmin tampoco se inscribe');

-- ── CA-49.1 · RF-49.3 · datos de pago con formato ───────────────────────────
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000003';
select throws_ok(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', 'ABC-123', 'Ana Ruiz') $$,
  '23514', null, 'CA-49.1 · un número de cuenta con letras se rechaza');
select throws_ok(
  $$ select public.enroll_as_ambassador('2026-09-v1', '   ', 'savings', '12345678901', 'Ana Ruiz') $$,
  '23514', null, 'CA-49.1 · el banco no puede ir vacío');
select throws_ok(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'cripto', '12345678901', 'Ana Ruiz') $$,
  '23514', null, 'CA-49.1 · el tipo de cuenta sale del vocabulario cerrado');
select throws_ok(
  $$ select public.enroll_as_ambassador('   ', 'Bancolombia', 'savings', '12345678901', 'Ana Ruiz') $$,
  '23514', null, 'RF-49.2 · sin versión de términos no hay inscripción');

-- ── RF-49.1 · la inscripción del Propietario ────────────────────────────────
select lives_ok(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'savings', '12345678901', 'Ana Ruiz') $$,
  'RF-49.1 · un Propietario se inscribe y queda pendiente de aprobación');
select is(
  (select status::text from public.ambassadors where user_id = 'c4900000-0000-4000-8000-000000000003'),
  'pending', 'RF-49.4 · la inscripción nace pendiente');
select is(
  (select count(*) from public.referral_codes rc join public.ambassadors a on a.id = rc.ambassador_id
    where a.user_id = 'c4900000-0000-4000-8000-000000000003'),
  0::bigint, 'RF-50.1 · sin aprobación todavía no hay código');
select is(
  (select count(*) from public.user_roles where user_id = 'c4900000-0000-4000-8000-000000000003' and role = 'ambassador'),
  0::bigint, 'RF-49.4 · sin aprobación tampoco hay rol Embajador');

-- ── CA-49.3 · RF-49.6 · nadie se inscribe dos veces ─────────────────────────
select throws_like(
  $$ select public.enroll_as_ambassador('2026-09-v1', 'Davivienda', 'checking', '99999999', 'Ana Ruiz') $$,
  '%CA-49.3%', 'CA-49.3 · una cuenta ya inscrita no se inscribe de nuevo');

-- ── RF-49.5 · quién ve las inscripciones ────────────────────────────────────
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.ambassadors), 0::bigint,
  'RF-49.5 · una cuenta ajena no ve inscripciones de otros');
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.ambassadors), 1::bigint,
  'RF-49.5 · el inscrito ve la suya');
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000001';
-- Se cuentan las cuentas de esta prueba y no toda la tabla: la base local puede
-- traer Embajadores sembrados y la afirmación es sobre lo que la RLS deja ver.
select is(
  (select count(*) from public.ambassadors a
    where a.user_id in ('c4900000-0000-4000-8000-000000000003', 'c4900000-0000-4000-8000-000000000004')),
  1::bigint,
  'RF-49.5 · el Superadmin ve todas las inscripciones');

-- ── CA-49.2 · RF-49.4 · aprobar suma el rol y genera el código ──────────────
create temporary table amb as
  select id from public.ambassadors where user_id = 'c4900000-0000-4000-8000-000000000003';
grant select on amb to authenticated;

set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.approve_ambassador((select id from amb), true, null) $$,
  '%RF-49.5%', 'RF-49.5 · solo el Superadmin aprueba inscripciones');

set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.approve_ambassador((select id from amb), true, null) $$,
  'CA-49.2 · el Superadmin aprueba la inscripción');
-- La cuenta ya traía `user` del registro (HU-04) y `owner` de la compra: el
-- Embajador se suma a los dos, no los reemplaza.
select is(
  (select array_agg(role::text order by role::text) from public.user_roles where user_id = 'c4900000-0000-4000-8000-000000000003'),
  array['ambassador', 'owner', 'user'], 'CA-49.2 · la cuenta queda con Propietario y Embajador, sin perder nada');
select is(
  (select status::text from public.ambassadors where id = (select id from amb)),
  'approved', 'RF-49.4 · la inscripción queda aprobada');

-- ── CA-50.1 · RF-50.1 · el código generado ──────────────────────────────────
select matches(
  (select code from public.referral_codes where ambassador_id = (select id from amb)),
  '^[2-9A-HJKMNP-Z]{8}$', 'CA-50.1 · el código cumple el formato: 8 caracteres sin ambigüedades');
select is(
  (select enabled from public.referral_codes where ambassador_id = (select id from amb)),
  true, 'RF-50.1 · el código nace habilitado');
select lives_ok(
  $$ select public.approve_ambassador((select id from amb), true, null) $$,
  'RF-50.1 · aprobar de nuevo es idempotente y no crea un segundo código');
select is(
  (select count(*) from public.referral_codes where ambassador_id = (select id from amb)),
  1::bigint, 'RF-50.2 · el Embajador tiene un solo código');

-- ── CA-50.2 · RF-50.2 · el código no cambia nunca ───────────────────────────
select is(
  (select has_table_privilege('authenticated', 'public.referral_codes', 'UPDATE')),
  false, 'CA-50.2 · la aplicación no tiene permiso para modificar códigos');
reset role;
set local request.jwt.claim.sub = '';
select throws_like(
  $$ update public.referral_codes set code = 'ARENA234' where ambassador_id = (select id from amb) $$,
  '%RF-50.2%', 'CA-50.2 · aun con permiso, cambiar el código se rechaza');
select throws_ok(
  $$ insert into public.referral_codes (ambassador_id, code)
     values ((select id from amb), (select code from public.referral_codes where ambassador_id = (select id from amb))) $$,
  '23505', null, 'CA-50.1 · la restricción de unicidad rechaza un código duplicado');
select is(
  (select count(*) from public.audit_log
    where entity_type = 'ambassador' and action = 'ambassador.creada'
      and entity_id = (select id from amb)),
  1::bigint, 'RF-49.4 · TR-01 · la inscripción queda auditada');
select ok(
  (select count(*) from public.audit_log where entity_type = 'ambassador' and action = 'ambassador.actualizada') >= 1,
  'RF-49.4 · TR-01 · la aprobación también queda auditada');
set local role authenticated;

-- ── RF-49.4 · el rechazo exige motivo y no concede nada ─────────────────────
set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000004';
select public.enroll_as_ambassador('2026-09-v1', 'Bancolombia', 'checking', '55555555', 'Luis Mora');
create temporary table amb2 as
  select id from public.ambassadors where user_id = 'c4900000-0000-4000-8000-000000000004';
grant select on amb2 to authenticated;

set local request.jwt.claim.sub = 'c4900000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.approve_ambassador((select id from amb2), false, '  ') $$,
  '%RF-49.4%', 'RF-49.4 · rechazar una inscripción exige motivo');
select lives_ok(
  $$ select public.approve_ambassador((select id from amb2), false, 'Datos bancarios de un tercero') $$,
  'RF-49.4 · el Superadmin rechaza con motivo');
select is(
  (select count(*) from public.user_roles where user_id = 'c4900000-0000-4000-8000-000000000004' and role = 'ambassador'),
  0::bigint, 'RF-49.4 · una inscripción rechazada no concede el rol Embajador');
select is(
  (select count(*) from public.referral_codes rc join public.ambassadors a on a.id = rc.ambassador_id
    where a.user_id = 'c4900000-0000-4000-8000-000000000004'),
  0::bigint, 'RF-50.1 · ni genera código');

select * from finish();
rollback;
