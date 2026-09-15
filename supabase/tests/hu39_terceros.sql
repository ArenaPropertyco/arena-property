-- HU-39 · RF-39.1…RF-39.5 · D-25, D-33, D-39 — el tercero, la bolsa de renta y el
-- origen que la reserva conserva.
-- Nivel N2: lo que garantiza el motor, no la disciplina de código.
begin;
select plan(44);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'third_parties', 'RF-39.1 · existe third_parties');
select has_table('public', 'third_party_bookings', 'RF-39.2 · existe third_party_bookings');
select is((select relforcerowsecurity from pg_class where oid = 'public.third_parties'::regclass),
  true, 'D-25 · third_parties fuerza RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.third_party_bookings'::regclass),
  true, 'RF-39.3 · third_party_bookings fuerza RLS');
select has_column('public', 'third_parties', 'anonymize_after', 'RF-39.5 · D-25 · guarda la fecha de anonimización');
select has_column('public', 'third_parties', 'consent_accepted_at', 'RF-39.5 · y el consentimiento');
select has_column('public', 'third_party_bookings', 'origin_reason', 'RF-39.2b · la reserva guarda el motivo de origen');
select has_column('public', 'third_party_bookings', 'origin_fraction_id', 'RF-39.2b · y la fracción de origen');
select ok(not has_table_privilege('authenticated', 'public.third_party_bookings', 'DELETE'),
  'RF-39.4 · una reserva no se borra: se cancela');
select has_function('public', 'anonimizar_terceros', array['date'], 'RF-39.5 · existe la anonimización a 5 años');
select ok((select count(*) from cron.job where jobname = 'anonimizar-terceros') = 1,
  'D-25 · DT-09 · la anonimización corre a diario en pg_cron');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c3900000-0000-4000-8000-000000000001', 'admin.ter@arena.co', '{}'),
  ('c3900000-0000-4000-8000-000000000003', 'dueno3.ter@arena.co', '{}'),
  ('c3900000-0000-4000-8000-000000000005', 'dueno5.ter@arena.co', '{}'),
  ('c3900000-0000-4000-8000-000000000009', 'ajeno.ter@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c3900000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3900000-0000-4000-8000-000000000001', 'Casa Terceros', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a3900000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a3900000-0000-4000-8000-000000000001' and number in (3, 5);
update public.fractions set status = 'sold', owner_id = 'c3900000-0000-4000-8000-000000000003'
  where property_id = 'a3900000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'c3900000-0000-4000-8000-000000000005'
  where property_id = 'a3900000-0000-4000-8000-000000000001' and number = 5;

create temporary table semanas30 as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2030-01-05'::date + i * 7)::text,
  'ends_on', ('2030-01-05'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', null
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a3900000-0000-4000-8000-000000000001', 2030, 2029, null, (select semanas from semanas30));

reset role;
set local request.jwt.claim.sub = '';
-- El calendario se activa sin sesión, como lo haría la derivación del plan de pagos.
update public.fractions set calendar_active = true
  where property_id = 'a3900000-0000-4000-8000-000000000001' and number in (3, 5);

create temporary table ctx39 as
  select (select id from public.season_calendars where property_id = 'a3900000-0000-4000-8000-000000000001' and year = 2030) as cal,
         (select id from public.fractions where property_id = 'a3900000-0000-4000-8000-000000000001' and number = 3) as f3,
         (select id from public.fractions where property_id = 'a3900000-0000-4000-8000-000000000001' and number = 5) as f5,
         null::uuid as tercero;
grant select, update on ctx39 to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select cal from ctx39), array[3, 5]);
-- CA-12.2 · seis semanas por fracción. Fracción 3: 0, 9, 17, 25, 33, 41.
-- Fracción 5: 2, 10, 18, 26, 34, 42. Las 30 y 31 quedan sobrantes de la rejilla.
select public.select_weeks((select cal from ctx39), (select f3 from ctx39), array[0, 9, 17, 25, 33, 41]);
select public.select_weeks((select cal from ctx39), (select f5 from ctx39), array[2, 10, 18, 26, 34, 42]);

-- ── RF-39.1 · RF-39.5 · el registro del tercero ─────────────────────────────
select throws_like(
  $$ select public.registrar_tercero('a3900000-0000-4000-8000-000000000001', 'Sin permiso', 'cc', '999', null, '300', false) $$,
  '%D-25%', 'RF-39.5 · D-25 · sin consentimiento explícito no se registra al tercero');

