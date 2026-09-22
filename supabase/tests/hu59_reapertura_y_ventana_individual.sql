-- HU-59 · RF-59.1, RF-59.6, RF-59.9 · HU-12 · RF-12.4 · D-47 — la ventana se
-- reabre, el comprador tardío recibe turno y la ventana individual del Superadmin
-- sustituye al turno general sin tocar las demás reglas.
begin;
select plan(32);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'fraction_windows', 'RF-59.9 · existe fraction_windows');
select is((select relforcerowsecurity from pg_class where oid = 'public.fraction_windows'::regclass), true, 'RF-59.9 · la ventana individual fuerza RLS');
select has_function('public', 'open_fraction_window', array['uuid', 'integer', 'integer'], 'RF-59.9 · existe open_fraction_window');
select has_function('public', 'close_fraction_window', array['uuid'], 'RF-59.9 · existe close_fraction_window');
select has_function('public', 'reopen_selection_window', array['uuid'], 'RF-59.6 · existe reopen_selection_window');
select has_trigger('public', 'fractions', 'fractions_con_turno', 'RF-12.4 · D-47 · la venta da turno');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c5910000-0000-4000-8000-000000000001', 'admin.rea@arena.co', '{}'),
  ('c5910000-0000-4000-8000-000000000002', 'super.rea@arena.co', '{}'),
  ('c5910000-0000-4000-8000-000000000003', 'dueno1.rea@arena.co', '{}'),
  ('c5910000-0000-4000-8000-000000000004', 'dueno4.rea@arena.co', '{}'),
  ('c5910000-0000-4000-8000-000000000005', 'dueno5.rea@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c5910000-0000-4000-8000-000000000001', 'property_admin'),
  ('c5910000-0000-4000-8000-000000000002', 'superadmin');

set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a5910000-0000-4000-8000-000000000001', 'Casa Reapertura', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a5910000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a5910000-0000-4000-8000-000000000001' and number in (1, 2, 3, 4, 5);
update public.fractions set status = 'sold', owner_id = 'c5910000-0000-4000-8000-000000000003'
  where property_id = 'a5910000-0000-4000-8000-000000000001' and number in (1, 2, 3);

create or replace function pg_temp.rejilla(ancla date) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (ancla + i * 7)::text, 'ends_on', (ancla + i * 7 + 7)::text,
    'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
    'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
  ) order by i) from generate_series(0, 51) as i;
$$;
select public.guardar_calendario('a5910000-0000-4000-8000-000000000001', 2028, 2027, null, pg_temp.rejilla('2028-01-01'));

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a5910000-0000-4000-8000-000000000001' and number in (1, 2, 3);
create temporary table cal as
  select id from public.season_calendars where property_id = 'a5910000-0000-4000-8000-000000000001' and year = 2028;
create temporary table fr as
  select number, id from public.fractions where property_id = 'a5910000-0000-4000-8000-000000000001';
grant select on cal, fr to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select id from cal), array[1, 2, 3]);

-- ── RF-12.4 · D-47 · el comprador tardío recibe el siguiente turno ──────────
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'sold', owner_id = 'c5910000-0000-4000-8000-000000000004', calendar_active = true
  where id = (select id from fr where number = 4);
select is(
  (select t.position::integer from public.selection_turns t where t.calendar_id = (select id from cal) and t.fraction_id = (select id from fr where number = 4)),
  3, 'RF-12.4 · D-47 · la fracción vendida con la selección abierta recibe el siguiente turno');
select is(
  (select count(*) from public.selection_turns t where t.calendar_id = (select id from cal)),
  4::bigint, 'RF-12.4 · D-47 · los turnos anteriores no se tocan');
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000004';
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 4), array[3, 11, 19, 27, 35, 43]) $$,
  '%CA-12.5%', 'CA-12.5 · el comprador tardío espera a que elijan los turnos anteriores');

-- ── RF-59.9 · la ventana individual ─────────────────────────────────────────
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.open_fraction_window((select id from cal), 4, 48) $$,
  '%RF-59.9%', 'RF-59.9 · el Administrador no abre ventanas individuales');
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.open_fraction_window((select id from cal), 5, 48) $$,
  '%RF-59.9%', 'RF-59.9 · sin titular no hay a quién abrirle la ventana');
select throws_like(
  $$ select public.open_fraction_window((select id from cal), 4, 0) $$,
  '%RF-59.9%', 'RF-59.9 · la ventana individual dura al menos una hora');
select lives_ok(
  $$ select public.open_fraction_window((select id from cal), 4, 48) $$,
  'RF-59.9 · el Superadmin abre una ventana individual a la fracción 4');
select public.open_fraction_window((select id from cal), 4, 24);
select is(
  (select count(*) from public.fraction_windows where calendar_id = (select id from cal) and closed_at is null),
  1::bigint, 'RF-59.9 · una nueva ventana individual reemplaza a la anterior: una abierta por fracción');
