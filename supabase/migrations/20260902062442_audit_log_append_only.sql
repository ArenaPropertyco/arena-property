-- TR-01 · RF-A.2 — el registro de auditoría es append-only.
--
-- Tres cierres, porque una sola capa no basta cuando lo que se protege es la prueba
-- de lo que pasó con dinero ajeno:
--   1. Permisos de tabla: ningún rol de la API recibe UPDATE ni DELETE. Esto incluye
--      a `service_role`, que salta la RLS pero no los permisos.
--   2. RLS: solo se declara política de INSERT; sin política, no hay operación.
--   3. Un disparador que rechaza UPDATE, DELETE y TRUNCATE incluso para el dueño.

-- 1 · Permisos: solo insertar y leer. `anon` no toca el registro en absoluto.
revoke all on table public.audit_log from anon, authenticated, service_role;
grant select, insert on table public.audit_log to authenticated, service_role;

-- 2 · No se declara ninguna política de UPDATE ni de DELETE: RLS las deniega por
--     ausencia. La de lectura llega en su propia migración (RF-A.6).
create policy audit_log_insert_sistema
  on public.audit_log
  for insert
  to authenticated, service_role
  with check (true);

-- 3 · Última barrera, activa incluso para el dueño de la tabla.
create or replace function public.audit_log_solo_append()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'El registro de auditoría es append-only: no admite UPDATE.';
  elsif tg_op = 'DELETE' then
    raise exception 'El registro de auditoría es append-only: no admite DELETE.';
  else
    raise exception 'El registro de auditoría es append-only: no admite TRUNCATE.';
  end if;
end;
$$;

comment on function public.audit_log_solo_append() is
  'TR-01 · RF-A.2 · rechaza toda modificación o borrado del registro de auditoría.';

revoke execute on function public.audit_log_solo_append() from public, anon, authenticated, service_role;

create trigger audit_log_sin_update
  before update on public.audit_log
  for each row execute function public.audit_log_solo_append();

create trigger audit_log_sin_delete
  before delete on public.audit_log
  for each row execute function public.audit_log_solo_append();

create trigger audit_log_sin_truncate
  before truncate on public.audit_log
  for each statement execute function public.audit_log_solo_append();
