-- HU-52 · RF-52.1…RF-52.5 · D-05 · D-37 — el catálogo de tipos de comisión en la
-- base: valor inmutable, un solo predeterminado, escritura solo del Superadmin,
-- asignación por Embajador y resolución del tipo aplicable a cada uno.
begin;
select plan(45);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'commission_types', 'RF-52.1 · existe commission_types');
select has_table('public', 'ambassador_commissions', 'RF-52.4 · existe ambassador_commissions');
select is((select relforcerowsecurity from pg_class where oid = 'public.commission_types'::regclass),
  true, 'RF-52.1 · commission_types fuerza RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.ambassador_commissions'::regclass),
  true, 'RF-52.4 · ambassador_commissions fuerza RLS');
select has_column('public', 'commission_types', 'basis_points', 'RF-D.4 · el porcentaje vive en puntos básicos');
select has_column('public', 'commission_types', 'is_default', 'RF-52.3 · el catálogo marca su predeterminado');
select has_function('public', 'create_commission_type', array['text', 'public.commission_kind', 'bigint', 'integer', 'boolean'], 'RF-52.1 · existe create_commission_type');
select has_function('public', 'assign_commission_type', array['uuid', 'uuid'], 'RF-52.4 · existe assign_commission_type');
select has_function('public', 'commission_type_for', array['uuid'], 'RF-52.5 · existe commission_type_for');
select has_function('public', 'default_commission_type', array[]::text[], 'RF-52.3 · existe default_commission_type');

-- ── Cuentas y Embajadores ───────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5200000-0000-4000-8000-000000000001', 'super.com@arena.co', '{}'),
  ('c5200000-0000-4000-8000-000000000002', 'usuario.com@arena.co', '{}'),
  ('c5200000-0000-4000-8000-000000000003', 'ana.com@arena.co', '{}'),
  ('c5200000-0000-4000-8000-000000000004', 'luis.com@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5200000-0000-4000-8000-000000000001', 'superadmin');
insert into public.ambassadors (id, user_id, terms_version, bank, account_kind, account_number, holder, status) values
  ('c52a0000-0000-4000-8000-00000000000a', 'c5200000-0000-4000-8000-000000000003', '2026-09-v1', 'Bancolombia', 'savings', '1234567890', 'Ana', 'approved'),
  ('c52a0000-0000-4000-8000-00000000000b', 'c5200000-0000-4000-8000-000000000004', '2026-09-v1', 'Davivienda', 'checking', '9876543210', 'Luis', 'approved');

-- ── CA-52.6 · solo el Superadmin administra el catálogo ─────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c5200000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.create_commission_type('Pirata', 'percentage', null, 9000) $$,
  '%CA-52.6%', 'CA-52.6 · un Usuario no crea tipos de comisión');
select throws_like(
  $$ select public.assign_commission_type('c52a0000-0000-4000-8000-00000000000a', null) $$,
  '%CA-52.6%', 'CA-52.6 · un Usuario no asigna el tipo de un Embajador');

-- ── RF-52.1 · RF-52.3 · el catálogo ─────────────────────────────────────────
set local request.jwt.claim.sub = 'c5200000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.create_commission_type('Base', 'percentage', null, 300) $$,
  'RF-52.1 · el Superadmin crea el tipo Base del 3 %');
select is(
  (select is_default from public.commission_types where name = 'Base'),
  true, 'RF-52.3 · el primer tipo del catálogo queda como predeterminado');
select lives_ok(
  $$ select public.create_commission_type('Premium', 'percentage', null, 500) $$,
  'RF-52.1 · y el tipo Premium del 5 %');
select lives_ok(
  $$ select public.create_commission_type('Bono lanzamiento', 'fixed', 1500000, null) $$,
  'RF-52.1 · y uno de importe fijo');
select is(
  (select count(*) from public.commission_types where is_default),
  1::bigint, 'CA-52.5 · seguir creando tipos no multiplica el predeterminado');

-- ── CA-52.3 · valores y nombres inválidos ───────────────────────────────────
select throws_ok(
  $$ select public.create_commission_type('Cero', 'fixed', 0, null) $$,
  '23514', null, 'CA-52.3 · un importe fijo de cero se rechaza');
select throws_ok(
  $$ select public.create_commission_type('Negativo', 'fixed', -1, null) $$,
  '23514', null, 'CA-52.3 · un importe fijo negativo se rechaza');
select throws_ok(
  $$ select public.create_commission_type('Nada', 'percentage', null, 0) $$,
  '23514', null, 'CA-52.3 · un porcentaje de cero puntos básicos se rechaza');
select throws_ok(
  $$ select public.create_commission_type('Exceso', 'percentage', null, 10001) $$,
  '23514', null, 'CA-52.3 · un porcentaje por encima del 100 % se rechaza');
select throws_ok(
  $$ select public.create_commission_type('Mixto', 'percentage', 5000000, 1000) $$,
  '23514', null, 'CA-52.3 · un tipo porcentual con importe fijo a la vez se rechaza');
