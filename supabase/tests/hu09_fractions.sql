-- HU-09 · RF-09.1…RF-09.5 — las 8 fracciones, su máquina de estados y el traspaso.
-- Nivel N2: los invariantes que garantiza el motor, no la disciplina de código.
begin;
select plan(37);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'fractions', 'existe fractions');
select is((select relrowsecurity from pg_class where oid = 'public.fractions'::regclass), true,
  'fractions nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.fractions'::regclass), true,
  'fractions fuerza RLS al dueño');
select ok(not has_table_privilege('authenticated', 'public.fractions', 'DELETE'),
  'RF-09.2 · una fracción no se borra: cambia de estado');

-- ── Cuentas y propiedades ───────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-00000000000a', 'super@arena.co'),
  ('f0000000-0000-4000-8000-000000000001', 'admin@arena.co'),
  ('f0000000-0000-4000-8000-000000000002', 'titular1@ejemplo.com'),
  ('f0000000-0000-4000-8000-000000000003', 'titular2@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('f0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('f0000000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2000000-0000-4000-8000-000000000001', 'Casa Uno', 'Propiedad de prueba.', 200, 'CO', 'La Guajira', 'Palomino'),
  ('a2000000-0000-4000-8000-000000000002', 'Casa Dos', 'Propiedad de prueba.', 200, 'CO', 'Magdalena', 'Santa Marta');

-- ── CA-09.1 · fraccionamiento atómico en 8 ──────────────────────────────────
select lives_ok(
  $$ select public.fraccionar_propiedad('a2000000-0000-4000-8000-000000000001', array[180000000::bigint]) $$,
  'RF-09.3 · el fraccionamiento crea las 8 de una sola vez');

select is(
  (select count(*) from public.fractions where property_id = 'a2000000-0000-4000-8000-000000000001'),
  8::bigint, 'CA-09.1 · resultan exactamente 8 fracciones');

select is(
  (select array_agg(number order by number)::int[] from public.fractions
    where property_id = 'a2000000-0000-4000-8000-000000000001'),
  array[1, 2, 3, 4, 5, 6, 7, 8],
  'CA-09.1 · numeradas 1/8…8/8 sin duplicados');

select is(
  (select count(distinct status) from public.fractions
    where property_id = 'a2000000-0000-4000-8000-000000000001' and status = 'available'),
  1::bigint, 'CA-09.1 · todas nacen disponibles');

select is(
  (select count(*) from public.fractions
    where property_id = 'a2000000-0000-4000-8000-000000000001' and calendar_active),
  0::bigint, 'D-31 · ninguna nace con el calendario activo');

-- RF-09.1 · la novena no cabe ni por rango ni por unicidad.
select throws_ok(
  $$ insert into public.fractions (property_id, number, list_price)
     values ('a2000000-0000-4000-8000-000000000001', 9, 1000) $$,
  '23514', null, 'RF-09.1 · no existe una novena fracción');

select throws_ok(
  $$ insert into public.fractions (property_id, number, list_price)
     values ('a2000000-0000-4000-8000-000000000001', 3, 1000) $$,
  '23505', null, 'CA-09.1 · la numeración no se repite dentro de una propiedad');

-- RF-09.3 · ni siete. El cardinal se comprueba al confirmar la transacción; aquí se
-- fuerza esa comprobación para poder verla sin hacer commit.
select throws_ok(
  $$ do $do$
     begin
       insert into public.fractions (property_id, number, list_price)
       values ('a2000000-0000-4000-8000-000000000002', 1, 1000);
       set constraints all immediate;
     end $do$ $$,
  'P0001', null, 'RF-09.3 · una propiedad no puede quedarse con menos de 8 fracciones');

select throws_ok(
  $$ select public.fraccionar_propiedad('a2000000-0000-4000-8000-000000000002', array[1000::bigint, 2000::bigint]) $$,
  'P0001', null, 'RF-09.3 · fraccionar con una lista que no trae 8 precios no crea nada');

-- ── CA-09.2 · el precio es dinero positivo ──────────────────────────────────
select throws_ok(
  $$ insert into public.fractions (property_id, number, list_price)
     values ('a2000000-0000-4000-8000-000000000002', 1, 0) $$,
  '23514', null, 'CA-09.2 · un precio de cero se rechaza');

select throws_ok(
  $$ insert into public.fractions (property_id, number, list_price)
     values ('a2000000-0000-4000-8000-000000000002', 1, -1) $$,
  '23514', null, 'CA-09.2 · un precio negativo se rechaza');

select is(
  (select pg_typeof(list_price)::text from public.fractions limit 1),
  'bigint', 'TR-02 · RF-D.1 · el precio es entero de pesos, no punto flotante');

-- ── CA-09.3 · máquina de estados de la fracción ─────────────────────────────
select throws_ok(
  $$ update public.fractions set status = 'sold'
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'P0001', null, 'CA-09.3 · de disponible no se salta a vendida');

select lives_ok(
  $$ update public.fractions set status = 'reserved'
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'CA-09.3 · disponible → reservada');

select lives_ok(
  $$ update public.fractions set status = 'available'
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'CA-09.3 · una reserva puede caerse y volver a disponible');

select lives_ok(
  $$ update public.fractions set status = 'reserved'
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'se reserva de nuevo para poder venderla');

select lives_ok(
  $$ update public.fractions
        set status = 'sold', owner_id = 'f0000000-0000-4000-8000-000000000002'
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'CA-09.3 · reservada → vendida, con su titular (D-31)');

select throws_ok(
  $$ update public.fractions set status = 'available', owner_id = null
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'P0001', null, 'CA-09.3 · `vendida` → `disponible` sin Superadmin se rechaza');

select throws_ok(
  $$ update public.fractions set number = 4
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 2 $$,
  'P0001', null, 'RF-09.1 · la numeración no es editable');

-- D-31 · DT-04 · el derecho de uso lo deriva el plan de pagos, no una edición.
select throws_ok(
  $$ update public.fractions set calendar_active = true
      where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1 $$,
  'P0001', null, 'D-31 · el interruptor de calendario no se marca a mano');

-- ── CA-09.4 · el estado comercial se recalcula solo ─────────────────────────
select is(public.estado_comercial('a2000000-0000-4000-8000-000000000001'), 'coming_soon',
  'RF-08.3 · mientras el Administrador la tenga en «Próximamente», nada se deriva');

select lives_ok(
  $$ update public.properties set coming_soon = false
      where id = 'a2000000-0000-4000-8000-000000000001' $$,
  'RF-08.3 · con las 8 fracciones sí puede salir de «Próximamente»');

select is(public.estado_comercial('a2000000-0000-4000-8000-000000000001'), 'fractions_available',
  'CA-09.4 · con 7 disponibles y 1 vendida, el estado derivado es «Fracciones disponibles»');

-- Se venden las siete restantes.
update public.fractions set status = 'reserved'
  where property_id = 'a2000000-0000-4000-8000-000000000001' and number between 2 and 8;
update public.fractions set status = 'sold', owner_id = 'f0000000-0000-4000-8000-000000000002'
  where property_id = 'a2000000-0000-4000-8000-000000000001' and number between 2 and 8;

select is(public.estado_comercial('a2000000-0000-4000-8000-000000000001'), 'sold_out',
  'CA-08.2 · CA-09.4 · con las 8 vendidas el estado derivado es «Vendido»');

select is(
  (select commercial_status from public.property_overview
    where id = 'a2000000-0000-4000-8000-000000000001'),
  'sold_out', 'RF-10.1 · la vista global expone el mismo estado derivado');

-- ── CA-09.5 · traspaso de titular, solo del Superadmin (D-17) ───────────────
select throws_ok(
  $$ select public.traspasar_fraccion(
       (select id from public.fractions
         where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
       'f0000000-0000-4000-8000-000000000003', 'transfer', 'transfer', 'Cesión firmada.') $$,
  'P0001', null, 'CA-09.5 · un Administrador no traspasa el titular de una fracción');

set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-00000000000a';

select throws_ok(
  $$ select public.traspasar_fraccion(
       (select id from public.fractions
         where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
       'f0000000-0000-4000-8000-000000000003', 'transfer', 'transfer', '   ') $$,
  'P0001', null, 'RF-A.4 · el traspaso no se registra sin motivo');

select throws_ok(
  $$ select public.traspasar_fraccion(
       (select id from public.fractions
         where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
       'f0000000-0000-4000-8000-000000000003', 'lo_que_sea', 'transfer', 'Cesión firmada.') $$,
  'P0001', null, 'RF-09.5 · el destino de las reservas debe decidirse explícitamente');

select lives_ok(
  $$ select public.traspasar_fraccion(
       (select id from public.fractions
         where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
       'f0000000-0000-4000-8000-000000000003', 'cancel', 'settle_with_previous',
       'Cesión firmada ante notaría.') $$,
  'CA-09.5 · el Superadmin traspasa el titular');

select is(
  (select owner_id from public.fractions
    where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
  'f0000000-0000-4000-8000-000000000003'::uuid,
  'CA-09.5 · el nuevo titular queda vinculado');

-- El registro es append-only (RF-A.2): traspasos de otras pruebas o de un uso real
-- siguen ahí. La aserción se acota a la fracción que crea esta prueba, o solo
-- pasaría sobre una base recién creada.
select is(
  (select next_state from public.audit_log
    where action = 'fraction.transferida'
      and entity_id = (select id from public.fractions
                        where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1)),
  jsonb_build_object(
    'owner_id', 'f0000000-0000-4000-8000-000000000003',
    'bookings_destination', 'cancel',
    'installments_destination', 'settle_with_previous'),
  'CA-09.5 · el registro de auditoría lleva el destino de reservas y de cuotas');

select is(
  (select reason from public.audit_log
    where action = 'fraction.transferida'
      and entity_id = (select id from public.fractions
                        where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1)),
  'Cesión firmada ante notaría.', 'CA-09.5 · y el motivo con el que se hizo');

-- El titular anterior deja de ver la fracción: su política de lectura era la
-- titularidad, y ya no la tiene. La propiedad sigue siendo un borrador.
set local request.jwt.claim.sub = 'f0000000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.fractions
    where property_id = 'a2000000-0000-4000-8000-000000000001' and number = 1),
  0::bigint, 'CA-09.5 · el titular anterior pierde el acceso a la fracción');

reset role;
select * from finish();
rollback;
