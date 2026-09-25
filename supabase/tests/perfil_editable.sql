-- Perfil editable — la propia cuenta cambia nombre, teléfono e idioma; el
-- Superadmin, los de cualquiera. El correo, la identidad y la suspensión no se
-- tocan desde el perfil, y `tengo_contrasena()` distingue las cuentas de Google.
begin;
select plan(16);

select has_function('public', 'tengo_contrasena', 'existe tengo_contrasena');

insert into auth.users (id, email, encrypted_password) values
  ('9e000000-0000-4000-8000-000000000001', 'perfil.propio@ejemplo.com', crypt('clave1234', gen_salt('bf'))),
  ('9e000000-0000-4000-8000-000000000002', 'perfil.google@ejemplo.com', null),
  ('9e000000-0000-4000-8000-000000000003', 'perfil.super@ejemplo.com', crypt('clave1234', gen_salt('bf')));
insert into public.user_roles (user_id, role) values ('9e000000-0000-4000-8000-000000000003', 'superadmin');

-- ── La propia cuenta ────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '9e000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ update public.profiles set full_name = 'Ana Ruiz', phone = '+57 300 123 4567', locale = 'en'
      where id = '9e000000-0000-4000-8000-000000000001' $$,
  'la cuenta cambia su nombre, teléfono e idioma');
select is(
  (select full_name || ' · ' || phone || ' · ' || locale from public.profiles where id = '9e000000-0000-4000-8000-000000000001'),
  'Ana Ruiz · +57 300 123 4567 · en', 'y los cambios quedan guardados');
select throws_like(
  $$ update public.profiles set email = 'otro@ejemplo.com' where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%PERFIL-CORREO%', 'el correo no se cambia desde el perfil');
select throws_like(
  $$ update public.profiles set created_at = now() - interval '1 year' where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%PERFIL-IDENTIDAD%', 'la fecha de alta no cambia');
select throws_like(
  $$ update public.profiles set phone = '300-ABC' where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%PERFIL-TELEFONO%', 'un teléfono con letras se rechaza');
select throws_like(
  $$ update public.profiles set full_name = repeat('a', 121) where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%PERFIL-NOMBRE%', 'un nombre de más de 120 caracteres se rechaza');
select throws_like(
  $$ update public.profiles set avatar_url = 'javascript:alert(1)' where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%PERFIL-AVATAR%', 'un avatar que no es https se rechaza');
select throws_like(
  $$ update public.profiles set suspension_reason = 'nada' where id = '9e000000-0000-4000-8000-000000000001' $$,
  '%Superadmin%', 'la suspensión no se toca desde el perfil propio');

-- RLS · una cuenta no alcanza el perfil de otra.
update public.profiles set full_name = 'Intruso' where id = '9e000000-0000-4000-8000-000000000002';
reset role;
select is(
  (select full_name from public.profiles where id = '9e000000-0000-4000-8000-000000000002'),
  null, 'una cuenta no edita el perfil de otra');

-- ── ¿Tiene contraseña? ──────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '9e000000-0000-4000-8000-000000000001';
select is(public.tengo_contrasena(), true, 'la cuenta con contraseña lo sabe');
set local request.jwt.claim.sub = '9e000000-0000-4000-8000-000000000002';
select is(public.tengo_contrasena(), false, 'la cuenta creada con Google no tiene contraseña');
reset role;
select is(
  has_function_privilege('anon', 'public.tengo_contrasena()', 'execute'),
  false, 'un visitante sin sesión no la llama');

-- ── El Superadmin ───────────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = '9e000000-0000-4000-8000-000000000003';
select lives_ok(
  $$ update public.profiles set full_name = 'Beto Google', phone = '3001234567', locale = 'en'
      where id = '9e000000-0000-4000-8000-000000000002' $$,
  'el Superadmin edita el nombre, teléfono e idioma de cualquier cuenta');
select throws_like(
  $$ update public.profiles set email = 'nuevo@ejemplo.com' where id = '9e000000-0000-4000-8000-000000000002' $$,
  '%PERFIL-CORREO%', 'ni el Superadmin escribe el correo en el perfil: va por la cuenta de acceso');
reset role;
select is(
  (select count(*) from public.audit_log
    where action = 'profile.actualizada' and entity_id = '9e000000-0000-4000-8000-000000000002'
      and actor_id = '9e000000-0000-4000-8000-000000000003'),
  1::bigint, 'TR-01 · la edición del Superadmin queda auditada con su autoría');

select * from finish();
rollback;
