-- HU-59 · RF-59.1…RF-59.6, RF-59.8 · D-36 — la ventana anual de reubicación por
-- semanas en la base: configuración del Superadmin con turnos de 48 horas, orden
-- rotativo, guarda de turno y de calendario activo (I-08), reglas de temporada y
-- ocupación, cierre manual y programado, auditoría y aviso por movimiento.
begin;
select plan(47);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'selection_windows', 'RF-59.1 · existe selection_windows');
select has_table('public', 'selection_window_turns', 'RF-59.1 · existen los turnos de la ventana');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.selection_windows'::regclass, 'public.selection_window_turns'::regclass)),
  true, 'RF-59.1 · la ventana y sus turnos fuerzan RLS');
select has_function('public', 'configure_selection_window', array['uuid', 'timestamp with time zone', 'integer', 'integer', 'integer[]'], 'RF-59.1 · existe configure_selection_window');
select has_function('public', 'suggested_relocation_order', array['uuid'], 'RF-59.2 · existe suggested_relocation_order');
select has_function('public', 'relocate_week', array['uuid', 'uuid', 'integer', 'integer'], 'RF-59.3 · existe relocate_week');
select has_function('public', 'close_selection_window', array['uuid'], 'RF-59.6 · existe close_selection_window');
select has_function('public', 'close_expired_selection_windows', array['timestamp with time zone'], 'RF-59.6 · existe el cierre programado');
select ok((select count(*) from cron.job where jobname = 'close-selection-windows') = 1, 'RF-59.6 · el cierre corre cada hora en pg_cron');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5900000-0000-4000-8000-000000000001', 'admin.reu@arena.co', '{}'),
  ('c5900000-0000-4000-8000-000000000002', 'super.reu@arena.co', '{}'),
  ('c5900000-0000-4000-8000-000000000003', 'dueno1.reu@arena.co', '{}'),
  ('c5900000-0000-4000-8000-000000000004', 'dueno2.reu@arena.co', '{}'),
  ('c5900000-0000-4000-8000-000000000005', 'dueno3.reu@arena.co', '{}'),
  ('c5900000-0000-4000-8000-000000000006', 'ajeno.reu@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5900000-0000-4000-8000-000000000001', 'property_admin'),
  ('c5900000-0000-4000-8000-000000000002', 'superadmin'),
  ('c5900000-0000-4000-8000-000000000006', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5900000-0000-4000-8000-000000000001', 'Casa Ventana', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5900000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a5900000-0000-4000-8000-000000000001' and number in (1, 2, 3);
update public.fractions set status = 'sold', owner_id = 'c5900000-0000-4000-8000-000000000003'
  where property_id = 'a5900000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c5900000-0000-4000-8000-000000000004'
  where property_id = 'a5900000-0000-4000-8000-000000000001' and number = 2;
update public.fractions set status = 'sold', owner_id = 'c5900000-0000-4000-8000-000000000005'
  where property_id = 'a5900000-0000-4000-8000-000000000001' and number = 3;

-- ── Rejillas de 2028 y 2029 (52 semanas cada una) ───────────────────────────
-- 8 altas (0..7), 8 media-altas (8..15), 8 medias (16..23) y 28 bajas.
create or replace function pg_temp.rejilla(anio integer, ancla date) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (ancla + i * 7)::text, 'ends_on', (ancla + i * 7 + 7)::text,
    'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
    'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
  ) order by i) from generate_series(0, 51) as i;
$$;
select public.guardar_calendario('a5900000-0000-4000-8000-000000000001', 2028, 2027, null, pg_temp.rejilla(2028, '2028-01-01'));
select public.guardar_calendario('a5900000-0000-4000-8000-000000000001', 2029, 2027, null, pg_temp.rejilla(2029, '2029-01-06'));

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a5900000-0000-4000-8000-000000000001' and number in (1, 2, 3);
create temporary table cal28 as
  select id from public.season_calendars where property_id = 'a5900000-0000-4000-8000-000000000001' and year = 2028;
create temporary table cal29 as
  select id from public.season_calendars where property_id = 'a5900000-0000-4000-8000-000000000001' and year = 2029;
create temporary table fr as
  select number, id from public.fractions where property_id = 'a5900000-0000-4000-8000-000000000001';
grant select on cal28, cal29, fr to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000001';