reset role;
set local request.jwt.claim.sub = '';
select ok(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.entity_type = 'fraction_window' and r.recipient_id = 'c5910000-0000-4000-8000-000000000004') > 0,
  'RF-59.9 · TR-03 · el titular recibe aviso de su ventana individual');
select is(
  (select count(*) from public.audit_log where action = 'fraction_window.creada' and reason like 'Ventana individual abierta%'),
  2::bigint, 'RF-59.9 · TR-01 · cada apertura queda auditada con su motivo');
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000004';
select lives_ok(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 4), array[3, 11, 19, 27, 35, 43]) $$,
  'RF-59.9 · en su ventana individual la fracción elige sin esperar el turno');
select lives_ok(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 4), 27, 47) $$,
  'RF-59.9 · en su ventana individual reubica aunque no haya ventana general');
select throws_like(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 4), 47, 5) $$,
  '%CA-59.1%', 'RF-59.9 · la ventana individual no relaja la regla de temporada');
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
select lives_ok(
  $$ select public.close_fraction_window((select id from public.fraction_windows where calendar_id = (select id from cal) and closed_at is null)) $$,
  'RF-59.9 · el Superadmin cierra la ventana individual');
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000004';
select throws_like(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 4), 47, 48) $$,
  '%RF-59.1%', 'RF-59.9 · cerrada la individual, vuelve la regla general');

-- ── RF-59.6 · D-47 · la ventana cerrada se reabre ───────────────────────────
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
select public.configure_selection_window((select id from cal), now() - interval '1 hour', 16, 48, null);
select public.close_selection_window((select id from cal));
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reopen_selection_window((select id from cal)) $$,
  '%RF-59.6%', 'RF-59.6 · el Administrador cierra pero no reabre');
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
select lives_ok(
  $$ select public.reopen_selection_window((select id from cal)) $$,
  'RF-59.6 · D-47 · el Superadmin reabre la ventana cerrada antes de tiempo');
select is(
  (select closed_at is null from public.selection_windows where calendar_id = (select id from cal)),
  true, 'RF-59.6 · D-47 · la ventana vuelve a estar abierta');
select lives_ok(
  $$ select public.reopen_selection_window((select id from cal)) $$,
  'RF-59.6 · reabrir una ventana abierta no hace nada');
select throws_like(
  $$ select public.configure_selection_window((select id from cal), now() - interval '30 days', 16, 48, null) $$,
  '%RF-59.1%', 'RF-59.1 · D-47 · una ventana que terminaría en el pasado no se guarda');
select public.close_selection_window((select id from cal));
reset role;
set local request.jwt.claim.sub = '';
update public.selection_windows set closes_at = now() - interval '1 minute' where calendar_id = (select id from cal);
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.reopen_selection_window((select id from cal)) $$,
  '%ya venció%', 'RF-59.6 · D-47 · una ventana vencida no se reabre sin nuevas fechas');
select lives_ok(
  $$ select public.configure_selection_window((select id from cal), now() - interval '10 days', 16, 1, null) $$,
  'RF-59.1 · D-47 · guardarla con nuevas fechas la reabre');
select is(
  (select closed_at is null from public.selection_windows where calendar_id = (select id from cal)),
  true, 'RF-59.1 · D-47 · reconfigurada, ya no está cerrada');

-- ── D-47 · sin turno en la ventana general se entra por orden de llegada ───
-- La ventana quedó con 4 turnos de una hora hace 10 días: está por orden de llegada.
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'sold', owner_id = 'c5910000-0000-4000-8000-000000000005', calendar_active = true
  where id = (select id from fr where number = 5);
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000001';
select public.select_weeks((select id from cal), (select id from fr where number = 5), array[4, 12, 20, 28, 36, 44]);
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.selection_window_turns t join public.selection_windows w on w.id = t.window_id
    where w.calendar_id = (select id from cal) and t.fraction_id = (select id from fr where number = 5)),
  0::bigint, 'D-47 · la fracción vendida después de configurar la ventana no tiene turno en ella');
select lives_ok(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 5), 28, 48) $$,
  'D-47 · sin turno, la fracción reubica en la fase por orden de llegada');
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000002';
-- Con turnos por delante (48 horas cada uno desde hace una hora), quien no tiene turno espera.
select public.configure_selection_window((select id from cal), now() - interval '1 hour', 16, 48, array[1, 2, 3, 4, 5]);
reset role;
set local request.jwt.claim.sub = '';
-- Simula la venta posterior a esta configuración: la fracción 5 se queda sin franja.
delete from public.selection_window_turns where fraction_id = (select id from fr where number = 5);
set local role authenticated;
set local request.jwt.claim.sub = 'c5910000-0000-4000-8000-000000000005';
select throws_like(
  $$ select public.relocate_week((select id from cal), (select id from fr where number = 5), 48, 49) $$,
  '%orden de llegada%', 'D-47 · sin turno y con turnos por delante, espera al orden de llegada');

select * from finish();
rollback;
