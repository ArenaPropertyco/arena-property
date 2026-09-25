-- HU-61 · RF-61.2, RF-61.4, RF-61.5, RF-61.6, RF-61.7 — alta, vinculación,
-- atribución de referido y datos de presentación al ingresar con Google.
-- Nivel N2: la creación de cuenta y el ingreso reales solo se verifican con
-- credenciales de Google en vivo (ver HU61-spec.md); aquí se prueba el mecanismo del
-- que depende esa atribución, simulando la cuenta como ya lo hace hu07_roles.sql.
begin;
select plan(26);

select has_function('public', 'aplicar_atribucion_referido', array['text'],
  'existe la función de atribución, expuesta por RPC');
select has_function('private', 'proteger_referido', 'existe la guarda de escritura única');
select has_column('public', 'profiles', 'avatar_url', 'RF-61.7 · el perfil guarda el avatar del proveedor');

-- ── CA-61.1 · CA-61.6 · alta por Google: el mismo perfil que por correo ─────
-- Así crea Supabase Auth la cuenta de Google: correo ya confirmado y los datos de
-- la identidad en `raw_user_meta_data`.
insert into auth.users (id, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000061', 'google.nuevo@ejemplo.com', now(),
   '{"provider": "google", "providers": ["google"]}',
   '{"full_name": "Ana Google", "avatar_url": "https://lh3.googleusercontent.com/a/ana", "email_verified": true}');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-061', '90000000-0000-4000-8000-000000000061', '{"sub": "g-061", "email": "google.nuevo@ejemplo.com"}', 'google');

select is(
  (select array_agg(role::text order by role) from public.user_roles where user_id = '90000000-0000-4000-8000-000000000061'),
  array['user'], 'CA-61.1 · el alta por Google nace con el rol Usuario y ninguno más');
