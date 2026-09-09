-- HU-12 · RF-12.2…RF-12.8 · D-32 — el calendario persistido: rejilla clasificada,
-- apertura con orden de turnos, selección de semanas por cada fracción,
-- intercambios del Administrador, solicitudes del Propietario y liberación a 60
-- días. Las reglas puras viven en `shared/scheduling`; la base las repite.
begin;
select plan(64);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'season_calendars', 'existe season_calendars');
select has_table('public', 'calendar_weeks', 'existe calendar_weeks');
select has_table('public', 'allocations', 'existe allocations');
select has_table('public', 'selection_turns', 'RF-12.4 · existe selection_turns');
select has_table('public', 'week_swap_requests', 'RF-12.6 · existe week_swap_requests');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.season_calendars'::regclass, 'public.calendar_weeks'::regclass, 'public.allocations'::regclass,
                'public.selection_turns'::regclass, 'public.week_swap_requests'::regclass)),
  true, 'todas las tablas del calendario fuerzan RLS');
select has_column('public', 'calendar_weeks', 'peak_block', 'RF-12.2 · la semana guarda su bloque pico');
select hasnt_function('public', 'publicar_calendario', array['uuid', 'jsonb', 'boolean'], 'D-32 · el reparto automático desapareció');

-- ── Cuentas, propiedad y tres compras cerradas ──────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1200000-0000-4000-8000-000000000001', 'admin.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000002', 'ajeno.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000003', 'dueno1.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000004', 'dueno2.cal@arena.co', '{}'),
  ('c1200000-0000-4000-8000-000000000005', 'dueno3.cal@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1200000-0000-4000-8000-000000000001', 'property_admin'),
  ('c1200000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1200000-0000-4000-8000-000000000001', 'Casa Calendario', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1200000-0000-4000-8000-000000000001', array[100000000::bigint]);

-- Las fracciones 1, 2 y 3 se venden por el flujo real (HU-06): así existe el
-- plan de pagos del que sale el orden de compra (RF-12.4).
insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, invitee_id, agreed_price)
select ('e1200000-0000-4000-8000-00000000000' || n)::uuid,
       (select id from public.fractions where property_id = 'a1200000-0000-4000-8000-000000000001' and number = n),
       'a1200000-0000-4000-8000-000000000001',
       'dueno' || n || '.cal@arena.co',
       ('c1200000-0000-4000-8000-00000000000' || (n + 2))::uuid,
       100000000
  from generate_series(1, 3) as n;
select public.cerrar_compra('e1200000-0000-4000-8000-000000000001');
select public.cerrar_compra('e1200000-0000-4000-8000-000000000002');
select public.cerrar_compra('e1200000-0000-4000-8000-000000000003');

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

