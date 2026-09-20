-- HU-27 · RF-27.1…RF-27.3 — el gasto de mantenimiento en la base: es un gasto
-- de HU-23 con sus 8 cuotas, se asocia a un ítem de la propiedad o a ninguno, y
-- su factura vive en un bucket que solo leen los roles permitidos.
begin;
select plan(23);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_column('public', 'movements', 'maintenance', 'RF-27.1 · el movimiento sabe si es de mantenimiento');
select has_column('public', 'movements', 'inventory_item_id', 'RF-27.1 · y a qué ítem se asocia');
select has_column('public', 'movements', 'attachment_path', 'RF-27.1 · y su factura adjunta');
select is((select public from storage.buckets where id = 'movement-attachments'), false,
  'CA-27.3 · el bucket de facturas es privado');

-- ── Cuentas y propiedad con 8 fracciones ────────────────────────────────────
insert into auth.users (id, email) values
  ('d2700000-0000-4000-8000-000000000001', 'admin.hu27@arena.co'),
  ('d2700000-0000-4000-8000-000000000002', 'otroadmin.hu27@arena.co'),
  ('d2700000-0000-4000-8000-000000000003', 'dueno.hu27@ejemplo.com'),
  ('d2700000-0000-4000-8000-000000000004', 'ajeno.hu27@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d2700000-0000-4000-8000-000000000001', 'property_admin'),
  ('d2700000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2700000-0000-4000-8000-000000000001', 'Casa Mantenimiento', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a2700000-0000-4000-8000-000000000001', array[100000000::bigint]);
insert into public.inventory_items (id, property_id, name, category, quantity) values
  ('b2700000-0000-4000-8000-000000000001', 'a2700000-0000-4000-8000-000000000001', 'Bomba de la piscina', 'equipment', 1),
  ('b2700000-0000-4000-8000-000000000002', 'a2700000-0000-4000-8000-000000000001', 'Aire acondicionado', 'appliances', 3);
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2700000-0000-4000-8000-000000000002', 'Casa Otra', 'Propiedad de prueba.', 200, 'CO', 'Quindío', 'Salento');
select public.fraccionar_propiedad('a2700000-0000-4000-8000-000000000002', array[100000000::bigint]);
insert into public.inventory_items (id, property_id, name, category, quantity) values
  ('b2700000-0000-4000-8000-000000000009', 'a2700000-0000-4000-8000-000000000002', 'Nevera ajena', 'appliances', 1);

reset role;
set local request.jwt.claim.sub = '';
-- El dueño tiene la 3/8 con calendario activo desde antes de la causación.
update public.fractions set status = 'reserved' where property_id = 'a2700000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'd2700000-0000-4000-8000-000000000003'
 where property_id = 'a2700000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set calendar_active = true where property_id = 'a2700000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set calendar_activated_at = now() - interval '30 days'
 where property_id = 'a2700000-0000-4000-8000-000000000001' and number = 3;

create temporary table ctx27 as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as categoria,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta;
grant select on ctx27 to authenticated;

-- ── CA-27.1 · un mantenimiento de $80.000 genera las 8 cuotas de HU-23 ──────
set local role authenticated;
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000001';
select lives_ok(
  $$ insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, inventory_item_id, attachment_path)
     values ('c2700000-0000-4000-8000-000000000001', 'a2700000-0000-4000-8000-000000000001', 80000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date, 'Cambio del rodamiento', 'b2700000-0000-4000-8000-000000000001', 'a2700000-0000-4000-8000-000000000001/factura-01.pdf') $$,
  'RF-27.1 · el Administrador registra un mantenimiento de $80.000 sobre la bomba, con su factura');
select is(
  (select (count(*), sum(amount)::bigint, bool_and(amount = 10000)) from public.movement_shares where movement_id = 'c2700000-0000-4000-8000-000000000001'),
  (8::bigint, 80000::bigint, true), 'CA-27.1 · genera las 8 cuotas de $10.000 con la regla de HU-23');
select is(
  (select maintenance from public.movements where id = 'c2700000-0000-4000-8000-000000000001'),
  true, 'RF-27.2 · con ítem, el gasto queda marcado como mantenimiento aunque no se marcara');

set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000003';
select is(
  (select (amount, payer::text) from public.movement_shares where movement_id = 'c2700000-0000-4000-8000-000000000001' and fraction_number = 3),
  (10000::bigint, 'owner'::text), 'CA-27.1 · y aparece en el estado de cuenta del Propietario como su cuota de $10.000');
select is(
  (select (m.maintenance, m.inventory_item_id) from public.movements m where m.id = 'c2700000-0000-4000-8000-000000000001'),
  (true, 'b2700000-0000-4000-8000-000000000001'::uuid), 'RF-28.1 · el Propietario lee el mantenimiento de su propiedad con su ítem');

