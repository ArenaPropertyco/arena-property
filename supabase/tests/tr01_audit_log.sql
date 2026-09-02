-- TR-01 · RF-A.1 — la tabla única de auditoría existe con todos sus campos y con RLS.
-- Nivel N2 del plan §5: se prueba contra el motor, no contra la aplicación.
begin;
select plan(20);

-- La tabla vive en `public` y es la única de auditoría.
select has_table('public', 'audit_log', 'existe la tabla de auditoría');

-- RF-A.1 · campos obligatorios de la entrada.
select has_column('public', 'audit_log', 'id', 'identificador');
select has_column('public', 'audit_log', 'occurred_at', 'marca de tiempo');
select has_column('public', 'audit_log', 'actor_id', 'autor: cuenta');
select has_column('public', 'audit_log', 'actor_role', 'autor: rol efectivo al momento');
select has_column('public', 'audit_log', 'action', 'acción');
select has_column('public', 'audit_log', 'entity_type', 'entidad afectada: tipo');
select has_column('public', 'audit_log', 'entity_id', 'entidad afectada: identificador');
select has_column('public', 'audit_log', 'property_id', 'propiedad relacionada');
select has_column('public', 'audit_log', 'reason', 'motivo');
select has_column('public', 'audit_log', 'previous_state', 'estado anterior');
select has_column('public', 'audit_log', 'next_state', 'estado posterior');

-- La marca de tiempo lleva zona horaria: el registro se reconstruye en UTC.
select col_type_is('public', 'audit_log', 'occurred_at', 'timestamp with time zone',
  'la marca de tiempo es timestamptz');

-- Los estados se guardan como JSON para poder diferenciarlos después.
select col_type_is('public', 'audit_log', 'previous_state', 'jsonb', 'estado anterior en jsonb');
select col_type_is('public', 'audit_log', 'next_state', 'jsonb', 'estado posterior en jsonb');

-- Lo que nunca puede faltar en una entrada.
select col_not_null('public', 'audit_log', 'occurred_at', 'la marca de tiempo es obligatoria');
select col_not_null('public', 'audit_log', 'action', 'la acción es obligatoria');
select col_not_null('public', 'audit_log', 'entity_type', 'el tipo de entidad es obligatorio');

-- Principio 5 · toda tabla nace con RLS habilitada, y también para su dueño.
select is(
  (select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  true, 'RLS habilitada');
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.audit_log'::regclass),
  true, 'RLS forzada también para el dueño de la tabla');

select * from finish();
rollback;
