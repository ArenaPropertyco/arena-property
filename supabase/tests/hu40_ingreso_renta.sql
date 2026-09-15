-- HU-40 · RF-40.1…RF-40.6 · D-01, D-39 · TR-02 — el ingreso de una semana rentada
-- y a quién pertenece: prorrateado entre las ocho o atribuido a quien la liberó.
-- HU-24 · RF-24.3 — el detalle solo se ve sobre la fracción propia.
begin;
select plan(48);

-- ── Estructura ──────────────────────────────────────────────────────────────
select has_table('public', 'platform_ledger', 'D-01 · existe el libro de plataforma');
select has_column('public', 'properties', 'rental_commission_basis_points', 'RF-40.4 · la comisión de gestión es de la propiedad');
select has_column('public', 'movements', 'booking_id', 'RF-40.1 · el ingreso se enlaza a su reserva');
select has_column('public', 'movements', 'commission_amount', 'RF-40.4 · y congela la comisión aplicada');
select is((select relforcerowsecurity from pg_class where oid = 'public.platform_ledger'::regclass),
  true, 'D-01 · platform_ledger fuerza RLS');
select ok(not has_table_privilege('authenticated', 'public.platform_ledger', 'INSERT'),
  'D-01 · el libro de plataforma lo escribe solo la base');
select has_function('public', 'fijar_comision_de_renta', array['uuid', 'integer'], 'RF-40.4 · existe fijar_comision_de_renta');
select has_function('public', 'registrar_ingreso_de_renta', array['uuid', 'bigint', 'uuid', 'uuid', 'uuid', 'date', 'text'],
  'RF-40.1 · existe registrar_ingreso_de_renta');

-- ── Cuentas y propiedad ─────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('c4000000-0000-4000-8000-00000000000a', 'super.ren@arena.co', '{}'),
  ('c4000000-0000-4000-8000-000000000001', 'admin.ren@arena.co', '{}'),
  ('c4000000-0000-4000-8000-000000000003', 'dueno3.ren@arena.co', '{}'),
  ('c4000000-0000-4000-8000-000000000005', 'dueno5.ren@arena.co', '{}');
insert into public.user_roles (user_id, role) values
  ('c4000000-0000-4000-8000-00000000000a', 'superadmin'),
  ('c4000000-0000-4000-8000-000000000001', 'property_admin');

set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';

insert into public.properties (id, name, description, area_m2, country, region, city) values
  ('a4000000-0000-4000-8000-000000000001', 'Casa Renta', 'Propiedad de prueba.', 100, 'CO', 'Bolívar', 'Cartagena');
select public.fraccionar_propiedad('a4000000-0000-4000-8000-000000000001', array[100000000::bigint]);
update public.fractions set status = 'reserved'
  where property_id = 'a4000000-0000-4000-8000-000000000001' and number in (3, 5);
update public.fractions set status = 'sold', owner_id = 'c4000000-0000-4000-8000-000000000003'
  where property_id = 'a4000000-0000-4000-8000-000000000001' and number = 3;
update public.fractions set status = 'sold', owner_id = 'c4000000-0000-4000-8000-000000000005'
  where property_id = 'a4000000-0000-4000-8000-000000000001' and number = 5;

create temporary table semanas31 as
select jsonb_agg(jsonb_build_object(
  'index', i,
  'starts_on', ('2031-01-04'::date + i * 7)::text,
  'ends_on', ('2031-01-04'::date + i * 7 + 7)::text,
  'season', case when i < 8 then 'alta' when i < 16 then 'media_alta' when i < 24 then 'media' else 'baja' end,
  'peak_block', null
) order by i) as semanas
from generate_series(0, 51) as i;
select public.guardar_calendario('a4000000-0000-4000-8000-000000000001', 2031, 2030, null, (select semanas from semanas31));

reset role;
set local request.jwt.claim.sub = '';
update public.fractions set calendar_active = true
  where property_id = 'a4000000-0000-4000-8000-000000000001' and number in (3, 5);

