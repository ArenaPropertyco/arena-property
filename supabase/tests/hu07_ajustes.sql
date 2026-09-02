-- HU-07 · RF-07.3 — ajustes de la matriz de permisos, solo del Superadmin.
-- Nivel N2: quién escribe, quién lee y que todo cambio quede auditado (RF-07.4).
begin;
select plan(16);

select has_table('public', 'role_capabilities', 'existe la tabla de ajustes de capacidades');
select is((select relrowsecurity from pg_class where oid = 'public.role_capabilities'::regclass), true,
  'nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.role_capabilities'::regclass), true,
  'RLS forzada también al dueño');
select col_is_pk('public', 'role_capabilities', array['capability', 'role'],
  'una sola fila por celda de la matriz');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('f0000000-0000-4000-8000-000000000001', 'admin@arena.co'),
  ('f0000000-0000-4000-8000-000000000002', 'usuario@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('f0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('f0000000-0000-4000-8000-000000000001', 'property_admin');

-- ── Solo el Superadmin ajusta ───────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000002';

select throws_ok(
  $$ insert into public.role_capabilities (capability, role, scope)
     values ('administrar_usuarios_y_roles', 'user', 'si') $$,
  '42501', null, 'RF-07.3 · un Usuario no puede ajustar la matriz');

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ insert into public.role_capabilities (capability, role, scope)
     values ('administrar_usuarios_y_roles', 'property_admin', 'si') $$,
  '42501', null, 'RF-07.3 · un Administrador tampoco: no puede ampliarse a sí mismo');

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000a';

select lives_ok(
  $$ insert into public.role_capabilities (capability, role, scope, updated_by)
     values ('gestionar_inventario', 'owner', 'si', 'f0000000-0000-4000-8000-00000000000a') $$,
  'RF-07.3 · el Superadmin ajusta una celda');

-- ── Todo ajuste queda auditado (RF-07.4) ────────────────────────────────────
select is(
  (select count(*) from public.audit_log
    where action = 'role_capability.creada'
      and actor_id = 'f0000000-0000-4000-8000-00000000000a'
      and next_state->>'capability' = 'gestionar_inventario'
      and next_state->>'scope' = 'si'),
  1::bigint, 'CA-07.3 · el ajuste queda registrado con autor, capacidad y alcance');

-- ── Reajustar la misma celda actualiza, no duplica ──────────────────────────
select lives_ok(
  $$ insert into public.role_capabilities (capability, role, scope, updated_by)
     values ('gestionar_inventario', 'owner', 'lectura', 'f0000000-0000-4000-8000-00000000000a')
     on conflict (capability, role) do update
        set scope = excluded.scope,
            updated_by = excluded.updated_by,
            updated_at = now() $$,
  'reajustar la misma celda no duplica la fila');

select is(
  (select scope from public.role_capabilities
    where capability = 'gestionar_inventario' and role = 'owner'),
  'lectura', 'queda el último alcance');

select is(
  (select count(*) from public.audit_log
    where action = 'role_capability.actualizada'
      and actor_id = 'f0000000-0000-4000-8000-00000000000a'
      and next_state->>'capability' = 'gestionar_inventario'
      and next_state->>'scope' = 'lectura'),
  1::bigint, 'RF-07.4 · el reajuste también queda auditado');

-- ── Volver a la matriz del VSM es borrar el ajuste ──────────────────────────
select lives_ok(
  $$ delete from public.role_capabilities
     where capability = 'gestionar_inventario' and role = 'owner' $$,
  'el Superadmin puede retirar un ajuste y volver a la matriz base');

select is(
  (select count(*) from public.audit_log
    where action = 'role_capability.eliminada'
      and actor_id = 'f0000000-0000-4000-8000-00000000000a'
      and previous_state->>'capability' = 'gestionar_inventario'),
  1::bigint, 'retirar el ajuste también queda auditado');

-- ── Solo se guardan celdas que existen ──────────────────────────────────────
select throws_ok(
  $$ insert into public.role_capabilities (capability, role, scope)
     values ('gestionar_inventario', 'owner', 'alcance_inventado') $$,
  '23514', null, 'un alcance fuera del vocabulario se rechaza');

select throws_ok(
  $$ insert into public.role_capabilities (capability, role, scope)
     values ('gestionar_inventario', 'rol_inventado', 'si') $$,
  '23514', null, 'una columna que no es rol ni visitante se rechaza');

-- ── Cualquiera con cuenta lee la matriz efectiva: la interfaz la necesita ───
insert into public.role_capabilities (capability, role, scope, updated_by)
values ('enviar_novedades', 'owner', 'si', 'f0000000-0000-4000-8000-00000000000a');

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.role_capabilities
    where capability = 'enviar_novedades' and role = 'owner'),
  1::bigint, 'un usuario con cuenta lee los ajustes para que su interfaz sea coherente');

reset role;
select * from finish();
rollback;
