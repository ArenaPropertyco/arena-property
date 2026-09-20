-- HU-26 · RF-26.1…RF-26.4 · HU-27 · RF-27.1…RF-27.3 · HU-28 · RF-28.1, RF-28.2 —
-- el inventario de cada propiedad y sus gastos de mantenimiento.
--
-- Cinco decisiones que conviene leer antes que el código:
--
-- 1. **Un ítem no se borra: se da de baja (RF-26.2).** Como los movimientos de
--    HU-23 y las propiedades de HU-11. Nadie tiene `delete` y un disparador lo
--    rechaza por si alguien lo consiguiera; la baja lleva fecha y motivo, y a
--    partir de ahí el ítem queda congelado como histórico.
--
-- 2. **El estado y la cantidad dejan rastro (RF-26.4).** `inventory_history` guarda
--    cada cambio con su antes y su después; lo escribe solo un disparador. El
--    nombre, la ubicación y las notas se corrigen sin rastro: describen la ficha,
--    no el activo.
--
-- 3. **Escriben el Superadmin y el Administrador asignado (RF-26.3, D-45).** La
--    matriz de HU-07 deja al Propietario en lectura, y la RLS lo repite tal cual:
--    `puede_gestionar_propiedad` para escribir —la misma frontera que `movements`
--    y que el bucket de facturas—, y para leer eso o ser copropietario. El
--    Propietario no ve los ítems dados de baja (CA-28.3).
--
-- 4. **El gasto de mantenimiento es un gasto de HU-23 (RF-27.2).** Ni tabla nueva
--    ni segundo reparto: `movements` gana una marca de mantenimiento, el ítem al
--    que se asocia y su factura. Las 8 cuotas, la anulación y el estado de cuenta
--    son los de siempre. Un ítem ya dado de baja admite un mantenimiento tardío:
--    el gasto ocurrió igual.
--
-- 5. **La factura vive en un bucket privado propio (CA-27.3).** La propiedad es la
--    primera carpeta de la ruta y de ahí deciden las políticas: la leen quien
--    gestiona la propiedad y sus copropietarios; la sube quien gestiona.
--
-- Las mismas reglas están en `shared/properties/inventario.ts` y
-- `shared/finance/mantenimiento.ts`.

-- ── RF-26.1 · el ítem ───────────────────────────────────────────────────────
create type public.inventory_category as enum ('furniture', 'appliances', 'equipment', 'linens', 'supplies', 'other');
create type public.inventory_condition as enum ('new', 'good', 'fair', 'damaged');

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  name text not null,
  category public.inventory_category not null,
  condition public.inventory_condition not null default 'good',
  -- RF-26.1 · entero ≥ 0; cero es un ítem agotado, no inexistente.
  quantity integer not null default 1,
  location text,
  notes text,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- RF-26.2 · baja lógica con motivo; nunca borrado.
  retired_at timestamptz,
  retired_by uuid references auth.users (id),
  retire_reason text,

  constraint inventory_items_nombre check (btrim(name) <> '' and length(name) <= 120),
  -- CA-26.1 · la cantidad no es negativa.
  constraint inventory_items_cantidad check (quantity >= 0),
  constraint inventory_items_ubicacion check (location is null or length(location) <= 120),
  constraint inventory_items_notas check (notes is null or length(notes) <= 1000),
  constraint inventory_items_baja_con_motivo check (
    (retired_at is null and retired_by is null and retire_reason is null)
    or (retired_at is not null and btrim(coalesce(retire_reason, '')) <> '')
  )
);

comment on table public.inventory_items is
  'HU-26 · RF-26.1, RF-26.2 · mobiliario, equipamiento e insumos de una propiedad; se da de baja con motivo, no se borra.';
comment on column public.inventory_items.retired_at is
  'RF-26.2 · baja lógica: el ítem deja de listarse como activo y su histórico se conserva.';

create index inventory_items_propiedad_idx on public.inventory_items (property_id, retired_at, name);

-- ── RF-26.4 · el histórico de estado y cantidad ─────────────────────────────
create table public.inventory_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  field text not null,
  previous text not null,
  next text not null,
  changed_by uuid default auth.uid() references auth.users (id),
  changed_at timestamptz not null default now(),
  note text,

  constraint inventory_history_campo check (field in ('condition', 'quantity', 'retired'))
);

