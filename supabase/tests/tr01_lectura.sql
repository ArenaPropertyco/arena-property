-- TR-01 · RF-A.6 y CA-A.5 — quién puede leer el registro.
-- El Superadmin lo ve completo; el Administrador solo el de sus propiedades
-- asignadas; ningún otro rol accede. Con `user_roles` y `property_admins` ya
-- existentes, la prueba usa cuentas y asignaciones reales, no solo la función.
begin;
select plan(12);

-- ── Cuentas: un Superadmin, un Administrador de A, un Propietario ───────────
insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('d0000000-0000-4000-8000-000000000001', 'admin@arena.co'),
  ('d0000000-0000-4000-8000-000000000002', 'dueno@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d0000000-0000-4000-8000-000000000001', 'property_admin'),
  ('d0000000-0000-4000-8000-000000000002', 'owner');
-- La asignación referencia una propiedad real desde HU-08; la segunda propiedad
-- solo aparece en el registro de auditoría, que no lleva clave foránea (RF-A.2).
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('11111111-1111-4111-8111-111111111111', 'A', 'Propiedad A de prueba.', 100, 'CO', 'La Guajira', 'Palomino');

insert into public.property_admins (admin_id, property_id, assigned_by) values
  ('d0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'd0000000-0000-4000-8000-00000000000a');

-- Dos entradas de negocio, una por propiedad, escritas como el sistema.
insert into public.audit_log (actor_role, action, entity_type, entity_id, property_id) values
  ('superadmin', 'property.publicada', 'property',
   '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('superadmin', 'property.publicada', 'property',
   '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');

-- ── Permisos y política ─────────────────────────────────────────────────────
select ok(not has_table_privilege('anon', 'public.audit_log', 'SELECT'),
  'RF-A.6 · anon no tiene siquiera permiso de lectura sobre el registro');
select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and tablename = 'audit_log' and cmd = 'SELECT' $$,
  'existe una política de lectura del registro');

-- ── La regla, directamente ──────────────────────────────────────────────────
select ok(private.puede_leer_auditoria_de('11111111-1111-4111-8111-111111111111', 'superadmin'),
  'RF-A.6 · el Superadmin puede leer cualquier propiedad');
select ok(private.puede_leer_auditoria_de(null, 'superadmin'),
  'el Superadmin también lee las entradas sin propiedad asociada');
select ok(not private.puede_leer_auditoria_de('11111111-1111-4111-8111-111111111111', 'owner'),
  'RF-A.6 · ningún otro rol accede al registro');

-- ── Como Usuario/Propietario: nada ──────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.audit_log), 0::bigint,
  'RF-A.6 · un Propietario no ve ninguna entrada');

-- ── Como Administrador de A: solo A ─────────────────────────────────────────
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';
select is(
  (select array_agg(property_id::text) from public.audit_log where action = 'property.publicada'),
  array['11111111-1111-4111-8111-111111111111'],
  'CA-A.5 · el Administrador solo obtiene entradas de sus propiedades asignadas');
select is(
  (select count(*) from public.audit_log where property_id is null),
  0::bigint,
  'el Administrador no ve entradas sin propiedad: no son de su ámbito');

-- ── Como Superadmin: todo ───────────────────────────────────────────────────
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000a';
select is((select count(*) from public.audit_log where action = 'property.publicada'), 2::bigint,
  'RF-A.6 · el Superadmin ve el registro completo');

-- ── Al retirar la asignación, el Administrador deja de ver A ────────────────
update public.property_admins set revoked_at = now(), revoked_by = 'd0000000-0000-4000-8000-00000000000a'
 where admin_id = 'd0000000-0000-4000-8000-000000000001';
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';
select is((select count(*) from public.audit_log where action = 'property.publicada'), 0::bigint,
  'una asignación retirada deja de dar acceso al registro de esa propiedad');

reset role;

-- ── Higiene de las funciones privilegiadas ──────────────────────────────────
select ok(not has_function_privilege('anon', 'private.roles_efectivos()', 'EXECUTE'),
  'anon no puede invocar la resolución de roles');
select hasnt_function('public', 'puede_leer_auditoria_de', array['uuid', 'text'],
  'la regla de lectura ya no vive en el esquema expuesto');

select * from finish();
rollback;
