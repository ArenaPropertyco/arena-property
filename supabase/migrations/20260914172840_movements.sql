-- HU-23 · RF-23.2…RF-23.7 · D-01, D-08, D-09, D-31 · TR-02 — movimientos
-- financieros de una propiedad y sus 8 cuotas.
--
-- Cinco decisiones que conviene leer antes que el código:
--
-- 1. **Las cuotas las escribe la base, siempre (RF-23.3).** Un disparador `after
--    insert` genera las 8 con la regla canónica de TR-02 (`q = M div 8`, `r = M mod
--    8`, residuo a las primeras fracciones) y decide el pagador de cada una. La
--    aplicación no inserta cuotas: no tiene ni el permiso. Así ninguna ruta nueva
--    puede producir un reparto distinto del que prueba `shared/finance/cuotas.ts`.
--
-- 2. **El pagador es D-08 y D-31 en una columna (RF-23.6).** Fracción sin vender o
--    vendida con calendario inactivo → `inventory_holder` (Arena o el vendedor,
--    `payer_id` nulo). Propietario con calendario activo → `owner`, pero solo desde
--    la primera causación posterior a la activación: se compara la fecha de
--    causación con `calendar_activated_at` leída en la zona del negocio.
--
-- 3. **Un movimiento no se edita ni se borra: se anula (RF-23.4).** El único
--    `update` permitido es el que lo anula, con motivo obligatorio que viaja a la
--    auditoría (RF-A.4); la anulación revierte las 8 cuotas marcándolas, no
--    borrándolas, para que el histórico siga contando lo que pasó.
--
-- 4. **La maestra manda (RF-23.1, RF-23.5).** Categoría, medio y cuenta deben ser
--    entradas activas; una categoría del libro de plataforma —las comisiones a
--    Embajadores— se rechaza por categoría no permitida (CA-23.6, D-01).
--
-- 5. **Imputación por causación (RF-23.7, D-09).** `incurred_on` es el periodo al
--    que pertenece el movimiento; la fecha de pago no se guarda aquí.

create type public.share_payer as enum ('owner', 'inventory_holder');

-- ── RF-23.2 · el movimiento ─────────────────────────────────────────────────
create table public.movements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  kind public.movement_kind not null default 'expense',
  -- TR-02 · RF-D.1 · entero de pesos, mayor que cero.
  amount bigint not null,
  category_id uuid not null references public.expense_categories (id),
  payment_method_id uuid not null references public.payment_methods (id),
  account_id uuid not null references public.ledger_accounts (id),
  -- D-09 · RF-23.7 · fecha de causación: el periodo al que se imputa.
  incurred_on date not null,
  description text not null,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- RF-23.4 · anulación con motivo, nunca borrado.
  voided_at timestamptz,
  voided_by uuid references auth.users (id),
  void_reason text,

  constraint movements_monto_positivo check (amount > 0),
  constraint movements_descripcion check (btrim(description) <> '' and length(description) <= 500),
  constraint movements_anulacion_con_motivo check (
    (voided_at is null and void_reason is null)
    or (voided_at is not null and btrim(coalesce(void_reason, '')) <> '')
  )
);

comment on table public.movements is
  'HU-23 · RF-23.2 · D-09 · gasto o ingreso de una propiedad, imputado por fecha de causación; se anula, no se borra.';
comment on column public.movements.incurred_on is
  'D-09 · RF-23.7 · fecha de causación: el periodo al que se imputa, no la de pago.';

create index movements_propiedad_idx on public.movements (property_id, incurred_on desc);
create index movements_categoria_idx on public.movements (category_id);
create index movements_medio_idx on public.movements (payment_method_id);
create index movements_cuenta_idx on public.movements (account_id);

