-- HU-06 · RF-06.1…RF-06.5 — invitación a comprar y cierre de la compra.
-- Nivel N2: quién invita, sobre qué fracción, y qué deja el cierre (D-31).
begin;
select plan(37);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'purchase_invitations', 'existe purchase_invitations');
select is((select relrowsecurity from pg_class where oid = 'public.purchase_invitations'::regclass), true,
  'purchase_invitations nace con RLS');
select is((select relforcerowsecurity from pg_class where oid = 'public.purchase_invitations'::regclass), true,
  'purchase_invitations fuerza RLS al dueño');
select ok(not has_table_privilege('authenticated', 'public.purchase_invitations', 'DELETE'),
  'una invitación no se borra: se cancela o se acepta');

-- ── Cuentas ─────────────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-4000-8000-00000000000a', 'super@arena.co', '{}'),
  ('d0000000-0000-4000-8000-000000000001', 'admin1@arena.co', '{}'),
  ('d0000000-0000-4000-8000-000000000002', 'admin2@arena.co', '{}'),
  -- RF-06.4 · el comprador llegó con un código de referido (HU-51).
  ('d0000000-0000-4000-8000-000000000003', 'comprador@ejemplo.com', '{"referral_code": "ana2026"}'),
  ('d0000000-0000-4000-8000-000000000004', 'curioso@ejemplo.com', '{}');
insert into public.user_roles (user_id, role) values
  ('d0000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('d0000000-0000-4000-8000-000000000001', 'property_admin'),
  ('d0000000-0000-4000-8000-000000000002', 'property_admin');

-- ── Propiedad de admin1, fraccionada ────────────────────────────────────────
set local role authenticated;
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a6000000-0000-4000-8000-000000000001', 'Casa Venta', 'Propiedad de prueba.', 200, 'CO', 'La Guajira', 'Palomino');
select public.fraccionar_propiedad('a6000000-0000-4000-8000-000000000001', array[180000000::bigint]);

-- Los identificadores de las fracciones, a mano de cualquier rol: un Administrador
-- ajeno no puede ni leerlas, y aquí se quiere medir que tampoco invita sobre ellas.
reset role;
create temporary table fx as
  select id, number from public.fractions where property_id = 'a6000000-0000-4000-8000-000000000001';
grant select on fx to authenticated;
set local role authenticated;

-- ── CA-06.1 · solo el Administrador asignado invita ─────────────────────────
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000002';

select throws_ok(
  $$ insert into public.purchase_invitations (fraction_id, property_id, invitee_email, agreed_price)
     values ((select id from fx where number = 1),
             'a6000000-0000-4000-8000-000000000001', 'comprador@ejemplo.com', 180000000) $$,
  '42501', null, 'CA-06.1 · un Administrador sin la propiedad asignada no invita sobre ella');

set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, agreed_price, referral_code)
     values ('e6000000-0000-4000-8000-000000000001',
             (select id from fx where number = 1),
             'a6000000-0000-4000-8000-000000000001', 'Comprador@Ejemplo.com', 180000000, 'otro-2026') $$,
  'RF-06.1 · el Administrador asignado invita sobre una fracción disponible');

select is(
  (select invitee_id from public.purchase_invitations where id = 'e6000000-0000-4000-8000-000000000001'),
  'd0000000-0000-4000-8000-000000000003'::uuid,
  'RF-06.1 · la invitación queda vinculada a la cuenta que ya tiene ese correo, normalizado');

select is(
  (select status::text from public.purchase_invitations where id = 'e6000000-0000-4000-8000-000000000001'),
  'pending', 'la invitación nace pendiente');

-- Sobre una reservada también cabe.
update public.fractions set status = 'reserved'
  where property_id = 'a6000000-0000-4000-8000-000000000001' and number = 2;

select lives_ok(
  $$ insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, agreed_price, referral_code)
     values ('e6000000-0000-4000-8000-000000000002',
             (select id from fx where number = 2),
             'a6000000-0000-4000-8000-000000000001', 'curioso@ejemplo.com', 175000000, ' luis-2026 ') $$,
  'RF-06.1 · sobre una fracción reservada también se invita');