select throws_ok(
  $$ select public.create_commission_type('   ', 'percentage', null, 300) $$,
  '23514', null, 'CA-52.3 · un nombre vacío se rechaza');
select throws_ok(
  $$ select public.create_commission_type('  base ', 'percentage', null, 400) $$,
  '23505', null, 'CA-52.3 · un nombre repetido se rechaza, sin distinguir caja ni espacios');

-- ── CA-52.4 · RF-52.2 · el valor de un tipo no se edita ─────────────────────
select is(
  (select has_table_privilege('authenticated', 'public.commission_types', 'UPDATE')
       or has_table_privilege('authenticated', 'public.commission_types', 'DELETE')),
  false, 'RF-52.2 · la aplicación no tiene permiso de modificar ni borrar tipos');

reset role;
set local request.jwt.claim.sub = '';
select throws_like(
  $$ update public.commission_types set basis_points = 2000 where name = 'Base' $$,
  '%CA-52.4%', 'CA-52.4 · el valor de un tipo no se edita');
select throws_like(
  $$ update public.commission_types set kind = 'fixed', amount = 1, basis_points = null where name = 'Base' $$,
  '%CA-52.4%', 'CA-52.4 · tampoco cambiando la clase del valor');
select throws_like(
  $$ delete from public.commission_types where name = 'Base' $$,
  '%RF-52.2%', 'RF-52.2 · un tipo no se borra: se desactiva');
set local role authenticated;
set local request.jwt.claim.sub = 'c5200000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.rename_commission_type((select id from public.commission_types where name = 'Bono lanzamiento'), 'Bono de lanzamiento') $$,
  'CA-52.4 · renombrar sí procede');
select is(
  (select basis_points from public.commission_types where name = 'Base'),
  300, 'CA-52.4 · el valor de Base sigue intacto');

-- ── CA-52.1 · RF-52.4 · a quién se le aplica cada tipo ──────────────────────
select lives_ok(
  $$ select public.assign_commission_type(
       'c52a0000-0000-4000-8000-00000000000a',
       (select id from public.commission_types where name = 'Premium')) $$,
  'RF-52.4 · el Superadmin le asigna Premium a Ana');
select is(
  (select name from public.commission_type_for('c52a0000-0000-4000-8000-00000000000a')),
  'Premium', 'CA-52.1 · Ana cobra con el tipo que le asignaron');
select is(
  (select name from public.commission_type_for('c52a0000-0000-4000-8000-00000000000b')),
  'Base', 'CA-52.1 · Luis, sin asignación, cobra con el predeterminado');
select is(
  (select basis_points from public.commission_type_for('c52a0000-0000-4000-8000-00000000000a')),
  500, 'CA-52.2 · el porcentaje que cobra Ana es el suyo, no el de todos');
select lives_ok(
  $$ select public.assign_commission_type('c52a0000-0000-4000-8000-00000000000a', null) $$,
  'RF-52.4 · retirar la asignación procede');
select is(
  (select name from public.commission_type_for('c52a0000-0000-4000-8000-00000000000a')),
  'Base', 'RF-52.4 · sin asignación, Ana vuelve al predeterminado');

-- ── CA-52.5 · RF-52.2 · predeterminado y desactivación ──────────────────────
select lives_ok(
  $$ select public.set_default_commission_type((select id from public.commission_types where name = 'Premium')) $$,
  'CA-52.5 · el Superadmin nombra otro predeterminado');
select is(
  (select string_agg(name, ',') from public.commission_types where is_default),
  'Premium', 'CA-52.5 · el anterior deja de serlo y queda exactamente uno');
select throws_like(
  $$ select public.set_commission_type_active((select id from public.commission_types where name = 'Premium'), false) $$,
  '%RF-52.3%', 'RF-52.3 · el predeterminado no se desactiva');
select lives_ok(
  $$ select public.set_commission_type_active((select id from public.commission_types where name = 'Base'), false) $$,
  'RF-52.2 · un tipo que no es el predeterminado sí se desactiva');
select throws_like(
  $$ select public.assign_commission_type(
       'c52a0000-0000-4000-8000-00000000000b',
       (select id from public.commission_types where name = 'Base')) $$,
  '%RF-52.2%', 'RF-52.2 · un tipo desactivado no se le asigna a nadie nuevo');

-- ── RF-52.3 · lectura ───────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c5200000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.commission_types), 0::bigint,
  'RF-52.1 · el catálogo completo no lo ve quien no es Superadmin');
select is(
  (select name from public.default_commission_type()),
  'Premium', 'RF-52.3 · pero el predeterminado sí lo ve cualquiera (HU-48)');

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log where entity_type = 'commission_type' and action = 'commission_type.creada'),
  3::bigint, 'TR-01 · cada tipo creado deja su entrada de auditoría');
select ok(
  (select count(*) from public.audit_log where entity_type = 'ambassador_commission') >= 2,
  'TR-01 · RF-52.4 · asignar y retirar el tipo de un Embajador queda auditado');

select * from finish();
rollback;