-- Una rejilla imposible para 2028: solo 7 semanas altas.
create temporary table semanas28_json as
select jsonb_agg(jsonb_build_object(
  'index', i, 'starts_on', ('2028-01-01'::date + i * 7)::text, 'ends_on', ('2028-01-01'::date + i * 7 + 7)::text,
  'season', case when i < 7 then 'alta' when i < 15 then 'media_alta' when i < 23 then 'media' else 'baja' end, 'peak_block', null
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a1200000-0000-4000-8000-000000000001', 2028, 2026, null, (select semanas from semanas28_json));

reset role;
-- D-31 · el turno exige calendario activo: se enciende sin sesión, como la derivación.
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a1200000-0000-4000-8000-000000000001' and number in (1, 2, 3);
create temporary table cal as
  select id from public.season_calendars where property_id = 'a1200000-0000-4000-8000-000000000001' and year = 2027;
create temporary table cal28 as
  select id from public.season_calendars where property_id = 'a1200000-0000-4000-8000-000000000001' and year = 2028;
create temporary table fr as
  select number, id from public.fractions where property_id = 'a1200000-0000-4000-8000-000000000001';
grant select on cal, cal28, fr to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';

-- ── RF-12.7 · CA-12.7 · rejilla imposible ───────────────────────────────────
select throws_like(
  $$ select public.open_calendar_selection((select id from cal28)) $$,
  '%CA-12.7%', 'CA-12.7 · con solo 7 semanas altas la apertura se rechaza y no persiste nada');
select is(
  (select published_at from public.season_calendars where id = (select id from cal28)),
  null, 'CA-12.7 · el calendario imposible sigue sin abrir');

-- ── RF-12.4 · CA-12.4 · el orden sugerido del primer año es el de compra ────
-- Las tres compras se cerraron en la misma transacción (misma fecha): desempata
-- el número; las fracciones sin titular quedan fuera.
select is(
  (select public.suggested_selection_order((select id from cal))),
  array[1, 2, 3], 'CA-12.4 · el orden sugerido va por fecha de compra y deja fuera las fracciones sin titular');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select throws_ok(
  $$ select public.open_calendar_selection((select id from cal)) $$,
  'P0001', null, 'CA-11.3 · un Administrador ajeno no abre la selección');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.open_calendar_selection((select id from cal), array[1, 1, 2]) $$,
  '%CA-12.6%', 'CA-12.6 · un orden con repeticiones se rechaza');
select throws_like(
  $$ select public.open_calendar_selection((select id from cal), array[4, 1, 2, 3]) $$,
  '%CA-12.6%', 'CA-12.6 · un orden con una fracción sin titular se rechaza');
-- El Administrador decide otro orden: 3, 1, 2.
select is(
  (select public.open_calendar_selection((select id from cal), array[3, 1, 2])),
  array[3, 1, 2], 'RF-12.5 · el Administrador abre la selección con el orden que fija');
select is(
  (select array_agg(f.number order by t.position) from public.selection_turns t join fr f on f.id = t.fraction_id where t.calendar_id = (select id from cal)),
  array[3, 1, 2]::smallint[], 'RF-12.4 · los turnos quedan persistidos en ese orden');
select is(
  (select published_at is not null from public.season_calendars where id = (select id from cal)),
  true, 'RF-12.4 · el calendario queda abierto');

-- ── RF-12.4 · CA-12.5 · cada fracción elige en su turno ─────────────────────
-- Con el calendario inactivo la fracción 3 no elige y tampoco bloquea a la 1.
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = false where id = (select id from fr where number = 3);
set local role authenticated;
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000005';
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 3), array[0, 8, 16, 24, 25, 26]) $$,
  '%CA-14.0%', 'CA-14.0 · D-31 · sin calendario activo la fracción no elige semanas');
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[0, 8, 16, 24]) $$,
  '%CA-12.2%', 'CA-12.5 · una fracción inactiva no bloquea a la siguiente (la 1 ya tiene el turno)');
reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true where id = (select id from fr where number = 3);
set local role authenticated;

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[0, 8, 16, 24, 25, 26]) $$,
  '%CA-12.5%', 'CA-12.5 · la segunda del orden no elige mientras la primera no termine');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000005';
select is(
  (select public.select_weeks((select id from cal), (select id from fr where number = 3), array[0, 8, 16, 24, 25, 26])),
  6, 'RF-12.3 · la primera del orden elige sus 6 semanas');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[1, 2, 9, 27, 28, 29]) $$,
  '%CA-12.2%', 'CA-12.2 · dos altas y ninguna media se rechazan por composición');
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[1, 9, 17, 27, 28]) $$,
  '%CA-12.2%', 'CA-12.2 · cinco semanas se rechazan por cantidad');
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[0, 9, 17, 27, 28, 29]) $$,
  '%CA-12.3%', 'CA-12.3 · una semana ya elegida por otra fracción se rechaza');
select lives_ok(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[1, 9, 17, 27, 28, 29]) $$,
  'CA-12.5 · terminada la primera, la segunda elige entre lo que queda');
select throws_like(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 1), array[2, 10, 18, 30, 31, 32]) $$,
  '%CA-12.5%', 'CA-12.5 · una fracción no elige dos veces');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000004';