create temporary table ctx40 as
  select (select id from public.season_calendars where property_id = 'a4000000-0000-4000-8000-000000000001' and year = 2031) as cal,
         (select id from public.fractions where property_id = 'a4000000-0000-4000-8000-000000000001' and number = 3) as f3,
         (select id from public.fractions where property_id = 'a4000000-0000-4000-8000-000000000001' and number = 5) as f5,
         (select id from public.expense_categories where name = 'Renta a terceros' and kind = 'income') as categoria,
         (select id from public.payment_methods where code = 'transfer') as medio,
         (select id from public.ledger_accounts where code = 'bank') as cuenta,
         null::uuid as tercero,
         null::uuid as libre,      -- reserva sobre semana liberada por la 3/8
         null::uuid as cancelada;  -- reserva sobre semana cancelada por la 5/8
grant select, update on ctx40 to authenticated;

set local role authenticated;
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
select public.open_calendar_selection((select cal from ctx40), array[3, 5]);
select public.select_weeks((select cal from ctx40), (select f3 from ctx40), array[0, 9, 17, 25, 33, 41]);
select public.select_weeks((select cal from ctx40), (select f5 from ctx40), array[2, 10, 18, 26, 34, 42]);
update ctx40 set tercero = (select id from public.registrar_tercero(
  'a4000000-0000-4000-8000-000000000001', 'Marta Restrepo', 'cc', '1020304', 'marta@ejemplo.com', null, true));

-- La 3/8 libera a propósito su semana 17; la 5/8 confirma y cancela la 10.
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000003';
select public.release_week((select cal from ctx40), (select f3 from ctx40), 17);
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000005';
select public.confirm_week((select cal from ctx40), (select f5 from ctx40), 10);
select public.cancel_week((select cal from ctx40), (select f5 from ctx40), 10);

set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
update ctx40 set libre = (select id from public.rentar_semana((select cal from ctx40), 17, (select tercero from ctx40)));
update ctx40 set cancelada = (select id from public.rentar_semana((select cal from ctx40), 10, (select tercero from ctx40)));

-- ── CA-40.1 · una semana cancelada se prorratea entre las 8 ─────────────────
select lives_ok(
  $$ select public.registrar_ingreso_de_renta((select cancelada from ctx40), 800000,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Renta semana 10') $$,
  'RF-40.1 · el Administrador registra el ingreso de la semana cancelada');
select is(
  (select count(*) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select cancelada from ctx40)),
  8::bigint, 'CA-40.1 · el ingreso de una semana cancelada genera las 8 cuotas');
select is(
  (select array_agg(s.amount order by s.fraction_number) from public.movement_shares s
     join public.movements m on m.id = s.movement_id where m.booking_id = (select cancelada from ctx40)),
  array[100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000]::bigint[],
  'CA-40.1 · cada fracción recibe $100.000');
select is(
  (select sum(s.amount) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select cancelada from ctx40)),
  800000::numeric, 'CA-40.1 · y la suma es exactamente $800.000');
select is(
  (select m.commission_amount from public.movements m where m.booking_id = (select cancelada from ctx40)),
  null::bigint, 'RF-40.2 · una semana cancelada no paga comisión de gestión');
select is(
  (select count(*) from public.platform_ledger where source_type = 'rental_commission'),
  0::bigint, 'D-01 · y no entra nada al libro de plataforma');

-- ── CA-40.5 · sin comisión configurada no hay ingreso atribuido ─────────────
select is(
  (select rental_commission_basis_points from public.properties where id = 'a4000000-0000-4000-8000-000000000001'),
  null::integer, 'RF-40.5 · la propiedad todavía no tiene comisión de gestión');
