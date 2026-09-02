-- HU-04 · RF-04.2 — la verificación del correo es un dato de la base, no del JWT.
--
-- Por qué no basta el token: los claims no traen `email_confirmed_at`, solo
-- `user_metadata.email_verified`, y `user_metadata` lo edita el propio usuario. Usarlo
-- para decidir acceso sería dejar que cualquiera se declare verificado. La fuente de
-- verdad es `auth.users.email_confirmed_at`, reflejada en `profiles.email_verified`
-- por disparador y protegida contra escritura del cliente.
begin;
select plan(9);

select has_column('public', 'profiles', 'email_verified',
  'RF-04.2 · el perfil registra si el correo está verificado');
select col_not_null('public', 'profiles', 'email_verified',
  'nunca es nulo: o está verificado o no lo está');

-- ── Alta sin confirmar ──────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-000000000001', 'sin-verificar@ejemplo.com');

select is(
  (select email_verified from public.profiles where id = 'e0000000-0000-4000-8000-000000000001'),
  false, 'una cuenta recién registrada nace sin verificar');

-- ── Al confirmar el correo, el perfil se entera ─────────────────────────────
update auth.users set email_confirmed_at = now()
 where id = 'e0000000-0000-4000-8000-000000000001';

select is(
  (select email_verified from public.profiles where id = 'e0000000-0000-4000-8000-000000000001'),
  true, 'RF-04.2 · confirmar el correo marca el perfil como verificado');

-- ── Alta ya confirmada (invitación, alta administrativa) ────────────────────
insert into auth.users (id, email, email_confirmed_at) values
  ('e0000000-0000-4000-8000-000000000002', 'invitado@ejemplo.com', now());

select is(
  (select email_verified from public.profiles where id = 'e0000000-0000-4000-8000-000000000002'),
  true, 'una cuenta creada ya confirmada nace verificada');

-- Una cuenta sin verificar que luego intentará declararse verificada.
insert into auth.users (id, email) values
  ('e0000000-0000-4000-8000-000000000003', 'impaciente@ejemplo.com');

-- ── El cliente no puede declararse verificado ───────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ update public.profiles set full_name = 'Persona' where id = 'e0000000-0000-4000-8000-000000000001' $$,
  'el usuario sigue pudiendo editar sus propios datos');

set local request.jwt.claim.sub = 'e0000000-0000-4000-8000-000000000003';

select throws_ok(
  $$ update public.profiles set email_verified = true
     where id = 'e0000000-0000-4000-8000-000000000003' $$,
  'P0001', null,
  'RF-04.2 · nadie puede marcarse a sí mismo como verificado');

reset role;

-- Un correo revocado vuelve a dejar la cuenta sin verificar.
update auth.users set email_confirmed_at = null
 where id = 'e0000000-0000-4000-8000-000000000002';

select is(
  (select email_verified from public.profiles where id = 'e0000000-0000-4000-8000-000000000002'),
  false, 'si se revoca la confirmación, el perfil deja de estar verificado');

-- El correo del perfil sigue al de la cuenta (los listados lo muestran).
update auth.users set email = 'nuevo@ejemplo.com'
 where id = 'e0000000-0000-4000-8000-000000000001';

select is(
  (select email from public.profiles where id = 'e0000000-0000-4000-8000-000000000001'),
  'nuevo@ejemplo.com', 'el correo del perfil sigue al de la cuenta');

select * from finish();
rollback;
