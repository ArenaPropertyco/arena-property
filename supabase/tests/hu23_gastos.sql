-- HU-23 · RF-23.1…RF-23.7 · D-01, D-08, D-09, D-31 · TR-02 — maestra contable,
-- movimientos y las 8 cuotas generadas por la base.
-- Nivel N2: lo que garantiza el motor, no la disciplina de código.
begin;
select plan(71);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'expense_categories', 'RF-23.1 · existe expense_categories');
select has_table('public', 'payment_methods', 'RF-23.1 · existe payment_methods');
select has_table('public', 'ledger_accounts', 'RF-23.1 · existe ledger_accounts');
select has_table('public', 'movements', 'RF-23.2 · existe movements');
select has_table('public', 'movement_shares', 'RF-23.3 · existe movement_shares');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.expense_categories'::regclass, 'public.payment_methods'::regclass, 'public.ledger_accounts'::regclass)),
  true, 'RF-23.1 · la maestra fuerza RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.movements'::regclass),
  true, 'RF-23.2 · movements fuerza RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.movement_shares'::regclass),
  true, 'RF-23.6 · movement_shares fuerza RLS');
select has_column('public', 'expense_categories', 'active', 'RF-23.1 · la maestra tiene marca de activa');
select has_column('public', 'expense_categories', 'scope', 'D-01 · la categoría declara su libro');
select has_column('public', 'movements', 'incurred_on', 'RF-23.7 · D-09 · el movimiento tiene fecha de causación');
select has_column('public', 'movement_shares', 'payer', 'RF-23.6 · cada cuota registra quién la paga');
select has_column('public', 'movement_shares', 'has_remainder', 'RF-D.3 · la cuota con residuo queda marcada');
select ok(not has_table_privilege('authenticated', 'public.movements', 'DELETE'),
  'RF-23.4 · un movimiento no se borra: se anula');
select ok(not has_table_privilege('authenticated', 'public.movement_shares', 'INSERT')
  and not has_table_privilege('authenticated', 'public.movement_shares', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.movement_shares', 'DELETE'),
  'RF-23.3 · las cuotas las escribe solo la base');
select ok(not has_table_privilege('authenticated', 'public.expense_categories', 'DELETE'),
  'RF-23.1 · una categoría no se borra: se desactiva');
select has_function('public', 'anular_movimiento', array['uuid', 'text'], 'RF-23.4 · existe anular_movimiento');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d2300000-0000-4000-8000-00000000000a', 'super.hu23@arena.co'),
  ('d2300000-0000-4000-8000-000000000001', 'admin.hu23@arena.co'),
  ('d2300000-0000-4000-8000-000000000002', 'titular2.hu23@ejemplo.com'),
  ('d2300000-0000-4000-8000-000000000004', 'titular4.hu23@ejemplo.com'),
  ('d2300000-0000-4000-8000-000000000005', 'titular5.hu23@ejemplo.com'),
  ('d2300000-0000-4000-8000-000000000007', 'titular7.hu23@ejemplo.com'),
  ('d2300000-0000-4000-8000-000000000009', 'ajeno.hu23@ejemplo.com'),
  ('d2300000-0000-4000-8000-00000000000b', 'admin.sinasignar.hu23@arena.co');
insert into public.user_roles (user_id, role) values
  ('d2300000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d2300000-0000-4000-8000-000000000001', 'property_admin'),
  -- D-40 · CA-07.5 · Administrador con rol pero sin esta propiedad asignada.
  ('d2300000-0000-4000-8000-00000000000b', 'property_admin');

-- ── RF-23.1 · la maestra la escribe el Superadmin y la lee cualquiera ───────
set local role authenticated;
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000009';
select throws_ok(
  $$ insert into public.expense_categories (name, kind) values ('Colada', 'expense') $$,
  '42501', null, 'RF-23.1 · un Usuario no da de alta categorías');
select isnt_empty(
  $$ select 1 from public.expense_categories where active $$,
  'RF-23.1 · la maestra se lee con sesión');
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.expense_categories (name, kind) values ('Jardinería pgTAP', 'expense') $$,
  'RF-23.1 · el Superadmin da de alta una categoría');
select lives_ok(
  $$ update public.expense_categories set active = false where name = 'Jardinería pgTAP' $$,
  'RF-23.1 · y la desactiva sin borrarla');