select throws_like(
  $$ select public.registrar_ingreso_de_renta((select libre from ctx40), 800000,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Renta semana 17') $$,
  '%CA-40.5%', 'CA-40.5 · el ingreso de una semana liberada se rechaza con motivo');
select is(
  (select count(*) from public.movements where booking_id = (select libre from ctx40)),
  0::bigint, 'CA-40.5 · y no se crea ninguna cuota');

-- ── RF-40.4 · solo el Superadmin fija la comisión ───────────────────────────
select throws_like(
  $$ select public.fijar_comision_de_renta('a4000000-0000-4000-8000-000000000001', 2000) $$,
  '%RF-40.4%', 'RF-40.4 · el Administrador no fija la comisión de gestión');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select throws_like(
  $$ select public.fijar_comision_de_renta('a4000000-0000-4000-8000-000000000001', 10001) $$,
  '%10 000%', 'RF-40.4 · TR-02 · un porcentaje fuera de rango se rechaza');
select lives_ok(
  $$ select public.fijar_comision_de_renta('a4000000-0000-4000-8000-000000000001', 2000) $$,
  'RF-40.4 · el Superadmin fija el 20 % de comisión de gestión');

-- ── CA-40.4 · la semana liberada es de quien la liberó ──────────────────────
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
select lives_ok(
  $$ select public.registrar_ingreso_de_renta((select libre from ctx40), 800000,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Renta semana 17') $$,
  'CA-40.4 · con la comisión configurada, el ingreso de la semana liberada sí entra');
select is(
  (select count(*) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select libre from ctx40)),
  1::bigint, 'CA-40.4 · genera una sola cuota: las otras siete fracciones reciben $0');
select is(
  (select (s.fraction_number, s.amount, s.payer::text, s.payer_id) from public.movement_shares s
     join public.movements m on m.id = s.movement_id where m.booking_id = (select libre from ctx40)),
  (3::smallint, 640000::bigint, 'owner'::text, 'c4000000-0000-4000-8000-000000000003'::uuid),
  'CA-40.4 · la fracción 3/8 recibe $640.000, a nombre de su Propietario');
select is(
  (select m.commission_amount from public.movements m where m.booking_id = (select libre from ctx40)),
  160000::bigint, 'CA-40.4 · Arena registra $160.000 de comisión');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select is(
  (select (l.amount, l.kind::text, l.source_type) from public.platform_ledger l
    where l.source_id = (select id from public.movements where booking_id = (select libre from ctx40))),
  (160000::bigint, 'income'::text, 'rental_commission'::text),
  'RF-40.4 · D-01 · la comisión entra al libro de plataforma, no a la propiedad');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
select is(
  (select (select sum(s.amount) from public.movement_shares s where s.movement_id = m.id) + m.commission_amount
     from public.movements m where m.booking_id = (select libre from ctx40)),
  800000::numeric, 'CA-40.4 · cuota + comisión suman exactamente el bruto');
select is(
  (select s.has_remainder from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select libre from ctx40)),
  false, 'RF-40.2 · la cuota atribuida no lleva residuo: no se dividió nada');

-- ── CA-40.2 · RF-40.3 · un solo ingreso vigente por reserva ─────────────────
select throws_ok(
  $$ select public.registrar_ingreso_de_renta((select libre from ctx40), 100000,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Segundo intento') $$,
  '23505', null, 'CA-40.2 · un segundo ingreso sobre la misma reserva se rechaza');

-- ── CA-40.6 · el truncamiento no pierde un peso ─────────────────────────────
-- Semana 25 de la 3/8, liberada, con la comisión al 17,5 % sobre $333.333.
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000003';
select public.release_week((select cal from ctx40), (select f3 from ctx40), 25);
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select public.fijar_comision_de_renta('a4000000-0000-4000-8000-000000000001', 1750);
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
create temporary table ctx40b as
  select (select id from public.rentar_semana((select cal from ctx40), 25, (select tercero from ctx40))) as reserva;
grant select on ctx40b to authenticated;
select lives_ok(
  $$ select public.registrar_ingreso_de_renta((select reserva from ctx40b), 333333,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Renta semana 25') $$,
  'CA-40.6 · entra un bruto que no divide exacto con la comisión');
select is(
  (select m.commission_amount from public.movements m where m.booking_id = (select reserva from ctx40b)),
  58333::bigint, 'CA-40.6 · TR-02 · la comisión se trunca al peso hacia abajo');
select is(
  (select s.amount from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select reserva from ctx40b)),
  275000::bigint, 'CA-40.6 · el peso suelto del truncamiento se queda en la fracción');
select is(
  (select (select sum(s.amount) from public.movement_shares s where s.movement_id = m.id) + m.commission_amount
     from public.movements m where m.booking_id = (select reserva from ctx40b)),
  333333::numeric, 'CA-40.6 · comisión + neto siguen sumando el bruto sin perder ni un peso');

-- ── CA-40.7 · anular revierte la cuota y la comisión ────────────────────────
select lives_ok(
  $$ select public.anular_movimiento(
       (select id from public.movements where booking_id = (select libre from ctx40)),
       'El tercero no se presentó.') $$,
  'CA-40.7 · el Administrador anula el ingreso atribuido con motivo');
select is(
  (select count(*) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select libre from ctx40) and s.reversed_at is not null),
  1::bigint, 'CA-40.7 · la cuota de la fracción queda revertida');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select is(
  (select (l.reversed_at is not null, l.reverse_reason) from public.platform_ledger l
    where l.source_id = (select id from public.movements where booking_id = (select libre from ctx40))),
  (true, 'El tercero no se presentó.'::text),
  'CA-40.7 · y la comisión de plataforma se revierte con el mismo motivo');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000001';
