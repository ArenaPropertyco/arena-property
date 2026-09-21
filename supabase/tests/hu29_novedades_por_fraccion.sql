-- HU-29 · RF-29.5, RF-29.6 (D-46) — la novedad dirigida a una sola fracción y su
-- estado activa/inactiva: solo el titular de esa fracción la recibe y la ve; una
-- novedad inactiva no la ve ningún Propietario; el estado lo cambia únicamente el
-- Superadmin, aunque el Administrador la haya publicado.
begin;
select plan(23);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_column('public', 'announcements', 'fraction_id', 'RF-29.5 · la novedad puede dirigirse a una fracción');
select has_column('public', 'announcements', 'active', 'RF-29.6 · la novedad tiene estado activa/inactiva');
select has_function('public', 'set_announcement_active', array['uuid', 'boolean'], 'RF-29.6 · existe set_announcement_active');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d2950000-0000-4000-8000-00000000000a', 'super.hu29f@arena.co'),
  ('d2950000-0000-4000-8000-000000000001', 'admin.hu29f@arena.co'),
  ('d2950000-0000-4000-8000-000000000002', 'otroadmin.hu29f@arena.co'),
  ('d2950000-0000-4000-8000-000000000003', 'ana.hu29f@ejemplo.com'),
  ('d2950000-0000-4000-8000-000000000004', 'luis.hu29f@ejemplo.com'),
  ('d2950000-0000-4000-8000-000000000005', 'marta.hu29f@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d2950000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d2950000-0000-4000-8000-000000000001', 'property_admin'),
  ('d2950000-0000-4000-8000-000000000002', 'property_admin');

-- ── A del admin 1: Ana (fracciones 1 y 2) y Luis (3). B del admin 2: Marta (1) ─
set local role authenticated;
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2950000-0000-4000-8000-000000000001', 'Casa Fracción', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a2950000-0000-4000-8000-000000000001', array[100000000::bigint]);
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2950000-0000-4000-8000-000000000002', 'Casa Ajena', 'Propiedad de prueba.', 200, 'CO', 'Quindío', 'Salento');
select public.fraccionar_propiedad('a2950000-0000-4000-8000-000000000002', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'reserved'
 where (property_id = 'a2950000-0000-4000-8000-000000000001' and number between 1 and 3)
    or (property_id = 'a2950000-0000-4000-8000-000000000002' and number = 1);
update public.fractions set status = 'sold', owner_id = 'd2950000-0000-4000-8000-000000000003'
 where property_id = 'a2950000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'd2950000-0000-4000-8000-000000000004'
 where property_id = 'a2950000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'd2950000-0000-4000-8000-000000000005'
 where property_id = 'a2950000-0000-4000-8000-000000000002' and number = 1;

-- ── RF-29.5 · CA-29.4 · a una fracción concreta: solo su titular ────────────
-- La fracción ajena se busca como Superadmin: al Administrador la RLS de `fractions`
-- ni se la muestra, y la subconsulta daría null en vez de probar la regla.
set local role authenticated;
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-00000000000a';
select throws_like(
  $$ insert into public.announcements (property_id, fraction_id, title, body, urgency)
     values ('a2950000-0000-4000-8000-000000000001',
             (select id from public.fractions where property_id = 'a2950000-0000-4000-8000-000000000002' and number = 1),
             'Ajena', 'No debería.', 'informative') $$,
  '%RF-29.5%', 'RF-29.5 · la fracción tiene que ser de la propiedad de la novedad');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000001';
select lives_ok(
  $$ insert into public.announcements (id, property_id, fraction_id, title, body, urgency)
     values ('b2950000-0000-4000-8000-000000000001', 'a2950000-0000-4000-8000-000000000001',
             (select id from public.fractions where property_id = 'a2950000-0000-4000-8000-000000000001' and number = 3),
             'Revisión de su unidad', 'Pasaremos el lunes.', 'important') $$,
  'RF-29.5 · el Administrador publica una novedad dirigida a la fracción 3');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select array_agg(r.recipient_id::text) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'b2950000-0000-4000-8000-000000000001'),
  array['d2950000-0000-4000-8000-000000000004'],
  'CA-29.4 · solo el titular de la fracción 3 recibe la notificación; Ana, copropietaria, no');