comment on table public.inventory_history is
  'HU-26 · RF-26.4 · cada cambio de estado, de cantidad o la baja de un ítem, con su antes y su después; lo escribe solo la base.';

create index inventory_history_item_idx on public.inventory_history (item_id, changed_at desc);

-- ── RLS · RF-26.3 · RF-28.2 ─────────────────────────────────────────────────
alter table public.inventory_items enable row level security;
alter table public.inventory_items force row level security;
alter table public.inventory_history enable row level security;
alter table public.inventory_history force row level security;

revoke all on table public.inventory_items, public.inventory_history from anon, authenticated, service_role;
-- RF-26.2 · sin DELETE para nadie: un ítem se da de baja.
grant select, insert, update on table public.inventory_items to authenticated, service_role;
-- RF-26.4 · el histórico lo escribe solo el disparador.
grant select on table public.inventory_history to authenticated, service_role;

-- RF-26.3 · D-45 · quien gestiona la propiedad ve todo; el copropietario, solo lo activo (CA-28.3).
create policy inventory_items_lectura on public.inventory_items for select to authenticated
  using (
    private.puede_gestionar_propiedad(property_id)
    or (private.es_copropietario(property_id) and retired_at is null)
  );

create policy inventory_items_creacion on public.inventory_items for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy inventory_items_edicion on public.inventory_items for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

create policy inventory_history_lectura on public.inventory_history for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

