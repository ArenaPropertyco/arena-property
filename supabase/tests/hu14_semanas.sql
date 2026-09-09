-- HU-14 · RF-14.1…RF-14.10 · HU-13 · RF-13.1, RF-13.3 · D-33 — uso de semanas en
-- la base: guarda de calendario activo (I-08), confirmación hasta 60 días,
-- cancelación hasta 30, liberación, caducidad, auditoría y aviso una sola vez,
-- unicidad de la confirmación y lecturas por RLS (D-16).
begin;
select plan(43);

-- ── Estructura ──────────────────────────────────────────────────────────────
select hasnt_table('public', 'stays', 'D-33 · las estadías por noches desaparecieron');
select hasnt_table('public', 'released_nights', 'D-33 · la bolsa de renta por noches desapareció');
select has_column('public', 'allocations', 'confirmed_at', 'RF-14.1 · la semana elegida guarda su confirmación');
select has_column('public', 'allocations', 'release_reason', 'RF-14.7 · y el motivo de su liberación');
select has_function('public', 'confirm_week', array['uuid', 'uuid', 'integer'], 'RF-14.1 · existe confirm_week');
select has_function('public', 'cancel_week', array['uuid', 'uuid', 'integer'], 'RF-14.6 · existe cancel_week');
select has_function('public', 'release_week', array['uuid', 'uuid', 'integer'], 'RF-14.7 · existe release_week');
select has_function('public', 'expire_unconfirmed_weeks', array['date', 'integer'], 'RF-14.7 · existe la caducidad a 60 días');
select ok((select count(*) from cron.job where jobname = 'expire-unconfirmed-weeks') = 1, 'DT-09 · la caducidad corre a diario en pg_cron');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1400000-0000-4000-8000-000000000001', 'admin.sem@arena.co', '{}'),
  ('c1400000-0000-4000-8000-000000000003', 'dueno1.sem@arena.co', '{}'),
  ('c1400000-0000-4000-8000-000000000004', 'dueno2.sem@arena.co', '{}'),
  ('c1400000-0000-4000-8000-000000000005', 'ajeno.sem@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1400000-0000-4000-8000-000000000001', 'property_admin');
update public.profiles set full_name = 'Ana Ruiz', phone = '+57 300 000 0001' where id = 'c1400000-0000-4000-8000-000000000003';
update public.profiles set full_name = 'Luis Mora', phone = '+57 300 000 0002' where id = 'c1400000-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1400000-0000-4000-8000-000000000001', 'Casa Semanas', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1400000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a1400000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'c1400000-0000-4000-8000-000000000003'
  where property_id = 'a1400000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c1400000-0000-4000-8000-000000000004'
  where property_id = 'a1400000-0000-4000-8000-000000000001' and number = 2;

-- ── Rejilla de 2028 (52 semanas desde el sábado 1 de enero) ─────────────────
create temporary table semanas28 as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2028-01-01'::date + i * 7)::text,
  'ends_on', ('2028-01-01'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a1400000-0000-4000-8000-000000000001', 2028, 2027, null, (select semanas from semanas28));

reset role;
create temporary table cal28 as
  select id from public.season_calendars where property_id = 'a1400000-0000-4000-8000-000000000001' and year = 2028;
create temporary table f1 as
  select id from public.fractions where property_id = 'a1400000-0000-4000-8000-000000000001' and number = 1;
create temporary table f2 as
  select id from public.fractions where property_id = 'a1400000-0000-4000-8000-000000000001' and number = 2;
grant select on cal28, f1, f2 to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000001';

-- D-32 · el Administrador abre la selección y elige por las dos fracciones con
-- titular. Fracción 1: 0 (1–7 ene), 9 (4–10 mar), 17 (29 abr–5 may), 25 (24–30 jun),
-- 33 (19–25 ago), 41 (14–20 oct). Fracción 2: 2, 10, 18, 26 (1–7 jul), 34, 42.
select public.open_calendar_selection((select id from cal28), array[1, 2]);
select public.select_weeks((select id from cal28), (select id from f1), array[0, 9, 17, 25, 33, 41]);
select public.select_weeks((select id from cal28), (select id from f2), array[2, 10, 18, 26, 34, 42]);

-- ── CA-14.0 · sin calendario activo no se confirma ──────────────────────────
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 25) $$,
  '%CA-14.0%', 'CA-14.0 · con el calendario inactivo la confirmación se rechaza (I-08)');

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a1400000-0000-4000-8000-000000000001' and number in (1, 2);
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 25) $$,
  'CA-14.0 · activado el calendario, la misma confirmación se acepta');
