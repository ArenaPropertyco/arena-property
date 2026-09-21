-- HU-29 · RF-29.1…RF-29.4 · HU-30 · RF-30.3 — la novedad en la base: validación
-- del aviso, notificación a todos los propietarios de la propiedad una sola vez,
-- estado abierta/resuelta, contenido inmutable tras publicar y lectura del
-- Propietario acotada a sus propiedades.
begin;
select plan(30);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'announcements', 'RF-29.1 · existe announcements');
select has_column('public', 'announcements', 'status', 'RF-29.3 · la novedad tiene estado abierta/resuelta');
select is((select relforcerowsecurity from pg_class where oid = 'public.announcements'::regclass), true,
  'RF-29.3 · announcements fuerza RLS');
select ok(not has_table_privilege('authenticated', 'public.announcements', 'DELETE'),
  'RF-29.3 · una novedad no se borra: queda en el historial');
select has_function('public', 'resolve_announcement', array['uuid'], 'RF-29.3 · existe resolve_announcement');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email) values
  ('d2900000-0000-4000-8000-00000000000a', 'super.hu29@arena.co'),
  ('d2900000-0000-4000-8000-000000000001', 'admin.hu29@arena.co'),
  ('d2900000-0000-4000-8000-000000000002', 'otroadmin.hu29@arena.co'),
  ('d2900000-0000-4000-8000-000000000003', 'ana.hu29@ejemplo.com'),
  ('d2900000-0000-4000-8000-000000000004', 'luis.hu29@ejemplo.com'),
  ('d2900000-0000-4000-8000-000000000005', 'marta.hu29@ejemplo.com'),
  ('d2900000-0000-4000-8000-000000000006', 'pedro.hu29@ejemplo.com'),
  ('d2900000-0000-4000-8000-000000000007', 'sofia.hu29@ejemplo.com'),
  ('d2900000-0000-4000-8000-000000000008', 'ajeno.hu29@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d2900000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d2900000-0000-4000-8000-000000000001', 'property_admin'),
  ('d2900000-0000-4000-8000-000000000002', 'property_admin');

-- ── Dos propiedades: A del admin 1 con 5 propietarios (Ana tiene 2); B del admin 2 ─
set local role authenticated;
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2900000-0000-4000-8000-000000000001', 'Casa Novedades', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a2900000-0000-4000-8000-000000000001', array[100000000::bigint]);
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000002';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a2900000-0000-4000-8000-000000000002', 'Casa Ajena', 'Propiedad de prueba.', 200, 'CO', 'Quindío', 'Salento');

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'reserved'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number between 1 and 6;
update public.fractions set status = 'sold', owner_id = 'd2900000-0000-4000-8000-000000000003'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'd2900000-0000-4000-8000-000000000004'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'd2900000-0000-4000-8000-000000000005'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number = 4;
update public.fractions set status = 'sold', owner_id = 'd2900000-0000-4000-8000-000000000006'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number = 5;
update public.fractions set status = 'sold', owner_id = 'd2900000-0000-4000-8000-000000000007'
 where property_id = 'a2900000-0000-4000-8000-000000000001' and number = 6;

-- ── CA-29.2 · la base rechaza el aviso sin título o sin urgencia ────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000001';
select throws_ok(
  $$ insert into public.announcements (property_id, title, body, urgency)
     values ('a2900000-0000-4000-8000-000000000001', '   ', 'El martes.', 'important') $$,
  '23514', null, 'CA-29.2 · sin título se rechaza');
select throws_ok(
  $$ insert into public.announcements (property_id, title, body, urgency)
     values ('a2900000-0000-4000-8000-000000000001', 'Corte de agua', 'El martes.', null) $$,
  '23502', null, 'CA-29.2 · sin urgencia se rechaza');
select throws_ok(
  $$ insert into public.announcements (property_id, title, body, urgency)
     values ('a2900000-0000-4000-8000-000000000001', 'Corte de agua', 'El martes.', 'critical') $$,
  '22P02', null, 'CA-29.2 · una urgencia fuera del catálogo se rechaza');

-- ── RF-29.1 · el Administrador asignado publica ─────────────────────────────
select lives_ok(
  $$ insert into public.announcements (id, property_id, title, body, urgency)
     values ('b2900000-0000-4000-8000-000000000001', 'a2900000-0000-4000-8000-000000000001', '  Corte de agua  ', 'El martes de 8 a 12.', 'important') $$,
  'RF-29.1 · el Administrador asignado publica una novedad sobre su propiedad');

-- ── CA-29.1 · CA-29.3 · todos los propietarios, una sola vez cada uno ───────
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.notifications where kind = 'announcement_published' and entity_type = 'announcement'
     and entity_id = 'b2900000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-29.3 · publicar emite una sola notificación');
