-- HU-08 · RF-08.1…RF-08.6 — propiedad, medios y sus dos máquinas de estado.
-- Nivel N2: lo que la base impide por sí sola, sin que la aplicación colabore.
begin;
select plan(33);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'properties', 'existe properties');
select has_table('public', 'property_media', 'RF-08.5 · existe property_media');
select is((select relrowsecurity from pg_class where oid = 'public.properties'::regclass), true,
  'properties nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.properties'::regclass), true,
  'properties fuerza RLS al dueño');
select is((select relrowsecurity from pg_class where oid = 'public.property_media'::regclass), true,
  'property_media nace con RLS');

select ok(not has_table_privilege('anon', 'public.properties', 'INSERT'),
  'sin sesión no se crea una propiedad');
select ok(has_table_privilege('anon', 'public.properties', 'SELECT'),
  'RF-08.2 · el catálogo público se lee sin sesión');

-- ── RF-08.5 · el bucket de medios existe y es privado ───────────────────────
select is((select public from storage.buckets where id = 'property-media'), false,
  'RF-08.5 · el bucket de medios es privado: las fotos de un borrador no se filtran por URL');
select isnt_empty(
  $$ select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like 'property_media_objetos_%' $$,
  'RF-08.5 · el bucket tiene políticas por rol');

-- La carpeta raíz del objeto es la propiedad: de ahí decide la política.
select is(private.propiedad_de_objeto('c0000000-0000-4000-8000-00000000000a/photo/x.jpg'),
  'c0000000-0000-4000-8000-00000000000a'::uuid,
  'RF-08.5 · la política extrae la propiedad de la primera carpeta del objeto');
select is(private.propiedad_de_objeto('no-es-un-uuid/photo/x.jpg'), null,
  'una ruta con basura en la raíz no rompe la política: no resuelve a ninguna propiedad');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('e0000000-0000-4000-8000-000000000001', 'admin1@arena.co'),
  ('e0000000-0000-4000-8000-000000000002', 'admin2@arena.co'),
  ('e0000000-0000-4000-8000-000000000003', 'visitante@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('e0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('e0000000-0000-4000-8000-000000000001', 'property_admin'),
  ('e0000000-0000-4000-8000-000000000002', 'property_admin');

-- ── RF-08.6 · la propiedad creada queda asignada a su Administrador creador ──
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ insert into public.properties (id, name, description, area_m2, bedrooms, bathrooms, country, region, city)
     values ('a1000000-0000-4000-8000-000000000001', 'Casa Palomino',
             'Casa frente al mar con terraza y piscina privada.', 240, 4, 3, 'CO', 'La Guajira', 'Palomino') $$,
  'un Administrador crea una propiedad');

select is(
  (select count(*) from public.property_admins
    where admin_id = 'e0000000-0000-4000-8000-000000000001'
      and property_id = 'a1000000-0000-4000-8000-000000000001'
      and revoked_at is null),
  1::bigint, 'RF-08.6 · la propiedad queda asignada al Administrador que la creó');

select is(
  (select created_by from public.properties where id = 'a1000000-0000-4000-8000-000000000001'),
  'e0000000-0000-4000-8000-000000000001'::uuid,
  'RF-08.6 · queda registrado quién la creó');

select is(
  (select count(*) from public.audit_log
    where action = 'property.creada' and entity_id = 'a1000000-0000-4000-8000-000000000001'),
  1::bigint, 'TR-01 · RF-A.3 · la creación queda auditada con su propiedad');

-- Regresión · la asignación de RF-08.6 la escribe un disparador `after`, dentro de
-- la misma orden que el `insert`. La política de lectura depende de esa asignación,
-- así que la proyección de un `returning` todavía no la ve. La fila se inserta bien;
-- lo que no se puede es pedirla de vuelta en la misma orden.
select throws_ok(
  $$ insert into public.properties (name, description, area_m2, country, region, city)
     values ('Con returning', 'Prueba.', 100, 'CO', 'La Guajira', 'Palomino')
     returning id $$,
  '42501', null,
  'RF-08.6 · un `insert ... returning` del Administrador se rechaza: la asignación aún no es visible');

select lives_ok(
  $$ insert into public.properties (id, name, description, area_m2, country, region, city)
     values ('a1000000-0000-4000-8000-00000000000f', 'Con id propio', 'Prueba.', 100, 'CO', 'La Guajira', 'Palomino') $$,
  'RF-08.6 · con el identificador puesto por el cliente y sin `returning`, la creación pasa');

