-- HU-10 · RF-10.1, RF-10.3 — vista global de propiedades del Superadmin.
-- Nivel N2: la frontera es la RLS, no el filtro de la pantalla (DT-05).
begin;
select plan(11);

-- ── Cuentas: un Superadmin, dos Administradores y un Usuario ────────────────
insert into auth.users (id, email) values
  ('a9000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('a9000000-0000-4000-8000-000000000001', 'admin1@arena.co'),
  ('a9000000-0000-4000-8000-000000000002', 'admin2@arena.co'),
  ('a9000000-0000-4000-8000-000000000003', 'usuario@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('a9000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('a9000000-0000-4000-8000-000000000001', 'property_admin'),
  ('a9000000-0000-4000-8000-000000000002', 'property_admin');

-- ── Tres propiedades, una por estado de visibilidad, de dos administradores ─
set local role authenticated;

set local request.jwt.claim.sub = 'a9000000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3000000-0000-4000-8000-000000000001', 'Borrador de A1', 'Propiedad de prueba.', 100, 'CO', 'La Guajira', 'Palomino'),
  ('a3000000-0000-4000-8000-000000000002', 'Publicada de A1', 'Propiedad de prueba.', 100, 'CO', 'La Guajira', 'Palomino');
update public.properties set visibility = 'published' where id = 'a3000000-0000-4000-8000-000000000002';

set local request.jwt.claim.sub = 'a9000000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3000000-0000-4000-8000-000000000003', 'Inactiva de A2', 'Propiedad de prueba.', 100, 'CO', 'Magdalena', 'Santa Marta');
update public.properties set visibility = 'published' where id = 'a3000000-0000-4000-8000-000000000003';
update public.properties set visibility = 'inactive' where id = 'a3000000-0000-4000-8000-000000000003';

-- ── CA-10.1 · el Superadmin ve todo estado y todo administrador ─────────────
-- Las aserciones se acotan al prefijo de esta prueba: la base puede tener
-- propiedades reales, y comparar contra la tabla entera solo pasaría estando vacía.
set local request.jwt.claim.sub = 'a9000000-0000-4000-8000-00000000000a';

select is(
  (select array_agg(name order by name) from public.properties where id::text like 'a3000000-%'),
  array['Borrador de A1', 'Inactiva de A2', 'Publicada de A1'],
  'CA-10.1 · el Superadmin obtiene también las `En borrador` e `Inactiva` de todos los administradores');

select is(
  (select array_agg(name order by name) from public.property_overview where id::text like 'a3000000-%'),
  array['Borrador de A1', 'Inactiva de A2', 'Publicada de A1'],
  'RF-10.1 · la vista global le muestra las mismas tres');

select is(
  (select created_by from public.property_overview where id = 'a3000000-0000-4000-8000-000000000003'),
  'a9000000-0000-4000-8000-000000000002'::uuid,
  'RF-10.1 · el listado global trae el administrador de cada propiedad');

select is(
  (select commercial_status from public.property_overview where id = 'a3000000-0000-4000-8000-000000000001'),
  'coming_soon', 'RF-10.1 · y su estado comercial ya derivado');

-- ── CA-10.3 · a quien no es Superadmin la vista no le entrega el conjunto ───
set local request.jwt.claim.sub = 'a9000000-0000-4000-8000-000000000001';

select is(
  (select array_agg(name order by name) from public.property_overview where id::text like 'a3000000-%'),
  array['Borrador de A1', 'Publicada de A1'],
  'CA-10.3 · un Administrador ve por la vista exactamente lo suyo, nunca lo global');

select is(
  (select count(*) from public.property_overview
    where id = 'a3000000-0000-4000-8000-000000000003'),
  0::bigint, 'CA-10.3 · RF-10.3 · no alcanza la propiedad de otro administrador');

set local request.jwt.claim.sub = 'a9000000-0000-4000-8000-000000000003';

select is(
  (select array_agg(name) from public.property_overview where id::text like 'a3000000-%'),
  array['Publicada de A1'],
  'CA-10.3 · un Usuario solo alcanza lo publicado, que es el catálogo');

set local role anon;
set local request.jwt.claim.sub = '';

select is(
  (select array_agg(name) from public.property_overview where id::text like 'a3000000-%'),
  array['Publicada de A1'],
  'CA-10.3 · sin sesión, lo mismo: la vista no es una puerta trasera');

-- La vista respeta la RLS de quien consulta porque se declaró `security_invoker`.
-- Sin esa opción, correría con los privilegios de su dueño y todo lo anterior
-- devolvería las tres propiedades a cualquiera.
reset role;
select is(
  (select count(*) from pg_class c
    where c.relname = 'property_overview'
      and c.reloptions @> array['security_invoker=true']),
  1::bigint, 'RF-10.3 · la vista global se evalúa con los permisos de quien consulta');

select ok(not has_table_privilege('anon', 'public.property_overview', 'INSERT'),
  'la vista no se escribe');

select ok(
  (select count(*) from public.property_overview where id::text like 'a3000000-%') = 3,
  'la vista existe y agrega las tres propiedades cuando quien consulta puede verlas todas');

select * from finish();
rollback;