select is(
  (select a.confirmed_at is not null from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 25),
  true, 'CA-14.1 · la semana propia queda confirmada');

-- ── CA-14.1 · CA-14.2 · solo semanas propias, una sola vez ──────────────────
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 26) $$,
  '%RF-14.3%', 'CA-14.1 · una semana de otra fracción se rechaza');
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 25) $$,
  '%CA-14.2%', 'CA-14.2 · CA-14.9 · una semana ya confirmada no se confirma de nuevo: solo una confirmación queda registrada');
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 45) $$,
  '%RF-14.3%', 'RF-14.3 · una semana que nadie eligió tampoco se confirma');

-- ── CA-14.0b · primer año tras la activación ────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_activated_at = '2028-07-01' where id = (select id from f2);
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000004';
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f2), 2) $$,
  '%CA-14.0b%', 'CA-14.0b · activada en julio, la semana de enero no se confirma');
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f2), 26) $$,
  'CA-14.0b · la semana posterior a la activación sí se confirma');

-- ── CA-14.4 · bloqueada o ya en renta ───────────────────────────────────────
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000001';
select public.block_weeks((select id from cal28), array[33], 'Mantenimiento de piscina');
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 33) $$,
  '%RF-15.2%', 'CA-14.4 · una semana bloqueada por el Administrador se rechaza');
select lives_ok(
  $$ select public.release_week((select id from cal28), (select id from f1), 41) $$,
  'CA-14.8 · el titular libera una semana propia a la bolsa de renta');
select is(
  (select a.release_reason from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 41),
  'voluntary', 'CA-14.8 · la semana liberada queda en la bolsa con su motivo');
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 41) $$,
  '%CA-14.2%', 'CA-14.4 · CA-14.6 · una semana ya en la bolsa de renta no se confirma');
select throws_like(
  $$ select public.release_week((select id from cal28), (select id from f1), 41) $$,
  '%CA-14.8%', 'RF-14.7 · una semana liberada no se libera dos veces');

-- ── CA-14.5 · cancelación hasta 30 días antes, relativo a hoy ───────────────
-- Un calendario del año en curso (y del siguiente si hace falta) con criterio de
-- solo bajas: la fracción 1 elige las semanas que contienen «hoy + 75» y «hoy + 20».
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000001';
create or replace function pg_temp.rejilla_baja(anio integer) returns jsonb language sql as $$
  with ancla as (
    select make_date(anio, 1, 1) + ((6 - extract(dow from make_date(anio, 1, 1))::int + 7) % 7) as sabado
  )
  select jsonb_agg(jsonb_build_object(
    'index', i, 'starts_on', (sabado + i * 7)::text, 'ends_on', (sabado + i * 7 + 7)::text, 'season', 'baja', 'peak_block', null
  ) order by i)
  from ancla, generate_series(0, 52) as i
  where sabado + i * 7 + 6 <= make_date(anio, 12, 31);
$$;
create or replace function pg_temp.semana_de(dia date) returns integer language sql as $$
  select ((dia - (make_date(extract(year from dia)::int, 1, 1) + ((6 - extract(dow from make_date(extract(year from dia)::int, 1, 1))::int + 7) % 7))) / 7)::int;
