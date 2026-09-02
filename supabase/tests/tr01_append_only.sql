-- TR-01 · RF-A.2 y CA-A.2 — el registro es append-only para todo rol.
-- Ni RLS ni los permisos de tabla permiten UPDATE o DELETE, y un disparador cierra
-- el paso a cualquier ruta que llegara por debajo de ambos.
begin;
select plan(13);

-- Una entrada de partida, escrita como el sistema.
insert into public.audit_log (actor_role, action, entity_type, entity_id)
values ('superadmin', 'prueba.append_only', 'prueba', gen_random_uuid());

-- Ningún rol de la API tiene concedido UPDATE ni DELETE sobre la tabla.
select ok(
  not has_table_privilege('anon', 'public.audit_log', 'UPDATE'),
  'anon no puede actualizar');
select ok(
  not has_table_privilege('anon', 'public.audit_log', 'DELETE'),
  'anon no puede borrar');
select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'UPDATE'),
  'authenticated no puede actualizar');
select ok(
  not has_table_privilege('authenticated', 'public.audit_log', 'DELETE'),
  'authenticated no puede borrar');
select ok(
  not has_table_privilege('service_role', 'public.audit_log', 'UPDATE'),
  'service_role no puede actualizar: tampoco la llave de servicio reescribe el registro');
select ok(
  not has_table_privilege('service_role', 'public.audit_log', 'DELETE'),
  'service_role no puede borrar');

-- Tampoco existen políticas RLS que habiliten esas operaciones.
select is_empty(
  $$ select policyname from pg_policies
     where schemaname = 'public' and tablename = 'audit_log' and cmd in ('UPDATE', 'DELETE') $$,
  'no existe ninguna política de UPDATE ni de DELETE');

-- Y el disparador rechaza el intento aunque alguien llegue con permisos de dueño.
select throws_ok(
  $$ update public.audit_log set reason = 'reescrito' $$,
  'P0001',
  'El registro de auditoría es append-only: no admite UPDATE.',
  'el disparador rechaza el UPDATE');

select throws_ok(
  $$ delete from public.audit_log $$,
  'P0001',
  'El registro de auditoría es append-only: no admite DELETE.',
  'el disparador rechaza el DELETE');

select throws_ok(
  $$ truncate public.audit_log $$,
  'P0001',
  'El registro de auditoría es append-only: no admite TRUNCATE.',
  'el disparador rechaza el TRUNCATE');

-- La entrada sigue intacta tras todos los intentos.
select is(
  (select count(*) from public.audit_log where action = 'prueba.append_only'),
  1::bigint,
  'la entrada sobrevive a los intentos de borrado');

-- Insertar sí está permitido: append-only es «solo añadir», no «solo lectura».
select lives_ok(
  $$ insert into public.audit_log (actor_role, action, entity_type, entity_id)
     values ('administrador', 'prueba.insercion', 'prueba', gen_random_uuid()) $$,
  'insertar una entrada nueva sí está permitido');

select is(
  (select count(*) from public.audit_log
    where action in ('prueba.append_only', 'prueba.insercion')),
  2::bigint,
  'quedan las dos entradas insertadas');

select * from finish();
rollback;
