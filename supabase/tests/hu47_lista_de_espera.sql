-- HU-47 · RF-47.1…RF-47.5 · D-24 · D-25 — la lista de espera en la base: solo
-- escribe el servidor, un correo por propiedad, aviso en orden de inscripción y
-- una sola vez por persona cuando una fracción vuelve a disponible, y
-- anonimización a los cinco años.
begin;
select plan(27);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'waitlist_entries', 'RF-47.2 · existe waitlist_entries');
select is((select relforcerowsecurity from pg_class where oid = 'public.waitlist_entries'::regclass), true,
  'RF-47.2 · waitlist_entries fuerza RLS');
select ok(not has_table_privilege('anon', 'public.waitlist_entries', 'INSERT'),
  'RF-47.3 · D-24 · el Visitante no inserta directo: pasa por la ruta Nitro con límite de tasa');
select ok(not has_table_privilege('anon', 'public.waitlist_entries', 'SELECT'),
  'el Visitante no lee la lista');
select ok(not has_table_privilege('authenticated', 'public.waitlist_entries', 'INSERT'),
  'una cuenta tampoco inserta directo');
select has_function('public', 'anonimizar_lista_de_espera', array['timestamp with time zone'], 'D-25 · existe la anonimización');

-- ── Cuentas y propiedades ───────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c4700000-0000-4000-8000-00000000000a', 'super.espera@arena.co', '{}'),
  ('c4700000-0000-4000-8000-000000000001', 'admin1.espera@arena.co', '{}'),
  ('c4700000-0000-4000-8000-000000000002', 'admin2.espera@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c4700000-0000-4000-8000-00000000000a', 'superadmin'),
  ('c4700000-0000-4000-8000-000000000001', 'property_admin'),
  ('c4700000-0000-4000-8000-000000000002', 'property_admin');

