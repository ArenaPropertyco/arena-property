-- HU-11 · RF-11.1…RF-11.4 — editar e inactivar, nunca eliminar.
-- Nivel N2: la ausencia de borrado es una propiedad de la base, no una omisión
-- de la interfaz que la próxima ruta pueda deshacer.
begin;
select plan(14);

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('a8000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('a8000000-0000-4000-8000-000000000001', 'admin1@arena.co'),
  ('a8000000-0000-4000-8000-000000000002', 'admin2@arena.co');
insert into public.user_roles (user_id, role) values
  ('a8000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('a8000000-0000-4000-8000-000000000001', 'property_admin'),
  ('a8000000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'a8000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a4000000-0000-4000-8000-000000000001', 'Casa de A1', 'Propiedad de prueba.', 100, 'CO', 'La Guajira', 'Palomino');
insert into public.property_media (property_id, kind, path) values
  ('a4000000-0000-4000-8000-000000000001', 'photo', 'a4000000-0000-4000-8000-000000000001/photo/uno.jpg');
select public.fraccionar_propiedad('a4000000-0000-4000-8000-000000000001', array[100000000::bigint]);

update public.properties set visibility = 'published' where id = 'a4000000-0000-4000-8000-000000000001';

-- ── CA-11.1 · el Administrador no elimina ───────────────────────────────────
-- RLS no lanza error en DELETE: simplemente no le entrega ninguna fila que borrar.
-- Que la operación «no explote» y aun así no borre nada es exactamente el rechazo.
select lives_ok(
  $$ delete from public.properties where id = 'a4000000-0000-4000-8000-000000000001' $$,
  'el intento de borrado del Administrador no explota…');

select is(
  (select count(*) from public.properties where id = 'a4000000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-11.1 · …y la propiedad sigue ahí: RLS rechaza el borrado del Administrador');

select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and tablename = 'properties' and cmd = 'DELETE'
       and qual not like '%es_superadmin%' $$,
  'RF-11.2 · la única política de borrado que existe es la del Superadmin');

select ok(not has_table_privilege('authenticated', 'public.fractions', 'DELETE'),
  'RF-11.2 · borrar la propiedad tampoco es posible por la puerta de las fracciones');

-- ── CA-11.3 · un Administrador sin la propiedad asignada no la edita ────────
set local request.jwt.claim.sub = 'a8000000-0000-4000-8000-000000000002';

select is(
  (select count(*) from public.properties
    where id = 'a4000000-0000-4000-8000-000000000001' and visibility = 'published'),
  1::bigint, 'el otro Administrador ve la propiedad publicada, porque es pública');

select lives_ok(
  $$ update public.properties set name = 'Secuestrada'
      where id = 'a4000000-0000-4000-8000-000000000001' $$,
  'su intento de edición no explota…');

select is(
  (select name from public.properties where id = 'a4000000-0000-4000-8000-000000000001'),
  'Casa de A1',
  'CA-11.3 · …pero no cambia nada: sin asignación no edita');

select throws_ok(
  $$ insert into public.property_media (property_id, kind, path)
     values ('a4000000-0000-4000-8000-000000000001', 'photo',
             'a4000000-0000-4000-8000-000000000001/photo/intrusa.jpg') $$,
  '42501', null, 'CA-11.3 · tampoco le añade medios');

-- ── RF-11.1 · el Administrador asignado sí edita la ficha completa ──────────
set local request.jwt.claim.sub = 'a8000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ update public.properties
        set name = 'Casa de A1, renovada', bedrooms = 5, amenities = array['Piscina', 'Wifi']
      where id = 'a4000000-0000-4000-8000-000000000001' $$,
  'RF-11.1 · el Administrador asignado edita la ficha de su propiedad');

-- ── CA-11.2 · inactivar conserva el histórico y retira del catálogo ─────────
select lives_ok(
  $$ update public.properties set visibility = 'inactive'
      where id = 'a4000000-0000-4000-8000-000000000001' $$,
  'RF-11.3 · la baja es lógica: `inactive`');

select is(
  (select count(*) from public.property_media
    where property_id = 'a4000000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-11.2 · los medios de la propiedad siguen consultables tras inactivarla');

select is(
  (select count(*) from public.fractions
    where property_id = 'a4000000-0000-4000-8000-000000000001'),
  8::bigint, 'CA-11.2 · sus 8 fracciones siguen ahí, con su histórico de titularidad');

select ok(
  (select count(*) from public.audit_log
    where property_id = 'a4000000-0000-4000-8000-000000000001') > 0,
  'CA-11.2 · TR-01 · el registro de auditoría de la propiedad se conserva entero');

-- RF-11.3 · pero deja de estar en el catálogo público.
set local role anon;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.properties where id = 'a4000000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-11.3 · inactivar la retira del catálogo público');

reset role;
select * from finish();
rollback;
