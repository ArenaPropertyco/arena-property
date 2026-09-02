-- HU-05 · RF-05.1, RF-05.2, RF-05.3 — asignación administrador ↔ propiedad.
--
-- La relación es explícita y con histórico: retirar una asignación la marca como
-- retirada, nunca la borra (RF-05.2). Volver a asignar crea una fila nueva, así que
-- el registro cuenta la historia completa. Solo el Superadmin asigna y retira
-- (RF-05.1); el Administrador lee lo suyo y nada más (RF-05.3).
--
-- `property_id` no lleva clave foránea todavía: `properties` nace con HU-08 (T-036),
-- que añade la referencia en su propia migración.

create table public.property_admins (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users (id) on delete cascade,
  property_id uuid not null,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  constraint property_admins_retiro_coherente check (revoked_at is not null or revoked_by is null)
);

comment on table public.property_admins is
  'HU-05 · qué administrador opera qué propiedad. Retirar marca revoked_at; no se borra.';

-- Una sola asignación vigente por par administrador-propiedad; las retiradas no cuentan.
create unique index property_admins_vigente_unica
  on public.property_admins (admin_id, property_id)
  where revoked_at is null;

create index property_admins_admin_idx on public.property_admins (admin_id) where revoked_at is null;
create index property_admins_property_idx on public.property_admins (property_id) where revoked_at is null;

alter table public.property_admins enable row level security;
alter table public.property_admins force row level security;

-- Sin DELETE para nadie desde la API: el histórico se conserva por construcción.
revoke all on table public.property_admins from anon, authenticated, service_role;
grant select, insert, update on table public.property_admins to authenticated, service_role;

-- ── Políticas ───────────────────────────────────────────────────────────────
create policy property_admins_lectura
  on public.property_admins for select to authenticated
  using (admin_id = (select auth.uid()) or private.es_superadmin());

create policy property_admins_asignar
  on public.property_admins for insert to authenticated
  with check (private.es_superadmin());

create policy property_admins_retirar
  on public.property_admins for update to authenticated
  using (private.es_superadmin())
  with check (private.es_superadmin());

-- ── Solo una cuenta con rol Administrador recibe propiedades ────────────────
create or replace function private.validar_asignacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.user_roles
      where user_id = new.admin_id and role = 'property_admin'
    ) then
      raise exception 'Solo una cuenta con rol Administrador puede recibir propiedades.';
    end if;
    return new;
  end if;

  -- Una asignación solo cambia para retirarse. Ni se reasigna ni se "des-retira":
  -- para volver a otorgarla se crea una fila nueva y el histórico queda entero.
  if new.admin_id <> old.admin_id
     or new.property_id <> old.property_id
     or new.assigned_by is distinct from old.assigned_by
     or new.assigned_at <> old.assigned_at
     or (old.revoked_at is not null and new.revoked_at is null) then
    raise exception 'Una asignación solo puede retirarse; para volver a otorgarla se crea otra.';
  end if;

  return new;
end;
$$;

create trigger property_admins_validar
  before insert or update on public.property_admins
  for each row execute function private.validar_asignacion();

-- ── Qué propiedades administra quien consulta (reemplaza el cuerpo provisional) ─
create or replace function private.propiedades_administradas()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(property_id), '{}'::uuid[])
  from public.property_admins
  where admin_id = (select auth.uid())
    and revoked_at is null;
$$;

comment on function private.propiedades_administradas() is
  'HU-05 · propiedades con asignación vigente para la cuenta que consulta.';

-- Predicado que usarán las políticas de `properties` y de todo lo que cuelga de una
-- propiedad: calendario, inventario, gastos, novedades (RF-05.3).
create or replace function private.administra_propiedad(propiedad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select propiedad = any (private.propiedades_administradas());
$$;

revoke execute on function private.administra_propiedad(uuid) from public, anon;
grant execute on function private.administra_propiedad(uuid) to authenticated, service_role;

-- ── TR-01 · RF-A.3 · asignaciones y retiros quedan auditados con su propiedad ─
create trigger property_admins_auditada
  after insert or update or delete on public.property_admins
  for each row execute function public.registrar_auditoria('property_admin');