-- ── RF-06.4 · el código del embajador viaja en la invitación ────────────────
select is(
  (select referral_code from public.purchase_invitations where id = 'e6000000-0000-4000-8000-000000000002'),
  'LUIS-2026', 'RF-06.4 · el código de referido de la invitación se guarda normalizado');

select throws_ok(
  $$ insert into public.purchase_invitations (fraction_id, property_id, invitee_email, agreed_price, referral_code)
     values ((select id from fx where number = 4),
             'a6000000-0000-4000-8000-000000000001', 'cuarto@ejemplo.com', 180000000, 'x') $$,
  'P0001', null, 'RF-06.4 · un código de referido con formato inválido se rechaza');

select throws_ok(
  $$ update public.purchase_invitations set referral_code = 'OTRO-2026'
      where id = 'e6000000-0000-4000-8000-000000000002' $$,
  'P0001', null, 'RF-06.4 · el código de la invitación no se edita después');

select throws_ok(
  $$ insert into public.purchase_invitations (fraction_id, property_id, invitee_email, agreed_price)
     values ((select id from fx where number = 1),
             'a6000000-0000-4000-8000-000000000001', 'otro@ejemplo.com', 180000000) $$,
  '23505', null, 'una fracción no se ofrece a dos compradores a la vez: una sola invitación pendiente');

select throws_ok(
  $$ update public.purchase_invitations set status = 'accepted'
      where id = 'e6000000-0000-4000-8000-000000000001' $$,
  'P0001', null, 'RF-06.2 · aceptar una invitación no es un UPDATE: es cerrar la compra');

-- ── El invitado ve la suya y nadie más ──────────────────────────────────────
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.purchase_invitations where property_id = 'a6000000-0000-4000-8000-000000000001'),
  1::bigint, 'el invitado ve su invitación');

set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000002';
select is(
  (select count(*) from public.purchase_invitations where property_id = 'a6000000-0000-4000-8000-000000000001'),
  0::bigint, 'CA-06.1 · un Administrador ajeno no ve las invitaciones de la propiedad');

select throws_ok(
  $$ select public.cerrar_compra('e6000000-0000-4000-8000-000000000001') $$,
  'P0001', null, 'CA-06.1 · un Administrador ajeno tampoco cierra la compra');

-- ── CA-06.2 · cierre de la compra: titularidad sí, derecho de uso no (D-31) ─
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';

select lives_ok(
  $$ select public.cerrar_compra('e6000000-0000-4000-8000-000000000001') $$,
  'RF-06.2 · el Administrador asignado cierra la compra');

select is(
  (select (status::text, owner_id, calendar_active) from public.fractions
    where property_id = 'a6000000-0000-4000-8000-000000000001' and number = 1),
  ('sold'::text, 'd0000000-0000-4000-8000-000000000003'::uuid, false),
  'CA-06.2 · la fracción queda vendida, vinculada al comprador y con el calendario inactivo');

-- `user_roles` solo deja leer el propio: se mira con la sesión del comprador.
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000003';
select ok(
  exists (select 1 from public.user_roles
           where user_id = 'd0000000-0000-4000-8000-000000000003' and role = 'owner'),
  'CA-06.2 · el comprador obtiene el rol Propietario de inmediato');
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-000000000001';

select is(
  (select (status::text, invitee_id) from public.purchase_invitations
    where id = 'e6000000-0000-4000-8000-000000000001'),
  ('accepted'::text, 'd0000000-0000-4000-8000-000000000003'::uuid),
  'la invitación queda aceptada y apunta al comprador');

-- ── CA-06.3 · el plan de pagos nace con el cierre ───────────────────────────
select is(
  (select (agreed_price, public.estado_del_plan(id)) from public.payment_plans
    where invitation_id = 'e6000000-0000-4000-8000-000000000001'),
  (180000000::bigint, 'reserved'::text),
  'CA-06.3 · se crea el plan con el precio pactado y sin abonos deriva «Reservada»');

select is(
  (select calendar_active from public.fractions
    where property_id = 'a6000000-0000-4000-8000-000000000001' and number = 1),
  false, 'CA-06.3 · el calendario sigue inactivo hasta que el plan derive «Pago completado»');