-- ── CA-27.2 · asociación a un ítem o a la propiedad en general ──────────────
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000001';
select lives_ok(
  $$ insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, maintenance)
     values ('c2700000-0000-4000-8000-000000000002', 'a2700000-0000-4000-8000-000000000001', 40000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date, 'Fumigación general', true) $$,
  'RF-27.1 · un mantenimiento general no lleva ítem');
select is(
  (select array_agg(id order by id) from public.movements where inventory_item_id = 'b2700000-0000-4000-8000-000000000001'),
  array['c2700000-0000-4000-8000-000000000001'::uuid], 'CA-27.2 · el historial del ítem incluye su gasto y no el general');
select is(
  (select count(*) from public.movements where inventory_item_id = 'b2700000-0000-4000-8000-000000000002'),
  0::bigint, 'CA-27.2 · el general no aparece en ningún otro ítem');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, inventory_item_id)
     values ('a2700000-0000-4000-8000-000000000001', 10000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date, 'Ítem ajeno', 'b2700000-0000-4000-8000-000000000009') $$,
  '%RF-27.1%', 'RF-27.1 · no se asocia a un ítem de otra propiedad');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, inventory_item_id)
     values ('a2700000-0000-4000-8000-000000000001', 10000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date, 'Ítem inexistente', gen_random_uuid()) $$,
  '%RF-27.1%', 'RF-27.1 · ni a un ítem que no existe');

-- Un mantenimiento tardío sobre un ítem ya dado de baja sigue entrando.
select public.retire_inventory_item('b2700000-0000-4000-8000-000000000002', 'Reemplazado.');
select lives_ok(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, inventory_item_id)
     values ('a2700000-0000-4000-8000-000000000001', 15000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date - 10, 'Última reparación antes del cambio', 'b2700000-0000-4000-8000-000000000002') $$,
  'RF-27.1 · un mantenimiento tardío sobre un ítem dado de baja entra: el gasto ocurrió');

-- ── RF-27.2 · un solo modelo: anular es anular el gasto de HU-23 ────────────
select lives_ok(
  $$ select public.anular_movimiento('c2700000-0000-4000-8000-000000000002', 'Se facturó dos veces.') $$,
  'RF-27.2 · el mantenimiento se anula como cualquier gasto');
select is(
  (select count(*) from public.movement_shares where movement_id = 'c2700000-0000-4000-8000-000000000002' and reversed_at is not null),
  8::bigint, 'RF-27.2 · y sus 8 cuotas se revierten igual');

-- ── CA-27.3 · la factura solo apunta a la carpeta de su propiedad ───────────
select throws_ok(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description, attachment_path)
     values ('a2700000-0000-4000-8000-000000000001', 10000, (select categoria from ctx27), (select medio from ctx27), (select cuenta from ctx27),
             current_date, 'Factura ajena', 'a2700000-0000-4000-8000-000000000002/factura.pdf') $$,
  '23514', null, 'CA-27.3 · una factura bajo la carpeta de otra propiedad se rechaza');

-- ── CA-27.3 · quién lee y quién sube la factura ─────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
insert into storage.objects (bucket_id, name, owner, metadata)
values ('movement-attachments', 'a2700000-0000-4000-8000-000000000001/factura-01.pdf', 'd2700000-0000-4000-8000-000000000001', '{}');

set local role authenticated;
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000001';
select is(
  (select count(*) from storage.objects where bucket_id = 'movement-attachments' and name like 'a2700000-0000-4000-8000-000000000001/%'),
  1::bigint, 'CA-27.3 · el Administrador de la propiedad lee la factura');
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000003';
select is(
  (select count(*) from storage.objects where bucket_id = 'movement-attachments' and name like 'a2700000-0000-4000-8000-000000000001/%'),
  1::bigint, 'CA-27.3 · el copropietario también la lee');
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000004';
select is(
  (select count(*) from storage.objects where bucket_id = 'movement-attachments' and name like 'a2700000-0000-4000-8000-000000000001/%'),
  0::bigint, 'CA-27.3 · un Usuario ajeno no la ve');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner, metadata)
     values ('movement-attachments', 'a2700000-0000-4000-8000-000000000001/colada.pdf', 'd2700000-0000-4000-8000-000000000004', '{}') $$,
  '42501', null, 'CA-27.3 · ni sube nada bajo la carpeta de la propiedad');
set local request.jwt.claim.sub = 'd2700000-0000-4000-8000-000000000001';
-- El borrado en storage.objects solo pasa por la API de Storage, que aplica esta
-- misma política: se comprueba su forma, no su efecto.
select ok(
  exists (select 1 from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and cmd = 'DELETE'
             and policyname = 'movement_attachments_objetos_limpieza' and qual like '%attachment_path%'),
  'CA-27.3 · la factura de un gasto registrado es evidencia: la política de retiro la excluye');

select * from finish();
rollback;
