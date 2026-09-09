-- HU-15 · RF-15.1…RF-15.5 · D-33 — bloqueos del Administrador por semanas:
-- motivo obligatorio, impiden confirmar, no borran confirmaciones (conflicto para
-- HU-17), solo sobre propiedades asignadas, y auditados con motivo.
begin;
select plan(26);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'week_blocks', 'RF-15.1 · existe week_blocks');
select has_table('public', 'calendar_conflicts', 'RF-15.4 · existe calendar_conflicts');
select is((select bool_and(relforcerowsecurity) from pg_class
  where oid in ('public.week_blocks'::regclass, 'public.calendar_conflicts'::regclass)),
  true, 'week_blocks y calendar_conflicts fuerzan RLS');
select col_not_null('public', 'week_blocks', 'reason', 'RF-15.1 · el motivo es obligatorio en la tabla');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c1500000-0000-4000-8000-000000000001', 'admin.blq@arena.co', '{}'),
  ('c1500000-0000-4000-8000-000000000002', 'ajeno.blq@arena.co', '{}'),
  ('c1500000-0000-4000-8000-000000000003', 'dueno.blq@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c1500000-0000-4000-8000-000000000001', 'property_admin'),
  ('c1500000-0000-4000-8000-000000000002', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a1500000-0000-4000-8000-000000000001', 'Casa Bloqueos', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a1500000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a1500000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'sold', owner_id = 'c1500000-0000-4000-8000-000000000003'
  where property_id = 'a1500000-0000-4000-8000-000000000001' and number = 1;

create temporary table semanas28 as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2028-01-01'::date + i * 7)::text,
  'ends_on', ('2028-01-01'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', case i when 0 then 'christmas' when 1 then 'new_year' when 2 then 'holy_week' else null end
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a1500000-0000-4000-8000-000000000001', 2028, 2027, null, (select semanas from semanas28));

reset role;
create temporary table cal28 as
  select id from public.season_calendars where property_id = 'a1500000-0000-4000-8000-000000000001' and year = 2028;
create temporary table f1 as
  select id from public.fractions where property_id = 'a1500000-0000-4000-8000-000000000001' and number = 1;
grant select on cal28, f1 to authenticated;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true where id = (select id from f1);
set local role authenticated;
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000001';

-- D-32 · Fracción 1 elige, entre otras, las semanas 25 (24–30 jun) y 33 (19–25 ago), bajas.
select public.open_calendar_selection((select id from cal28), array[1]);
select public.select_weeks((select id from cal28), (select id from f1), array[0, 9, 17, 25, 33, 41]);

-- ── CA-15.1 · sin motivo no hay bloqueo ─────────────────────────────────────
select throws_like(
  $$ select public.block_weeks((select id from cal28), array[33], '   ') $$,
  '%CA-15.1%', 'CA-15.1 · un bloqueo sin motivo se rechaza');
select throws_ok(
  $$ insert into public.week_blocks (calendar_id, property_id, week_id, reason)
     values ((select id from cal28), 'a1500000-0000-4000-8000-000000000001',
             (select id from public.calendar_weeks where calendar_id = (select id from cal28) and index = 33), '') $$,
  '23514', null, 'CA-15.1 · la tabla tampoco admite un motivo vacío');

-- ── RF-15.1 · RF-15.5 · un bloqueo con motivo, auditado ─────────────────────
create temporary table bloqueo as
  select ((public.block_weeks((select id from cal28), array[33], 'Mantenimiento de piscina') -> 'ids') ->> 0)::uuid as id;
select is(
  (select count(*) from public.week_blocks where id = (select id from bloqueo) and lifted_at is null),
  1::bigint, 'RF-15.1 · el Administrador asignado bloquea la semana 33');
select is(
  (select reason from public.audit_log where action = 'week_block.creada' and entity_id = (select id from bloqueo)),
  'Mantenimiento de piscina', 'RF-15.5 · CA-A.1 · la creación queda auditada con su motivo');
select is(
  (select actor_id from public.audit_log where action = 'week_block.creada' and entity_id = (select id from bloqueo)),
  'c1500000-0000-4000-8000-000000000001', 'RF-15.5 · y con quién lo hizo');
select throws_like(
  $$ select public.block_weeks((select id from cal28), array[33], 'Otra vez') $$,
  '%ya está bloqueada%', 'RF-15.1 · una semana no se bloquea dos veces');

-- ── CA-15.2 · una semana bloqueada no se confirma ───────────────────────────
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 33) $$,
  '%RF-15.2%', 'CA-15.2 · el Propietario no confirma una semana bloqueada');
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 25) $$,
  'RF-15.2 · fuera del bloqueo sí confirma');