select lives_ok(
  $$ select public.select_weeks((select id from cal), (select id from fr where number = 2), array[2, 10, 18, 30, 31, 32]) $$,
  'CA-12.5 · la tercera elige tras la segunda');
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal)),
  18::bigint, 'CA-12.2 · tres fracciones con 6 semanas cada una');
select is(
  (select count(*) from public.calendar_weeks w where w.calendar_id = (select id from cal)
     and not exists (select 1 from public.allocations a where a.week_id = w.id)),
  34::bigint, 'CA-12.8 · las semanas que nadie eligió quedan libres, en la bolsa del Administrador');

-- D-16 · lecturas
select is(
  (select count(*) from public.selection_turns where calendar_id = (select id from cal)),
  3::bigint, 'D-16 · el titular ve el orden de turnos completo');
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.allocations where calendar_id = (select id from cal)),
  0::bigint, 'un Administrador ajeno no ve las semanas elegidas');

-- ── RF-12.5 · CA-12.6 · el año siguiente se sugiere rotado ──────────────────
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select public.guardar_calendario('a1200000-0000-4000-8000-000000000001', 2028, 2026, null, (select semanas from semanas_json));
select is(
  (select public.suggested_selection_order((select id from cal28))),
  array[1, 2, 3], 'CA-12.6 · la sugerencia para el año siguiente rota el orden anterior: la primera pasa al final');
select throws_like(
  $$ select public.open_calendar_selection((select id from cal), array[2, 3, 1]) $$,
  '%RF-12.5%', 'RF-12.5 · con semanas ya elegidas el orden no se cambia');

-- ── RF-12.6 · CA-12.10 · intercambios del Administrador ─────────────────────
-- La fracción 1 confirma su semana 1 (9–15 de enero, alta) como uso propio (D-33).
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.confirm_week((select id from cal), (select id from fr where number = 1), 1) $$,
  'el titular confirma una semana que eligió');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.swap_weeks((select id from cal), 1, 1, 2, 2, 'Acuerdo') $$,
  '%CA-12.10%', 'CA-12.10 · una semana ya confirmada no se intercambia');
select throws_like(
  $$ select public.swap_weeks((select id from cal), 3, 0, 2, 10, 'Acuerdo') $$,
  '%CA-12.10%', 'CA-12.10 · semanas de distinta temporada no se intercambian');
select throws_like(
  $$ select public.swap_weeks((select id from cal), 3, 0, 2, 2, '  ') $$,
  '%CA-12.10%', 'CA-12.10 · sin motivo no hay intercambio');
select throws_like(
  $$ select public.swap_weeks((select id from cal), 3, 2, 2, 0, 'Acuerdo') $$,
  '%CA-12.10%', 'CA-12.10 · cada semana debe pertenecer a la fracción indicada');
select lives_ok(
  $$ select public.swap_weeks((select id from cal), 3, 0, 2, 2, 'Acuerdo entre titulares') $$,
  'CA-12.10 · misma temporada, sin estadías y con motivo: el intercambio procede');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join fr f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal) and w.index = 0),
  2::smallint, 'CA-12.10 · la semana 0 pasó a la fracción 2');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join fr f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal) and w.index = 2),
  3::smallint, 'CA-12.10 · y la semana 2 a la fracción 3');
-- La auditoría de una asignación no lleva propiedad: se lee sin sesión (TR-01 · RF-A.6).
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log where action = 'allocation.actualizada' and reason = 'Acuerdo entre titulares'),
  2::bigint, 'RF-12.6 · TR-01 · el intercambio queda auditado con su motivo');
set local role authenticated;

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.swap_weeks((select id from cal), 3, 2, 2, 0, 'Intento ajeno') $$,
  '%CA-17.4%', 'CA-17.4 · un Administrador sin la propiedad asignada no intercambia');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_swap' and r.recipient_id = 'c1200000-0000-4000-8000-000000000004'),
  1::bigint, 'CA-12.10 · TR-03 · el titular de la fracción 2 recibe el aviso del intercambio');

-- ── RF-12.6 · CA-12.11 · solicitudes del Propietario ────────────────────────
set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.request_week_swap((select id from cal), (select id from fr where number = 1), 24, 3, 27) $$,
  '%CA-12.11%', 'CA-12.11 · solo se ofrece una semana propia');
