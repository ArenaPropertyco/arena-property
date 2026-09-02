-- HU-04 · RF-04.3 y HU-07 · RF-07.1, RF-07.2, RF-07.4 — perfiles y roles.
-- Nivel N2: estructura, disparador de alta, RLS por rol y auditoría de cambios.
begin;
select plan(32);

-- ── Estructura (T-021) ───────────────────────────────────────────────────────
select has_table('public', 'profiles', 'existe profiles');
select has_table('public', 'user_roles', 'existe user_roles');
select has_type('public', 'app_role', 'existe el tipo app_role');

select is((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), true,
  'profiles nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass), true,
  'profiles fuerza RLS también al dueño');
select is((select relrowsecurity from pg_class where oid = 'public.user_roles'::regclass), true,
  'user_roles nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.user_roles'::regclass), true,
  'user_roles fuerza RLS también al dueño');

select has_function('private', 'roles_efectivos', 'la resolución de roles vive en el esquema privado');
select hasnt_function('public', 'roles_efectivos', 'y ya no está expuesta en public');

-- ── Alta: el registro crea perfil y rol Usuario por disparador (RF-04.3) ────
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-4000-8000-000000000001', 'ana@ejemplo.com',
        '{"referral_code": "ARENA-7K2Q"}'::jsonb);

select is(
  (select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-04.3 · al registrarse nace el perfil');

select is(
  (select status::text from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'active', 'el perfil nace activo');

select is(
  (select array_agg(role::text) from public.user_roles where user_id = 'a0000000-0000-4000-8000-000000000001'),
  array['user'], 'CA-04.2 · el perfil creado tiene rol Usuario y ningún otro');

select is(
  (select referred_by_code from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'ARENA-7K2Q', 'RF-04.4 · el código de referido del registro queda persistido en el perfil');

-- Un segundo registro sin código.
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000002', 'sofia@ejemplo.com');
select is(
  (select referred_by_code from public.profiles where id = 'a0000000-0000-4000-8000-000000000002'),
  null, 'sin código de referido el perfil queda sin atribución pendiente');

-- ── Superadmin de prueba, otorgado por el sistema ───────────────────────────
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-00000000000a', 'super@arena.co');
insert into public.user_roles (user_id, role) values ('a0000000-0000-4000-8000-00000000000a', 'superadmin');

-- ── Resolución de roles para quien consulta ─────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-000000000001';

select is(private.roles_efectivos(), array['user']::public.app_role[],
  'roles_efectivos() devuelve los roles de la cuenta que consulta');
select is(private.es_superadmin(), false, 'un Usuario no es Superadmin');

-- ── RLS de user_roles: lectura propia, escritura solo Superadmin ────────────
select is(
  (select count(*) from public.user_roles),
  1::bigint, 'RF-07.2 · un usuario solo lee sus propios roles');

select throws_ok(
  $$ insert into public.user_roles (user_id, role)
     values ('a0000000-0000-4000-8000-000000000001', 'superadmin') $$,
  '42501', null,
  'CA-05.1 / RF-07.3 · un Usuario no puede otorgarse roles');

-- ── RLS de profiles: propio sí, ajeno no ────────────────────────────────────
select is(
  (select count(*) from public.profiles),
  1::bigint, 'un usuario solo lee su propio perfil');

select lives_ok(
  $$ update public.profiles set full_name = 'Ana Pérez'
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'un usuario edita sus propios datos');

select throws_ok(
  $$ update public.profiles set status = 'suspended', suspension_kind = 'administrative',
       suspension_reason = 'me suspendo yo'
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  'P0001', null,
  'RF-33.6 · solo el Superadmin cambia el estado de una cuenta');

-- ── El Superadmin otorga y retira roles, y queda auditado (RF-07.4) ─────────
set local request.jwt.claim.sub = 'a0000000-0000-4000-8000-00000000000a';

select is(private.es_superadmin(), true, 'el Superadmin se reconoce');

select is(
  (select count(*) from public.profiles
    where id in ('a0000000-0000-4000-8000-000000000001',
                 'a0000000-0000-4000-8000-000000000002',
                 'a0000000-0000-4000-8000-00000000000a')),
  3::bigint, 'el Superadmin lee los perfiles ajenos, no solo el suyo');

select lives_ok(
  $$ insert into public.user_roles (user_id, role, granted_by)
     values ('a0000000-0000-4000-8000-000000000002', 'property_admin',
             'a0000000-0000-4000-8000-00000000000a') $$,
  'RF-07.3 · el Superadmin otorga un rol');

select is(
  (select count(*) from public.audit_log
    where action = 'user_role.creada'
      and actor_id = 'a0000000-0000-4000-8000-00000000000a'
      and next_state->>'user_id' = 'a0000000-0000-4000-8000-000000000002'
      and next_state->>'role' = 'property_admin'),
  1::bigint,
  'CA-07.3 · el cambio de rol deja registro con quién, a quién, qué rol y cuándo');

select lives_ok(
  $$ delete from public.user_roles
     where user_id = 'a0000000-0000-4000-8000-000000000002' and role = 'property_admin' $$,
  'el Superadmin retira un rol');

select is(
  (select count(*) from public.audit_log
    where action = 'user_role.eliminada'
      and actor_id = 'a0000000-0000-4000-8000-00000000000a'
      and previous_state->>'user_id' = 'a0000000-0000-4000-8000-000000000002'),
  1::bigint, 'RF-07.4 · retirar un rol también queda auditado');

-- ── Acumulación de roles (RF-07.1, CA-07.4) ─────────────────────────────────
insert into public.user_roles (user_id, role, granted_by)
values ('a0000000-0000-4000-8000-000000000001', 'owner', 'a0000000-0000-4000-8000-00000000000a');

select lives_ok(
  $$ insert into public.user_roles (user_id, role, granted_by)
     values ('a0000000-0000-4000-8000-000000000001', 'ambassador',
             'a0000000-0000-4000-8000-00000000000a') $$,
  'CA-07.4 · un Propietario puede inscribirse como Embajador');

select is(
  (select array_agg(role::text order by role::text) from public.user_roles
    where user_id = 'a0000000-0000-4000-8000-000000000001'),
  array['ambassador', 'owner', 'user'],
  'CA-07.4 · conserva ambos roles');

select throws_ok(
  $$ insert into public.user_roles (user_id, role, granted_by)
     values ('a0000000-0000-4000-8000-00000000000a', 'ambassador',
             'a0000000-0000-4000-8000-00000000000a') $$,
  'P0001', null,
  'RF-07.1 · Embajador no se acumula con Superadmin');

select throws_ok(
  $$ insert into public.user_roles (user_id, role, granted_by)
     values ('a0000000-0000-4000-8000-000000000001', 'owner',
             'a0000000-0000-4000-8000-00000000000a') $$,
  '23505', null,
  'un rol no se otorga dos veces a la misma cuenta');

reset role;

-- ── Suspensión coherente: sin motivo y tipo no hay suspensión (RF-33.1/33.3) ─
select throws_ok(
  $$ update public.profiles set status = 'suspended'
     where id = 'a0000000-0000-4000-8000-000000000002' $$,
  '23514', null,
  'CA-33.1 · una suspensión sin motivo ni tipo se rechaza en la base');

select * from finish();
rollback;
