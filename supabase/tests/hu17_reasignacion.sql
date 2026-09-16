-- HU-17 · RF-17.1…RF-17.4 · HU-16 · RF-16.1, RF-16.2 · TR-01 · TR-03 — la
-- reasignación administrativa de una semana: solo sobre propiedades asignadas
-- (CA-17.4), con motivo siempre (RF-17.4), sin solapamiento (CA-17.2), cruzando de
-- temporada solo por decisión explícita y auditada (CA-17.3), con aviso al
-- titular afectado y a nadie más (CA-17.1, CA-16.1, CA-16.2). Resuelve el
-- conflicto que un bloqueo de HU-15 dejó abierto.
begin;
select plan(31);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_function('public', 'reassign_week', array['uuid', 'integer', 'integer', 'integer', 'text', 'boolean'],
  'RF-17.1 · existe reassign_week');
select is(
  (select count(*) from public.audit_reason_required where action = 'allocation.actualizada'),
  1::bigint, 'RF-17.4 · RF-A.4 · ningún cambio de una semana asignada se audita sin motivo');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1700000-0000-4000-8000-000000000001', 'admin.rea@arena.co', '{}'),
  ('c1700000-0000-4000-8000-000000000002', 'ajeno.rea@arena.co', '{}'),
  ('c1700000-0000-4000-8000-000000000003', 'dueno1.rea@arena.co', '{}'),
  ('c1700000-0000-4000-8000-000000000004', 'dueno2.rea@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1700000-0000-4000-8000-000000000001', 'property_admin'),
  ('c1700000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1700000-0000-4000-8000-000000000001', 'Casa Reasignación', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1700000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a1700000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'c1700000-0000-4000-8000-000000000003'
  where property_id = 'a1700000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c1700000-0000-4000-8000-000000000004'
  where property_id = 'a1700000-0000-4000-8000-000000000001' and number = 2;

-- Rejilla de 2028: 0–7 alta, 8–15 media-alta, 16–23 media, 24–51 baja.
create temporary table semanas28 as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2028-01-01'::date + i * 7)::text,
  'ends_on', ('2028-01-01'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a1700000-0000-4000-8000-000000000001', 2028, 2027, null, (select semanas from semanas28));

reset role;
create temporary table cal28 as
  select id from public.season_calendars where property_id = 'a1700000-0000-4000-8000-000000000001' and year = 2028;
create temporary table f1 as
  select id from public.fractions where property_id = 'a1700000-0000-4000-8000-000000000001' and number = 1;
create temporary table f2 as
  select id from public.fractions where property_id = 'a1700000-0000-4000-8000-000000000001' and number = 2;
grant select on cal28, f1, f2 to authenticated;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true where id in ((select id from f1), (select id from f2));
set local role authenticated;
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';

-- D-32 · el Administrador abre la selección y elige por las dos fracciones.
-- Fracción 1: 0, 9, 17, 25, 33, 41. Fracción 2: 2, 10, 18, 26, 34, 42.
select public.open_calendar_selection((select id from cal28), array[1, 2]);
select public.select_weeks((select id from cal28), (select id from f1), array[0, 9, 17, 25, 33, 41]);
select public.select_weeks((select id from cal28), (select id from f2), array[2, 10, 18, 26, 34, 42]);

-- ── RF-17.1 · crear: el Administrador confirma en nombre del titular ────────
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 33) $$,
  'RF-17.1 · el Administrador asignado confirma una semana en nombre del titular');

-- El titular confirma la 25 como uso propio: esa es la «reserva» que HU-17 mueve.
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 25) $$,
  'RF-14.1 · el titular confirma la semana 25');
create temporary table alloc25 as
  select a.id from public.allocations a join public.calendar_weeks w on w.id = a.week_id
   where a.calendar_id = (select id from cal28) and w.index = 25;

-- ── RF-15.4 · un bloqueo pisa la semana confirmada y deja el conflicto ──────
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';
select public.block_weeks((select id from cal28), array[25, 29], 'Obra en la cubierta');
select is(
  (select count(*) from public.calendar_conflicts where allocation_id = (select id from alloc25) and status = 'open'),
  1::bigint, 'RF-15.4 · el bloqueo deja abierto el conflicto que HU-17 debe resolver');

-- ── CA-17.4 · sin la propiedad asignada no hay acción posible ───────────────
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 25, 27, 'Intento ajeno') $$,
  '%CA-17.4%', 'CA-17.4 · un Administrador sin la propiedad asignada no reasigna');

-- ── RF-17.4 · CA-A.3 · sin motivo no hay operación ni registro ──────────────
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 25, 27, '   ') $$,
  '%RF-17.4%', 'RF-17.4 · la reasignación sin motivo se rechaza');
select is(
  (select w.index from public.allocations a join public.calendar_weeks w on w.id = a.week_id where a.id = (select id from alloc25)),
  25::smallint, 'CA-A.3 · sin motivo la semana sigue donde estaba');

-- ── CA-17.2 · RF-17.3 · invariantes del motor ───────────────────────────────
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 25, 26, 'Acomodar la obra') $$,
  '%CA-17.2%', 'CA-17.2 · reasignar a una semana de otra fracción generaría solapamiento: se rechaza');
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 25, 29, 'Acomodar la obra') $$,
  '%RF-15.2%', 'RF-17.3 · RF-15.2 · una semana bloqueada no es destino');
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 25, 99, 'Acomodar la obra') $$,
  '%RF-17.3%', 'RF-17.3 · una semana fuera de la rejilla no es destino');