$$;
create temporary table fechas as
  select case when pg_temp.semana_de(current_date + 75) < 0 then current_date + 82 else current_date + 75 end as lejana,
         case when pg_temp.semana_de(current_date + 20) < 0 then current_date + 27 else current_date + 20 end as cercana;
select public.guardar_calendario('a1400000-0000-4000-8000-000000000001', extract(year from (select lejana from fechas))::int, 2025, null,
  pg_temp.rejilla_baja(extract(year from (select lejana from fechas))::int));
select public.guardar_calendario('a1400000-0000-4000-8000-000000000001', extract(year from (select cercana from fechas))::int, 2025, null,
  pg_temp.rejilla_baja(extract(year from (select cercana from fechas))::int));
create temporary table cal_lejana as
  select id from public.season_calendars where property_id = 'a1400000-0000-4000-8000-000000000001' and year = extract(year from (select lejana from fechas))::int;
create temporary table cal_cercana as
  select id from public.season_calendars where property_id = 'a1400000-0000-4000-8000-000000000001' and year = extract(year from (select cercana from fechas))::int;
reset role;
set local request.jwt.claim.sub = '';
create temporary table sel as
  select (select id from cal_lejana) = (select id from cal_cercana) as misma,
         (select array(select distinct unnest(array[pg_temp.semana_de(lejana), pg_temp.semana_de(cercana)]) order by 1) from fechas) as semanas;
update public.season_calendars
   set criteria = (select jsonb_build_object('alta', 0, 'media_alta', 0, 'media', 0, 'baja', case when misma then cardinality(semanas) else 1 end) from sel)
 where id in ((select id from cal_lejana), (select id from cal_cercana));
grant select on sel, cal_lejana, cal_cercana, fechas to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select id from cal_lejana), array[1, 2]);
select public.select_weeks((select id from cal_lejana), (select id from f1),
  case when (select misma from sel) then (select semanas from sel) else array[pg_temp.semana_de((select lejana from fechas))] end);
do $$
begin
  if not (select misma from sel) then
    perform public.open_calendar_selection((select id from cal_cercana), array[1, 2]);
    perform public.select_weeks((select id from cal_cercana), (select id from f1), array[pg_temp.semana_de((select cercana from fechas))]);
  end if;
end;
$$;

set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.confirm_week((select id from cal_lejana), (select id from f1), pg_temp.semana_de((select lejana from fechas))) $$,
  'RF-14.7 · a 75 días la semana todavía se puede confirmar');
select throws_like(
  $$ select public.confirm_week((select id from cal_cercana), (select id from f1), pg_temp.semana_de((select cercana from fechas))) $$,
  '%RF-14.7%', 'RF-14.7 · a 20 días la confirmación ya está cerrada');
select lives_ok(
  $$ select public.cancel_week((select id from cal_lejana), (select id from f1), pg_temp.semana_de((select lejana from fechas))) $$,
  'CA-14.5 · a 75 días de la entrada la cancelación se acepta');
select is(
  (select a.release_reason from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal_lejana) and w.index = pg_temp.semana_de((select lejana from fechas))),
  'cancelled', 'CA-14.5 · la semana cancelada queda en la bolsa de renta');
select throws_like(
  $$ select public.confirm_week((select id from cal_lejana), (select id from f1), pg_temp.semana_de((select lejana from fechas))) $$,
  '%CA-14.6%', 'CA-14.6 · una semana cancelada no vuelve a confirmarse');

-- La semana cercana se confirma sin sesión (como haría un Administrador a tiempo)
-- para probar que a 20 días la cancelación se rechaza.
reset role;
set local request.jwt.claim.sub = '';
set local app.audit_reason = 'Confirmada por el Administrador para la prueba';
update public.allocations a set confirmed_at = now()
  from public.calendar_weeks w
 where w.id = a.week_id and a.calendar_id = (select id from cal_cercana) and w.index = pg_temp.semana_de((select cercana from fechas));
