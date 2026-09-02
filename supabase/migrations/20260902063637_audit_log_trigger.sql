-- TR-01 · RF-A.4 y RF-A.5 — disparador genérico de auditoría.
--
-- Por qué un disparador y no una llamada desde la aplicación: RF-A.5 exige que la
-- entrada se escriba en la **misma transacción** que la operación auditada. Con un
-- disparador eso es una propiedad del motor, no una disciplina de quien programa:
-- si la auditoría falla, la operación se revierte sola, y ninguna ruta nueva puede
-- olvidarse de auditar.
--
-- Cómo se usa desde una tabla de negocio:
--   create trigger <tabla>_auditada
--     after insert or update or delete on public.<tabla>
--     for each row execute function public.registrar_auditoria('<tipo_entidad>');
--
-- El motivo y el rol efectivo viajan en ajustes locales de la transacción, que la
-- aplicación fija junto a la operación:
--   set local app.audit_reason = 'texto del motivo';
--   set local app.audit_actor_role = 'administrador';

-- ── Qué acciones no se registran sin motivo (RF-A.4) ────────────────────────
create table public.audit_reason_required (
  action text primary key,
  -- Spec que impone la exigencia, para poder rastrear de dónde sale la regla.
  source text not null,
  created_at timestamptz not null default now()
);

comment on table public.audit_reason_required is
  'TR-01 · RF-A.4 · acciones que la spec de origen no permite registrar sin motivo.';

alter table public.audit_reason_required enable row level security;
alter table public.audit_reason_required force row level security;

revoke all on table public.audit_reason_required from anon, authenticated, service_role;
grant select on table public.audit_reason_required to authenticated, service_role;

create policy audit_reason_required_lectura
  on public.audit_reason_required
  for select
  to authenticated, service_role
  using (true);

-- Las acciones que exigen motivo según TR-01 RF-A.4. Cada historia añade las suyas
-- en su propia migración cuando se implementa.
insert into public.audit_reason_required (action, source) values
  ('stay.bloqueada', 'HU-15'),
  ('stay.cancelada_por_administrador', 'HU-17'),
  ('profile.suspendida', 'HU-33'),
  ('profile.reactivada', 'HU-33'),
  ('withdrawal_request.rechazada', 'HU-56');

-- ── Disparador genérico ─────────────────────────────────────────────────────
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tipo_entidad text := tg_argv[0];
  operacion text;
  accion text;
  estado_anterior jsonb;
  estado_posterior jsonb;
  fila jsonb;
  motivo text;
  rol text;
  identificador uuid;
  propiedad uuid;
begin
  if tipo_entidad is null then
    raise exception 'registrar_auditoria() necesita el tipo de entidad como argumento del disparador.';
  end if;

  if tg_op = 'INSERT' then
    operacion := 'creada';
    estado_anterior := null;
    estado_posterior := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    operacion := 'actualizada';
    estado_anterior := to_jsonb(old);
    estado_posterior := to_jsonb(new);
  else
    operacion := 'eliminada';
    estado_anterior := to_jsonb(old);
    estado_posterior := null;
  end if;

  accion := tipo_entidad || '.' || operacion;
  fila := coalesce(estado_posterior, estado_anterior);

  -- RF-A.4 · sin motivo no hay registro, y sin registro no hay operación.
  motivo := nullif(btrim(coalesce(current_setting('app.audit_reason', true), '')), '');

  if motivo is null
     and exists (select 1 from public.audit_reason_required r where r.action = accion) then
    raise exception 'La operación % exige un motivo y no lo trae.', accion;
  end if;

  -- RF-A.1 · rol efectivo al momento. Mientras no exista `user_roles` (HU-07) se
  -- toma del ajuste que fija la aplicación; el rol de base de datos es el respaldo.
  rol := coalesce(
    nullif(btrim(coalesce(current_setting('app.audit_actor_role', true), '')), ''),
    current_user
  );

  identificador := nullif(fila->>'id', '')::uuid;
  propiedad := case
    when fila ? 'property_id' then nullif(fila->>'property_id', '')::uuid
    when tipo_entidad = 'property' then identificador
    else null
  end;

  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, property_id,
    reason, previous_state, next_state
  )
  values (
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    rol, accion, tipo_entidad, identificador, propiedad,
    motivo, estado_anterior, estado_posterior
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.registrar_auditoria() is
  'TR-01 · RF-A.5 · escribe la entrada de auditoría en la misma transacción que la operación.';

revoke execute on function public.registrar_auditoria() from public, anon, authenticated, service_role;