select is(
  (select count(*) from public.audit_log where entity_type = 'expense_category' and action = 'expense_category.actualizada'
     and next_state ->> 'name' = 'Jardinería pgTAP'),
  1::bigint, 'TR-01 · el cambio en la maestra queda auditado');

-- ── Propiedad con 8 fracciones ──────────────────────────────────────────────
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2300000-0000-4000-8000-000000000001', 'Casa Gastos', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a2300000-0000-4000-8000-000000000001', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
create temporary table ctx as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as categoria,
    (select id from public.expense_categories where name = 'Comisiones a Embajadores') as comisiones,
    (select id from public.expense_categories where name = 'Renta a terceros') as renta,
    (select id from public.expense_categories where name = 'Jardinería pgTAP') as inactiva,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta,
    null::uuid as movimiento;
grant select, update on ctx to authenticated;

-- Fracción 2: vendida con calendario activo. Fracción 4: vendida con calendario
-- inactivo (D-31). Sin sesión, como lo haría la derivación del plan de pagos.
update public.fractions set status = 'reserved'
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number in (2, 4, 5, 7);
update public.fractions set status = 'sold', owner_id = 'd2300000-0000-4000-8000-000000000002'
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 2;
update public.fractions set status = 'sold', owner_id = 'd2300000-0000-4000-8000-000000000004'
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 4;
update public.fractions set status = 'sold', owner_id = 'd2300000-0000-4000-8000-000000000005'
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 5;
update public.fractions set status = 'sold', owner_id = 'd2300000-0000-4000-8000-000000000007'
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 7;
update public.fractions set calendar_active = true
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 2;

set local role authenticated;
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000001';

-- ── CA-23.3 · sin categoría de la maestra o con monto ≤ 0 se rechaza ────────
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 0, (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Cero') $$,
  '%CA-23.3%', 'CA-23.3 · un gasto de cero pesos se rechaza');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', -5, (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Negativo') $$,
  '%CA-23.3%', 'CA-23.3 · un gasto negativo se rechaza');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 100000, null, (select medio from ctx), (select cuenta from ctx), current_date, 'Sin categoría') $$,
  '%CA-23.3%', 'CA-23.3 · un gasto sin categoría se rechaza');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 100000, gen_random_uuid(), (select medio from ctx), (select cuenta from ctx), current_date, 'Inventada') $$,
  '%CA-23.3%', 'CA-23.3 · una categoría que no está en la maestra se rechaza');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 100000, (select inactiva from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Retirada') $$,
  '%CA-23.3%', 'CA-23.3 · una categoría desactivada tampoco sirve');
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 100000, (select renta from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Clase cruzada') $$,
  '%RF-23.1%', 'RF-23.1 · una categoría de ingreso no sirve para un gasto');

