-- HU-46 · RF-46.5 y HU-03 · RF-03.4 — las solicitudes de contacto se persisten
-- desde el servidor y solo las leen el Superadmin y el Administrador de la
-- propiedad asociada.
begin;
select plan(11);

select has_table('public', 'contact_requests', 'existe contact_requests');
select is((select relrowsecurity from pg_class where oid = 'public.contact_requests'::regclass), true,
  'contact_requests nace con RLS');
select ok(not has_table_privilege('anon', 'public.contact_requests', 'INSERT'),
  'RF-46.5 · el Visitante no inserta directo: pasa por la ruta Nitro con límite de tasa (D-24)');
select ok(not has_table_privilege('anon', 'public.contact_requests', 'SELECT'),
  'el Visitante no lee solicitudes');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c4600000-0000-4000-8000-00000000000a', 'super.contacto@arena.co', '{}'),
  ('c4600000-0000-4000-8000-000000000001', 'admin1.contacto@arena.co', '{}'),
  ('c4600000-0000-4000-8000-000000000002', 'admin2.contacto@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c4600000-0000-4000-8000-00000000000a', 'superadmin'),
  ('c4600000-0000-4000-8000-000000000001', 'property_admin'),
  ('c4600000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c4600000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a4600000-0000-4000-8000-000000000001', 'Casa Contacto', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');

-- ── RF-46.5 · el servidor persiste ──────────────────────────────────────────
set local role service_role;
select lives_ok(
  $$ insert into public.contact_requests
       (id, first_name, last_name, email, phone, message, intent, property_type, income_range, referral_code)
     values ('e4600000-0000-4000-8000-000000000001', 'Ana', 'Gómez', 'Ana@Ejemplo.com', '+57 310', 'Hola',
             'investment', 'vacation', 'over_7m', ' luis-2026 ') $$,
  'RF-46.5 · el servidor persiste la solicitud general');

select lives_ok(
  $$ insert into public.contact_requests
       (id, property_id, first_name, last_name, email, phone, message, intent)
     values ('e4600000-0000-4000-8000-000000000002', 'a4600000-0000-4000-8000-000000000001',
             'Luis', 'Pérez', 'luis@ejemplo.com', '+57 311', 'Quiero visitarla', 'truly_mine') $$,
  'CA-03.2 · la solicitud desde la ficha queda vinculada a la propiedad con su intención');

select is(
  (select (email, referral_code) from public.contact_requests where id = 'e4600000-0000-4000-8000-000000000001'),
  ('ana@ejemplo.com'::text, 'LUIS-2026'::text),
  'correo en minúsculas y código de referido normalizado');

select throws_ok(
  $$ insert into public.contact_requests (first_name, last_name, email, phone, message, intent)
     values ('X', 'Y', 'x@y.co', '1', 'm', 'otra') $$,
  '23514', null, 'CA-03.3 · una intención fuera de las 4 de RF-03.2 se rechaza');

-- ── Lectura: Superadmin todo; Administrador, lo de su propiedad ─────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c4600000-0000-4000-8000-00000000000a';
select is((select count(*) from public.contact_requests where id::text like 'e4600000-%'), 2::bigint,
  'el Superadmin lee todas las solicitudes');

set local request.jwt.claim.sub = 'c4600000-0000-4000-8000-000000000001';
select is((select count(*) from public.contact_requests where id::text like 'e4600000-%'), 1::bigint,
  'RF-03.4 · el Administrador asignado lee solo las solicitudes de su propiedad');

set local request.jwt.claim.sub = 'c4600000-0000-4000-8000-000000000002';
select is((select count(*) from public.contact_requests where id::text like 'e4600000-%'), 0::bigint,
  'un Administrador ajeno no lee ninguna');

reset role;
select * from finish();
rollback;
