-- HU-04 · RF-04.4 y CA-04.3 — la atribución de referido al registrarse.
-- Nivel N2: lo que la base persiste según el código que trae el registro, con el
-- formulario delante o sin él (HU-61 llega por cookie, otro cliente por metadatos).
begin;
select plan(8);

select has_function('private', 'normalizar_codigo_referido', array['text'],
  'existe la regla de formato del código en la base');

select is(private.normalizar_codigo_referido(' arena-7k2q '), 'ARENA-7K2Q',
  'CA-04.3 · un código válido se normaliza a mayúsculas y sin espacios');
select is(private.normalizar_codigo_referido('!!'), null,
  'CA-04.3 · un código con formato inválido no produce atribución');
select is(private.normalizar_codigo_referido('   '), null,
  'sin código no hay atribución');

-- ── Registro con código válido, inválido y sin código ───────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c4000000-0000-4000-8000-000000000001', 'valido@ejemplo.com', '{"referral_code": " arena-7k2q "}'),
  ('c4000000-0000-4000-8000-000000000002', 'invalido@ejemplo.com', '{"referral_code": "!!"}'),
  ('c4000000-0000-4000-8000-000000000003', 'sin@ejemplo.com', '{}');

select is(
  (select referred_by_code from public.profiles where id = 'c4000000-0000-4000-8000-000000000001'),
  'ARENA-7K2Q', 'CA-04.3 · con código válido, la atribución queda persistida normalizada en el perfil');

select is(
  (select (referred_by_code, true) from public.profiles where id = 'c4000000-0000-4000-8000-000000000002'),
  (null::text, true), 'CA-04.3 · con código inválido, el registro procede y el perfil nace sin atribución');

select is(
  (select count(*) from public.user_roles
    where user_id in ('c4000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000002')
      and role = 'user'),
  2::bigint, 'RF-04.3 · en los dos casos la cuenta obtiene el rol Usuario: el código nunca bloquea el registro');

-- HU-61 · la atribución que llega por cookie respeta la misma regla de formato.
set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000003';
select public.aplicar_atribucion_referido('!!');
select is(
  (select referred_by_code from public.profiles where id = 'c4000000-0000-4000-8000-000000000003'),
  null, 'CA-04.3 · un código inválido tampoco se aplica por la vía de Google (HU-61)');

reset role;
select * from finish();
rollback;