-- ── RF-23.3 · RF-23.6 · las 8 cuotas ────────────────────────────────────────
create table public.movement_shares (
  id uuid primary key default gen_random_uuid(),
  movement_id uuid not null references public.movements (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  fraction_id uuid not null references public.fractions (id),
  fraction_number smallint not null,
  amount bigint not null,
  -- TR-02 · RF-D.3 · esta cuota absorbió un peso del residuo.
  has_remainder boolean not null default false,
  -- D-08 · D-31 · quién la asume.
  payer public.share_payer not null,
  -- El Propietario cuando paga él; nulo cuando paga el titular del inventario.
  payer_id uuid references auth.users (id),
  -- RF-23.4 · revertida al anularse el movimiento.
  reversed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint movement_shares_numero_en_rango check (fraction_number between 1 and 8),
  constraint movement_shares_unica_por_fraccion unique (movement_id, fraction_number),
  constraint movement_shares_pagador_coherente check ((payer = 'owner') = (payer_id is not null))
);

comment on table public.movement_shares is
  'HU-23 · RF-23.3, RF-23.6 · D-08 · las 8 cuotas de un movimiento, con residuo marcado y pagador; las escribe solo la base.';
comment on column public.movement_shares.payer is
  'D-08 · D-31 · `owner` si el Propietario tiene el calendario activo desde antes de la causación; si no, `inventory_holder`.';

create index movement_shares_movimiento_idx on public.movement_shares (movement_id);
create index movement_shares_fraccion_idx on public.movement_shares (fraction_id);
create index movement_shares_pagador_idx on public.movement_shares (payer_id) where payer_id is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.movements enable row level security;
alter table public.movements force row level security;
alter table public.movement_shares enable row level security;
alter table public.movement_shares force row level security;

revoke all on table public.movements, public.movement_shares from anon, authenticated, service_role;
-- Sin DELETE para nadie: un movimiento se anula (RF-23.4).
grant select, insert, update on table public.movements to authenticated, service_role;
-- Las cuotas las escribe solo el disparador.
grant select on table public.movement_shares to authenticated, service_role;

-- El Administrador asignado y el Superadmin registran; los copropietarios ven los
-- movimientos de su propiedad (HU-19 los agrega, HU-24 los detalla).
create policy movements_lectura on public.movements for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

create policy movements_creacion on public.movements for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy movements_edicion on public.movements for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- HU-24 · RF-24.3 · el Propietario ve las cuotas de su fracción; la gestión, todas.
create policy movement_shares_lectura on public.movement_shares for select to authenticated
  using (
    private.puede_gestionar_propiedad(property_id)
    or exists (
      select 1 from public.fractions f
       where f.id = movement_shares.fraction_id and f.owner_id = (select auth.uid())
    )
  );

-- ── TR-01 · RF-A.3, RF-A.4 · alta auditada, anulación con motivo ────────────
insert into public.audit_reason_required (action, source) values
  ('movement.actualizada', 'HU-23')
on conflict (action) do nothing;

create trigger movements_auditados
  after insert or update or delete on public.movements
  for each row execute function public.registrar_auditoria('movement');
create trigger movement_shares_auditadas
  after insert or update or delete on public.movement_shares
  for each row execute function public.registrar_auditoria('movement_share');

-- ── RF-23.2 · RF-23.4 · RF-23.5 · las reglas, en la base, sea cual sea la vía ─
create or replace function private.validar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  categoria public.expense_categories;
  fracciones integer;
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();

    -- RF-23.4 · el único cambio admitido es la anulación, una sola vez y con motivo.
    if (to_jsonb(new) - 'voided_at' - 'voided_by' - 'void_reason' - 'updated_at')
       <> (to_jsonb(old) - 'voided_at' - 'voided_by' - 'void_reason' - 'updated_at') then
      raise exception 'RF-23.4 · un movimiento no se edita: se anula con motivo y se registra otro.';
    end if;
    if old.voided_at is not null then
      raise exception 'RF-23.4 · el movimiento ya estaba anulado.';
    end if;
    if new.voided_at is null then
      raise exception 'RF-23.4 · el único cambio admitido sobre un movimiento es anularlo.';
    end if;
    if btrim(coalesce(new.void_reason, '')) = '' then
      raise exception 'CA-23.4 · RF-A.4 · un movimiento no se anula sin motivo.';
    end if;
    return new;
  end if;

  -- CA-23.3 · monto entero de pesos mayor que cero.
  if new.amount is null or new.amount <= 0 then
    raise exception 'CA-23.3 · RF-23.2 · el monto debe ser un entero de pesos mayor que cero.';
  end if;

  -- CA-23.3 · CA-23.6 · la categoría es de la maestra, activa, de la clase y del libro correctos.
  select * into categoria from public.expense_categories c where c.id = new.category_id;
  if categoria.id is null or not categoria.active then
    raise exception 'CA-23.3 · RF-23.1 · la categoría no está en la maestra contable.';
  end if;
  if categoria.scope <> 'property' then
    raise exception 'CA-23.6 · RF-23.5 · D-01 · categoría no permitida: pertenece al libro de plataforma y no se prorratea.';
  end if;
  if categoria.kind <> new.kind then
    raise exception 'RF-23.1 · la categoría es de % y el movimiento de %.', categoria.kind, new.kind;
  end if;

  if not exists (select 1 from public.payment_methods m where m.id = new.payment_method_id and m.active) then
    raise exception 'RF-23.1 · el medio de pago no está activo en la maestra contable.';
  end if;
  if not exists (select 1 from public.ledger_accounts a where a.id = new.account_id and a.active) then
    raise exception 'RF-23.1 · la cuenta contable no está activa en la maestra.';
  end if;

  -- RF-23.3 · sin las 8 fracciones no hay reparto posible.
  select count(*) into fracciones from public.fractions f where f.property_id = new.property_id;
  if fracciones <> 8 then
    raise exception 'RF-23.3 · la propiedad debe tener sus 8 fracciones para prorratear; tiene %.', fracciones;
  end if;

  new.voided_at := null;
  new.voided_by := null;
  new.void_reason := null;
  return new;
end;
$$;

create trigger movements_validados
  before insert or update on public.movements
  for each row execute function private.validar_movimiento();

-- ── RF-23.3 · RF-23.6 · CA-23.1, CA-23.2, CA-23.5, CA-23.7 · generar las 8 cuotas ─
-- La misma regla que `shared/finance/cuotas.ts`: `q = M div 8`, `r = M mod 8`, las
-- primeras `r` fracciones reciben `q + 1`; el Propietario paga solo si su calendario
-- está activo desde una fecha (en la zona del negocio) no posterior a la causación.
create or replace function private.generar_cuotas_de_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cociente bigint := new.amount / 8;
  residuo integer := (new.amount % 8)::integer;
begin
  insert into public.movement_shares (
    movement_id, property_id, fraction_id, fraction_number, amount, has_remainder, payer, payer_id
  )
  select
    new.id,
    new.property_id,
    f.id,
    f.number,
    cociente + case when f.number <= residuo then 1 else 0 end,
    f.number <= residuo,
    case when paga_propietario then 'owner'::public.share_payer else 'inventory_holder'::public.share_payer end,
    case when paga_propietario then f.owner_id else null end
  from public.fractions f
  cross join lateral (
    select f.status = 'sold'
       and f.owner_id is not null
       and f.calendar_active
       and f.calendar_activated_at is not null
       and (f.calendar_activated_at at time zone 'America/Bogota')::date <= new.incurred_on
       as paga_propietario
  ) regla
  where f.property_id = new.property_id
  order by f.number;

  return null;
end;
$$;

create trigger movements_prorrateados
  after insert on public.movements
  for each row execute function private.generar_cuotas_de_movimiento();

-- ── RF-23.4 · CA-23.4 · la anulación revierte las 8 cuotas ──────────────────
create or replace function private.revertir_cuotas_de_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.voided_at is not null and old.voided_at is null then
    update public.movement_shares s
       set reversed_at = new.voided_at
     where s.movement_id = new.id and s.reversed_at is null;
  end if;
  return null;
end;
$$;

create trigger movements_revertidos
  after update on public.movements
  for each row execute function private.revertir_cuotas_de_movimiento();

-- `SECURITY INVOKER`: la RLS de `movements` sigue decidiendo quién anula. La función
-- solo garantiza el motivo y que viaje a la auditoría en la misma transacción.
create or replace function public.anular_movimiento(movimiento uuid, motivo text)
returns public.movements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.movements;
begin
  if length(btrim(coalesce(motivo, ''))) = 0 then
    raise exception 'CA-23.4 · RF-A.4 · un movimiento no se anula sin motivo.';
  end if;

  perform set_config('app.audit_reason', motivo, true);

  update public.movements
     set voided_at = now(), voided_by = (select auth.uid()), void_reason = motivo
   where id = movimiento
  returning * into resultado;

  perform set_config('app.audit_reason', '', true);

  if resultado.id is null then
    raise exception 'El movimiento no existe o no es visible para esta cuenta.';
  end if;

  return resultado;
end;
$$;

comment on function public.anular_movimiento(uuid, text) is
  'HU-23 · RF-23.4 · CA-23.4 · anula un movimiento con motivo; sus 8 cuotas quedan revertidas y todo auditado.';

revoke execute on function public.anular_movimiento(uuid, text) from public, anon;
grant execute on function public.anular_movimiento(uuid, text) to authenticated, service_role;