update ctx39 set tercero = (select id from public.registrar_tercero(
  'a3900000-0000-4000-8000-000000000001', 'Marta Restrepo', 'cc', '1.020.304-5', 'marta@ejemplo.com', '+57 300 123 4567', true));
select isnt((select tercero from ctx39), null, 'RF-39.1 · el Administrador registra al tercero');
select is(
  (select document_number from public.third_parties where id = (select tercero from ctx39)),
  '10203045', 'CA-39.3 · el documento se guarda normalizado, sin puntos ni guiones');
select is(
  (select (anonymize_after - created_at::date) from public.third_parties where id = (select tercero from ctx39)),
  1826, 'RF-39.5 · D-25 · la anonimización queda fijada a cinco años del alta');

-- CA-39.3 · el mismo documento con otro formato no duplica.
select is(
  (select id from public.registrar_tercero('a3900000-0000-4000-8000-000000000001', 'Marta R.', 'cc', '1020304 5', 'otra@ejemplo.com', null, true)),
  (select tercero from ctx39), 'CA-39.3 · el tercero ya registrado se reutiliza, no se duplica');
select is(
  (select count(*) from public.third_parties where property_id = 'a3900000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-39.3 · y el registro sigue teniendo una sola fila');
select isnt(
  (select id from public.registrar_tercero('a3900000-0000-4000-8000-000000000001', 'Marta P.', 'passport', '10203045', 'pas@ejemplo.com', null, true)),
  (select tercero from ctx39), 'CA-39.3 · el mismo número con otro tipo de documento es otra persona');

-- ── CA-39.1 · RF-39.2 · solo se renta lo que está en la bolsa ───────────────
select throws_like(
  $$ select public.rentar_semana((select cal from ctx39), 0, (select tercero from ctx39)) $$,
  '%CA-39.1%', 'CA-39.1 · una semana elegida por una fracción no se renta');

set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000003';
select public.confirm_week((select cal from ctx39), (select f3 from ctx39), 9);
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.rentar_semana((select cal from ctx39), 9, (select tercero from ctx39)) $$,
  '%CA-39.1%', 'CA-39.1 · y una con estadía declarada por su Propietario, menos');

select public.block_weeks((select cal from ctx39), array[40], 'Mantenimiento de la piscina');
select throws_like(
  $$ select public.rentar_semana((select cal from ctx39), 40, (select tercero from ctx39)) $$,
  '%RF-15.2%', 'CA-39.1 · RF-15.2 · una semana bloqueada por el Administrador no se renta');

-- ── CA-39.5 · RF-39.2b · el origen que la reserva conserva ──────────────────
-- La fracción 3 libera voluntariamente su semana 17; la 5 cancela la 10 confirmada.
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000003';
select public.release_week((select cal from ctx39), (select f3 from ctx39), 17);
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000005';
select public.confirm_week((select cal from ctx39), (select f5 from ctx39), 10);
select public.cancel_week((select cal from ctx39), (select f5 from ctx39), 10);

set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.rentar_semana((select cal from ctx39), 17, (select tercero from ctx39)) $$,
  'CA-39.1 · una semana liberada voluntariamente sí se renta');
select is(
  (select (b.origin_reason::text, f.number) from public.third_party_bookings b
     join public.fractions f on f.id = b.origin_fraction_id
    join public.calendar_weeks w on w.id = b.week_id where w.index = 17),
  ('voluntary'::text, 3::smallint),
  'CA-39.5 · RF-39.2b · la reserva queda con la fracción 3/8 y el motivo «liberada»');

select lives_ok(
  $$ select public.rentar_semana((select cal from ctx39), 10, (select tercero from ctx39)) $$,
  'CA-39.1 · una semana cancelada también se renta');
select is(
  (select b.origin_reason::text from public.third_party_bookings b
     join public.calendar_weeks w on w.id = b.week_id where w.index = 10),
  'cancelled', 'RF-39.2b · y conserva el motivo «cancelada», que no atribuye');

-- Una semana que nadie eligió: sobrante de la rejilla, sin fracción de origen.
select lives_ok(
  $$ select public.rentar_semana((select cal from ctx39), 30, (select tercero from ctx39)) $$,
  'CA-39.1 · una semana sobrante de la rejilla se renta');
