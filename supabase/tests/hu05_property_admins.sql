-- HU-05 · RF-05.1, RF-05.2, RF-05.3 — asignación administrador ↔ propiedad.
-- Nivel N2: solo el Superadmin asigna; el Administrador ve exactamente lo suyo;
-- retirar no borra histórico.
begin;
select plan(22);

-- ── Estructura (T-032) ───────────────────────────────────────────────────────
select has_table('public', 'property_admins', 'existe property_admins');
select is((select relrowsecurity from pg_class where oid = 'public.property_admins'::regclass), true,
  'property_admins nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.property_admins'::regclass), true,
  'property_admins fuerza RLS al dueño');
select ok(not has_table_privilege('authenticated', 'public.property_admins', 'DELETE'),
  'RF-05.2 · ningún rol de la API puede borrar una asignación: el histórico se conserva');

-- ── Cuentas de prueba ───────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('b0000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('b0000000-0000-4000-8000-000000000001', 'admin@arena.co'),
  ('b0000000-0000-4000-8000-000000000002', 'usuario@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('b0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('b0000000-0000-4000-8000-000000000001', 'property_admin');

-- Propiedades A, B y C de mentira, con la política que HU-08 aplicará a la tabla real.
create table public.prueba_propiedades (id uuid primary key, nombre text);
insert into public.prueba_propiedades values
  ('c0000000-0000-4000-8000-00000000000a', 'A'),
  ('c0000000-0000-4000-8000-00000000000b', 'B'),
  ('c0000000-0000-4000-8000-00000000000c', 'C');
alter table public.prueba_propiedades enable row level security;
grant select on public.prueba_propiedades to authenticated;
create policy prueba_admin_lee_las_suyas on public.prueba_propiedades
  for select to authenticated
  using (private.es_superadmin() or private.administra_propiedad(id));

-- ── CA-05.1 · solo el Superadmin asigna ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000002';

select throws_ok(
  $$ insert into public.property_admins (admin_id, property_id)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'CA-05.1 · un Usuario no puede asignar propiedades');

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select throws_ok(
  $$ insert into public.property_admins (admin_id, property_id)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000a') $$,
  '42501', null, 'CA-05.1 · un Administrador tampoco se asigna propiedades a sí mismo');

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000a';

select lives_ok(
  $$ insert into public.property_admins (admin_id, property_id, assigned_by) values
       ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000a',
        'b0000000-0000-4000-8000-00000000000a'),
       ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000b',
        'b0000000-0000-4000-8000-00000000000a') $$,
  'RF-05.1 · el Superadmin asigna A y B');

select throws_ok(
  $$ insert into public.property_admins (admin_id, property_id)
     values ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-00000000000a') $$,
  'P0001', null, 'solo una cuenta con rol Administrador puede recibir propiedades');

select is(
  (select count(*) from public.audit_log
    where action = 'property_admin.creada'
      and property_id = 'c0000000-0000-4000-8000-00000000000a'
      and actor_id = 'b0000000-0000-4000-8000-00000000000a'),
  1::bigint, 'TR-01 · la asignación queda auditada con su propiedad');

-- ── CA-05.2 · el Administrador ve exactamente A y B ─────────────────────────
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select is(
  (select array_agg(p order by p) from unnest(private.propiedades_administradas()) as p),
  array['c0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000b']::uuid[],
  'CA-05.2 · propiedades_administradas() devuelve exactamente A y B');

select is(
  (select array_agg(nombre order by nombre) from public.prueba_propiedades),
  array['A', 'B'],
  'CA-05.2 · RF-05.3 · al consultar propiedades obtiene exactamente A y B, no C');

select is(
  (select count(*) from public.property_admins),
  2::bigint, 'el Administrador lee sus propias asignaciones');

-- RLS no lanza error en UPDATE: simplemente no le muestra filas que pueda tocar.
select lives_ok(
  $$ update public.property_admins set revoked_at = now() $$,
  'el intento del Administrador de retirar sus asignaciones no explota…');
select is(
  (select count(*) from public.property_admins where revoked_at is not null),
  0::bigint, '…pero no altera ninguna fila: RLS no le deja tocar sus asignaciones');

-- ── CA-05.3 · retirar B sin perder histórico ────────────────────────────────
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000a';

select lives_ok(
  $$ update public.property_admins
        set revoked_at = now(), revoked_by = 'b0000000-0000-4000-8000-00000000000a'
      where admin_id = 'b0000000-0000-4000-8000-000000000001'
        and property_id = 'c0000000-0000-4000-8000-00000000000b' $$,
  'RF-05.2 · el Superadmin retira la asignación de B');

set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-000000000001';

select is(
  (select array_agg(nombre order by nombre) from public.prueba_propiedades),
  array['A'],
  'CA-05.3 · el Administrador deja de ver B');

select is(
  (select count(*) from public.property_admins
    where property_id = 'c0000000-0000-4000-8000-00000000000b' and revoked_at is not null),
  1::bigint, 'CA-05.3 · el histórico de B sigue ahí, marcado como retirado');

select ok(
  private.administra_propiedad('c0000000-0000-4000-8000-00000000000a'),
  'administra_propiedad() reconoce la asignación vigente');
select ok(
  not private.administra_propiedad('c0000000-0000-4000-8000-00000000000b'),
  'administra_propiedad() ignora la asignación retirada');

-- Una asignación retirada puede volver a otorgarse: nueva fila, histórico intacto.
set local request.jwt.claim.sub = 'b0000000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.property_admins (admin_id, property_id, assigned_by)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000b',
             'b0000000-0000-4000-8000-00000000000a') $$,
  'RF-05.2 · puede volver a agregarse sin tocar el histórico');
select is(
  (select count(*) from public.property_admins
    where property_id = 'c0000000-0000-4000-8000-00000000000b'),
  2::bigint, 'quedan las dos filas de B: la retirada y la vigente');

select throws_ok(
  $$ insert into public.property_admins (admin_id, property_id)
     values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-00000000000b') $$,
  '23505', null, 'no puede haber dos asignaciones vigentes de la misma propiedad al mismo administrador');

reset role;
select * from finish();
rollback;
