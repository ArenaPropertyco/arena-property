-- HU-31 · RF-31.1…RF-31.4 — el comunicado global en la base: solo el Superadmin
-- lo emite, el segmento se resuelve a cuentas concretas sin duplicados, y queda
-- registrado con su segmento, su fecha y cuántos lo recibieron.
begin;
select plan(23);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'broadcasts', 'RF-31.3 · existe broadcasts');
select has_column('public', 'broadcasts', 'recipient_count', 'RF-31.3 · el comunicado registra cuántos lo recibieron');
select is((select relforcerowsecurity from pg_class where oid = 'public.broadcasts'::regclass), true,
  'RF-31.4 · broadcasts fuerza RLS');
select ok(not has_table_privilege('authenticated', 'public.broadcasts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.broadcasts', 'DELETE'),
  'RF-31.3 · un comunicado enviado no se edita ni se borra');

-- ── Cuentas: cada rol, una con dos roles, una sin rol operativo y una suspendida ─
insert into auth.users (id, email) values
  ('d3100000-0000-4000-8000-00000000000a', 'super.hu31@arena.co'),
  ('d3100000-0000-4000-8000-000000000001', 'admin.hu31@arena.co'),
  ('d3100000-0000-4000-8000-000000000003', 'ana.hu31@ejemplo.com'),
  ('d3100000-0000-4000-8000-000000000004', 'luis.hu31@ejemplo.com'),
  ('d3100000-0000-4000-8000-000000000005', 'dual.hu31@ejemplo.com'),
  ('d3100000-0000-4000-8000-000000000006', 'emba.hu31@ejemplo.com'),
  ('d3100000-0000-4000-8000-000000000007', 'nadie.hu31@ejemplo.com'),
  ('d3100000-0000-4000-8000-000000000008', 'suspendida.hu31@ejemplo.com');
insert into public.user_roles (user_id, role) values
  ('d3100000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d3100000-0000-4000-8000-000000000001', 'property_admin'),
  ('d3100000-0000-4000-8000-000000000003', 'owner'),
  ('d3100000-0000-4000-8000-000000000004', 'owner'),
  ('d3100000-0000-4000-8000-000000000005', 'owner'),
  ('d3100000-0000-4000-8000-000000000005', 'ambassador'),
  ('d3100000-0000-4000-8000-000000000006', 'ambassador'),
  ('d3100000-0000-4000-8000-000000000008', 'owner');
update public.profiles
   set status = 'suspended', suspension_kind = 'administrative', suspension_reason = 'Documentos vencidos.', suspended_at = now()
 where id = 'd3100000-0000-4000-8000-000000000008';

-- ── La propiedad P: del admin 1, con Ana (2 fracciones), Luis, Dual y la suspendida ─
set local role authenticated;
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-000000000001';
insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a3100000-0000-4000-8000-000000000001', 'Casa Comunicados', 'Propiedad de prueba.', 200, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a3100000-0000-4000-8000-000000000001', array[100000000::bigint]);

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set status = 'reserved'
 where property_id = 'a3100000-0000-4000-8000-000000000001' and number between 1 and 5;
update public.fractions set status = 'sold', owner_id = 'd3100000-0000-4000-8000-000000000003'
 where property_id = 'a3100000-0000-4000-8000-000000000001' and number in (1, 2);
update public.fractions set status = 'sold', owner_id = 'd3100000-0000-4000-8000-000000000004'
 where property_id = 'a3100000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'd3100000-0000-4000-8000-000000000005'
 where property_id = 'a3100000-0000-4000-8000-000000000001' and number = 4;
update public.fractions set status = 'sold', owner_id = 'd3100000-0000-4000-8000-000000000008'
 where property_id = 'a3100000-0000-4000-8000-000000000001' and number = 5;

-- ── RF-31.4 · solo el Superadmin ────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-000000000001';
select throws_ok(
  $$ insert into public.broadcasts (title, body, segment_kind) values ('Cierre', 'Del 24 al 2.', 'all') $$,
  '42501', null, 'RF-31.4 · un Administrador no emite comunicados globales');
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-000000000003';
select throws_ok(
  $$ insert into public.broadcasts (title, body, segment_kind) values ('Cierre', 'Del 24 al 2.', 'all') $$,
  '42501', null, 'RF-31.4 · un Propietario tampoco');
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-00000000000a';
select lives_ok(
  $$ insert into public.broadcasts (id, title, body, segment_kind)
     values ('c3100000-0000-4000-8000-000000000001', '  Cierre de fin de año ', 'Las oficinas cierran del 24 al 2.', 'all') $$,
  'RF-31.4 · el Superadmin emite el comunicado');

-- ── RF-31.3 · queda registrado con su segmento y su fecha, y sale por TR-03 ──
select is(
  (select (title, segment_kind, created_by, created_at is not null) from public.broadcasts where id = 'c3100000-0000-4000-8000-000000000001'),
  ('Cierre de fin de año'::text, 'all'::text, 'd3100000-0000-4000-8000-00000000000a'::uuid, true),
  'RF-31.3 · el comunicado queda registrado con su segmento, su autor y su fecha');
reset role;
set local request.jwt.claim.sub = '';
select is(
  (select count(*) from public.notifications where kind = 'broadcast' and entity_type = 'broadcast'
     and entity_id = 'c3100000-0000-4000-8000-000000000001'),
  1::bigint, 'RF-31.3 · el envío es una notificación del canal TR-03');

