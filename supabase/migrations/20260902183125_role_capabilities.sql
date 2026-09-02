-- HU-07 · RF-07.3 y RF-07.4 — ajustes de la matriz de permisos.
--
-- La matriz del VSM sigue viviendo en el código (`shared/permissions/mapa.ts`): es la
-- referencia del negocio y lo que prueba CA-07.1. Esta tabla guarda **solo las celdas
-- que el Superadmin decidió cambiar**. La matriz efectiva es base + ajustes, y retirar
-- un ajuste devuelve la celda a la referencia. Así la pantalla nunca reescribe el VSM.
--
-- Alcance real de estos ajustes: gobiernan la interfaz y la guarda de rutas. Las
-- políticas RLS materializan la misma matriz en la base (RF-07.2) y **no** cambian
-- desde aquí: ampliar una capacidad que la base hace cumplir no concede acceso a los
-- datos hasta que su política cambie en una migración. La pantalla lo advierte.

create table public.role_capabilities (
  -- Identificadores del vocabulario de `shared/permissions/mapa.ts`.
  capability text not null,
  -- Columna de la matriz: los cinco roles con cuenta y el Visitante sin sesión.
  role text not null,
  scope text not null,

  updated_by uuid,
  updated_at timestamptz not null default now(),

  primary key (capability, role),

  constraint role_capabilities_scope_valido check (
    scope in ('todas', 'propias', 'lectura', 'si', 'no', 'no_aplica')
  ),
  constraint role_capabilities_role_valido check (
    role in ('superadmin', 'property_admin', 'owner', 'ambassador', 'user', 'visitante')
  ),
  constraint role_capabilities_capability_no_vacia check (length(btrim(capability)) > 0)
);

comment on table public.role_capabilities is
  'HU-07 · RF-07.3 · ajustes del Superadmin sobre celdas de la matriz de permisos. Solo lo que difiere del VSM.';

alter table public.role_capabilities enable row level security;
alter table public.role_capabilities force row level security;

revoke all on table public.role_capabilities from anon, authenticated, service_role;
grant select, insert, update, delete on table public.role_capabilities to authenticated, service_role;

-- Toda cuenta lee: su interfaz tiene que reflejar la misma matriz que la guarda de rutas.
create policy role_capabilities_lectura
  on public.role_capabilities for select
  to authenticated
  using (true);

-- Solo el Superadmin ajusta (RF-07.3).
create policy role_capabilities_crear
  on public.role_capabilities for insert
  to authenticated
  with check (private.es_superadmin());

create policy role_capabilities_actualizar
  on public.role_capabilities for update
  to authenticated
  using (private.es_superadmin())
  with check (private.es_superadmin());

create policy role_capabilities_retirar
  on public.role_capabilities for delete
  to authenticated
  using (private.es_superadmin());

-- TR-01 · RF-A.3 · cada ajuste queda registrado con autor, celda y alcance.
create trigger role_capabilities_auditada
  after insert or update or delete on public.role_capabilities
  for each row execute function public.registrar_auditoria('role_capability');