insert into public.properties (id, name, slug, description, area_m2, country, region, city) values
  ('a4700000-0000-4000-8000-000000000001', 'Villa Espera', 'villa-espera', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena'),
  ('a4700000-0000-4000-8000-000000000002', 'Casa Ajena', 'casa-ajena', 'Otra propiedad.', 90, 'CO', 'Bolívar', 'Cartagena');
insert into public.property_admins (admin_id, property_id) values
  ('c4700000-0000-4000-8000-000000000001', 'a4700000-0000-4000-8000-000000000001');
select public.fraccionar_propiedad('a4700000-0000-4000-8000-000000000001', array[120000000]::bigint[]);
select public.fraccionar_propiedad('a4700000-0000-4000-8000-000000000002', array[120000000]::bigint[]);

-- ── RF-47.2 · CA-47.3 · el servidor persiste ────────────────────────────────
set local role service_role;
select lives_ok(
  $$ insert into public.waitlist_entries (id, property_id, full_name, email, phone, consent_version, created_at)
     values ('e4700000-0000-4000-8000-000000000001', 'a4700000-0000-4000-8000-000000000001',
             ' Ana Gómez ', 'Ana@Ejemplo.com', '+57 310', '2026-09-v1', '2026-09-01T10:00:00Z') $$,
  'CA-47.3 · el servidor persiste la inscripción');
select lives_ok(
  $$ insert into public.waitlist_entries (id, property_id, full_name, email, phone, consent_version, created_at)
     values ('e4700000-0000-4000-8000-000000000002', 'a4700000-0000-4000-8000-000000000001',
             'Luis Pérez', 'luis@ejemplo.com', '+57 311', '2026-09-v1', '2026-09-02T10:00:00Z') $$,
  'RF-47.2 · una segunda persona se inscribe después');
select lives_ok(
  $$ insert into public.waitlist_entries (id, property_id, full_name, email, phone, consent_version, created_at)
     values ('e4700000-0000-4000-8000-000000000003', 'a4700000-0000-4000-8000-000000000002',
             'Sofía Ruiz', 'sofia@ejemplo.com', '+57 312', '2026-09-v1', '2026-09-03T10:00:00Z') $$,
  'RF-47.2 · una inscripción en otra propiedad no interfiere');

select is(
  (select (email, full_name) from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000001'),
  ('ana@ejemplo.com'::text, 'Ana Gómez'::text),
  'RF-47.2 · correo en minúsculas y nombre recortado');
select is(
  (select retain_until from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000001'),
  (select consent_at + interval '5 years' from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000001'),
  'RF-47.5 · D-25 · la retención vence cinco años después del consentimiento');

-- ── CA-47.2 · un correo no se inscribe dos veces en la misma propiedad ──────
select throws_ok(
  $$ insert into public.waitlist_entries (property_id, full_name, email, phone, consent_version)
     values ('a4700000-0000-4000-8000-000000000001', 'Ana otra vez', 'ANA@ejemplo.com', '+57 313', '2026-09-v1') $$,
  '23505', null, 'CA-47.2 · el mismo correo, aunque cambie de caja, se rechaza en la misma propiedad');
select lives_ok(
  $$ insert into public.waitlist_entries (property_id, full_name, email, phone, consent_version)
     values ('a4700000-0000-4000-8000-000000000002', 'Ana Gómez', 'ana@ejemplo.com', '+57 310', '2026-09-v1') $$,
  'RF-47.2 · el mismo correo sí puede esperar en otra propiedad');

-- ── CA-47.4 · el disparador de liberación ───────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.waitlist_entries where notify_requested_at is not null), 0::bigint,
  'antes de liberarse una fracción nadie está pedido de aviso');

-- Una fracción de Villa Espera se reserva y vuelve a disponible.
update public.fractions set status = 'reserved'
 where property_id = 'a4700000-0000-4000-8000-000000000001' and number = 1;
update public.fractions set status = 'available'
 where property_id = 'a4700000-0000-4000-8000-000000000001' and number = 1;

select is(
  (select array_agg(id order by created_at) from public.waitlist_entries
    where property_id = 'a4700000-0000-4000-8000-000000000001' and notify_requested_at is not null),
  array['e4700000-0000-4000-8000-000000000001', 'e4700000-0000-4000-8000-000000000002']::uuid[],
  'CA-47.4 · al liberarse una fracción, la lista de esa propiedad queda pedida de aviso en orden de inscripción');
select is(
  (select count(*) from public.waitlist_entries
    where property_id = 'a4700000-0000-4000-8000-000000000002' and notify_requested_at is not null), 0::bigint,
  'CA-47.4 · la lista de otra propiedad no se toca');

-- El despacho entrega el aviso a Ana; Luis sigue pendiente. La fecha del pedido se
-- fija en el pasado para poder demostrar después que nadie la volvió a escribir.
set local role service_role;
update public.waitlist_entries
   set notified_at = now(), notify_requested_at = '2026-09-05T10:00:00Z'
 where id = 'e4700000-0000-4000-8000-000000000001';
reset role;
set local request.jwt.claim.sub = '';

-- Se libera otra fracción de la misma propiedad.
update public.fractions set status = 'reserved'
 where property_id = 'a4700000-0000-4000-8000-000000000001' and number = 2;
update public.fractions set status = 'available'
 where property_id = 'a4700000-0000-4000-8000-000000000001' and number = 2;

select is(
  (select notify_requested_at from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000001'),
  '2026-09-05T10:00:00Z'::timestamptz,
  'CA-47.4 · a quien ya se le avisó no se le vuelve a pedir el aviso: una sola vez por persona');
select is(
  (select count(*) from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000002' and notified_at is null and notify_requested_at is not null),
  1::bigint, 'CA-47.4 · quien sigue sin aviso conserva su pedido pendiente');

-- Un cambio que no lleva a `available` no pide nada.
update public.fractions set status = 'reserved'
 where property_id = 'a4700000-0000-4000-8000-000000000002' and number = 1;
select is(
  (select count(*) from public.waitlist_entries
    where property_id = 'a4700000-0000-4000-8000-000000000002' and notify_requested_at is not null), 0::bigint,
  'RF-47.4 · reservar una fracción no es liberarla: no hay aviso');

-- ── D-25 · anonimización ────────────────────────────────────────────────────
set local role service_role;
update public.waitlist_entries
   set consent_at = '2020-01-01T00:00:00Z', retain_until = '2025-01-01T00:00:00Z'
 where id = 'e4700000-0000-4000-8000-000000000003';
select is(public.anonimizar_lista_de_espera('2026-09-10T00:00:00Z'), 1, 'D-25 · se anonimiza exactamente la inscripción vencida');
select is(
  (select (full_name, phone, anonymized_at is not null) from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000003'),
  ('anonimizado'::text, '-'::text, true),
  'D-25 · la fila queda sin datos de persona');
select ok(
  (select email from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000003') like 'anon-%@anonimizado.invalid',
  'D-25 · el correo pasa a un valor inerte y único');
select is(
  (select anonymized_at from public.waitlist_entries where id = 'e4700000-0000-4000-8000-000000000002'),
  null::timestamptz, 'D-25 · las inscripciones vigentes no se tocan');

-- ── Lectura: Superadmin todo; Administrador, lo de su propiedad ─────────────
set local role authenticated;
set local request.jwt.claim.sub = 'c4700000-0000-4000-8000-00000000000a';
select is((select count(*) from public.waitlist_entries where id::text like 'e4700000-%'), 3::bigint,
  'el Superadmin lee toda la lista');
set local request.jwt.claim.sub = 'c4700000-0000-4000-8000-000000000001';
select is((select count(*) from public.waitlist_entries where property_id = 'a4700000-0000-4000-8000-000000000002'), 0::bigint,
  'un Administrador no lee la lista de una propiedad ajena');
select is((select count(*) from public.waitlist_entries where property_id = 'a4700000-0000-4000-8000-000000000001'), 2::bigint,
  'un Administrador lee la lista de su propiedad');

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.audit_log where entity_type = 'waitlist_entry' and action = 'waitlist_entry.creada'
     and entity_id::text like 'e4700000-%'),
  3::bigint, 'TR-01 · cada inscripción deja su entrada de auditoría');

select * from finish();
rollback;
