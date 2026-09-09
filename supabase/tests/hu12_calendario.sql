-- HU-12 · RF-12.2, RF-12.3, RF-12.8, RF-12.9 — el calendario persistido: rejilla
-- clasificada, publicación del reparto, liberación a 60 días y reconfiguración
-- con estadías. El motor es TypeScript (DT-07); la base guarda su resultado y
-- protege las invariantes.
begin;
select plan(28);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'season_calendars', 'existe season_calendars');
select has_table('public', 'calendar_weeks', 'existe calendar_weeks');
select has_table('public', 'allocations', 'existe allocations');
select has_table('public', 'released_nights', 'existe released_nights (bolsa de renta)');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.season_calendars'::regclass, 'public.calendar_weeks'::regclass, 'public.allocations'::regclass, 'public.released_nights'::regclass, 'public.stays'::regclass)),
  true, 'todas las tablas del calendario fuerzan RLS');
select has_column('public', 'calendar_weeks', 'peak_block', 'RF-12.2 · la semana guarda su bloque pico');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1200000-0000-4000-8000-000000000001', 'admin.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000002', 'ajeno.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000003', 'dueno.cal@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1200000-0000-4000-8000-000000000001', 'property_admin'),
  ('c1200000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1200000-0000-4000-8000-000000000001', 'Casa Calendario', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1200000-0000-4000-8000-000000000001', array[100000000::bigint]);
-- La fracción 1 tiene titular: es quien tendrá estadías y recibirá el aviso.
update public.fractions set status = 'reserved'
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c1200000-0000-4000-8000-000000000003'
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number = 1;

-- ── Rejilla de 2027 (52 semanas desde el sábado 2 de enero) ─────────────────
-- 8 altas (0..7, con los picos en 0, 1 y 2), 8 media-altas, 8 medias, 28 bajas.
create temporary table semanas_json as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2027-01-02'::date + i * 7)::text,
  'ends_on', ('2027-01-02'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
) order by i) as semanas
from generate_series(0, 51) as i;

select lives_ok(
  $$ select public.guardar_calendario('a1200000-0000-4000-8000-000000000001', 2027, 2026, null, (select semanas from semanas_json)) $$,
  'RF-12.2 · el Administrador asignado guarda la rejilla clasificada');

select is(
  (select count(*) from public.calendar_weeks w join public.season_calendars c on c.id = w.calendar_id
    where c.property_id = 'a1200000-0000-4000-8000-000000000001' and c.year = 2027),
  52::bigint, 'RF-12.2 · quedan las 52 semanas con su temporada');

select throws_ok(
  $$ select public.guardar_calendario('a1200000-0000-4000-8000-000000000001', 2027, 2026, null,
       '[{"index": 0, "starts_on": "2027-01-02", "ends_on": "2027-01-09", "season": "baja", "peak_block": "christmas"}]'::jsonb) $$,
  'P0001', null, 'RF-12.2 · un bloque pico fuera de la temporada alta se rechaza');

-- El calendario recién guardado, a mano de todos los roles de la prueba.
reset role;
create temporary table cal as
  select id from public.season_calendars where property_id = 'a1200000-0000-4000-8000-000000000001' and year = 2027;
grant select on cal to authenticated;
set local role authenticated;

-- ── RF-12.3 · publicación del reparto (posición p toma las semanas p, p+8, …) ─
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select throws_ok(
  $$ select public.publicar_calendario((select id from cal), '[]'::jsonb) $$,
  'P0001', null, 'CA-11.3 · un Administrador ajeno no publica el calendario');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
create temporary table reparto_json as
select jsonb_agg(jsonb_build_object('fraction_number', f, 'weeks', array[f - 1, f + 7, f + 15, f + 23, f + 31, f + 39])) as reparto
from generate_series(1, 8) as f;

select lives_ok(
  $$ select public.publicar_calendario((select id from cal), (select reparto from reparto_json)) $$,
  'RF-12.3 · el Administrador asignado publica el reparto');
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal)),
  48::bigint, 'CA-12.8 · se persisten 48 semanas repartidas');
