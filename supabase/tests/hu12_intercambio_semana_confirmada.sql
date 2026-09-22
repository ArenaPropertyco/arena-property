-- HU-12 · RF-12.6, RF-12.9 · CA-12.11 · D-33 — una semana confirmada o liberada
-- no se ofrece en un intercambio, no se pide y no se aprueba: la solicitud ya no
-- nace imposible para reventar al resolverla.
begin;
select plan(9);

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1200000-0000-4000-8000-000000000001', 'admin.int@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000002', 'dueno1.int@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000003', 'dueno2.int@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1200000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1200000-0000-4000-8000-000000000001', 'Casa Intercambio', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1200000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'c1200000-0000-4000-8000-000000000002'
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c1200000-0000-4000-8000-000000000003'
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number = 2;

-- Rejilla de un año futuro: la confirmación exige que la semana no haya pasado.
create or replace function pg_temp.rejilla(ancla date) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (ancla + i * 7)::text, 'ends_on', (ancla + i * 7 + 7)::text,
    'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
    'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
  ) order by i) from generate_series(0, 51) as i;
$$;
select public.guardar_calendario('a1200000-0000-4000-8000-000000000001', 2028, 2027, null, pg_temp.rejilla('2028-01-01'));

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number in (1, 2);
create temporary table cal as
  select id from public.season_calendars where property_id = 'a1200000-0000-4000-8000-000000000001' and year = 2028;
create temporary table fr as
  select number, id from public.fractions where property_id = 'a1200000-0000-4000-8000-000000000001';
grant select on cal, fr to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select id from cal), array[1, 2]);
-- La 1 elige 0, 8, 16, 24, 25, 26; la 2 elige 1, 9, 17, 27, 28, 29.
select public.select_weeks((select id from cal), (select id from fr where number = 1), array[0, 8, 16, 24, 25, 26]);
select public.select_weeks((select id from cal), (select id from fr where number = 2), array[1, 9, 17, 27, 28, 29]);

-- ── CA-12.11 · sin confirmar, la solicitud se crea y se aprueba ─────────────
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
create temporary table sol as
  select public.request_week_swap((select id from cal), (select id from fr where number = 2), 27, 1, 24, 'Cambio de planes') as id;
grant select on sol to authenticated;
select is(
  (select count(*) from public.week_swap_requests where id = (select id from sol) and status = 'open'),
  1::bigint, 'CA-12.11 · con las dos semanas libres la solicitud se crea');
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.resolve_swap_request((select id from sol), true, 'De acuerdo') $$,
  'CA-12.11 · RF-12.6 · el Administrador aprueba y el intercambio se aplica');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id
     join public.fractions f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal) and w.index = 27),
  1::smallint, 'CA-12.11 · la semana 28 pasó a la fracción 1');

-- ── RF-12.9 · D-33 · con una semana confirmada, la solicitud no nace ────────
-- La fracción 2 confirma su semana 29 (índice 28) y acto seguido intenta ofrecerla.
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select public.confirm_week((select id from cal), (select id from fr where number = 2), 28);
select throws_like(
  $$ select public.request_week_swap((select id from cal), (select id from fr where number = 2), 28, 1, 25, 'La quiero y punto') $$,
  '%RF-12.9%', 'CA-12.11 · RF-12.9 · no se ofrece en intercambio una semana ya confirmada');
select is(
  (select count(*) from public.week_swap_requests r join public.calendar_weeks w on w.id = r.offered_week_id
    where r.calendar_id = (select id from cal) and w.index = 28),
  0::bigint, 'RF-12.9 · la solicitud imposible no queda guardada');

-- Tampoco se pide una semana ajena que su titular ya confirmó.
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select public.confirm_week((select id from cal), (select id from fr where number = 1), 26);
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.request_week_swap((select id from cal), (select id from fr where number = 2), 29, 1, 26, 'Esa me sirve') $$,
  '%RF-12.9%', 'CA-12.11 · RF-12.9 · no se pide una semana ajena ya confirmada');

-- ── RF-12.9 · confirmada después de pedir, la aprobación se explica ─────────
-- La 2 pide la 25 de la 1 con todo libre; después la 1 confirma esa semana.
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
create temporary table sol2 as
  select public.request_week_swap((select id from cal), (select id from fr where number = 2), 29, 1, 25, 'Antes de confirmar') as id;
grant select on sol2 to authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select public.confirm_week((select id from cal), (select id from fr where number = 1), 25);
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.resolve_swap_request((select id from sol2), true, 'Va') $$,
  '%RF-12.9%', 'RF-12.9 · confirmada después de pedir, aprobar se rechaza citando la regla');
select is(
  (select status from public.week_swap_requests where id = (select id from sol2)),
  'open', 'RF-12.9 · la solicitud sigue abierta: el rechazo no la resuelve sola');
select lives_ok(
  $$ select public.resolve_swap_request((select id from sol2), false, 'La semana ya está confirmada') $$,
  'CA-12.11 · lo único que queda es rechazarla con motivo, y eso sí se puede');

select * from finish();
rollback;