-- D-32 · la selección de 2028 con el orden 1, 2, 3. Fracción 1: 0, 9, 17, 25, 33, 41.
-- Fracción 2: 2, 10, 18, 26, 34, 42. Fracción 3: 3, 11, 19, 27, 35, 43.
select public.open_calendar_selection((select id from cal28), array[1, 2, 3]);
select public.select_weeks((select id from cal28), (select id from fr where number = 1), array[0, 9, 17, 25, 33, 41]);
select public.select_weeks((select id from cal28), (select id from fr where number = 2), array[2, 10, 18, 26, 34, 42]);
select public.select_weeks((select id from cal28), (select id from fr where number = 3), array[3, 11, 19, 27, 35, 43]);

-- ── RF-59.2 · el primer año la sugerencia parte del orden de selección ──────
select is(
  (select public.suggested_relocation_order((select id from cal28))),
  array[1, 2, 3], 'RF-59.2 · sin ventana anterior, el orden sugerido es el de la selección del año');

-- ── RF-59.1 · solo el Superadmin configura la ventana ───────────────────────
select throws_like(
  $$ select public.configure_selection_window((select id from cal28), now() - interval '1 hour', 16, 48, null) $$,
  '%RF-59.1%', 'RF-59.1 · un Administrador de propiedad no configura la ventana');

set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.configure_selection_window((select id from cal28), now() - interval '1 hour', 16, 48, array[1, 2, 4]) $$,
  '%RF-59.2%', 'RF-59.2 · un orden con una fracción sin titular se rechaza');
select throws_like(
  $$ select public.configure_selection_window((select id from cal28), now() - interval '1 hour', 0, 48, null) $$,
  '%RF-59.1%', 'RF-59.1 · P-13 · una duración de cero días se rechaza');
select lives_ok(
  $$ select public.configure_selection_window((select id from cal28), now() - interval '1 hour', 16, 48, null) $$,
  'RF-59.1 · el Superadmin configura la ventana de 2028 abierta hace una hora, con turnos de 48 horas');
create temporary table ventana as
  select w.* from public.selection_windows w where w.calendar_id = (select id from cal28);
grant select on ventana to authenticated;
select is(
  (select closes_at from ventana), (select opens_at + interval '16 days' from ventana),
  'RF-59.1 · P-13 · el cierre queda 16 días después de la apertura');
select is(
  (select array_agg(f.number order by t.position) from public.selection_window_turns t join fr f on f.id = t.fraction_id
    where t.window_id = (select id from ventana)),
  array[1, 2, 3]::smallint[], 'RF-59.2 · sin orden explícito, los turnos siguen la sugerencia');
select is(
  (select t.opens_at from public.selection_window_turns t join fr f on f.id = t.fraction_id
    where t.window_id = (select id from ventana) and f.number = 2),
  (select opens_at + interval '48 hours' from ventana),
  'RF-59.1 · P-14 · el segundo turno abre 48 horas después del primero');

-- D-16 · lecturas
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000003';
select is((select count(*) from public.selection_windows where calendar_id = (select id from cal28)), 1::bigint,
  'D-16 · el titular ve la ventana de su propiedad');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000006';
select is((select count(*) from public.selection_windows where calendar_id = (select id from cal28)), 0::bigint,
  'CA-13.3 · un Administrador ajeno no ve la ventana');

-- ── CA-59.5 · fuera de turno y sin calendario activo ────────────────────────
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000004';
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 2), 26, 45) $$,
  '%CA-59.5%', 'CA-59.5 · la fracción 2 no mueve nada mientras es el turno de la 1');

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = false where id = (select id from fr where number = 1);
set local role authenticated;
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 25, 45) $$,
  '%I-08%', 'CA-59.5 · I-08 · con el calendario inactivo la fracción conserva el turno pero no opera');
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true where id = (select id from fr where number = 1);
set local role authenticated;
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000003';

-- ── CA-59.2 · una reubicación válida ────────────────────────────────────────
select lives_ok(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 25, 45) $$,
  'CA-59.2 · en su turno, la fracción 1 mueve la semana baja 25 a la 45');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join fr f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal28) and w.index = 45),
  1::smallint, 'CA-59.2 · la semana 45 es ahora de la fracción 1');
select is(
  (select count(*) from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 25),
  0::bigint, 'CA-59.2 · la semana 25 quedó libre');
select is(
  (select array_agg(w.season order by w.season) from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and a.fraction_id = (select id from fr where number = 1)),
  array['alta', 'baja', 'baja', 'baja', 'media', 'media_alta'], 'CA-59.2 · I-02 · el cupo sigue siendo 1/1/1/3');

-- ── CA-59.1 · CA-59.3 · CA-59.4 · rechazos ──────────────────────────────────
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 33, 4) $$,
  '%CA-59.1%', 'CA-59.1 · una semana baja no se mueve a una alta libre');
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 33, 26) $$,
  '%CA-59.3%', 'CA-59.3 · una semana elegida por otra fracción se rechaza');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000001';