-- El Superadmin crea sin quedarse de administrador: su acceso viene del rol.
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.properties (id, name, description, area_m2, country, region, city)
     values ('a1000000-0000-4000-8000-000000000009', 'Casa del Superadmin',
             'Creada por el Superadmin.', 100, 'CO', 'Magdalena', 'Santa Marta') $$,
  'el Superadmin también crea propiedades');
select is(
  (select count(*) from public.property_admins where property_id = 'a1000000-0000-4000-8000-000000000009'),
  0::bigint, 'RF-05.4 · el Superadmin no se asigna a sí mismo como Administrador de lo que crea');

-- ── CA-08.1 · máquina de visibilidad, en la base ────────────────────────────
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ update public.properties set visibility = 'inactive'
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'CA-08.1 · de borrador no se salta a inactiva');

select lives_ok(
  $$ update public.properties set visibility = 'published'
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-08.1 · de borrador a publicada sí');

select throws_ok(
  $$ update public.properties set visibility = 'draft'
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'CA-08.1 · lo publicado no vuelve a borrador');

select lives_ok(
  $$ update public.properties set visibility = 'inactive'
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-08.1 · RF-11.3 · publicada se inactiva');

select lives_ok(
  $$ update public.properties set visibility = 'published'
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'CA-08.1 · RF-11.4 · una inactiva se reactiva');

-- ── RF-08.3 · «Próximamente» no tiene vuelta ────────────────────────────────
select throws_ok(
  $$ update public.properties set coming_soon = false
      where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'RF-08.3 · sin las 8 fracciones no hay estado comercial que derivar');

-- ── CA-08.4 · el borrador no llega al catálogo, ni siquiera como fila ───────
set local role anon;
set local request.jwt.claim.sub = '';

-- Acotado a lo que crea esta prueba: `properties` puede tener datos reales, y una
-- aserción sobre la tabla entera solo pasaría en una base recién creada.
select is(
  (select array_agg(name order by name) from public.properties
    where id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009')),
  array['Casa Palomino'],
  'CA-08.4 · sin sesión solo se ve la publicada, no el borrador del Superadmin');

set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.properties
    where visibility = 'draft'
      and id in ('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009')),
  0::bigint, 'CA-08.4 · un Usuario cualquiera tampoco ve borradores');

-- ── RF-08.5 · los medios siguen el permiso de su propiedad ──────────────────
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000001';
select lives_ok(
  $$ insert into public.property_media (property_id, kind, path, sort_order)
     values ('a1000000-0000-4000-8000-000000000001', 'photo',
             'a1000000-0000-4000-8000-000000000001/photo/uno-terraza.jpg', 0) $$,
  'RF-08.5 · el Administrador asignado sube un medio a su propiedad');

set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000002';
select throws_ok(
  $$ insert into public.property_media (property_id, kind, path, sort_order)
     values ('a1000000-0000-4000-8000-000000000001', 'photo',
             'a1000000-0000-4000-8000-000000000001/photo/intruso.jpg', 1) $$,
  '42501', null, 'RF-08.5 · otro Administrador no sube medios a una propiedad que no administra');

-- La propiedad está publicada, así que su galería sí es pública.
set local role anon;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.property_media
    where property_id = 'a1000000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-08.5 · la galería de una propiedad publicada se ve sin sesión');

-- ── RF-08.1 · las restricciones de la ficha ─────────────────────────────────
reset role;
select throws_ok(
  $$ insert into public.properties (name, description, area_m2, country, region, city)
     values ('Sin metros', 'Descripción.', 0, 'CO', 'La Guajira', 'Palomino') $$,
  '23514', null, 'CA-08.3 · m² menor o igual que cero se rechaza también en la base');

select throws_ok(
  $$ insert into public.properties (name, description, area_m2, bedrooms, country, region, city)
     values ('Negativa', 'Descripción.', 100, -1, 'CO', 'La Guajira', 'Palomino') $$,
  '23514', null, 'CA-08.3 · un conteo negativo se rechaza');

select throws_ok(
  $$ insert into public.properties (name, description, area_m2, country, region, city, video_url)
     values ('Video raro', 'Descripción.', 100, 'CO', 'La Guajira', 'Palomino', 'javascript:alert(1)') $$,
  '23514', null, 'CA-08.3 · un `javascript:` no entra como URL de video');

select * from finish();
rollback;
