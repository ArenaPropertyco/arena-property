-- HU-59 · RF-59.1, RF-59.10 · D-48 — la ventana ya creada se ajusta sin perder su
-- orden, avisa a quien se le mueve la franja, y se elimina en cualquier fase sin
-- deshacer lo ya reubicado.
begin;
select plan(22);

select has_function('public', 'delete_selection_window', array['uuid'], 'RF-59.10 · existe delete_selection_window');
select has_function('private', 'normalizar_orden', array['uuid', 'integer[]'], 'RF-59.2 · existe el normalizador de orden');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5920000-0000-4000-8000-000000000001', 'admin.aju@arena.co', '{}'),
  ('c5920000-0000-4000-8000-000000000002', 'super.aju@arena.co', '{}'),
  ('c5920000-0000-4000-8000-000000000003', 'dueno1.aju@arena.co', '{}'),
  ('c5920000-0000-4000-8000-000000000004', 'dueno2.aju@arena.co', '{}'),
  ('c5920000-0000-4000-8000-000000000005', 'dueno3.aju@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5920000-0000-4000-8000-000000000001', 'property_admin'),
  ('c5920000-0000-4000-8000-000000000002', 'superadmin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5920000-0000-4000-8000-000000000001', 'Casa Ajuste', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5920000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a5920000-0000-4000-8000-000000000001' and number in (1, 2, 3);
update public.fractions set status = 'sold', owner_id = 'c5920000-0000-4000-8000-000000000003'
  where property_id = 'a5920000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c5920000-0000-4000-8000-000000000004'
  where property_id = 'a5920000-0000-4000-8000-000000000001' and number = 2;

create or replace function pg_temp.rejilla(ancla date) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (ancla + i * 7)::text, 'ends_on', (ancla + i * 7 + 7)::text,
    'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
    'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
  ) order by i) from generate_series(0, 51) as i;
$$;
select public.guardar_calendario('a5920000-0000-4000-8000-000000000001', 2028, 2027, null, pg_temp.rejilla('2028-01-01'));

reset role;
set local request.jwt.claim.sub = '';
-- Solo las vendidas: una fracción sin titular no puede tener el calendario activo.
update public.fractions set calendar_active = true
  where property_id = 'a5920000-0000-4000-8000-000000000001' and number in (1, 2);
create temporary table cal as
  select id from public.season_calendars where property_id = 'a5920000-0000-4000-8000-000000000001' and year = 2028;
create temporary table fr as
  select number, id from public.fractions where property_id = 'a5920000-0000-4000-8000-000000000001';
grant select on cal, fr to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select id from cal), array[1, 2]);

-- ── RF-59.1 · D-48 · ajustar no reescribe el orden ─────────────────────────
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
-- El Superadmin elige a mano el orden 2, 1 (la sugerencia sería 1, 2: la de la selección).
select public.configure_selection_window((select id from cal), now() + interval '1 day', 16, 48, array[2, 1]);
select is(
  (select array_agg(f.number order by t.position) from public.selection_window_turns t
     join public.selection_windows w on w.id = t.window_id
     join public.fractions f on f.id = t.fraction_id where w.calendar_id = (select id from cal)),
  array[2, 1]::smallint[], 'RF-59.2 · el orden elegido a mano queda guardado');

-- Se ajusta solo la apertura, sin pasar orden: el orden tiene que sobrevivir.
select public.configure_selection_window((select id from cal), now() + interval '3 days', 16, 48, null);
select is(
  (select array_agg(f.number order by t.position) from public.selection_window_turns t
     join public.selection_windows w on w.id = t.window_id
     join public.fractions f on f.id = t.fraction_id where w.calendar_id = (select id from cal)),
  array[2, 1]::smallint[], 'CA-59.10 · RF-59.1 · D-48 · ajustar la apertura no reescribe el orden con la sugerencia');
select is(
  (select date_trunc('minute', opens_at) = date_trunc('minute', now() + interval '3 days') from public.selection_windows where calendar_id = (select id from cal)),
  true, 'RF-59.1 · D-48 · la apertura nueva queda guardada');
select is(
  (select date_trunc('minute', closes_at) = date_trunc('minute', now() + interval '19 days') from public.selection_windows where calendar_id = (select id from cal)),
  true, 'RF-59.1 · D-48 · el cierre se recalcula desde la apertura y la duración');

-- Ajustar la duración y el turno.
select public.configure_selection_window((select id from cal), now() + interval '3 days', 10, 24, null);
select is(
  (select array[duration_days, turn_hours] from public.selection_windows where calendar_id = (select id from cal)),
  array[10, 24], 'RF-59.1 · D-48 · la duración y el turno se ajustan');