select is(
  (select count(distinct fraction_id) from public.allocations where calendar_id = (select id from cal)),
  8::bigint, 'RF-12.3 · las 8 fracciones tienen reparto');
select is(
  (select published_at is not null from public.season_calendars where id = (select id from cal)),
  true, 'RF-12.3 · el calendario queda publicado');

select throws_ok(
  $$ select public.publicar_calendario((select id from cal),
       '[{"fraction_number": 1, "weeks": [0, 0, 8, 16, 24, 32]}]'::jsonb) $$,
  'P0001', null, 'CA-12.3 · una semana no puede ir a dos fracciones');

-- ── Lecturas por RLS ────────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal)),
  48::bigint, 'D-16 · el titular ve el reparto completo de su propiedad');
select is(
  (select count(*) from public.calendar_weeks where calendar_id = (select id from cal)),
  52::bigint, 'D-16 · y la rejilla clasificada');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal)),
  0::bigint, 'un Administrador ajeno no ve el reparto');

-- ── RF-12.8 · liberación a 60 días ──────────────────────────────────────────
-- La fracción 1 tiene la semana 0 (2 al 9 de enero). Su titular declara una
-- estadía en las dos primeras noches; el resto vence a 60 días.
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select lives_ok(
  $$ insert into public.stays (calendar_id, fraction_id, property_id, nights)
     values ((select id from cal),
             (select id from public.fractions where property_id = 'a1200000-0000-4000-8000-000000000001' and number = 1),
             'a1200000-0000-4000-8000-000000000001', daterange('2027-01-02', '2027-01-04')) $$,
  'el titular declara una estadía sobre noches de su fracción');

reset role;
select is(
  (select public.liberar_noches_vencidas('2026-11-09'::date)), 5,
  'RF-12.8 · a 60 días se liberan las 5 noches de la semana sin estadía');
select is(
  (select public.liberar_noches_vencidas('2026-11-09'::date)), 0,
  'RF-12.8 · la tarea es idempotente: una segunda pasada no libera nada');
select is(
  (select count(*) from public.released_nights where calendar_id = (select id from cal)),
  5::bigint, 'las noches liberadas quedan en la bolsa de renta');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and r.recipient_id = 'c1200000-0000-4000-8000-000000000003'),
  1::bigint, 'RF-12.8 · el Propietario recibe un solo aviso por fracción y pasada');

-- ── RF-12.9 · reconfiguración con estadías ──────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
-- Girar el reparto: la fracción f pasa a tomar las semanas de la f+1.
create temporary table reparto2_json as
select jsonb_agg(jsonb_build_object('fraction_number', f, 'weeks', array[(f % 8), (f % 8) + 8, (f % 8) + 16, (f % 8) + 24, (f % 8) + 32, (f % 8) + 40])) as reparto
from generate_series(1, 8) as f;

select throws_ok(
  $$ select public.publicar_calendario((select id from cal), (select reparto from reparto2_json)) $$,
  'P0001', null, 'RF-12.9 · con estadías existentes la reconfiguración exige confirmación');

select lives_ok(
  $$ select public.publicar_calendario((select id from cal), (select reparto from reparto2_json), true) $$,
  'RF-12.9 · confirmada, la reconfiguración se aplica');
select is(
  (select count(*) from public.stays where calendar_id = (select id from cal)),
  1::bigint, 'RF-12.9 · la estadía existente no se elimina');
select is(
  (select jsonb_array_length(public.publicar_calendario((select id from cal), (select reparto from reparto2_json), true) -> 'conflicts')),
  1, 'RF-12.9 · los conflictos se listan: la estadía quedó sobre noches de otra fracción');

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
reset role;
select is(
  (select count(*) from public.audit_log where action = 'season_calendar.creada' and entity_id = (select id from cal)),
  1::bigint, 'CA-A.1 · el calendario queda auditado al crearse');

select * from finish();
rollback;