select is(
  (select array_agg(r.recipient_id::text order by r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'b2900000-0000-4000-8000-000000000001'),
  array['d2900000-0000-4000-8000-000000000003', 'd2900000-0000-4000-8000-000000000004', 'd2900000-0000-4000-8000-000000000005',
        'd2900000-0000-4000-8000-000000000006', 'd2900000-0000-4000-8000-000000000007'],
  'CA-29.1 · los destinatarios son exactamente los 5 propietarios, sin repetir a Ana por sus 2 fracciones');
select is(
  (select (requires_email, payload ->> 'title', payload ->> 'property_name', payload ->> 'urgency')
     from public.notifications where entity_id = 'b2900000-0000-4000-8000-000000000001'),
  (true, 'Corte de agua'::text, 'Casa Novedades'::text, 'important'::text),
  'CA-29.3 · RF-29.2 · la notificación exige correo y lleva el título ya recortado, la propiedad y la urgencia');
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'b2900000-0000-4000-8000-000000000001' and r.email_next_attempt_at is not null and r.email_sent_at is null),
  5::bigint, 'CA-29.3 · cada destinatario tiene su fila in-app con el correo pendiente de despacho');
select lives_ok(
  $$ select private.notificar_novedad('b2900000-0000-4000-8000-000000000001') $$,
  'RF-N.4 · reprocesar la publicación no falla');
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'b2900000-0000-4000-8000-000000000001'),
  5::bigint, 'CA-29.3 · y no duplica: sigue habiendo una notificación por destinatario');

-- ── RF-29.1 · quién publica ─────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000003';
select throws_ok(
  $$ insert into public.announcements (property_id, title, body, urgency)
     values ('a2900000-0000-4000-8000-000000000001', 'Fiesta', 'El sábado.', 'informative') $$,
  '42501', null, 'RF-29.1 · un Propietario no publica novedades');
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000002';
select throws_ok(
  $$ insert into public.announcements (property_id, title, body, urgency)
     values ('a2900000-0000-4000-8000-000000000001', 'Fiesta', 'El sábado.', 'informative') $$,
  '42501', null, 'RF-29.1 · el Administrador de otra propiedad no publica en esta');
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.announcements (id, property_id, title, body, urgency)
     values ('b2900000-0000-4000-8000-000000000002', 'a2900000-0000-4000-8000-000000000001', 'Fuga de gas', 'No enciendan la estufa.', 'urgent') $$,
  'RF-29.1 · el Superadmin publica en cualquier propiedad (matriz HU-07: enviar novedades)');

-- ── RF-29.3 · publicada, la novedad no se reescribe: los propietarios ya la recibieron ─
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000001';
select throws_like(
  $$ update public.announcements set title = 'Otro título' where id = 'b2900000-0000-4000-8000-000000000001' $$,
  '%RF-29.3%', 'RF-29.3 · el título no cambia tras publicar');
select throws_like(
  $$ update public.announcements set property_id = 'a2900000-0000-4000-8000-000000000002' where id = 'b2900000-0000-4000-8000-000000000001' $$,
  '%RF-29.3%', 'RF-29.3 · ni cambia de propiedad');

-- ── RF-29.3 · resolver ──────────────────────────────────────────────────────
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000003';
select throws_like(
  $$ select public.resolve_announcement('b2900000-0000-4000-8000-000000000001') $$,
  '%no existe%', 'RF-29.3 · un Propietario ve la novedad pero no la resuelve');
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.resolve_announcement('b2900000-0000-4000-8000-000000000001') $$,
  'RF-29.3 · el Administrador resuelve la novedad');
select is(
  (select (status, resolved_by, resolved_at is not null) from public.announcements where id = 'b2900000-0000-4000-8000-000000000001'),
  ('resolved'::text, 'd2900000-0000-4000-8000-000000000001'::uuid, true),
  'RF-29.3 · queda resuelta, con quién y cuándo');
select throws_like(
  $$ select public.resolve_announcement('b2900000-0000-4000-8000-000000000001') $$,
  '%ya está resuelta%', 'RF-29.3 · no se resuelve dos veces');
select is(
  (select array_agg(title order by title) from public.announcements
    where property_id = 'a2900000-0000-4000-8000-000000000001' and status = 'open'),
  array['Fuga de gas'], 'RF-29.3 · solo la abierta alimenta las alertas del tablero (HU-21)');
select is(
  (select count(*) from public.audit_log where entity_type = 'announcement'
     and entity_id = 'b2900000-0000-4000-8000-000000000001'),
  2::bigint, 'TR-01 · la publicación y la resolución quedan auditadas');

-- ── RF-30.3 · lo que ve cada quien ──────────────────────────────────────────
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000002';
insert into public.announcements (property_id, title, body, urgency)
values ('a2900000-0000-4000-8000-000000000002', 'Poda', 'El jueves.', 'informative');

set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000003';
select is(
  (select array_agg(title order by title) from public.announcements),
  array['Corte de agua', 'Fuga de gas'], 'RF-30.3 · CA-30.3 · Ana ve el historial de su propiedad, resueltas incluidas, y nada de otra');
select is(
  (select count(*) from public.notification_inbox where kind = 'announcement_published'),
  2::bigint, 'RF-30.1 · y en su bandeja están las dos novedades que le llegaron');
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000008';
select is((select count(*) from public.announcements), 0::bigint,
  'RF-30.3 · CA-30.3 · un Usuario sin fracción no ve novedad alguna');
set local request.jwt.claim.sub = 'd2900000-0000-4000-8000-000000000002';
select is(
  (select array_agg(title) from public.announcements),
  array['Poda'], 'RF-29.3 · el Administrador ve el historial de las propiedades que administra y no el de otras');

select * from finish();
rollback;