select is(
  (select extract(epoch from (max(t.closes_at) - min(t.opens_at)))::integer from public.selection_window_turns t
     join public.selection_windows w on w.id = t.window_id where w.calendar_id = (select id from cal)),
  2 * 24 * 3600, 'P-14 · D-48 · las franjas se recalculan con el turno nuevo');

-- ── TR-03 · D-48 · avisa solo a quien se le mueve la franja ────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(distinct r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_type = 'selection_window_adjusted'),
  2::bigint, 'CA-59.10 · TR-03 · D-48 · los dos titulares con turno reciben su franja nueva');
create temporary table avisos_antes as
  select count(*) as total from public.notifications where entity_type = 'selection_window_adjusted';
set local role authenticated;
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
-- Guardar lo mismo otra vez no mueve nada: nadie debe recibir un segundo aviso.
select public.configure_selection_window((select id from cal), now() + interval '3 days', 10, 24, null);
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.notifications where entity_type = 'selection_window_adjusted'),
  (select total from avisos_antes), 'CA-59.10 · TR-03 · D-48 · guardar sin cambios no avisa a nadie');
select is(
  (select count(*) from public.audit_log where action = 'selection_window.actualizada' and reason = 'Ventana de reubicación ajustada por el Superadmin') > 0,
  true, 'TR-01 · D-48 · el ajuste queda auditado con su motivo');

-- ── D-47 · la fracción vendida después entra al final al ajustar ───────────
update public.fractions set status = 'sold', owner_id = 'c5920000-0000-4000-8000-000000000005', calendar_active = true
  where id = (select id from fr where number = 3);
set local role authenticated;
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
select lives_ok(
  $$ select public.configure_selection_window((select id from cal), now() + interval '4 days', 10, 24, null) $$,
  'D-47 · D-48 · ajustar con una fracción vendida después no falla por el orden');
select is(
  (select array_agg(f.number order by t.position) from public.selection_window_turns t
     join public.selection_windows w on w.id = t.window_id
     join public.fractions f on f.id = t.fraction_id where w.calendar_id = (select id from cal)),
  array[2, 1, 3]::smallint[], 'D-47 · D-48 · la fracción nueva entra al final del orden conservado');

-- ── RF-59.10 · eliminar la ventana ─────────────────────────────────────────
-- Con la ventana abierta, la fracción 2 reubica una semana; eliminarla no lo deshace.
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000001';
select public.select_weeks((select id from cal), (select id from fr where number = 2), array[1, 9, 17, 25, 33, 41]);
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
select public.configure_selection_window((select id from cal), now() - interval '1 hour', 10, 24, array[2, 1, 3]);
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000004';
select public.relocate_week((select id from cal), (select id from fr where number = 2), 25, 45);

set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.delete_selection_window((select id from cal)) $$,
  '%RF-59.10%', 'RF-59.10 · el Administrador no elimina la ventana');
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
select lives_ok(
  $$ select public.delete_selection_window((select id from cal)) $$,
  'RF-59.10 · el Superadmin elimina la ventana abierta');
select is(
  (select count(*) from public.selection_windows where calendar_id = (select id from cal)),
  0::bigint, 'CA-59.11 · RF-59.10 · la ventana desaparece');
select is(
  (select count(*) from public.selection_window_turns t join public.fractions f on f.id = t.fraction_id
    where f.property_id = 'a5920000-0000-4000-8000-000000000001'),
  0::bigint, 'RF-59.10 · sus turnos se van con ella');
select is(
  (select array_agg(w.index order by w.index) from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal) and a.fraction_id = (select id from fr where number = 2)),
  array[1, 9, 17, 33, 41, 45]::smallint[], 'CA-59.11 · principio 9 · lo ya reubicado no se deshace: la 25 sigue en la 45');
select throws_like(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 2), 45, 46) $$,
  '%RF-59.1%', 'RF-59.10 · sin ventana, nadie reubica');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(distinct r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_type = 'selection_window_deleted'),
  3::bigint, 'CA-59.11 · TR-03 · RF-59.10 · los titulares con turno se enteran de que la ventana se eliminó');
select is(
  (select count(*) from public.audit_log where action = 'selection_window.eliminada' and reason = 'Ventana de reubicación eliminada por el Superadmin'),
  1::bigint, 'TR-01 · RF-59.10 · la eliminación queda auditada con su motivo');
set local role authenticated;
set local request.jwt.claim.sub = 'c5920000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.delete_selection_window((select id from cal)) $$,
  '%RF-59.10%', 'RF-59.10 · eliminar una ventana que ya no existe se explica');

select * from finish();
rollback;
