-- HU-26 · RF-26.1…RF-26.4 · HU-28 · RF-28.1, RF-28.2 — el inventario en la base:
-- validaciones, baja lógica con histórico, escritura del Superadmin y del
-- Administrador asignado (D-45) y lectura del Propietario sin los ítems dados de baja.
begin;
select plan(36);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'inventory_items', 'RF-26.1 · existe inventory_items');
select has_table('public', 'inventory_history', 'RF-26.4 · existe inventory_history');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.inventory_items'::regclass, 'public.inventory_history'::regclass)),
  true, 'RF-26.3 · inventario e histórico fuerzan RLS');
select ok(not has_table_privilege('authenticated', 'public.inventory_items', 'DELETE'),
  'RF-26.2 · un ítem no se borra: se da de baja');
select ok(not has_table_privilege('authenticated', 'public.inventory_history', 'INSERT')
  and not has_table_privilege('authenticated', 'public.inventory_history', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.inventory_history', 'DELETE'),
  'RF-26.4 · el histórico lo escribe solo la base');
select has_function('public', 'retire_inventory_item', array['uuid', 'text'], 'RF-26.2 · existe retire_inventory_item');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d2600000-0000-4000-8000-00000000000a', 'super.hu26@arena.co'),
  ('d2600000-0000-4000-8000-000000000001', 'admin.hu26@arena.co'),
  ('d2600000-0000-4000-8000-000000000002', 'otroadmin.hu26@arena.co'),
  ('d2600000-0000-4000-8000-000000000003', 'dueno.hu26@ejemplo.com'),
  ('d2600000-0000-4000-8000-000000000004', 'ajeno.hu26@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d2600000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d2600000-0000-4000-8000-000000000001', 'property_admin'),
  ('d2600000-0000-4000-8000-000000000002', 'property_admin');

-- ── Dos propiedades: A del admin 1 con fracción del dueño; B del admin 2 ────
set local role authenticated;
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2600000-0000-4000-8000-000000000001', 'Casa Inventario', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a2600000-0000-4000-8000-000000000001', array[100000000::bigint]);
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2600000-0000-4000-8000-000000000002', 'Casa Ajena', 'Propiedad de prueba.', 200, 'CO', 'Quindío', 'Salento');

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'reserved'
 where property_id = 'a2600000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'd2600000-0000-4000-8000-000000000003'
 where property_id = 'a2600000-0000-4000-8000-000000000001' and number = 3;

-- ── CA-26.1 · validaciones ──────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000001';
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', 'Sofá', 'furniture', -1) $$,
  '23514', null, 'CA-26.1 · una cantidad negativa se rechaza');
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', 'Sofá', null, 1) $$,
  '23502', null, 'CA-26.1 · sin categoría se rechaza');
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', 'Sofá', 'mascotas', 1) $$,
  '22P02', null, 'CA-26.1 · una categoría fuera del catálogo se rechaza');
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', '   ', 'furniture', 1) $$,
  '23514', null, 'RF-26.1 · sin nombre no hay ítem');
select lives_ok(
  $$ insert into public.inventory_items (id, property_id, name, category, condition, quantity, location)
     values ('b2600000-0000-4000-8000-000000000001', 'a2600000-0000-4000-8000-000000000001', '  Sofá de tres puestos ', 'furniture', 'good', 1, 'Sala') $$,
  'RF-26.1 · el Administrador asignado registra un ítem completo');
select lives_ok(
  $$ insert into public.inventory_items (id, property_id, name, category, condition, quantity)
     values ('b2600000-0000-4000-8000-000000000002', 'a2600000-0000-4000-8000-000000000001', 'Toallas', 'linens', 'new', 0) $$,
  'RF-26.1 · cero es una cantidad válida: el ítem se agotó pero existe');
select is(
  (select name from public.inventory_items where id = 'b2600000-0000-4000-8000-000000000001'),
  'Sofá de tres puestos', 'RF-26.1 · el nombre se guarda sin espacios de sobra');

-- ── CA-26.3 · RF-26.3 · escribe solo el Administrador asignado ──────────────
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000003';
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', 'Colchón', 'furniture', 1) $$,
  '42501', null, 'CA-26.3 · CA-28.2 · un Propietario no crea ítems');
-- La RLS no le entrega la fila: el update no falla, pero no toca nada.
update public.inventory_items set quantity = 9 where id = 'b2600000-0000-4000-8000-000000000001';
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select quantity from public.inventory_items where id = 'b2600000-0000-4000-8000-000000000001'),
  1, 'CA-26.3 · CA-28.2 · un Propietario no edita ítems: la RLS no le entrega la fila');
set local role authenticated;
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.retire_inventory_item('b2600000-0000-4000-8000-000000000001', 'Me estorba.') $$,
  '%no existe o no es visible%', 'CA-28.2 · un Propietario tampoco da de baja');
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000002';
select throws_ok(
  $$ insert into public.inventory_items (property_id, name, category, quantity)
     values ('a2600000-0000-4000-8000-000000000001', 'Colchón', 'furniture', 1) $$,
  '42501', null, 'RF-26.3 · el Administrador de otra propiedad no escribe en esta');
-- ── RF-26.4 · los cambios de estado y cantidad quedan historizados ──────────
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000001';
update public.inventory_items set condition = 'damaged', quantity = 2, location = 'Terraza'
 where id = 'b2600000-0000-4000-8000-000000000001';