-- ── RF-26.1 · RF-26.2 · las reglas del ítem, en la base ─────────────────────
create or replace function private.validar_item_de_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'RF-26.2 · un ítem de inventario no se borra: se da de baja con motivo.';
  end if;

  new.name := btrim(new.name);
  new.location := nullif(btrim(coalesce(new.location, '')), '');
  new.notes := nullif(btrim(coalesce(new.notes, '')), '');

  if tg_op = 'INSERT' then
    -- Nace activo, aunque la fila trajera otra cosa.
    new.retired_at := null;
    new.retired_by := null;
    new.retire_reason := null;
    return new;
  end if;

  new.updated_at := now();

  if new.property_id <> old.property_id then
    raise exception 'RF-26.1 · un ítem no cambia de propiedad.';
  end if;
  -- RF-26.2 · dado de baja, el ítem queda congelado como histórico.
  if old.retired_at is not null then
    raise exception 'RF-26.2 · un ítem dado de baja no se modifica.';
  end if;
  if new.retired_at is not null then
    if btrim(coalesce(new.retire_reason, '')) = '' then
      raise exception 'RF-26.2 · RF-A.4 · la baja de un ítem exige un motivo.';
    end if;
    new.retired_by := coalesce(new.retired_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

create trigger inventory_items_validados
  before insert or update on public.inventory_items
  for each row execute function private.validar_item_de_inventario();

create trigger inventory_items_sin_borrado
  before delete on public.inventory_items
  for each row execute function private.validar_item_de_inventario();

-- ── RF-26.4 · CA-26.2 · el histórico lo escribe la base ─────────────────────
-- La misma regla que `cambiosDeItem` en `shared/properties/inventario.ts`: el
-- estado, la cantidad y la baja; nada más. La nota es el motivo de auditoría que
-- la operación haya fijado, si lo hay.
create or replace function private.historizar_item_de_inventario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nota text := nullif(btrim(coalesce(current_setting('app.audit_reason', true), '')), '');
begin
  if new.condition <> old.condition then
    insert into public.inventory_history (item_id, property_id, field, previous, next, note)
    values (new.id, new.property_id, 'condition', old.condition::text, new.condition::text, nota);
  end if;
  if new.quantity <> old.quantity then
    insert into public.inventory_history (item_id, property_id, field, previous, next, note)
    values (new.id, new.property_id, 'quantity', old.quantity::text, new.quantity::text, nota);
  end if;
  if (new.retired_at is null) <> (old.retired_at is null) then
    insert into public.inventory_history (item_id, property_id, field, previous, next, note)
    values (new.id, new.property_id, 'retired',
            case when old.retired_at is null then 'active' else 'retired' end,
            case when new.retired_at is null then 'active' else 'retired' end,
            coalesce(new.retire_reason, nota));
  end if;
  return null;
end;
$$;

create trigger inventory_items_historizados
  after update on public.inventory_items
  for each row execute function private.historizar_item_de_inventario();

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger inventory_items_auditados
  after insert or update on public.inventory_items
  for each row execute function public.registrar_auditoria('inventory_item');

-- ── RF-26.2 · CA-26.2 · la baja, con motivo y auditada ──────────────────────
-- SECURITY INVOKER: la RLS de `inventory_items` sigue decidiendo quién da de baja.
create or replace function public.retire_inventory_item(item uuid, reason text)
returns public.inventory_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  motivo text := nullif(btrim(coalesce(reason, '')), '');
  resultado public.inventory_items;
begin
  if motivo is null then
    raise exception 'RF-26.2 · RF-A.4 · la baja de un ítem exige un motivo.';
  end if;

  perform set_config('app.audit_reason', motivo, true);
  update public.inventory_items
     set retired_at = now(), retired_by = (select auth.uid()), retire_reason = motivo
   where id = item
  returning * into resultado;
  perform set_config('app.audit_reason', '', true);

  if resultado.id is null then
    raise exception 'El ítem no existe o no es visible para esta cuenta.';
  end if;

  return resultado;
end;
$$;

comment on function public.retire_inventory_item(uuid, text) is
  'HU-26 · RF-26.2 · CA-26.2 · da de baja un ítem con motivo; el histórico se conserva y todo queda auditado.';

revoke execute on function public.retire_inventory_item(uuid, text) from public, anon;
grant execute on function public.retire_inventory_item(uuid, text) to authenticated, service_role;

-- ── HU-27 · RF-27.1 · RF-27.2 · el gasto de mantenimiento es un movimiento ──
alter table public.movements
  add column maintenance boolean not null default false,
  add column inventory_item_id uuid references public.inventory_items (id),
  add column attachment_path text,
  -- CA-27.3 · la factura solo puede apuntar a la carpeta de esta propiedad.
  add constraint movements_adjunto_de_la_propiedad check (
    attachment_path is null or split_part(attachment_path, '/', 1) = property_id::text
  );

comment on column public.movements.maintenance is
  'HU-27 · RF-27.1 · gasto de mantenimiento; se marca solo o por llevar ítem. Sigue siendo un gasto de HU-23 (RF-27.2).';
comment on column public.movements.inventory_item_id is
  'HU-27 · RF-27.1, RF-27.3 · el ítem del inventario al que se asocia; nulo si es de la propiedad en general.';
comment on column public.movements.attachment_path is
  'HU-27 · CA-27.3 · la factura o foto en el bucket movement-attachments, bajo la carpeta de la propiedad.';

create index movements_item_idx on public.movements (inventory_item_id) where inventory_item_id is not null;

-- RF-27.1 · el ítem tiene que ser del inventario de esta propiedad. Un disparador
-- aparte del de HU-23 y HU-40: la regla es de esta historia y no toca las otras.
create or replace function private.validar_mantenimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.inventory_items;
begin
  if new.inventory_item_id is not null then
    select * into item from public.inventory_items i where i.id = new.inventory_item_id;
    if item.id is null or item.property_id <> new.property_id then
      raise exception 'RF-27.1 · el ítem no es del inventario de esta propiedad.';
    end if;
    if new.kind <> 'expense' then
      raise exception 'RF-27.1 · a un ítem solo se le asocia un gasto.';
    end if;
    -- RF-27.2 · con ítem, es de mantenimiento aunque no se marcara.
    new.maintenance := true;
  end if;
  if new.maintenance and new.kind <> 'expense' then
    raise exception 'RF-27.1 · el mantenimiento es un gasto, no un ingreso.';
  end if;
  return new;
end;
$$;

create trigger movements_mantenimiento_validado
  before insert on public.movements
  for each row execute function private.validar_mantenimiento();

-- ── CA-27.3 · la factura, en un bucket privado propio ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'movement-attachments', 'movement-attachments', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- La leen quien gestiona la propiedad y sus copropietarios: los mismos que ven el gasto.
create policy movement_attachments_objetos_lectura
  on storage.objects for select to authenticated
  using (
    bucket_id = 'movement-attachments'
    and (
      private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
      or private.es_copropietario(private.propiedad_de_objeto(name))
    )
  );

create policy movement_attachments_objetos_carga
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'movement-attachments'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

-- Solo se retira una factura que ningún movimiento referencia: la de una carga que
-- no llegó a registrarse. La de un gasto, anulado o no, es evidencia y se queda.
create policy movement_attachments_objetos_limpieza
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'movement-attachments'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
    and not exists (select 1 from public.movements m where m.attachment_path = name)
  );
