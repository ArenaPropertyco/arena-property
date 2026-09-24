-- HU-25 · RF-25.3, RF-25.5 · D-01 — lo que la base garantiza al reporte
-- consolidado: el libro de plataforma solo lo lee el Superadmin, los
-- movimientos de todas las propiedades solo los ve él, y ninguna comisión vive
-- en el libro de una propiedad. La agregación es pura y se prueba en N1.
begin;
select plan(9);

-- ── Cuentas y propiedades ───────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c2500000-0000-4000-8000-000000000001', 'super.hu25@arena.co', '{}'),
  ('c2500000-0000-4000-8000-000000000002', 'admin.hu25@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c2500000-0000-4000-8000-000000000001', 'superadmin'),
  ('c2500000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2500000-0000-4000-8000-000000000001', 'Casa Reporte A', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2500000-0000-4000-8000-000000000002', 'Casa Reporte B', 'Propiedad de prueba.', 100, 'CO', 'Quindío', 'Salento');
select public.fraccionar_propiedad('a2500000-0000-4000-8000-000000000001', array[100000000::bigint]);
select public.fraccionar_propiedad('a2500000-0000-4000-8000-000000000002', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
create temporary table ctx25 as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as mantenimiento,
    (select id from public.expense_categories where scope = 'platform' and kind = 'expense' order by name limit 1) as plataforma,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta;
grant select on ctx25 to authenticated;

-- Un gasto en cada propiedad y un egreso en el libro de plataforma.
set local role authenticated;
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000002';
insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('a2500000-0000-4000-8000-000000000001', 800000, (select mantenimiento from ctx25), (select medio from ctx25), (select cuenta from ctx25), current_date, 'Gasto de A');
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000001';
insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('a2500000-0000-4000-8000-000000000002', 450000, (select mantenimiento from ctx25), (select medio from ctx25), (select cuenta from ctx25), current_date, 'Gasto de B');
reset role;
set local request.jwt.claim.sub = '';
insert into public.platform_ledger (id, kind, amount, category_id, property_id, source_type, source_id, accrued_on, note)
values ('f2500000-0000-4000-8000-000000000001', 'expense', 3000000, (select plataforma from ctx25), 'a2500000-0000-4000-8000-000000000001', 'ambassador_commission', gen_random_uuid(), current_date, 'Comisión de prueba');

-- ── RF-25.5 · el libro de plataforma es del Superadmin ──────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.platform_ledger where id = 'f2500000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-25.5 · el Administrador no lee el libro de plataforma, ni siquiera lo de su propiedad');
select is(
  (select count(*) from public.movements where property_id = 'a2500000-0000-4000-8000-000000000002'),
  0::bigint, 'RF-25.5 · ni los movimientos de una propiedad que no administra');
select is(
  (select count(*) from public.movements where property_id = 'a2500000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-25.1 · los de la suya, sí: su reporte es el de HU-23');
set local request.jwt.claim.sub = 'c2500000-0000-4000-8000-000000000001';
select is(
  (select count(*) from public.platform_ledger where id = 'f2500000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-25.5 · el Superadmin lee el libro de plataforma');
select is(
  (select count(*) from public.movements where property_id in ('a2500000-0000-4000-8000-000000000001', 'a2500000-0000-4000-8000-000000000002')),
  2::bigint, 'RF-25.1 · y los movimientos de todas las propiedades');
select ok(not has_table_privilege('authenticated', 'public.platform_ledger', 'INSERT')
  and not has_table_privilege('authenticated', 'public.platform_ledger', 'UPDATE'),
  'RF-25.3 · D-01 · el libro de plataforma lo escribe solo el motor');

-- ── RF-25.3 · D-01 · los dos libros no se mezclan ───────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.movements m join public.expense_categories c on c.id = m.category_id where c.scope = 'platform'),
  0::bigint, 'RF-25.3 · CA-23.6 · ningún movimiento de propiedad usa una categoría del libro de plataforma');
select is(
  (select count(*) from public.platform_ledger l join public.expense_categories c on c.id = l.category_id where c.scope <> 'platform'),
  0::bigint, 'RF-25.3 · ni el libro de plataforma usa una categoría de propiedad');
select is(
  (select count(*) from public.movement_shares s where s.movement_id in
     (select m.id from public.movements m where m.property_id = 'a2500000-0000-4000-8000-000000000001')),
  8::bigint, 'RF-25.3 · CA-25.3 · lo de la propiedad se prorratea entre las ocho; la comisión, nunca');

select * from finish();
rollback;