select is(
  (select array_agg(field || ':' || previous || '→' || next order by field) from public.inventory_history
    where item_id = 'b2600000-0000-4000-8000-000000000001'),
  array['condition:good→damaged', 'quantity:1→2'],
  'RF-26.4 · el cambio de estado y el de cantidad dejan una entrada cada uno; la ubicación, ninguna');
select is(
  (select changed_by from public.inventory_history where item_id = 'b2600000-0000-4000-8000-000000000001' limit 1),
  'd2600000-0000-4000-8000-000000000001'::uuid, 'RF-26.4 · con quién hizo el cambio');
select throws_like(
  $$ update public.inventory_items set property_id = 'a2600000-0000-4000-8000-000000000002' where id = 'b2600000-0000-4000-8000-000000000001' $$,
  '%RF-26.1%', 'RF-26.1 · un ítem no cambia de propiedad');

-- ── CA-26.2 · la baja lógica conserva el histórico ──────────────────────────
select throws_like(
  $$ select public.retire_inventory_item('b2600000-0000-4000-8000-000000000001', '  ') $$,
  '%RF-A.4%', 'RF-26.2 · RF-A.4 · la baja exige motivo');
select lives_ok(
  $$ select public.retire_inventory_item('b2600000-0000-4000-8000-000000000001', 'Se rompió el armazón.') $$,
  'RF-26.2 · el Administrador da de baja con motivo');
select is(
  (select (retired_at is not null, retire_reason, name, quantity) from public.inventory_items where id = 'b2600000-0000-4000-8000-000000000001'),
  (true, 'Se rompió el armazón.'::text, 'Sofá de tres puestos'::text, 2),
  'CA-26.2 · dado de baja, el ítem sigue existiendo con su ficha y su motivo');
select is(
  (select (previous, next, note) from public.inventory_history
    where item_id = 'b2600000-0000-4000-8000-000000000001' and field = 'retired'),
  ('active'::text, 'retired'::text, 'Se rompió el armazón.'::text),
  'CA-26.2 · RF-26.4 · la baja queda historizada con su motivo');
select is(
  (select count(*) from public.inventory_history where item_id = 'b2600000-0000-4000-8000-000000000001'),
  3::bigint, 'CA-26.2 · el histórico previo a la baja persiste');
select throws_like(
  $$ update public.inventory_items set quantity = 5 where id = 'b2600000-0000-4000-8000-000000000001' $$,
  '%RF-26.2%', 'RF-26.2 · un ítem dado de baja no se modifica');
select throws_like(
  $$ select public.retire_inventory_item('b2600000-0000-4000-8000-000000000001', 'Otra vez.') $$,
  '%RF-26.2%', 'RF-26.2 · ni se da de baja dos veces');
select is(
  (select reason from public.audit_log where entity_type = 'inventory_item' and action = 'inventory_item.actualizada'
     and entity_id = 'b2600000-0000-4000-8000-000000000001' and next_state ->> 'retired_at' is not null),
  'Se rompió el armazón.', 'TR-01 · la baja queda auditada con su motivo');

-- ── CA-28.1 · CA-28.3 · lo que ve el Propietario ────────────────────────────
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000003';
select is(
  (select array_agg(name order by name) from public.inventory_items where property_id = 'a2600000-0000-4000-8000-000000000001'),
  array['Toallas'], 'CA-28.1 · CA-28.3 · el Propietario ve los ítems activos de su propiedad y no el dado de baja');
select is(
  (select count(*) from public.inventory_history where property_id = 'a2600000-0000-4000-8000-000000000001'),
  3::bigint, 'RF-28.1 · y lee el histórico de su propiedad');

-- El Administrador sí ve el dado de baja: es histórico suyo.
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.inventory_items where property_id = 'a2600000-0000-4000-8000-000000000001'),
  2::bigint, 'RF-26.2 · el Administrador sigue viendo el ítem dado de baja como histórico');

-- Un ítem en la propiedad B, que el dueño de A no debe ver.
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000002';
insert into public.inventory_items (property_id, name, category, quantity)
values ('a2600000-0000-4000-8000-000000000002', 'Nevera ajena', 'appliances', 1);
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.inventory_items where property_id = 'a2600000-0000-4000-8000-000000000002'),
  0::bigint, 'CA-28.1 · de otra propiedad no ve nada');
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.inventory_items where property_id in ('a2600000-0000-4000-8000-000000000001', 'a2600000-0000-4000-8000-000000000002')),
  0::bigint, 'RF-28.2 · un Usuario sin fracción no ve inventario alguno');

-- ── CA-07.6 · D-45 · el Superadmin gestiona el inventario de una propiedad que no administra ─
set local request.jwt.claim.sub = 'd2600000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.inventory_items (id, property_id, name, category, quantity)
     values ('b2600000-0000-4000-8000-00000000000a', 'a2600000-0000-4000-8000-000000000001', 'Colchón', 'furniture', 1) $$,
  'CA-07.6 · D-45 · registra un ítem aunque la propiedad sea de otro Administrador');
select lives_ok(
  $$ select public.retire_inventory_item('b2600000-0000-4000-8000-00000000000a', 'Se mojó en la inundación.') $$,
  'CA-07.6 · D-45 · y también lo da de baja con motivo');
select is(
  (select (retired_at is not null, retire_reason) from public.inventory_items
    where id = 'b2600000-0000-4000-8000-00000000000a'),
  (true, 'Se mojó en la inundación.'::text),
  'CA-07.6 · D-45 · y sigue viendo el ítem que dio de baja');

select * from finish();
rollback;
