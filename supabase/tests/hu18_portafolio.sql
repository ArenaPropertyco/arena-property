-- HU-18 · RF-18.4 · HU-19 · RF-19.4 · D-16 — el Propietario solo ve sus propias
-- fracciones y sus propias cuotas, y todas ellas aunque estén en propiedades
-- distintas. Ninguna cuota de otra fracción ni de otra propiedad se filtra.
begin;
select plan(8);

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1800000-0000-4000-8000-000000000001', 'admin.por@arena.co', '{}'),
  ('c1800000-0000-4000-8000-000000000003', 'ana.por@arena.co', '{}'),
  ('c1800000-0000-4000-8000-000000000004', 'luis.por@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1800000-0000-4000-8000-000000000001', 'property_admin');

-- ── Tres propiedades sin publicar: A y B con fracción de Ana; C sin ella ────
set local role authenticated;
set local request.jwt.claim.sub = 'c1800000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1800000-0000-4000-8000-000000000001', 'Casa A', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena'),
  ('a1800000-0000-4000-8000-000000000002', 'Casa B', 'Propiedad de prueba.', 100, 'CO', 'Quindío', 'Salento'),
  ('a1800000-0000-4000-8000-000000000003', 'Casa C', 'Propiedad de prueba.', 100, 'CO', 'Magdalena', 'Santa Marta');
select public.fraccionar_propiedad('a1800000-0000-4000-8000-000000000001', array[100000000::bigint]);
select public.fraccionar_propiedad('a1800000-0000-4000-8000-000000000002', array[100000000::bigint]);
select public.fraccionar_propiedad('a1800000-0000-4000-8000-000000000003', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'reserved'
 where (property_id = 'a1800000-0000-4000-8000-000000000001' and number in (3, 5))
    or (property_id = 'a1800000-0000-4000-8000-000000000002' and number = 1)
    or (property_id = 'a1800000-0000-4000-8000-000000000003' and number = 2);
-- Ana: 3/8 de A y 1/8 de B. Luis: 5/8 de A y 2/8 de C.
update public.fractions set status = 'sold', owner_id = 'c1800000-0000-4000-8000-000000000003', calendar_active = true
 where (property_id = 'a1800000-0000-4000-8000-000000000001' and number = 3)
    or (property_id = 'a1800000-0000-4000-8000-000000000002' and number = 1);
update public.fractions set status = 'sold', owner_id = 'c1800000-0000-4000-8000-000000000004', calendar_active = true
 where (property_id = 'a1800000-0000-4000-8000-000000000001' and number = 5)
    or (property_id = 'a1800000-0000-4000-8000-000000000003' and number = 2);

create temporary table ctx18 as
  select
    (select id from public.expense_categories where name = 'Mantenimiento' and kind = 'expense') as categoria,
    (select id from public.payment_methods where code = 'transfer') as medio,
    (select id from public.ledger_accounts where code = 'bank') as cuenta;
grant select on ctx18 to authenticated;

-- ── Gastos: $80.000 en A y $50.000 en C ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c1800000-0000-4000-8000-000000000001';
insert into public.movements (property_id, amount, category_id, payment_method_id, account_id, incurred_on, description)
values ('a1800000-0000-4000-8000-000000000001', 80000, (select categoria from ctx18), (select medio from ctx18), (select cuenta from ctx18), current_date, 'Bomba de la piscina'),
       ('a1800000-0000-4000-8000-000000000003', 50000, (select categoria from ctx18), (select medio from ctx18), (select cuenta from ctx18), current_date, 'Jardinería');

-- Las tres propiedades del test no están publicadas: lo único que Ana puede leer
-- de ellas es lo suyo. Se acota a ellas porque la base local puede tener otras,
-- publicadas y de lectura pública, que no son objeto de esta prueba.
create temporary table props18 as
  select unnest(array['a1800000-0000-4000-8000-000000000001', 'a1800000-0000-4000-8000-000000000002', 'a1800000-0000-4000-8000-000000000003']::uuid[]) as id;
grant select on props18 to authenticated;

-- ── RF-18.4 · Ana ve exactamente sus dos fracciones ─────────────────────────
set local request.jwt.claim.sub = 'c1800000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.fractions where property_id in (select id from props18)),
  2::bigint, 'RF-18.4 · un Propietario con fracciones en dos propiedades ve exactamente esas dos');
select is(
  (select array_agg(right(f.property_id::text, 1) || ':' || f.number order by f.property_id) from public.fractions f
    where f.property_id in (select id from props18)),
  array['1:3', '2:1'], 'RF-18.4 · y son las suyas: 3/8 de A y 1/8 de B');
select is(
  (select count(*) from public.fractions where property_id = 'a1800000-0000-4000-8000-000000000003'),
  0::bigint, 'RF-18.4 · de la propiedad donde no tiene fracción no ve ninguna');

-- ── RF-19.4 · CA-19.2 · y solo sus cuotas, exactas ──────────────────────────
select is(
  (select count(*) from public.movement_shares where property_id in (select id from props18)),
  1::bigint, 'RF-19.4 · Ana ve una sola cuota: la de su fracción en A');
select is(
  (select (fraction_number::integer, amount::bigint) from public.movement_shares where property_id in (select id from props18)),
  (3, 10000::bigint), 'CA-19.2 · un gasto de $80.000 le toca como $10.000 exactos a la 3/8');
select is(
  (select count(*) from public.movement_shares where property_id = 'a1800000-0000-4000-8000-000000000003'),
  0::bigint, 'RF-19.4 · ninguna cuota de la propiedad C, donde no tiene fracción');
select is(
  (select count(*) from public.movement_shares where property_id = 'a1800000-0000-4000-8000-000000000001' and fraction_number = 5),
  0::bigint, 'RF-19.4 · ni la cuota de la 5/8 de Luis en la misma propiedad A');

-- ── Luis ve las suyas: 5/8 de A y 2/8 de C ──────────────────────────────────
set local request.jwt.claim.sub = 'c1800000-0000-4000-8000-000000000004';
select is(
  (select array_agg(amount::bigint order by property_id) from public.movement_shares where property_id in (select id from props18)),
  array[10000, 6250]::bigint[], 'RF-18.4 · RF-19.4 · Luis ve sus dos cuotas: $10.000 en A y $6.250 en C');

select * from finish();
rollback;