select throws_like(
  $$ select public.reassign_week((select id from cal28), 2, 25, 27, 'Acomodar la obra') $$,
  '%RF-17.3%', 'RF-17.3 · la semana de origen debe ser de la fracción indicada');

-- ── CA-17.1 · la reasignación avisa al titular y queda auditada ─────────────
select lives_ok(
  $$ select public.reassign_week((select id from cal28), 1, 25, 27, 'Obra en la cubierta: se mueve la semana') $$,
  'CA-17.1 · RF-17.1 · misma temporada, destino libre y motivo: la reserva se mueve');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join public.fractions f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal28) and w.index = 27),
  1::smallint, 'CA-17.1 · la semana 27 es ahora de la fracción 1');
select is(
  (select count(*) from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 25),
  0::bigint, 'CA-17.1 · la semana 25 quedó libre');
select is(
  (select confirmed_at is not null from public.allocations where id = (select id from alloc25)),
  true, 'RF-17.1 · la confirmación del titular viaja con la semana: no se le cancela nada');
select is(
  (select count(*) from public.calendar_conflicts where allocation_id = (select id from alloc25) and status = 'open'),
  0::bigint, 'RF-15.4 · RF-17.1 · el conflicto del bloqueo quedó resuelto');

-- La auditoría de una asignación no lleva propiedad: se lee sin sesión (TR-01 · RF-A.6).
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select (actor_id, reason, entity_id) from public.audit_log
    where action = 'allocation.actualizada' and reason = 'Obra en la cubierta: se mueve la semana'),
  ('c1700000-0000-4000-8000-000000000001'::uuid, 'Obra en la cubierta: se mueve la semana'::text, (select id from alloc25)),
  'RF-17.4 · CA-17.1 · TR-01 · queda registrado: acción, motivo, semana afectada y autor');
select is(
  (select occurred_at is not null and next_state ->> 'week_id' = (select w.id::text from public.calendar_weeks w where w.calendar_id = (select id from cal28) and w.index = 27)
     from public.audit_log where action = 'allocation.actualizada' and reason = 'Obra en la cubierta: se mueve la semana'),
  true, 'RF-17.4 · TR-01 · con fecha y con el estado posterior que apunta a la semana nueva');
select is(
  (select array_agg(r.recipient_id) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_reassignment' and n.property_id = 'a1700000-0000-4000-8000-000000000001'),
  array['c1700000-0000-4000-8000-000000000003']::uuid[],
  'CA-16.1 · RF-16.2 · el conjunto de destinatarios es exactamente el titular de la fracción 1/8');

set local role authenticated;
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.entity_type = 'week_reassignment' and r.recipient_id = 'c1700000-0000-4000-8000-000000000003'),
  1::bigint, 'CA-17.1 · RF-17.2 · el titular afectado recibe el aviso de la reasignación');
select ok(
  (select n.payload ->> 'detail' like '%semana 26%semana 28%' and n.payload ->> 'reason' = 'Obra en la cubierta: se mueve la semana'
     from public.notifications n where n.entity_type = 'week_reassignment'),
  'RF-17.2 · el aviso dice de qué semana a cuál y por qué');
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.entity_type = 'week_reassignment' and r.recipient_id = 'c1700000-0000-4000-8000-000000000004'),
  0::bigint, 'CA-16.2 · el titular de la fracción 2/8 no recibe el aviso de un cambio ajeno');

-- ── CA-17.3 · la excepción a la regla de temporada ──────────────────────────
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 27, 4, '', true) $$,
  '%CA-17.3%', 'CA-17.3 · la excepción de temporada sin motivo se rechaza');
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 27, 4, 'Pico de obra en la cubierta') $$,
  '%CA-17.3%', 'CA-17.3 · con motivo pero sin decisión explícita, cambiar de temporada se rechaza');
select lives_ok(
  $$ select public.reassign_week((select id from cal28), 1, 27, 4, 'Pico de obra en la cubierta', true) $$,
  'CA-17.3 · con motivo y decisión explícita, la excepción procede');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join public.fractions f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal28) and w.index = 4),
  1::smallint, 'CA-17.3 · la semana 4 (alta) es ahora de la fracción 1');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log
    where action = 'allocation.actualizada' and entity_id = (select id from alloc25)
      and reason like '%baja → alta%' and reason like '%Pico de obra en la cubierta%'),
  1::bigint, 'CA-17.3 · RF-17.3 · la excepción queda auditada con las temporadas y el motivo');
set local role authenticated;

-- ── RF-17.3 · una semana ya en la bolsa de renta no se reasigna ─────────────
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.release_week((select id from cal28), (select id from f1), 41) $$,
  'RF-14.7 · el titular libera la semana 41');
set local request.jwt.claim.sub = 'c1700000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 41, 43, 'Recolocar') $$,
  '%RF-17.3%', 'RF-17.3 · una semana liberada a la bolsa de renta no se reasigna');
select throws_like(
  $$ select public.reassign_week((select id from cal28), 1, 9, 9, 'Sin moverla') $$,
  '%RF-17.3%', 'RF-17.3 · la semana de destino debe ser distinta de la de origen');

select * from finish();
rollback;