-- ── RF-31.1 · el segmento se declara coherente ──────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-00000000000a';
select throws_ok(
  $$ insert into public.broadcasts (title, body, segment_kind, segment_roles) values ('X', 'Y', 'roles', '{}') $$,
  '23514', null, 'RF-31.1 · un segmento por rol sin roles se rechaza');
select throws_ok(
  $$ insert into public.broadcasts (title, body, segment_kind) values ('X', 'Y', 'property') $$,
  '23514', null, 'RF-31.1 · un segmento por propiedad sin propiedad se rechaza');
select throws_ok(
  $$ insert into public.broadcasts (title, body, segment_kind, segment_roles) values ('X', 'Y', 'roles', '{superadmin}') $$,
  '23514', null, 'RF-31.1 · solo se segmenta por Administrador, Propietario o Embajador');

-- ── CA-31.1 · CA-31.2 · CA-31.3 · el segmento resuelto a cuentas ────────────
insert into public.broadcasts (id, title, body, segment_kind, segment_roles)
values ('c3100000-0000-4000-8000-000000000002', 'Para propietarios', 'Asamblea anual.', 'roles', '{owner}');
insert into public.broadcasts (id, title, body, segment_kind, segment_property_id)
values ('c3100000-0000-4000-8000-000000000003', 'Para la casa', 'Mantenimiento de la piscina.', 'property', 'a3100000-0000-4000-8000-000000000001');
insert into public.broadcasts (id, title, body, segment_kind, segment_roles)
values ('c3100000-0000-4000-8000-000000000004', 'Propietarios y embajadores', 'Nuevo programa.', 'roles', '{owner,ambassador}');

reset role;
set local request.jwt.claim.sub = '';
select is(
  (select array_agg(r.recipient_id::text order by r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'c3100000-0000-4000-8000-000000000002'
      and r.recipient_id::text like 'd3100000-%'),
  array['d3100000-0000-4000-8000-000000000003', 'd3100000-0000-4000-8000-000000000004', 'd3100000-0000-4000-8000-000000000005'],
  'CA-31.1 · «rol Propietario» llega a todas las cuentas activas con ese rol y a ninguna más');
select is(
  (select array_agg(r.recipient_id::text order by r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'c3100000-0000-4000-8000-000000000003'),
  array['d3100000-0000-4000-8000-000000000001', 'd3100000-0000-4000-8000-000000000003', 'd3100000-0000-4000-8000-000000000004', 'd3100000-0000-4000-8000-000000000005'],
  'CA-31.2 · «propiedad P» llega a los propietarios de P y a su administrador, sin repetir a Ana ni incluir a la suspendida');
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'c3100000-0000-4000-8000-000000000004' and r.recipient_id = 'd3100000-0000-4000-8000-000000000005'),
  1::bigint, 'CA-31.3 · la cuenta Propietario+Embajador recibe «Propietarios y Embajadores» una sola vez');
select is(
  (select array_agg(r.recipient_id::text order by r.recipient_id) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'c3100000-0000-4000-8000-000000000004'
      and r.recipient_id::text like 'd3100000-%'),
  array['d3100000-0000-4000-8000-000000000003', 'd3100000-0000-4000-8000-000000000004', 'd3100000-0000-4000-8000-000000000005', 'd3100000-0000-4000-8000-000000000006'],
  'CA-31.3 · y el conjunto es la unión de los dos roles');
-- «Todos» alcanza también a las cuentas reales de la base local: se compara contra
-- el total de activas y se comprueba que la suspendida quedó fuera.
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id where n.entity_id = 'c3100000-0000-4000-8000-000000000001'),
  (select count(*) from public.profiles where status = 'active'),
  'RF-31.1 · «todos» es toda cuenta activa de la plataforma');
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'c3100000-0000-4000-8000-000000000001' and r.recipient_id = 'd3100000-0000-4000-8000-000000000008'),
  0::bigint, 'RF-31.2 · la cuenta suspendida no recibe comunicados');
select is(
  (select recipient_count from public.broadcasts where id = 'c3100000-0000-4000-8000-000000000003'),
  4, 'RF-31.3 · el registro guarda cuántos lo recibieron');
select is(
  (select property_id from public.notifications where entity_id = 'c3100000-0000-4000-8000-000000000003'),
  'a3100000-0000-4000-8000-000000000001'::uuid,
  'RF-30.3 · el comunicado por propiedad queda ligado a ella, para filtrar la bandeja');
select is(
  (select count(*) from public.audit_log where entity_type = 'broadcast' and entity_id = 'c3100000-0000-4000-8000-000000000001'),
  1::bigint, 'TR-01 · el envío queda auditado');

-- ── RF-30.1 · lo que ve el destinatario ─────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.notification_inbox where kind = 'broadcast'),
  4::bigint, 'RF-30.1 · Dual recibió los cuatro comunicados que le tocaban, cada uno una vez');
set local request.jwt.claim.sub = 'd3100000-0000-4000-8000-000000000001';
select is((select count(*) from public.broadcasts), 0::bigint,
  'RF-31.4 · el registro de comunicados es solo del Superadmin');

select * from finish();
rollback;
