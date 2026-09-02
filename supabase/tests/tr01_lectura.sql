-- TR-01 · RF-A.6 y CA-A.5 — quién puede leer el registro.
-- El Superadmin lo ve completo; el Administrador solo el de sus propiedades
-- asignadas; ningún otro rol accede.
begin;
select plan(8);

-- Dos entradas de propiedades distintas, escritas como el sistema.
insert into public.audit_log (actor_role, action, entity_type, entity_id, property_id)
values
  ('superadmin', 'property.publicada', 'property',
   '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111'),
  ('superadmin', 'property.publicada', 'property',
   '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222');

-- ── Ningún rol anónimo entra al registro ────────────────────────────────────
select ok(
  not has_table_privilege('anon', 'public.audit_log', 'SELECT'),
  'RF-A.6 · anon no tiene siquiera permiso de lectura sobre el registro');

-- ── La lectura pasa por políticas, no por permisos abiertos ─────────────────
select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and tablename = 'audit_log' and cmd = 'SELECT' $$,
  'existe una política de lectura del registro');

-- ── Un usuario autenticado sin rol no ve nada ───────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';

select is(
  (select count(*) from public.audit_log),
  0::bigint,
  'RF-A.6 · un usuario autenticado sin rol no ve ninguna entrada');

reset role;

-- ── El Superadmin ve todo el registro ───────────────────────────────────────
select ok(
  public.puede_leer_auditoria_de('11111111-1111-4111-8111-111111111111'::uuid,
                                 'superadmin') ,
  'RF-A.6 · el Superadmin puede leer cualquier propiedad');

select ok(
  public.puede_leer_auditoria_de(null, 'superadmin'),
  'el Superadmin también lee las entradas sin propiedad asociada');

-- ── El Administrador queda acotado a sus propiedades asignadas ──────────────
select ok(
  not public.puede_leer_auditoria_de('11111111-1111-4111-8111-111111111111'::uuid,
                                     'administrador'),
  'CA-A.5 · el Administrador no lee una propiedad que no tiene asignada');

select ok(
  not public.puede_leer_auditoria_de(null, 'administrador'),
  'el Administrador no lee entradas sin propiedad: no son de su ámbito');

-- ── Cualquier otro rol queda fuera ──────────────────────────────────────────
select ok(
  not public.puede_leer_auditoria_de('11111111-1111-4111-8111-111111111111'::uuid,
                                     'propietario'),
  'RF-A.6 · ningún otro rol accede al registro');

select * from finish();
rollback;