select is(
  (select (b.origin_reason::text, b.origin_fraction_id) from public.third_party_bookings b
     join public.calendar_weeks w on w.id = b.week_id where w.index = 30),
  ('pool'::text, null::uuid), 'CA-39.5 · RF-39.2b · la sobrante queda sin fracción de origen');

-- CA-14.8b · solo lo liberado a propósito queda marcado como atribuible.
select is(
  (select count(*) from public.third_party_bookings b where b.origin_reason = 'voluntary'
     and b.property_id = 'a3900000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-14.8b · de las tres semanas rentadas solo una es atribuible a su fracción');

-- ── D-33 · una semana, una ocupación ────────────────────────────────────────
select throws_ok(
  $$ select public.rentar_semana((select cal from ctx39), 17, (select tercero from ctx39)) $$,
  '23505', null, 'RF-39.2 · una semana ya rentada no se renta dos veces');

-- ── CA-39.2 · la ocupación se ve en el calendario de los copropietarios ─────
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.third_party_bookings where property_id = 'a3900000-0000-4000-8000-000000000001'),
  3::bigint, 'CA-39.2 · el copropietario ve las semanas ocupadas por terceros');
select is(
  (select count(*) from public.third_parties where property_id = 'a3900000-0000-4000-8000-000000000001'),
  0::bigint, 'D-25 · pero no los datos personales del tercero');

set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000009';
select is(
  (select count(*) from public.third_party_bookings where property_id = 'a3900000-0000-4000-8000-000000000001'),
  0::bigint, 'D-25 · una cuenta ajena a la propiedad no ve ni las reservas');
select throws_like(
  $$ select public.rentar_semana((select cal from ctx39), 31, (select tercero from ctx39)) $$,
  '%no es visible%', 'RF-39.2 · ni renta semanas de una propiedad que no gestiona');

-- ── CA-39.4 · RF-39.4 · cancelar la reserva ─────────────────────────────────
set local request.jwt.claim.sub = 'c3900000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.cancelar_reserva_a_tercero(
       (select b.id from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id where w.index = 30), '  ') $$,
  '%CA-39.4%', 'CA-39.4 · sin motivo no se cancela');
select lives_ok(
  $$ select public.cancelar_reserva_a_tercero(
       (select b.id from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id where w.index = 30),
       'El tercero desistió del viaje.') $$,
  'CA-39.4 · el Administrador cancela la reserva con motivo');
select is(
  (select b.status from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id where w.index = 30),
  'cancelled', 'CA-39.4 · la reserva queda cancelada, no borrada');
select is(
  (select reason from public.audit_log where action = 'third_party_booking.actualizada'
     and entity_id = (select b.id from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id where w.index = 30)),
  'El tercero desistió del viaje.', 'CA-39.4 · y queda auditada con su motivo');
select lives_ok(
  $$ select public.rentar_semana((select cal from ctx39), 30, (select tercero from ctx39)) $$,
  'CA-39.4 · cancelada, la semana vuelve a estar disponible para otra renta');
select throws_like(
  $$ update public.third_party_bookings set third_party_id = (select tercero from ctx39)
      where id = (select b.id from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id where w.index = 10) $$,
  '%RF-39.4%', 'RF-39.4 · una reserva no se edita: se cancela y se crea otra');

-- ── RF-39.5 · D-25 · anonimización a los 5 años ─────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(public.anonimizar_terceros(current_date), 0, 'D-25 · hoy no hay ningún tercero que anonimizar');
select is(public.anonimizar_terceros(current_date + 1900), 2, 'RF-39.5 · D-25 · pasados los 5 años se anonimizan los dos terceros');
select is(
  (select full_name from public.third_parties where id = (select tercero from ctx39)),
  'Tercero anonimizado', 'D-25 · el nombre desaparece');
select is(
  (select (email, phone) from public.third_parties where id = (select tercero from ctx39)),
  (null::text, null::text), 'D-25 · y el contacto también');
select is(
  (select count(*) from public.third_party_bookings where third_party_id = (select tercero from ctx39)),
  4::bigint, 'D-25 · las reservas siguen existiendo: la contabilidad tiene que cuadrar');

reset role;
select * from finish();
rollback;