set local app.audit_reason = '';
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.cancel_week((select id from cal_cercana), (select id from f1), pg_temp.semana_de((select cercana from fechas))) $$,
  '%RF-14.6%', 'CA-14.5 · a 20 días de la entrada la cancelación se rechaza');

-- ── CA-14.7 · caducidad a 60 días con aviso ─────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
-- Al 15 de enero de 2028 caducan la 9 de la fracción 1 (26 feb) y la 2 y la 10 de la fracción 2.
select is(
  (select public.expire_unconfirmed_weeks('2028-01-15'::date)), 3,
  'RF-14.7 · la tarea diaria caduca las semanas sin confirmar dentro del plazo');
select is(
  (select public.expire_unconfirmed_weeks('2028-01-15'::date)), 0,
  'RF-14.7 · la tarea es idempotente: una segunda pasada no caduca nada');
select is(
  (select a.release_reason from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 9),
  'expired', 'CA-14.7 · una semana sin confirmar a 59 días de su entrada ya está en la bolsa de renta');
select is(
  (select a.confirmed_at is not null and a.released_at is null from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 25),
  true, 'RF-14.7 · la semana confirmada no caduca');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'expired_weeks'
      and n.entity_id like (select id from cal28)::text || '%'
      and r.recipient_id = 'c1400000-0000-4000-8000-000000000003'),
  1::bigint, 'CA-14.7 · el Propietario fue avisado, una sola vez');

-- ── RF-14.10 · TR-01 · TR-03 · auditoría y notificación, una sola vez ───────
create temporary table confirmada as
  select a.id from public.allocations a join public.calendar_weeks w on w.id = a.week_id
   where a.calendar_id = (select id from cal28) and w.index = 25;
select is(
  (select count(*) from public.audit_log where action = 'allocation.actualizada' and entity_id = (select id from confirmada) and reason = 'Semana confirmada como uso propio'),
  1::bigint, 'RF-14.10 · CA-A.1 · confirmar deja una entrada de auditoría con su motivo');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'stay_confirmed' and n.entity_id = (select id from confirmada)::text),
  1::bigint, 'RF-14.10 · CA-16.3 · confirmar emite una notificación de reserva confirmada, una sola vez');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_release' and r.recipient_id = 'c1400000-0000-4000-8000-000000000003'),
  1::bigint, 'RF-14.10 · liberar notifica una sola vez');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_cancellation' and r.recipient_id = 'c1400000-0000-4000-8000-000000000003'),
  1::bigint, 'RF-14.10 · cancelar notifica una sola vez');

-- ── HU-13 · lecturas por RLS y copropietarios sin contacto ──────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000004';
select ok(
  (select count(*) from public.allocations a where a.calendar_id = (select id from cal28) and a.fraction_id = (select id from f1) and a.confirmed_at is not null) > 0,
  'RF-13.3 · D-16 · un copropietario ve las semanas confirmadas de las otras fracciones');
select is(
  (select owner_name from public.copropietarios_de('a1400000-0000-4000-8000-000000000001') where fraction_number = 1),
  'Ana Ruiz', 'CA-13.2 · el copropietario ve el nombre y la fracción del otro titular');
select is(
  (select proargnames from pg_proc where proname = 'copropietarios_de' and pronamespace = 'public'::regnamespace),
  array['propiedad', 'fraction_number', 'owner_name', 'calendar_active'],
  'CA-13.2 · la función no expone correo ni teléfono');

set local request.jwt.claim.sub = 'c1400000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal28)),
  0::bigint, 'CA-13.3 · sin fracción en la propiedad no se ven las semanas elegidas');
select is(
  (select count(*) from public.week_blocks where property_id = 'a1400000-0000-4000-8000-000000000001'),
  0::bigint, 'CA-13.3 · ni los bloqueos');
select throws_like(
  $$ select * from public.copropietarios_de('a1400000-0000-4000-8000-000000000001') $$,
  '%CA-13.3%', 'CA-13.3 · ni a los copropietarios');

select * from finish();
rollback;