-- ── CA-23.6 · las comisiones a Embajadores no entran en esta maestra (D-01) ──
select throws_like(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 5000000, (select comisiones from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Comisión de Ana') $$,
  '%CA-23.6%', 'CA-23.6 · una comisión de Embajador se rechaza por categoría no permitida');

-- ── CA-23.1 · $100.000 → 8 cuotas de $12.500 ────────────────────────────────
select lives_ok(
  $$ insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('e2300000-0000-4000-8000-000000000001', 'a2300000-0000-4000-8000-000000000001', 100000,
             (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Bomba de la piscina') $$,
  'RF-23.2 · el Administrador registra un gasto completo');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001'),
  8::bigint, 'CA-23.1 · se generan exactamente 8 cuotas');
select is(
  (select sum(amount) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001'),
  100000::numeric, 'CA-23.1 · la suma de las cuotas es exactamente $100.000');
select is(
  (select array_agg(amount order by fraction_number) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001'),
  array[12500, 12500, 12500, 12500, 12500, 12500, 12500, 12500]::bigint[], 'CA-23.1 · cada cuota vale $12.500');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001' and has_remainder),
  0::bigint, 'CA-23.1 · ninguna cuota lleva residuo');
select is(
  (select count(*) from public.audit_log where action = 'movement.creada' and entity_id = 'e2300000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-A.3 · el alta del gasto queda auditada');

-- ── CA-23.2 · $100.001 → 12.501 a la 1/8, 12.500 al resto ───────────────────
insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('e2300000-0000-4000-8000-000000000002', 'a2300000-0000-4000-8000-000000000001', 100001,
        (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'No divisible');
select is(
  (select array_agg(amount order by fraction_number) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000002'),
  array[12501, 12500, 12500, 12500, 12500, 12500, 12500, 12500]::bigint[], 'CA-23.2 · 12.501 para la 1/8 y 12.500 para las demás');
select is(
  (select sum(amount) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000002'),
  100001::numeric, 'CA-23.2 · la suma es exactamente $100.001');
select is(
  (select array_agg(fraction_number order by fraction_number) from public.movement_shares
    where movement_id = 'e2300000-0000-4000-8000-000000000002' and has_remainder),
  array[1]::smallint[], 'CA-23.2 · solo la 1/8 queda marcada con residuo');

-- ── CA-23.7 · vendida con calendario inactivo: paga el titular del inventario ─
select is(
  (select payer::text from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001' and fraction_number = 4),
  'inventory_holder', 'CA-23.7 · la fracción vendida con calendario inactivo se imputa al titular del inventario');
select is(
  (select payer_id from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001' and fraction_number = 2),
  'd2300000-0000-4000-8000-000000000002'::uuid, 'RF-23.6 · la fracción con calendario activo se imputa a su Propietario');
select is(
  (select payer::text from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001' and fraction_number = 1),
  'inventory_holder', 'D-08 · la fracción sin vender se imputa al titular del inventario');

-- Se activa el calendario de la 4 (sin sesión, como la derivación del plan).
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 4;
set local role authenticated;
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000001';

insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('e2300000-0000-4000-8000-000000000003', 'a2300000-0000-4000-8000-000000000001', 80000,
        (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Tras la activación');
select is(
  (select payer::text from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000003' and fraction_number = 4),
  'owner', 'CA-23.7 · activado el calendario, la siguiente causación se imputa al Propietario');
select is(
  (select payer_id from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000003' and fraction_number = 4),
  'd2300000-0000-4000-8000-000000000004'::uuid, 'CA-23.7 · con la cuenta del Propietario como pagador');

insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('e2300000-0000-4000-8000-000000000004', 'a2300000-0000-4000-8000-000000000001', 80000,
        (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date - 1, 'Causado antes de activar');
select is(
  (select payer::text from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000004' and fraction_number = 4),
  'inventory_holder', 'CA-23.7 · RF-23.7 · una causación anterior a la activación sigue siendo del inventario');

-- ── CA-23.5 · 3 calendarios activos y $80.000 ───────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = false
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number = 4;
update public.fractions set calendar_active = true
 where property_id = 'a2300000-0000-4000-8000-000000000001' and number in (5, 7);
set local role authenticated;
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000001';

insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('e2300000-0000-4000-8000-000000000005', 'a2300000-0000-4000-8000-000000000001', 80000,
        (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Tres activas');
select is(
  (select array_agg(amount order by fraction_number) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000005'),
  array[10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000]::bigint[], 'CA-23.5 · se generan igualmente 8 cuotas de $10.000');
select is(
  (select array_agg(fraction_number order by fraction_number) from public.movement_shares
    where movement_id = 'e2300000-0000-4000-8000-000000000005' and payer = 'owner'),
  array[2, 5, 7]::smallint[], 'CA-23.5 · 3 cuotas a cargo de esos propietarios');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000005' and payer = 'inventory_holder'),
  5::bigint, 'CA-23.5 · y 5 a cargo del titular del inventario');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000005' and payer = 'inventory_holder' and payer_id is not null),
  0::bigint, 'D-08 · el titular del inventario no se confunde con ningún Propietario');

-- ── RF-23.4 · CA-23.4 · un gasto no se elimina: se anula con motivo ─────────
select throws_like(
  $$ update public.movements set amount = 90000 where id = 'e2300000-0000-4000-8000-000000000001' $$,
  '%RF-23.4%', 'RF-23.4 · el monto de un gasto no se edita');
select throws_like(
  $$ update public.movements set description = 'Otra cosa' where id = 'e2300000-0000-4000-8000-000000000001' $$,
  '%RF-23.4%', 'RF-23.4 · la descripción tampoco');
select throws_like(
  $$ select public.anular_movimiento('e2300000-0000-4000-8000-000000000001', '   ') $$,
  '%CA-23.4%', 'CA-23.4 · sin motivo no hay anulación');
select throws_like(
  $$ update public.movements set voided_at = now(), void_reason = 'Sin pasar por la función'
      where id = 'e2300000-0000-4000-8000-000000000001' $$,
  '%motivo%', 'RF-A.4 · anular sin fijar el motivo de auditoría también se rechaza');
select is(
  (select voided_at from public.movements where id = 'e2300000-0000-4000-8000-000000000001'),
  null, 'RF-A.5 · el intento fallido no dejó el gasto anulado');
select lives_ok(
  $$ select public.anular_movimiento('e2300000-0000-4000-8000-000000000001', 'Factura duplicada.') $$,
  'CA-23.4 · el Administrador anula el gasto con motivo');
select is(
  (select void_reason from public.movements where id = 'e2300000-0000-4000-8000-000000000001'),
  'Factura duplicada.', 'CA-23.4 · el gasto queda anulado con su motivo');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001' and reversed_at is not null),
  8::bigint, 'CA-23.4 · sus 8 cuotas quedan revertidas');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000001'),
  8::bigint, 'CA-23.4 · revertidas, no borradas: el histórico se conserva');
select is(
  (select reason from public.audit_log where action = 'movement.actualizada' and entity_id = 'e2300000-0000-4000-8000-000000000001'),
  'Factura duplicada.', 'CA-23.4 · el movimiento de anulación queda auditado con su motivo');
select throws_like(
  $$ select public.anular_movimiento('e2300000-0000-4000-8000-000000000001', 'Otra vez.') $$,
  '%anulado%', 'RF-23.4 · un gasto anulado no se anula dos veces');

-- ── RLS · quién ve y quién escribe ──────────────────────────────────────────
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.movements where property_id = 'a2300000-0000-4000-8000-000000000001'),
  5::bigint, 'RF-23.6 · el Propietario ve los movimientos de su propiedad');
select is(
  (select count(distinct fraction_number) from public.movement_shares where property_id = 'a2300000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-24.3 · pero solo las cuotas de su propia fracción');
select is(
  (select min(fraction_number) from public.movement_shares where property_id = 'a2300000-0000-4000-8000-000000000001'),
  2::smallint, 'RF-24.3 · que es la 2/8');
select throws_ok(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 1000, (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Del titular') $$,
  '42501', null, 'RF-23.2 · un Propietario no registra gastos');

set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-000000000009';
select is(
  (select count(*) from public.movements where property_id = 'a2300000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-23.2 · una cuenta ajena a la propiedad no ve sus movimientos');
select is(
  (select count(*) from public.movement_shares where property_id = 'a2300000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-23.6 · ni sus cuotas');
select throws_ok(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 1000, (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Ajeno') $$,
  '42501', null, 'RF-23.2 · ni registra en una propiedad que no administra');

set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from public.movement_shares where property_id = 'a2300000-0000-4000-8000-000000000001'),
  40::bigint, 'RF-23.6 · el Superadmin ve todas las cuotas de todos los movimientos');

-- ── CA-07.5 · D-40 · el Superadmin registra en una propiedad que no administra ─
-- La propiedad la creó el Administrador ...001, que es su único asignado.
select is(
  (select count(*) from public.property_admins
    where property_id = 'a2300000-0000-4000-8000-000000000001'
      and admin_id = 'd2300000-0000-4000-8000-00000000000a' and revoked_at is null),
  0::bigint, 'CA-07.5 · el Superadmin no figura como Administrador de esta propiedad');
select lives_ok(
  $$ insert into public.movements (id, property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('e2300000-0000-4000-8000-000000000006', 'a2300000-0000-4000-8000-000000000001', 100000,
             (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Gasto del Superadmin') $$,
  'CA-07.5 · D-40 · aun así registra el gasto');
select is(
  (select count(*) from public.movement_shares where movement_id = 'e2300000-0000-4000-8000-000000000006'),
  8::bigint, 'CA-07.5 · y la base le genera sus 8 cuotas igual que a cualquiera');

-- La enmienda alcanza al Superadmin, no a cualquier Administrador.
set local request.jwt.claim.sub = 'd2300000-0000-4000-8000-00000000000b';
select throws_ok(
  $$ insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
     values ('a2300000-0000-4000-8000-000000000001', 1000, (select categoria from ctx), (select medio from ctx), (select cuenta from ctx), current_date, 'Admin sin asignar') $$,
  '42501', null, 'CA-07.5 · un Administrador sin la propiedad asignada sigue sin poder registrar');

reset role;
select * from finish();
rollback;