-- ── CA-15.3 · bloqueo sobre semana confirmada: persiste y hay conflicto ─────
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000001';
create temporary table bloqueo2 as
  select public.block_weeks((select id from cal28), array[25], 'Obra en la cubierta') as resultado;
select is(
  (select a.confirmed_at is not null and a.released_at is null from public.allocations a join public.calendar_weeks w on w.id = a.week_id
    where a.calendar_id = (select id from cal28) and w.index = 25),
  true, 'CA-15.3 · la confirmación persiste tras el bloqueo');
select is(
  (select jsonb_array_length(resultado -> 'conflicts') from bloqueo2),
  1, 'CA-15.3 · el bloqueo devuelve el conflicto generado');
select is(
  (select (resultado -> 'conflicts' -> 0 ->> 'week')::integer from bloqueo2),
  25, 'CA-15.3 · el conflicto indica la semana que colisiona');
select is(
  (select count(*) from public.calendar_conflicts c join public.calendar_weeks w on w.id = c.week_id
    where c.property_id = 'a1500000-0000-4000-8000-000000000001' and c.status = 'open' and w.index = 25),
  1::bigint, 'RF-15.4 · el conflicto queda abierto para HU-17');
-- La bandeja solo la lee su destinatario (RF-N.5): se mira con su sesión.
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.notification_recipients r join public.notifications n on n.id = r.notification_id
    where n.kind = 'calendar_changed' and n.entity_type = 'week_block' and r.recipient_id = 'c1500000-0000-4000-8000-000000000003'),
  1::bigint, 'RF-16.1 · el titular afectado recibe el aviso del bloqueo, una sola vez');

-- ── CA-15.4 · sin la propiedad asignada no se bloquea ───────────────────────
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000002';
select throws_like(
  $$ select public.block_weeks((select id from cal28), array[41], 'Intento ajeno') $$,
  '%CA-15.4%', 'CA-15.4 · un Administrador sin la propiedad asignada no bloquea');
select throws_ok(
  $$ insert into public.week_blocks (calendar_id, property_id, week_id, reason)
     values ((select id from cal28), 'a1500000-0000-4000-8000-000000000001',
             (select id from public.calendar_weeks where calendar_id = (select id from cal28) and index = 41), 'Intento ajeno') $$,
  '42501', null, 'CA-15.4 · tampoco por escritura directa (RLS)');
select is(
  (select count(*) from public.week_blocks where property_id = 'a1500000-0000-4000-8000-000000000001'),
  0::bigint, 'CA-15.4 · ni siquiera los ve');

-- ── RF-15.3 · visibles para los propietarios ────────────────────────────────
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.week_blocks where property_id = 'a1500000-0000-4000-8000-000000000001' and lifted_at is null),
  2::bigint, 'RF-15.3 · el Propietario ve los bloqueos de su propiedad con su motivo');
update public.week_blocks set reason = 'Cambiado' where id = (select id from bloqueo);
select is(
  (select reason from public.week_blocks where id = (select id from bloqueo)),
  'Mantenimiento de piscina', 'RF-15.1 · pero no los edita');

-- ── RF-15.5 · levantar el bloqueo, auditado ─────────────────────────────────
set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.lift_week_block((select id from bloqueo), '') $$,
  '%CA-15.1%', 'RF-15.5 · levantar también exige motivo');
select lives_ok(
  $$ select public.lift_week_block((select id from bloqueo), 'Fin del mantenimiento') $$,
  'RF-15.5 · el Administrador levanta el bloqueo');
select is(
  (select reason from public.audit_log where action = 'week_block.actualizada' and entity_id = (select id from bloqueo)),
  'Fin del mantenimiento', 'RF-15.5 · levantar queda auditado con su motivo');

set local request.jwt.claim.sub = 'c1500000-0000-4000-8000-000000000003';
select lives_ok(
  $$ select public.confirm_week((select id from cal28), (select id from f1), 33) $$,
  'RF-15.2 · levantado el bloqueo, la semana vuelve a confirmarse');

select * from finish();
rollback;
