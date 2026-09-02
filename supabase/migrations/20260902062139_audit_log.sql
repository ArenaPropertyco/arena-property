-- TR-01 · RF-A.1 — registro único de auditoría.
--
-- La plataforma administra dinero y derechos de uso ajenos: toda operación sensible
-- debe poder reconstruirse después con autor, momento y motivo (principio 9).
--
-- Sobre el autor: se guarda el identificador de la cuenta sin clave foránea a
-- `auth.users` a propósito. Una clave con `on delete set null` modificaría una fila
-- ya escrita, y este registro es append-only (RF-A.2); una con `no action` impediría
-- borrar cuentas para siempre. El rol se guarda como texto porque interesa el que
-- tenía **en ese momento**, no el que tenga hoy.

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),

  -- Momento del hecho, con zona horaria explícita.
  occurred_at timestamptz not null default now(),

  -- Autor: cuenta y rol efectivo al momento de la operación.
  actor_id uuid,
  actor_role text not null,

  -- Qué pasó y sobre qué.
  action text not null,
  entity_type text not null,
  entity_id uuid,

  -- Propiedad relacionada, cuando la operación cuelga de una (RF-A.6 la usa para
  -- acotar la lectura del Administrador a sus propiedades asignadas).
  property_id uuid,

  -- Motivo. Obligatorio solo donde la spec de origen lo exige (RF-A.4).
  reason text,

  -- Estados antes y después, para el diff de RF-A.7.
  previous_state jsonb,
  next_state jsonb,

  constraint audit_log_action_no_vacia check (length(btrim(action)) > 0),
  constraint audit_log_entity_type_no_vacia check (length(btrim(entity_type)) > 0),
  constraint audit_log_actor_role_no_vacio check (length(btrim(actor_role)) > 0)
);

comment on table public.audit_log is
  'TR-01 · registro append-only de operaciones auditables. No se actualiza ni se borra.';

-- Lectura del Administrador acotada a sus propiedades (RF-A.6).
create index audit_log_property_idx on public.audit_log (property_id, occurred_at desc);

-- Reconstrucción del histórico de una entidad concreta (CA-A.1).
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, occurred_at desc);

-- Qué hizo una cuenta.
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);

-- Principio 5 · la tabla nace con RLS, y forzada también para su dueño: nadie queda
-- fuera de las políticas, ni siquiera quien creó la tabla.
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;
