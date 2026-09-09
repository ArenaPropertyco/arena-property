-- TR-03 · RF-N.1, RF-N.4, RF-N.5 — el canal de notificaciones: modelo único,
-- estado leído por destinatario, emisión idempotente y bandeja por RLS.
begin;
select plan(21);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'notifications', 'existe notifications');
select has_table('public', 'notification_recipients', 'existe notification_recipients');
select is((select relforcerowsecurity from pg_class where oid = 'public.notifications'::regclass), true,
  'notifications fuerza RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.notification_recipients'::regclass), true,
  'notification_recipients fuerza RLS');
select has_column('public', 'notification_recipients', 'read_at',
  'RF-N.1 · el estado leído vive en el destinatario, no en la notificación');
select ok(not has_table_privilege('authenticated', 'public.notifications', 'INSERT'),
  'RF-N.4 · la emisión pasa por public.emitir_notificacion(), no por INSERT directo');

-- ── Cuentas: dos propietarias, un embajador sin fracciones y una ajena ──────
insert into auth.users (id, email, raw_user_meta_data) values
  ('d3000000-0000-4000-8000-000000000001', 'ana.tr03@arena.co', '{}'),
  ('d3000000-0000-4000-8000-000000000002', 'luis.tr03@arena.co', '{}'),
  ('d3000000-0000-4000-8000-000000000003', 'emba.tr03@arena.co', '{}'),
  ('d3000000-0000-4000-8000-000000000004', 'ajeno.tr03@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('d3000000-0000-4000-8000-000000000003', 'ambassador');
update public.profiles set locale = 'en' where id = 'd3000000-0000-4000-8000-000000000002';

-- ── RF-N.4 · CA-N.3 · emitir dos veces deja una sola notificación por destinatario ─
select lives_ok(
  $$ select public.emitir_notificacion('announcement_published', 'announcement', 'aviso-1', null,
       '{"title": "Corte de agua"}'::jsonb,
       array['d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'RF-N.4 · la emisión con destinatarios crea la notificación');
select lives_ok(
  $$ select public.emitir_notificacion('announcement_published', 'announcement', 'aviso-1', null,
       '{"title": "Corte de agua"}'::jsonb,
       array['d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002']::uuid[]) $$,
  'CA-N.3 · reprocesar el mismo evento no falla');
select is(
  (select count(*) from public.notifications where kind = 'announcement_published' and entity_id = 'aviso-1'),
  1::bigint, 'CA-N.3 · el mismo evento procesado dos veces deja una sola notificación');
select is(
  (select count(*) from public.notification_recipients r
     join public.notifications n on n.id = r.notification_id
    where n.entity_id = 'aviso-1'),
  2::bigint, 'CA-N.3 · y exactamente un destinatario por cuenta');

-- Dos avisos más para tener tres no leídas por cabeza.
select public.emitir_notificacion('announcement_published', 'announcement', 'aviso-2', null, '{"title": "Reparación"}'::jsonb,
  array['d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002']::uuid[]);
select public.emitir_notificacion('announcement_published', 'announcement', 'aviso-3', null, '{"title": "Reglas"}'::jsonb,
  array['d3000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002']::uuid[]);
-- Una para el embajador, que no tiene fracciones.
select public.emitir_notificacion('referral_paid', 'commission', 'com-1', null, '{"amount": "$ 5.000.000"}'::jsonb,
  array['d3000000-0000-4000-8000-000000000003']::uuid[]);

-- ── RF-N.5 · CA-N.4 · la bandeja es de cada cuenta ──────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd3000000-0000-4000-8000-000000000001';

select is((select count(*) from public.notification_inbox), 3::bigint,
  'RF-N.5 · Ana ve sus 3 notificaciones y ninguna ajena');
select is((select count(*) from public.notification_inbox where read_at is null), 3::bigint,
  'CA-N.4 · las 3 empiezan no leídas');

select lives_ok(
  $$ select public.marcar_leida((select id from public.notification_inbox order by created_at limit 1)) $$,
  'CA-N.4 · el destinatario marca una como leída');
select is((select count(*) from public.notification_inbox where read_at is null), 2::bigint,
  'CA-N.4 · su contador baja a 2');

set local request.jwt.claim.sub = 'd3000000-0000-4000-8000-000000000002';
select is((select count(*) from public.notification_inbox where read_at is null), 3::bigint,
  'CA-N.4 · el contador de Luis no cambia');

-- Nadie marca lo ajeno: la fila no es visible ni actualizable (CA-30.3).
select is(
  (select public.marcar_leida(r.id) from public.notification_recipients r
     where r.recipient_id = 'd3000000-0000-4000-8000-000000000001' limit 1),
  null, 'CA-30.3 · una notificación dirigida a otro no es visible ni marcable');

select throws_ok(
  $$ update public.notification_recipients set email_attempts = 9
      where recipient_id = 'd3000000-0000-4000-8000-000000000002' $$,
  'P0001', null, 'RF-N.5 · RF-N.6 · el destinatario no toca el estado del correo: eso es del servidor');

select lives_ok($$ select public.marcar_todas_leidas() $$, 'RF-30.2 · marcar todas');
select is((select count(*) from public.notification_inbox where read_at is null), 0::bigint,
  'RF-30.2 · marcar todas deja cero no leídas');

-- ── CA-N.5 · una cuenta solo Embajador accede a su bandeja ──────────────────
set local request.jwt.claim.sub = 'd3000000-0000-4000-8000-000000000003';
select is(
  (select (count(*), max(kind)) from public.notification_inbox),
  (1::bigint, 'referral_paid'::text),
  'CA-N.5 · una cuenta con rol solo Embajador, sin fracciones, ve sus notificaciones');

set local request.jwt.claim.sub = 'd3000000-0000-4000-8000-000000000004';
select is((select count(*) from public.notification_inbox), 0::bigint,
  'RF-N.5 · una cuenta sin notificaciones ve su bandeja vacía, no la de otros');

reset role;
select * from finish();
rollback;