select is(
  (select payload ->> 'fraction_number' from public.notifications where entity_id = 'b2950000-0000-4000-8000-000000000001'),
  '3', 'RF-29.5 · la notificación dice a qué fracción va');

set local role authenticated;
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000003';
select is((select count(*) from public.announcements where id = 'b2950000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-29.4 · Ana, copropietaria de la misma casa, no ve la novedad de la fracción de Luis');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000004';
select is((select count(*) from public.announcements where id = 'b2950000-0000-4000-8000-000000000001'), 1::bigint,
  'CA-29.4 · Luis sí la ve en su historial');

-- ── RF-29.6 · CA-29.5 · el estado lo cambia solo el Superadmin ──────────────
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000001';
select throws_like(
  $$ select public.set_announcement_active('b2950000-0000-4000-8000-000000000001', false) $$,
  '%RF-29.6%', 'RF-29.6 · el Administrador que la publicó no la desactiva');
select throws_like(
  $$ update public.announcements set active = false where id = 'b2950000-0000-4000-8000-000000000001' $$,
  '%RF-29.6%', 'RF-29.6 · ni por escritura directa');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ select public.set_announcement_active('b2950000-0000-4000-8000-000000000001', false) $$,
  'RF-29.6 · el Superadmin la desactiva');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000004';
select is((select count(*) from public.announcements where id = 'b2950000-0000-4000-8000-000000000001'), 0::bigint,
  'CA-29.5 · inactiva, el titular deja de verla');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000001';
select is(
  (select active from public.announcements where id = 'b2950000-0000-4000-8000-000000000001'),
  false, 'CA-29.5 · el Administrador sigue viéndola, marcada como inactiva');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ select public.set_announcement_active('b2950000-0000-4000-8000-000000000001', true) $$,
  'RF-29.6 · y la vuelve a activar');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'b2950000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-N.4 · reactivarla no vuelve a notificar: el aviso ya se dio');

-- ── RF-29.6 · nacer inactiva: se notifica al activarse, y solo el Superadmin puede ─
set local role authenticated;
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000001';
select throws_like(
  $$ insert into public.announcements (property_id, title, body, urgency, active)
     values ('a2950000-0000-4000-8000-000000000001', 'Borrador', 'Todavía no.', 'informative', false) $$,
  '%RF-29.6%', 'RF-29.6 · el Administrador no publica inactiva: eso es fijar el estado');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.announcements (id, property_id, title, body, urgency, active)
     values ('b2950000-0000-4000-8000-000000000002', 'a2950000-0000-4000-8000-000000000001', 'Obra en la fachada', 'Desde el 1 de octubre.', 'important', false) $$,
  'RF-29.6 · el Superadmin publica una novedad inactiva, para toda la propiedad');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.notifications where entity_id = 'b2950000-0000-4000-8000-000000000002'),
  0::bigint, 'RF-29.6 · inactiva al nacer, no se notifica a nadie');
set local role authenticated;
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-000000000003';
select is((select count(*) from public.announcements where id = 'b2950000-0000-4000-8000-000000000002'), 0::bigint,
  'CA-29.5 · ni Ana la ve mientras esté inactiva');
set local request.jwt.claim.sub = 'd2950000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ select public.set_announcement_active('b2950000-0000-4000-8000-000000000002', true) $$,
  'RF-29.6 · el Superadmin la activa cuando quiere');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select array_agg(r.recipient_id::text order by r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'b2950000-0000-4000-8000-000000000002'),
  array['d2950000-0000-4000-8000-000000000003', 'd2950000-0000-4000-8000-000000000004'],
  'RF-29.2 · al activarse se notifica a todos los titulares de la propiedad, una vez cada uno');
select is(
  (select count(*) from public.audit_log where entity_type = 'announcement' and entity_id = 'b2950000-0000-4000-8000-000000000001'),
  3::bigint, 'TR-01 · la publicación y cada cambio de estado quedan auditados');

select * from finish();
rollback;
