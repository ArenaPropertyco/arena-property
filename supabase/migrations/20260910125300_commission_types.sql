-- HU-52 · RF-52.1…RF-52.5 · D-05 · D-37 — el catálogo de tipos de comisión del
-- programa de referidos y a qué Embajador se le aplica cada uno.
--
-- 1. **Un catálogo, no una línea de tiempo.** El Superadmin crea tipos con
--    nombre y valor y decide cuál lleva cada Embajador (RF-52.1, RF-52.4). Quien
--    no tenga asignación cobra el **predeterminado**, que es también el que
--    publica la página del programa (RF-52.3, HU-48).
--
-- 2. **El valor de un tipo no se edita.** Un disparador rechaza cambiar importe,
--    puntos básicos o clase (RF-52.2, CA-52.4): para pagar otra cantidad se crea
--    otro tipo, y así una comisión ya devengada no cambia de importe porque
--    alguien tocara la cifra después. El nombre y el estado sí se corrigen.
--
-- 3. **Desactivar no es retirar.** Un tipo inactivo deja de ofrecerse para
--    asignaciones nuevas, pero quien ya lo tenía sigue cobrándolo (RF-52.2).
--
-- 4. **El porcentaje nunca es coma flotante.** Viaja en puntos básicos enteros
--    (TR-02 RF-D.4) y se aplica sobre el precio pactado del plan de pagos, no
--    sobre el precio de lista (D-05); el cálculo de liberación vive en HU-54.
--
-- Las mismas reglas están en `shared/referrals/commission.ts`.

create type public.commission_kind as enum ('fixed', 'percentage');

create table public.commission_types (
  id uuid primary key default gen_random_uuid(),
  -- RF-52.1 · el nombre con el que el Superadmin lo reconoce en la lista.
  name text not null,
  kind public.commission_kind not null,
  -- RF-52.1 · importe fijo en pesos enteros (TR-02); solo en tipos `fixed`.
  amount bigint,
  -- RF-D.4 · puntos básicos entre 1 y 10 000; solo en tipos porcentuales.
  basis_points integer,
  -- RF-52.3 · el que rige para quien no tenga asignación propia.
  is_default boolean not null default false,
  -- RF-52.2 · un tipo inactivo no se ofrece para asignaciones nuevas.
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CA-52.3 · el nombre no puede ser un vacío ni una parrafada.
  constraint commission_types_nombre check (
    btrim(name) <> '' and length(btrim(name)) <= 60
  ),
  -- CA-52.3 · el valor tiene que corresponder a la clase y estar en rango.
  constraint commission_types_valor_por_clase check (
    (kind = 'fixed' and amount is not null and amount > 0 and basis_points is null)
    or (kind = 'percentage' and basis_points is not null and basis_points between 1 and 10000 and amount is null)
  )
);

comment on table public.commission_types is
  'HU-52 · RF-52.1 · D-37 · catálogo de tipos de comisión: importe fijo en pesos o porcentaje en puntos básicos.';
comment on column public.commission_types.basis_points is
  'TR-02 · RF-D.4 · porcentaje en puntos básicos enteros: 1000 = 10 %.';
comment on column public.commission_types.is_default is
  'RF-52.3 · rige para el Embajador sin asignación propia y alimenta la página pública (HU-48).';

-- CA-52.3 · dos tipos no comparten nombre, sin distinguir caja ni espacios.
create unique index commission_types_nombre_unico
  on public.commission_types (lower(btrim(name)));

-- CA-52.5 · el predeterminado es uno solo.
create unique index commission_types_predeterminado_unico
  on public.commission_types (is_default) where is_default;

create index commission_types_activos_idx on public.commission_types (name) where active;

-- ── RF-52.4 · qué tipo lleva cada Embajador ─────────────────────────────────
-- Sin fila, lleva el predeterminado: la ausencia es un estado válido y explícito,
-- no un hueco que haya que rellenar al aprobar la inscripción.
create table public.ambassador_commissions (
  ambassador_id uuid primary key references public.ambassadors (id) on delete cascade,
  commission_type_id uuid not null references public.commission_types (id),
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now()
);

comment on table public.ambassador_commissions is
  'HU-52 · RF-52.4 · D-37 · el tipo de comisión que el Superadmin le asignó a un Embajador; sin fila rige el predeterminado.';

