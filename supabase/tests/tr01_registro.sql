-- TR-01 · RF-A.4 y RF-A.5 — el registro se escribe dentro de la misma transacción
-- que la operación auditada, y no se crea sin motivo donde la spec lo exige.
--
-- La prueba crea una tabla de negocio de mentira dentro de la transacción y le
-- engancha el disparador genérico, que es como lo usarán las tablas reales.
begin;
select plan(12);

create table public.prueba_entidad (
  id uuid primary key default gen_random_uuid(),
  estado text not null,
  property_id uuid
);

create trigger prueba_entidad_auditada
  after insert or update or delete on public.prueba_entidad
  for each row execute function public.registrar_auditoria('prueba_entidad');

-- ── RF-A.5 · la entrada nace junto con la operación ──────────────────────────
set local app.audit_actor_role = 'administrador';

insert into public.prueba_entidad (estado, property_id)
values ('borrador', '11111111-1111-4111-8111-111111111111');

select is(
  (select count(*) from public.audit_log where entity_type = 'prueba_entidad'),
  1::bigint,
  'CA-A.1 · una operación produce exactamente una entrada de auditoría');

select is(
  (select action from public.audit_log where entity_type = 'prueba_entidad'),
  'prueba_entidad.creada',
  'la acción registrada corresponde a la operación');

select is(
  (select actor_role from public.audit_log where entity_type = 'prueba_entidad'),
  'administrador',
  'RF-A.1 · queda el rol efectivo al momento de la operación');

select is(
  (select property_id from public.audit_log where entity_type = 'prueba_entidad'),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'RF-A.6 · la propiedad relacionada queda registrada para acotar la lectura');

select is(
  (select previous_state from public.audit_log where entity_type = 'prueba_entidad'),
  null,
  'un alta no tiene estado anterior');

select is(
  (select next_state->>'estado' from public.audit_log where entity_type = 'prueba_entidad'),
  'borrador',
  'el estado posterior queda guardado');

-- ── Una actualización deja su propia entrada, con los dos estados ────────────
update public.prueba_entidad set estado = 'publicada';

select is(
  (select previous_state->>'estado' from public.audit_log
   where action = 'prueba_entidad.actualizada'),
  'borrador',
  'la actualización guarda el estado anterior');

-- ── RF-A.4 · CA-A.3 · una acción que exige motivo no se registra sin él ──────
insert into public.audit_reason_required (action, source)
values ('prueba_entidad.eliminada', 'prueba');

select throws_ok(
  $$ delete from public.prueba_entidad $$,
  'P0001',
  'La operación prueba_entidad.eliminada exige un motivo y no lo trae.',
  'CA-A.3 · la operación sin motivo se rechaza');

-- ── RF-A.5 · CA-A.4 · si la auditoría falla, la operación se revierte ────────
select is(
  (select count(*) from public.prueba_entidad),
  1::bigint,
  'CA-A.4 · la fila de negocio sigue ahí: la operación quedó revertida');

select is(
  (select count(*) from public.audit_log where action = 'prueba_entidad.eliminada'),
  0::bigint,
  'CA-A.3 · tampoco quedó registro de auditoría');

-- ── Con motivo, la misma operación pasa y el motivo queda guardado ───────────
set local app.audit_reason = 'cierre de temporada';

select lives_ok(
  $$ delete from public.prueba_entidad $$,
  'la misma operación con motivo sí se completa');

select is(
  (select reason from public.audit_log where action = 'prueba_entidad.eliminada'),
  'cierre de temporada',
  'RF-A.4 · el motivo queda guardado en la entrada');

select * from finish();
rollback;
