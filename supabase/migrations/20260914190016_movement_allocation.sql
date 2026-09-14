-- HU-23 · RF-23.8, RF-23.9 · D-41 — el reparto del gasto: entre las 8 fracciones
-- o imputado a una sola.
--
-- Tres decisiones que conviene leer antes que el código:
--
-- 1. **El reparto es una columna del movimiento y no se edita.** `prorated` es el
--    de siempre (RF-23.3); `single_fraction` imputa el gasto íntegro a la fracción
--    indicada. Como el resto del movimiento, se anula y se registra otro: el
--    disparador de RF-23.4 ya rechaza cualquier otro cambio.
--
-- 2. **Solo se imputa a una fracción vendida de la misma propiedad (CA-23.9).**
--    La imputación es de responsabilidad: sin titular no hay a quién. Y no mira el
--    interruptor de calendario (D-31): no se cobra un derecho de uso, sino un daño.
--
-- 3. **La cuota única la escribe el mismo disparador que las ocho.** Monto íntegro,
--    sin residuo, pagador `owner`. Así la regla vive en un solo sitio y una ruta
--    nueva no puede producir un reparto distinto del que prueba
--    `shared/finance/cuotas.ts`.

create type public.movement_allocation as enum ('prorated', 'single_fraction');

alter table public.movements
  add column allocation public.movement_allocation not null default 'prorated',
  -- RF-23.9 · la fracción imputada; solo con reparto directo.
  add column fraction_id uuid references public.fractions (id),
  add constraint movements_reparto_coherente check ((allocation = 'prorated') = (fraction_id is null));

comment on column public.movements.allocation is
  'HU-23 · RF-23.8 · D-41 · `prorated` reparte entre las 8 fracciones; `single_fraction` imputa el gasto íntegro a `fraction_id`.';
comment on column public.movements.fraction_id is
  'HU-23 · RF-23.9 · D-41 · fracción a la que se imputa el gasto; vendida y de la misma propiedad.';

create index movements_fraccion_idx on public.movements (fraction_id) where fraction_id is not null;

-- ── RF-23.9 · CA-23.9 · la imputación exige fracción vendida de la propiedad ─
create or replace function private.validar_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  categoria public.expense_categories;
  fracciones integer;
  imputada public.fractions;
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

  -- RF-23.3 · sin las 8 fracciones no hay reparto posible, sea cual sea.
  select count(*) into fracciones from public.fractions f where f.property_id = new.property_id;
  if fracciones <> 8 then
    raise exception 'RF-23.3 · la propiedad debe tener sus 8 fracciones para repartir; tiene %.', fracciones;
  end if;

  -- RF-23.8 · RF-23.9 · D-41 · el reparto directo exige una fracción vendida de la
  -- propiedad; el prorrateado no admite fracción.
  if new.allocation = 'single_fraction' then
    if new.fraction_id is null then
      raise exception 'CA-23.9 · RF-23.9 · la imputación directa exige indicar la fracción.';
    end if;
    select * into imputada from public.fractions f where f.id = new.fraction_id;
    if imputada.id is null or imputada.property_id <> new.property_id then
      raise exception 'CA-23.9 · RF-23.9 · la fracción imputada no es de esta propiedad.';
    end if;
    if imputada.status <> 'sold' or imputada.owner_id is null then
      raise exception 'CA-23.9 · RF-23.9 · solo se imputa a una fracción vendida; la %/8 está %.', imputada.number, imputada.status;
    end if;
  elsif new.fraction_id is not null then
    raise exception 'RF-23.8 · un gasto prorrateado no lleva fracción.';
  end if;

  new.voided_at := null;
  new.voided_by := null;
  new.void_reason := null;
  return new;
end;
$$;

-- ── RF-23.3 · RF-23.9 · CA-23.1, CA-23.2, CA-23.5, CA-23.7, CA-23.8 · las cuotas ─
-- Prorrateado: `q = M div 8`, `r = M mod 8`, las primeras `r` fracciones reciben
-- `q + 1`; el Propietario paga solo si su calendario está activo desde una fecha (en
-- la zona del negocio) no posterior a la causación. Imputado: una cuota íntegra a
-- cargo del Propietario de la fracción, sin residuo y sin mirar el calendario.
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
  if new.allocation = 'single_fraction' then
    insert into public.movement_shares (
      movement_id, property_id, fraction_id, fraction_number, amount, has_remainder, payer, payer_id
    )
    select new.id, new.property_id, f.id, f.number, new.amount, false, 'owner'::public.share_payer, f.owner_id
      from public.fractions f
     where f.id = new.fraction_id;

    return null;
  end if;

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