select is(
  (select reason from public.audit_log where action = 'movement.actualizada'
     and entity_id = (select id from public.movements where booking_id = (select libre from ctx40))),
  'El tercero no se presentó.', 'CA-40.7 · todo auditable');
select lives_ok(
  $$ select public.registrar_ingreso_de_renta((select libre from ctx40), 700000,
       (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Corrección') $$,
  'RF-40.3 · anulado el anterior, se registra el ingreso corregido');

-- ── RF-40.1 · lo que no procede ─────────────────────────────────────────────
select throws_like(
  $$ select public.registrar_ingreso_de_renta(
       (select b.id from public.third_party_bookings b join public.calendar_weeks w on w.id = b.week_id
         where b.property_id = 'a4000000-0000-4000-8000-000000000001' and w.index = 10),
       0, (select categoria from ctx40), (select medio from ctx40), (select cuenta from ctx40), current_date, 'Cero') $$,
  '%CA-23.3%', 'RF-40.1 · un ingreso de cero pesos se rechaza');
select throws_like(
  $$ insert into public.movements (property_id, kind, amount, category_id, payment_method_id, account_id, incurred_on, description, booking_id)
     values ('a4000000-0000-4000-8000-000000000001', 'expense', 1000,
             (select id from public.expense_categories where name = 'Mantenimiento'),
             (select medio from ctx40), (select cuenta from ctx40), current_date, 'Gasto con reserva', (select cancelada from ctx40)) $$,
  '%RF-40.1%', 'RF-40.1 · una reserva no origina un gasto, solo un ingreso');

-- ── D-01 · el libro de plataforma es del Superadmin ─────────────────────────
select is(
  (select count(*) from public.platform_ledger),
  0::bigint, 'D-01 · el Administrador no ve lo que gana Arena: no es dinero de la propiedad');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from public.platform_ledger where source_type = 'rental_commission'),
  3::bigint, 'D-01 · el Superadmin sí ve las tres comisiones de gestión devengadas');

-- ── CA-40.3 · el ingreso llega al estado de cuenta del Propietario y al de Arena ─
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.movement_shares s
     join public.movements m on m.id = s.movement_id
    where m.kind = 'income' and m.voided_at is null and s.reversed_at is null
      and m.incurred_on = current_date and s.fraction_number = 3),
  3::bigint, 'CA-40.3 · el Propietario ve en el periodo los ingresos de renta que le tocan');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-00000000000a';
select is(
  (select count(*) from public.platform_ledger
    where source_type = 'rental_commission' and reversed_at is null and accrued_on = current_date),
  2::bigint, 'CA-40.3 · D-09 · y Arena ve las comisiones vigentes devengadas en el mismo periodo');

-- ── CA-24.3 · RF-24.3 · el detalle solo sobre la fracción propia ────────────
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000003';
select is(
  (select count(*) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select libre from ctx40)),
  2::bigint, 'RF-24.3 · el Propietario de la 3/8 ve sus cuotas: la del ingreso anulado y la del corregido');
set local request.jwt.claim.sub = 'c4000000-0000-4000-8000-000000000005';
select is(
  (select count(*) from public.movement_shares s join public.movements m on m.id = s.movement_id
    where m.booking_id = (select libre from ctx40)),
  0::bigint, 'CA-24.3 · una cuota de otra fracción no se le entrega');
select is(
  (select count(distinct s.fraction_number) from public.movement_shares s
    where s.property_id = 'a4000000-0000-4000-8000-000000000001'),
  1::bigint, 'CA-24.3 · RF-24.3 · solo ve las cuotas de su propia fracción');
select is(
  (select min(s.fraction_number) from public.movement_shares s
    where s.property_id = 'a4000000-0000-4000-8000-000000000001'),
  5::smallint, 'CA-24.3 · que es la 5/8');
select is(
  (select count(*) from public.platform_ledger),
  0::bigint, 'D-01 · y el Propietario tampoco ve el libro de plataforma');

reset role;
select * from finish();
rollback;