create index ambassador_commissions_tipo_idx on public.ambassador_commissions (commission_type_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- El catálogo es del Superadmin; el Embajador ve el tipo que le tocó, no los
-- montos que cobran los demás. El predeterminado sale de una función aparte, que
-- no expone el resto del catálogo.
alter table public.commission_types enable row level security;
alter table public.commission_types force row level security;
alter table public.ambassador_commissions enable row level security;
alter table public.ambassador_commissions force row level security;

revoke all on table public.commission_types from anon, authenticated, service_role;
revoke all on table public.ambassador_commissions from anon, authenticated, service_role;
grant select on table public.commission_types to authenticated, service_role;
grant select on table public.ambassador_commissions to authenticated, service_role;

create policy commission_types_lectura on public.commission_types for select to authenticated
  using (private.es_superadmin());

create policy ambassador_commissions_lectura on public.ambassador_commissions for select to authenticated
  using (
    private.es_superadmin()
    or exists (
      select 1 from public.ambassadors a
       where a.id = ambassador_commissions.ambassador_id
         and a.user_id = (select auth.uid())
    )
  );

-- ── RF-52.2 · CA-52.4 · el valor de un tipo no se edita ─────────────────────
create or replace function private.commission_types_valor_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'RF-52.2 · un tipo de comisión no se borra: desactívalo para dejar de ofrecerlo.';
  end if;

  if new.kind is distinct from old.kind
     or new.amount is distinct from old.amount
     or new.basis_points is distinct from old.basis_points then
    raise exception 'RF-52.2 · CA-52.4 · el valor de un tipo de comisión no se edita: crea otro tipo con el valor nuevo.';
  end if;

  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger commission_types_valor_fijo
  before update on public.commission_types
  for each row execute function private.commission_types_valor_inmutable();

create trigger commission_types_sin_borrado
  before delete on public.commission_types
  for each row execute function private.commission_types_valor_inmutable();

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger commission_types_auditados
  after insert or update on public.commission_types
  for each row execute function public.registrar_auditoria('commission_type');

create trigger ambassador_commissions_auditadas
  after insert or update or delete on public.ambassador_commissions
  for each row execute function public.registrar_auditoria('ambassador_commission');

-- ── RF-52.1 · CA-52.6 · crear un tipo ───────────────────────────────────────
create or replace function public.create_commission_type(
  name text,
  kind public.commission_kind,
  amount bigint default null,
  basis_points integer default null,
  make_default boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo uuid;
begin
  if not private.es_superadmin() then
    raise exception 'CA-52.6 · RF-52.1 · solo el Superadmin administra los tipos de comisión.';
  end if;

  perform set_config('app.audit_reason', 'Tipo de comisión creado por el Superadmin', true);
  insert into public.commission_types (name, kind, amount, basis_points, created_by)
  values (btrim(name), kind, amount, basis_points, (select auth.uid()))
  returning id into nuevo;
  perform set_config('app.audit_reason', '', true);

  -- RF-52.3 · el primero que entra manda mientras no haya otro predeterminado.
  if make_default or not exists (select 1 from public.commission_types t where t.is_default) then
    perform public.set_default_commission_type(nuevo);
  end if;

  return nuevo;
end;
$$;

comment on function public.create_commission_type(text, public.commission_kind, bigint, integer, boolean) is
  'HU-52 · RF-52.1, RF-52.3 · el Superadmin crea un tipo de comisión; el primero queda como predeterminado.';

-- ── CA-52.5 · RF-52.3 · mover la marca de predeterminado ────────────────────
create or replace function public.set_default_commission_type(commission_type uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-52.6 · RF-52.3 · solo el Superadmin decide el tipo predeterminado.';
  end if;
  if not exists (select 1 from public.commission_types t where t.id = commission_type and t.active) then
    raise exception 'RF-52.3 · el tipo predeterminado tiene que existir y estar activo.';
  end if;

  perform set_config('app.audit_reason', 'Tipo de comisión predeterminado', true);
  -- En dos pasos y en este orden: el índice único parcial no admite que dos filas
  -- lleven la marca ni por un instante dentro de la misma orden.
  update public.commission_types set is_default = false
   where is_default and id <> commission_type;
  update public.commission_types set is_default = true
   where id = commission_type and not is_default;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.set_default_commission_type(uuid) is
  'HU-52 · RF-52.3 · CA-52.5 · marca el tipo predeterminado y retira la marca al anterior.';

-- ── RF-52.2 · renombrar y activar o desactivar ──────────────────────────────
create or replace function public.rename_commission_type(commission_type uuid, name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-52.6 · RF-52.2 · solo el Superadmin administra los tipos de comisión.';
  end if;

  perform set_config('app.audit_reason', 'Tipo de comisión renombrado', true);
  update public.commission_types t set name = btrim(rename_commission_type.name)
   where t.id = commission_type;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.rename_commission_type(uuid, text) is
  'HU-52 · RF-52.2 · corrige el nombre de un tipo; su valor sigue siendo inmutable.';

create or replace function public.set_commission_type_active(commission_type uuid, active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-52.6 · RF-52.2 · solo el Superadmin administra los tipos de comisión.';
  end if;
  -- RF-52.3 · el predeterminado no se desactiva: dejaría sin comisión a todo
  -- Embajador sin asignación propia. Primero se nombra otro predeterminado.
  if not active and exists (
    select 1 from public.commission_types t where t.id = commission_type and t.is_default
  ) then
    raise exception 'RF-52.3 · el tipo predeterminado no se desactiva: nombra otro predeterminado primero.';
  end if;

  perform set_config('app.audit_reason', 'Tipo de comisión activado o desactivado', true);
  update public.commission_types t set active = set_commission_type_active.active
   where t.id = commission_type;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.set_commission_type_active(uuid, boolean) is
  'HU-52 · RF-52.2 · deja de ofrecer un tipo sin retirárselo a quien ya lo tenía.';

-- ── RF-52.4 · CA-52.6 · asignarle un tipo a un Embajador ────────────────────
create or replace function public.assign_commission_type(
  ambassador uuid,
  commission_type uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-52.6 · RF-52.4 · solo el Superadmin asigna el tipo de comisión de un Embajador.';
  end if;
  if not exists (select 1 from public.ambassadors a where a.id = ambassador) then
    raise exception 'RF-52.4 · no existe ese Embajador.';
  end if;

  perform set_config('app.audit_reason', 'Tipo de comisión del Embajador', true);

  -- `null` retira la asignación y devuelve al Embajador al predeterminado.
  if commission_type is null then
    delete from public.ambassador_commissions c where c.ambassador_id = ambassador;
    perform set_config('app.audit_reason', '', true);
    return;
  end if;

  if not exists (
    select 1 from public.commission_types t where t.id = commission_type and t.active
  ) then
    raise exception 'RF-52.2 · solo se asigna un tipo de comisión activo.';
  end if;

  insert into public.ambassador_commissions (ambassador_id, commission_type_id, assigned_by)
  values (ambassador, commission_type, (select auth.uid()))
  on conflict (ambassador_id) do update
    set commission_type_id = excluded.commission_type_id,
        assigned_by = excluded.assigned_by,
        assigned_at = now();

  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.assign_commission_type(uuid, uuid) is
  'HU-52 · RF-52.4 · CA-52.1 · le asigna un tipo de comisión a un Embajador; `null` lo devuelve al predeterminado.';

-- ── RF-52.5 · CA-52.1 · el tipo aplicable a un Embajador ────────────────────
create or replace function public.commission_type_for(ambassador uuid)
returns table (id uuid, name text, kind public.commission_kind, amount bigint, basis_points integer, is_default boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.kind, t.amount, t.basis_points, t.is_default
    from public.commission_types t
   where t.id = (
     select c.commission_type_id from public.ambassador_commissions c
      where c.ambassador_id = ambassador
   )
  union all
  select t.id, t.name, t.kind, t.amount, t.basis_points, t.is_default
    from public.commission_types t
   where t.is_default
     and not exists (
       select 1 from public.ambassador_commissions c
        where c.ambassador_id = ambassador
          and exists (select 1 from public.commission_types x where x.id = c.commission_type_id)
     )
  limit 1;
$$;

comment on function public.commission_type_for(uuid) is
  'HU-52 · RF-52.5 · CA-52.1 · el tipo que le toca a un Embajador: el suyo, y si no tiene, el predeterminado.';

-- RF-52.3 · el predeterminado alimenta la página pública del programa (HU-48).
create or replace function public.default_commission_type()
returns table (id uuid, name text, kind public.commission_kind, amount bigint, basis_points integer, is_default boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.kind, t.amount, t.basis_points, t.is_default
    from public.commission_types t
   where t.is_default;
$$;

comment on function public.default_commission_type() is
  'HU-52 · RF-52.3 · el tipo de comisión predeterminado; lo lee cualquiera, incluida la página pública (HU-48).';

-- ── Permisos de ejecución ───────────────────────────────────────────────────
revoke execute on function
  public.create_commission_type(text, public.commission_kind, bigint, integer, boolean),
  public.set_default_commission_type(uuid),
  public.rename_commission_type(uuid, text),
  public.set_commission_type_active(uuid, boolean),
  public.assign_commission_type(uuid, uuid)
  from public, anon;

grant execute on function
  public.create_commission_type(text, public.commission_kind, bigint, integer, boolean),
  public.set_default_commission_type(uuid),
  public.rename_commission_type(uuid, text),
  public.set_commission_type_active(uuid, boolean),
  public.assign_commission_type(uuid, uuid)
  to authenticated, service_role;

grant execute on function public.commission_type_for(uuid), public.default_commission_type()
  to anon, authenticated, service_role;