select public.block_weeks((select id from cal28), array[46], 'Mantenimiento de cubierta');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000004';
select public.release_week((select id from cal28), (select id from fr where number = 2), 42);
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 33, 46) $$,
  '%CA-59.3%', 'CA-59.3 · una semana bloqueada por el Administrador se rechaza');
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 33, 42) $$,
  '%CA-59.3%', 'CA-59.3 · una semana en la bolsa de renta se rechaza');
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 26, 47) $$,
  '%RF-59.3%', 'RF-59.3 · una semana ajena no se mueve');
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 33, 33) $$,
  '%RF-59.5%', 'RF-59.5 · el destino debe ser otra semana de la rejilla');
select public.confirm_week((select id from cal28), (select id from fr where number = 1), 41);
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 41, 47) $$,
  '%CA-59.4%', 'CA-59.4 · una semana ya confirmada no se mueve');

-- ── RF-59.8 · TR-01 · TR-03 · auditoría y aviso, una vez por movimiento ─────
create temporary table movida as
  select a.id from public.allocations a join public.calendar_weeks w on w.id = a.week_id
   where a.calendar_id = (select id from cal28) and w.index = 45;
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log where action = 'allocation.actualizada' and entity_id = (select id from movida) and reason like 'Semana reubicada%'),
  1::bigint, 'RF-59.8 · CA-A.1 · la reubicación deja una entrada de auditoría con su motivo');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_relocation' and r.recipient_id = 'c5900000-0000-4000-8000-000000000003'),
  1::bigint, 'RF-59.8 · TR-03 · el Propietario recibe un aviso por movimiento');
set local role authenticated;

-- ── RF-59.3 · HU-17 · el Administrador asignado reubica por cualquier fracción ─
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000006';
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 2), 26, 47) $$,
  '%RF-59.3%', 'CA-17.4 · un Administrador sin la propiedad asignada no reubica');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 2), 26, 47) $$,
  'RF-59.3 · HU-17 · el Administrador asignado reubica por la fracción 2 aunque no sea su turno');

-- ── RF-59.2 · CA-59.6 · el año siguiente rota ───────────────────────────────
select is(
  (select public.suggested_relocation_order((select id from cal29))),
  array[2, 3, 1], 'CA-59.6 · RF-59.2 · para 2029 se sugiere el orden anterior rotado: la primera pasa al final');

-- ── CA-59.7 · cierre de la ventana ──────────────────────────────────────────
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000006';
select throws_like(
  $$ select public.close_selection_window((select id from cal28)) $$,
  '%RF-59.6%', 'RF-59.6 · un Administrador ajeno no cierra la ventana');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000002';
select lives_ok(
  $$ select public.close_selection_window((select id from cal28)) $$,
  'RF-59.6 · el Superadmin cierra la ventana antes de tiempo');
select is(
  (select closed_at is not null from public.selection_windows where calendar_id = (select id from cal28)),
  true, 'CA-59.7 · la ventana queda cerrada');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.relocate_week((select id from cal28), (select id from fr where number = 1), 45, 48) $$,
  '%CA-59.7%', 'CA-59.7 · cerrada la ventana, ninguna reubicación se acepta');
select is(
  (select array_agg(w.index order by w.index) from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and a.fraction_id = (select id from fr where number = 1)),
  array[0, 9, 17, 33, 41, 45]::smallint[], 'CA-59.7 · las semanas no reubicadas siguen asignadas y la reubicada se queda en su destino');
select is(
  (select count(*) from public.calendar_weeks w where w.calendar_id = (select id from cal28) and w.index in (25, 26)
     and not exists (select 1 from public.allocations a where a.week_id = w.id)),
  2::bigint, 'CA-59.7 · las semanas liberadas por las reubicaciones figuran disponibles');
set local request.jwt.claim.sub = 'c5900000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.configure_selection_window((select id from cal28), now(), 16, 48, null) $$,
  '%CA-59.7%', 'CA-59.7 · una ventana cerrada no se reconfigura');

-- ── RF-59.6 · cierre programado al vencer ───────────────────────────────────
select public.configure_selection_window((select id from cal29), now() - interval '20 days', 16, 48, null);
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select public.close_expired_selection_windows(now())), 1,
  'RF-59.6 · el cierre programado cierra la ventana vencida y solo esa');
select is(
  (select closed_at is not null from public.selection_windows where calendar_id = (select id from cal29)),
  true, 'RF-59.6 · la ventana vencida queda cerrada');
select is(
  (select public.close_expired_selection_windows(now())), 0,
  'RF-59.6 · una segunda pasada no cierra nada más');

select * from finish();
rollback;
