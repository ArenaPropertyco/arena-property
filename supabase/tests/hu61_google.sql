-- HU-61 · RF-61.5, RF-61.6 — atribución de referido tras ingresar con Google.
-- Nivel N2: la creación de cuenta y el ingreso reales solo se verifican con
-- credenciales de Google en vivo (ver HU61-spec.md); aquí se prueba el mecanismo del
-- que depende esa atribución, simulando la cuenta como ya lo hace hu07_roles.sql.
begin;
select plan(11);

select has_function('public', 'aplicar_atribucion_referido', array['text'],
  'existe la función de atribución, expuesta por RPC');
select has_function('private', 'proteger_referido', 'existe la guarda de escritura única');

-- ── Cuenta de prueba, sin atribución todavía ────────────────────────────────
insert into auth.users (id, email) values
  ('90000000-0000-4000-8000-000000000001', 'visitante@ejemplo.com');

set local role authenticated;
set local request.jwt.claim.sub = '90000000-0000-4000-8000-000000000001';

-- ── CA-61.3 (mecanismo) · aplicar un código a un perfil sin atribución ──────
select lives_ok(
  $$ select public.aplicar_atribucion_referido('arena-7k2q') $$,
  'RF-61.5 · aplicar la atribución no lanza error');

select is(
  (select referred_by_code from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'ARENA-7K2Q', 'el código queda normalizado en mayúsculas');

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