select throws_like(
  $$ select public.request_week_swap((select id from cal), (select id from fr where number = 1), 27, 3, 8) $$,
  '%CA-12.11%', 'CA-12.11 · la semana pedida debe ser de la misma temporada');
create temporary table solicitud as
  select public.request_week_swap((select id from cal), (select id from fr where number = 1), 27, 3, 24, 'Cumpleaños en junio') as id;
create temporary table solicitud2 as
  select public.request_week_swap((select id from cal), (select id from fr where number = 1), 28, 3, 25) as id;
select is(
  (select count(*) from public.week_swap_requests where calendar_id = (select id from cal) and status = 'open'),
  2::bigint, 'CA-12.11 · el titular ve sus solicitudes abiertas');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000004';
select is(
  (select count(*) from public.week_swap_requests where calendar_id = (select id from cal)),
  0::bigint, 'RF-12.6 · un titular ajeno a la solicitud no la ve');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.resolve_swap_request((select id from solicitud), false) $$,
  '%CA-12.11%', 'CA-12.11 · rechazar exige motivo');
select lives_ok(
  $$ select public.resolve_swap_request((select id from solicitud), false, 'La semana 24 ya tiene planes') $$,
  'CA-12.11 · el Administrador rechaza con motivo');
select lives_ok(
  $$ select public.resolve_swap_request((select id from solicitud2), true) $$,
  'CA-12.11 · el Administrador aprueba la segunda y el intercambio se aplica');
select is(
  (select f.number from public.allocations a join public.calendar_weeks w on w.id = a.week_id join fr f on f.id = a.fraction_id
    where a.calendar_id = (select id from cal) and w.index = 25),
  1::smallint, 'CA-12.11 · la semana 25 pasó a la fracción 1');
select is(
  (select array_agg(status order by status) from public.week_swap_requests where calendar_id = (select id from cal)),
  array['approved', 'rejected'], 'CA-12.11 · las solicitudes quedan resueltas');

set local request.jwt.claim.sub = 'c1200000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'swap_request' and r.recipient_id = 'c1200000-0000-4000-8000-000000000003'),
  2::bigint, 'CA-12.11 · TR-03 · el solicitante recibe aviso del rechazo y de la aprobación');

-- ── RF-12.8 · caducidad a 60 días ───────────────────────────────────────────
-- Al 16 de noviembre de 2026 la semana 0 (2 de enero, ahora de la fracción 2)
-- sigue sin confirmar y caduca; la semana 1, confirmada por la fracción 1, no.
reset role;
set local request.jwt.claim.sub = '';
select ok(
  (select public.expire_unconfirmed_weeks('2026-11-16'::date)) >= 1,
  'RF-12.8 · a 60 días caducan las semanas elegidas sin confirmar');
select is(
  (select public.expire_unconfirmed_weeks('2026-11-16'::date)), 0,
  'RF-12.8 · la tarea es idempotente: una segunda pasada no caduca nada');
select is(
  (select a.release_reason from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal) and w.index = 0),
  'expired', 'RF-12.8 · la semana caducada queda en la bolsa de renta');
select is(
  (select a.confirmed_at is not null and a.released_at is null from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal) and w.index = 1),
  true, 'RF-12.8 · la semana confirmada no caduca');
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'expired_weeks' and r.recipient_id = 'c1200000-0000-4000-8000-000000000004'),
  1::bigint, 'RF-12.8 · el Propietario recibe un solo aviso por fracción y pasada');

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
select is(
  (select count(*) from public.audit_log where action = 'season_calendar.creada' and entity_id = (select id from cal)),
  1::bigint, 'CA-A.1 · el calendario queda auditado al crearse');
select is(
  (select count(*) from public.audit_log where action = 'selection_turn.creada' and entity_id in (select id from public.selection_turns where calendar_id = (select id from cal))),
  3::bigint, 'RF-12.5 · el orden de turnos queda auditado');

select * from finish();
rollback;