select is(
  (select status::text from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'active', 'CA-61.1 · el perfil nace activo');
select is(
  (select email_verified from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  true, 'CA-61.1 · D-34 · el correo llega verificado desde Google');
select is(
  (select full_name from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'Ana Google', 'CA-61.6 · el alta guarda el nombre de Google');
select is(
  (select avatar_url from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'https://lh3.googleusercontent.com/a/ana', 'CA-61.6 · el alta guarda el avatar de Google');
select is(
  (select count(*) from public.audit_log where action = 'profile.identidad_vinculada' and entity_id = '90000000-0000-4000-8000-000000000061'),
  0::bigint, 'CA-61.1 · la primera identidad de una cuenta nueva no es una vinculación');

-- Un ingreso posterior con el nombre cambiado en Google: Auth reescribe los metadatos.
update auth.users
   set raw_user_meta_data = '{"full_name": "Ana María Google", "avatar_url": "https://lh3.googleusercontent.com/a/ana2"}'
 where id = '90000000-0000-4000-8000-000000000061';
select is(
  (select full_name from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'Ana María Google', 'CA-61.6 · un ingreso posterior refleja el nombre nuevo');
select is(
  (select avatar_url from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'https://lh3.googleusercontent.com/a/ana2', 'CA-61.6 · y el avatar nuevo');

-- Metadatos sin nombre (u otro cambio cualquiera) no borran lo que había.
update auth.users set raw_user_meta_data = '{"locale": "en"}' where id = '90000000-0000-4000-8000-000000000061';
select is(
  (select full_name from public.profiles where id = '90000000-0000-4000-8000-000000000061'),
  'Ana María Google', 'RF-61.7 · sin nombre en los metadatos se conserva el anterior');

-- RF-61.8 · un avatar que no es https no se guarda.
insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000062', 'avatar.raro@ejemplo.com', '{"name": "Beto", "picture": "javascript:alert(1)"}');
select is(
  (select avatar_url from public.profiles where id = '90000000-0000-4000-8000-000000000062'),
  null, 'RF-61.8 · solo se aceptan avatares por https');
select is(
  (select full_name from public.profiles where id = '90000000-0000-4000-8000-000000000062'),
  'Beto', 'RF-61.7 · el nombre también se lee de `name`');

-- ── CA-61.2 · correo con cuenta de contraseña que entra con Google ──────────
-- Auth no crea otro usuario: añade la identidad de Google al existente.
insert into auth.users (id, email, email_confirmed_at) values
  ('90000000-0000-4000-8000-000000000063', 'ya.tengo.cuenta@ejemplo.com', now());
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('90000000-0000-4000-8000-000000000063', '90000000-0000-4000-8000-000000000063', '{"sub": "90000000-0000-4000-8000-000000000063", "email": "ya.tengo.cuenta@ejemplo.com"}', 'email');
insert into auth.identities (provider_id, user_id, identity_data, provider) values
  ('g-063', '90000000-0000-4000-8000-000000000063', '{"sub": "g-063", "email": "ya.tengo.cuenta@ejemplo.com"}', 'google');
select is(
  (select count(*) from public.profiles where email = 'ya.tengo.cuenta@ejemplo.com'),
  1::bigint, 'CA-61.2 · la identidad de Google se vincula y no nace un segundo perfil');
select is(
  (select count(*) from public.user_roles where user_id = '90000000-0000-4000-8000-000000000063'),
  1::bigint, 'CA-61.2 · ni un segundo juego de roles');
select is(
  (select reason from public.audit_log where action = 'profile.identidad_vinculada' and entity_id = '90000000-0000-4000-8000-000000000063'),
  'Identidad de google vinculada a la cuenta existente', 'RF-61.4 · TR-01 · la vinculación queda auditada');

-- ── Cuenta de prueba, sin atribución todavía ────────────────────────────────
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000001', 'visitante@ejemplo.com');

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';

-- ── CA-61.3 · el código guardado en la cookie se aplica al volver de Google ──
-- La cuenta de Google nace sin código (el proveedor no lo transporta); al volver,
-- la página de retorno lo aplica con la misma función que usa el formulario.
select lives_ok(
  $$ select public.aplicar_atribucion_referido('arena-7k2q') $$,
  'RF-61.5 · aplicar la atribución no lanza error');

select is(
  (select referred_by_code from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'ARENA-7K2Q', 'CA-61.3 · el perfil queda con el código, normalizado como en el formulario');

-- ── CA-61.4 · un perfil ya atribuido no cambia con un segundo código ────────
select lives_ok(
  $$ select public.aplicar_atribucion_referido('otro-codigo') $$,
  'un segundo intento no lanza error: simplemente no hace nada');

select is(
  (select referred_by_code from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'ARENA-7K2Q', 'CA-61.4 · la atribución original se conserva');

-- ── RF-61.4 · queda auditado como cualquier otro cambio de perfil ───────────
-- La lectura del registro es por rol (RF-A.6): un Visitante no ve su propia entrada,
-- así que se comprueba sin RLS, igual que hace tr01_lectura.sql para lo mismo.
reset role;
select is(
  (select count(*) from public.audit_log
    where action = 'profile.actualizada'
      and entity_id = '90000000-0000-4000-8000-000000000001'
      and next_state->>'referred_by_code' = 'ARENA-7K2Q'),
  1::bigint, 'el cambio de atribución queda en el registro de auditoría (TR-01)');

-- ── Código vacío o solo espacios: no hay nada que aplicar ───────────────────
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000002', 'otro@ejemplo.com');
set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000002';

select lives_ok(
  $$ select public.aplicar_atribucion_referido('   ') $$,
  'un código en blanco no lanza error');

select is(
  (select referred_by_code from public.profiles where id = '90000000-0000-4000-8000-000000000002'),
  null, 'y no deja atribución');

-- ── CA-61.5 · nadie se auto-refiere escribiendo la columna directo ──────────
select throws_ok(
  $$ update public.profiles set referred_by_code = 'ARENA-9Z9Z'
     where id = '90000000-0000-4000-8000-000000000002' $$,
  'P0001', null,
  'CA-61.5 · un intento directo de escribir la atribución se rechaza');

-- El intento fallido no dejó rastro.
select is(
  (select referred_by_code from public.profiles where id = '90000000-0000-4000-8000-000000000002'),
  null, 'la columna sigue vacía tras el intento rechazado');

reset role;
select * from finish();
rollback;