select is(
  (select referral_code from public.payment_plans
    where invitation_id = 'e6000000-0000-4000-8000-000000000001'),
  'ANA2026', 'RF-06.4 · la atribución del perfil del comprador manda sobre la de la invitación (D-03)');

-- El segundo comprador no traía atribución: la de la invitación suple.
select lives_ok(
  $$ select public.cerrar_compra('e6000000-0000-4000-8000-000000000002') $$,
  'RF-06.2 · se cierra la compra de la fracción reservada');

select is(
  (select referral_code from public.payment_plans
    where invitation_id = 'e6000000-0000-4000-8000-000000000002'),
  'LUIS-2026', 'RF-06.4 · sin atribución en el perfil, el código de la invitación se arrastra a la compra');

-- ── CA-06.4 · RF-06.5 · vendida no se reinvita ──────────────────────────────
select throws_ok(
  $$ insert into public.purchase_invitations (fraction_id, property_id, invitee_email, agreed_price)
     values ((select id from fx where number = 1),
             'a6000000-0000-4000-8000-000000000001', 'otro@ejemplo.com', 180000000) $$,
  'P0001', null, 'CA-06.4 · una fracción vendida no admite nueva invitación');

select throws_ok(
  $$ select public.cerrar_compra('e6000000-0000-4000-8000-000000000001') $$,
  'P0001', null, 'CA-06.4 · una invitación aceptada no se vuelve a cerrar');

-- ── Un invitado sin cuenta: la invitación vale, el cierre espera ────────────
select lives_ok(
  $$ insert into public.purchase_invitations (id, fraction_id, property_id, invitee_email, agreed_price)
     values ('e6000000-0000-4000-8000-000000000003',
             (select id from fx where number = 3),
             'a6000000-0000-4000-8000-000000000001', 'nuevo@ejemplo.com', 180000000) $$,
  'RF-06.1 · se invita a un correo que todavía no tiene cuenta');

select is(
  (select invitee_id from public.purchase_invitations where id = 'e6000000-0000-4000-8000-000000000003'),
  null, 'sin cuenta no hay vínculo todavía');

select throws_ok(
  $$ select public.cerrar_compra('e6000000-0000-4000-8000-000000000003') $$,
  'P0001', null, 'RF-06.2 · la compra no se cierra hasta que el invitado tenga cuenta');

-- ── Cancelación ─────────────────────────────────────────────────────────────
select lives_ok(
  $$ update public.purchase_invitations set status = 'cancelled', cancel_reason = 'Desistió.'
      where id = 'e6000000-0000-4000-8000-000000000003' $$,
  'una invitación pendiente se cancela');

select is(
  (select (status::text, cancelled_at is not null, cancelled_by) from public.purchase_invitations
    where id = 'e6000000-0000-4000-8000-000000000003'),
  ('cancelled'::text, true, 'd0000000-0000-4000-8000-000000000001'::uuid),
  'la cancelación deja fecha y autor');

select throws_ok(
  $$ update public.purchase_invitations set status = 'pending'
      where id = 'e6000000-0000-4000-8000-000000000003' $$,
  'P0001', null, 'una invitación cancelada no revive: se crea otra');

-- ── TR-01 · RF-A.3 · invitación y cierre quedan auditados ───────────────────
-- El registro se lee con la sesión del Superadmin (RF-A.6).
set local request.jwt.claim.sub = 'd0000000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from public.audit_log
    where action = 'purchase_invitation.creada'
      and entity_id = 'e6000000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-A.1 · la invitación queda auditada');

select is(
  (select count(*) from public.audit_log
    where action = 'payment_plan.creada'
      and property_id = 'a6000000-0000-4000-8000-000000000001'
      and actor_id = 'd0000000-0000-4000-8000-000000000001'),
  2::bigint, 'CA-A.1 · cada cierre deja su plan auditado con el Administrador como autor');

select is(
  (select count(*) from public.audit_log
    where action = 'user_role.creada'
      and next_state ->> 'user_id' = 'd0000000-0000-4000-8000-000000000003'
      and next_state ->> 'role' = 'owner'),
  1::bigint, 'CA-A.1 · el rol Propietario otorgado queda auditado');

reset role;
select * from finish();
rollback;
