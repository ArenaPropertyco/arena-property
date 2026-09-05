-- HU-01 · RF-01.1, RF-01.5 y HU-02 · RF-02.1 — el catálogo público se lee sin
-- sesión y solo muestra lo publicado; el detalle resuelve por slug.
begin;
select plan(11);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_column('public', 'properties', 'slug', 'properties tiene slug');
select col_is_unique('public', 'properties', 'slug', 'el slug es único');
select has_column('public', 'property_overview', 'slug', 'la vista pública expone el slug');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1000000-0000-4000-8000-000000000001', 'admin.catalogo@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1000000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a7000000-0000-4000-8000-000000000001', 'Casa Azul', 'Propiedad publicada de prueba.', 120, 'CO', 'La Guajira', 'Palomino'),
  ('a7000000-0000-4000-8000-000000000002', 'Casa Azul', 'Otra con el mismo nombre.', 90, 'CO', 'Bolívar', 'Cartagena'),
  ('a7000000-0000-4000-8000-000000000003', 'Loft Ñandú Café', 'Borrador que no debe verse.', 60, 'CO', 'Bolívar', 'Cartagena');

select is(
  (select slug from public.properties where id = 'a7000000-0000-4000-8000-000000000001'),
  'casa-azul', 'RF-02.1 · el slug nace del nombre');
select is(
  (select slug from public.properties where id = 'a7000000-0000-4000-8000-000000000002'),
  'casa-azul-2', 'RF-02.1 · un nombre repetido recibe sufijo para seguir siendo único');
select is(
  (select slug from public.properties where id = 'a7000000-0000-4000-8000-000000000003'),
  'loft-nandu-cafe', 'RF-02.1 · el slug va sin acentos ni eñes, apto para URL');

select public.fraccionar_propiedad('a7000000-0000-4000-8000-000000000001', array[180000000::bigint]);
update public.properties set visibility = 'published', coming_soon = false
  where id = 'a7000000-0000-4000-8000-000000000001';

-- ── CA-01.1 · el Visitante solo ve lo publicado ─────────────────────────────
set local role anon;
set local request.jwt.claim.sub = '';

select is(
  (select count(*) from public.property_overview where id in (
    'a7000000-0000-4000-8000-000000000001',
    'a7000000-0000-4000-8000-000000000002',
    'a7000000-0000-4000-8000-000000000003')),
  1::bigint, 'CA-01.1 · RF-01.5 · sin sesión solo llega la propiedad publicada');

select is(
  (select (slug, commercial_status, available_fractions::int, lowest_available_price)
     from public.property_overview where id = 'a7000000-0000-4000-8000-000000000001'),
  ('casa-azul'::text, 'fractions_available'::text, 8, 180000000::bigint),
  'CA-01.1 · la fila pública trae slug, estado comercial derivado, disponibles y precio desde');

select is(
  (select count(*) from public.properties where slug = 'loft-nandu-cafe'),
  0::bigint, 'CA-02.2 · un slug en borrador no resuelve para el Visitante: 404');

select is(
  (select count(*) from public.fractions where property_id = 'a7000000-0000-4000-8000-000000000001'),
  8::bigint, 'CA-02.3 · el Visitante lee las fracciones de la publicada para contar disponibles');

select throws_ok(
  $$ update public.properties set name = 'Otra' where id = 'a7000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'RF-01.5 · el Visitante no escribe nada');

reset role;
select * from finish();
rollback;
