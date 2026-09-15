-- HU-40 · RF-40.1…RF-40.6 · D-01, D-09, D-39 · TR-02 — el ingreso de una semana
-- rentada a un tercero, y a quién pertenece.
--
-- Cinco decisiones que conviene leer antes que el código:
--
-- 1. **El ingreso es un movimiento, no una tabla aparte.** Reutiliza `movements`
--    de HU-23 con `kind = 'income'` y un enlace a la reserva, igual que HU-27 hace
--    con el mantenimiento: un solo modelo financiero, no dos. Así aparece sin
--    trabajo extra en HU-19, HU-24 y HU-25 (RF-40.6).
--
-- 2. **El reparto lo deriva la base, no quien llama (RF-40.2).** El disparador lee
--    el origen que la reserva fijó (RF-39.2b) y decide: `voluntary` se atribuye a
--    la fracción que liberó la semana; cancelada, caducada, reubicada o sobrante se
--    prorratean entre las ocho. La aplicación manda el bruto y la reserva, nada más;
--    no puede equivocarse en el reparto porque no lo elige.
--
-- 3. **La comisión de gestión es de la propiedad y va al libro de Arena (RF-40.4).**
--    Se trunca al peso hacia abajo, de modo que el peso suelto se queda en la
--    fracción y comisión + neto suman siempre el bruto. Nunca se prorratea, igual
--    que las comisiones de Embajador no entran en la maestra de la propiedad
--    (RF-23.5, D-01): es el mismo principio en el sentido contrario.
--
-- 4. **Sin porcentaje configurado no hay registro (RF-40.5).** El ingreso de una
--    semana liberada se rechaza con motivo en vez de inventar un reparto. Las demás
--    semanas siguen registrándose: no dependen de ese dato.
--
-- 5. **Anular revierte las dos puntas (RF-40.3, CA-40.7).** La cuota de la fracción
--    y la comisión de plataforma se revierten juntas y auditadas; corregir es anular
--    y registrar de nuevo.
--
-- Las mismas reglas están en `shared/finance/ingresos.ts`.

-- ── RF-40.4 · la comisión de gestión, por propiedad ─────────────────────────
alter table public.properties
  add column rental_commission_basis_points integer,
  add constraint properties_comision_de_renta check (
    rental_commission_basis_points is null
    or rental_commission_basis_points between 0 and 10000
  );

comment on column public.properties.rental_commission_basis_points is
  'HU-40 · RF-40.4 · D-39 · comisión de gestión de la renta, en puntos básicos (TR-02 RF-D.4). Nula mientras el Superadmin no la fije: sin ella no se registra el ingreso de una semana liberada (RF-40.5).';

-- ── D-01 · el libro de plataforma (mínimo de HU-40; HU-25 lo amplía) ────────
create table public.platform_ledger (
  id uuid primary key default gen_random_uuid(),
  kind public.movement_kind not null,
  amount bigint not null,
  category_id uuid not null references public.expense_categories (id),
  -- De qué propiedad viene, a efectos informativos: el importe no es de ella.
  property_id uuid references public.properties (id) on delete set null,
  -- Qué lo originó: hoy solo la comisión de gestión de una renta.
  source_type text not null,
  source_id uuid,
  -- D-09 · imputación por devengo.
  accrued_on date not null,
  note text,
  created_at timestamptz not null default now(),
  reversed_at timestamptz,
  reverse_reason text,

  constraint platform_ledger_monto_positivo check (amount > 0),
  constraint platform_ledger_origen check (source_type in ('rental_commission', 'ambassador_commission')),
  constraint platform_ledger_reversa check ((reversed_at is null) = (reverse_reason is null))
);

comment on table public.platform_ledger is
  'HU-25 · D-01 · libro contable de Arena, separado del de cada inmueble: lo que entra aquí jamás se prorratea entre las fracciones.';

create index platform_ledger_origen_idx on public.platform_ledger (source_type, source_id);
create index platform_ledger_periodo_idx on public.platform_ledger (accrued_on desc);

alter table public.platform_ledger enable row level security;
alter table public.platform_ledger force row level security;

revoke all on table public.platform_ledger from anon, authenticated, service_role;
grant select on table public.platform_ledger to authenticated, service_role;

-- El libro de Arena es del Superadmin: ni el Administrador ni el Propietario ven
-- lo que Arena gana, porque no es dinero de la propiedad.
create policy platform_ledger_lectura on public.platform_ledger for select to authenticated
  using (private.es_superadmin());

create trigger platform_ledger_auditado
  after insert or update or delete on public.platform_ledger
  for each row execute function public.registrar_auditoria('platform_ledger');

-- RF-40.4 · la categoría del libro con la que entra la comisión de gestión.
insert into public.expense_categories (name, kind, scope) values
  ('Comisión de gestión de renta', 'income', 'platform')
on conflict (kind, lower(btrim(name))) do nothing;

-- ── RF-40.1 · RF-40.3 · el ingreso, enlazado a su reserva ───────────────────
alter table public.movements
  add column booking_id uuid references public.third_party_bookings (id),
  -- RF-40.4 · el porcentaje aplicado y su importe, congelados en el movimiento.
  add column commission_basis_points integer,
  add column commission_amount bigint,
  add constraint movements_comision_coherente check (
    (commission_basis_points is null) = (commission_amount is null)
  ),
  add constraint movements_comision_en_rango check (
    commission_basis_points is null or commission_basis_points between 0 and 10000
  ),
  add constraint movements_comision_no_supera check (
    commission_amount is null or (commission_amount >= 0 and commission_amount <= amount)
  ),
  -- La comisión solo existe sobre un ingreso enlazado a una reserva.
  add constraint movements_comision_solo_en_renta check (commission_amount is null or booking_id is not null);

comment on column public.movements.booking_id is
  'HU-40 · RF-40.1 · la reserva a tercero que originó el ingreso.';
comment on column public.movements.commission_amount is
  'HU-40 · RF-40.4 · D-39 · comisión de gestión descontada del bruto; va al libro de plataforma y nunca se prorratea.';

-- CA-40.2 · RF-40.3 · una reserva admite a lo sumo un ingreso vigente.
create unique index movements_ingreso_unico_por_reserva
  on public.movements (booking_id) where booking_id is not null and voided_at is null;
create index movements_reserva_idx on public.movements (booking_id) where booking_id is not null;

-- ── RF-40.2 · RF-40.5 · el reparto lo deriva la base ────────────────────────
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
  reserva public.third_party_bookings;
  puntos integer;
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

  -- ── RF-40.1 · RF-40.2 · el ingreso de una renta deriva su propio reparto ──
  if new.booking_id is not null then
    if new.kind <> 'income' then
      raise exception 'RF-40.1 · una reserva a tercero solo origina un ingreso, no un gasto.';
    end if;

    select * into reserva from public.third_party_bookings b where b.id = new.booking_id;
    if reserva.id is null or reserva.property_id <> new.property_id then
      raise exception 'RF-40.1 · la reserva no es de esta propiedad.';
    end if;
    if reserva.status <> 'confirmed' then
      raise exception 'RF-40.1 · la reserva está cancelada: no genera ingreso.';
    end if;

    -- RF-40.2 · D-39 · el origen de la semana decide el destino del ingreso.
    if reserva.origin_reason = 'voluntary' then
      select p.rental_commission_basis_points into puntos
        from public.properties p where p.id = new.property_id;

      -- CA-40.5 · sin porcentaje declarado no se inventa un reparto.
      if puntos is null then
        raise exception 'CA-40.5 · RF-40.5 · la propiedad no tiene configurada su comisión de gestión: el ingreso de una semana liberada no se registra.';
      end if;

      new.allocation := 'single_fraction';
      new.fraction_id := reserva.origin_fraction_id;
      new.commission_basis_points := puntos;
      -- RF-40.4 · TR-02 · truncado al peso hacia abajo: el suelto se queda en la fracción.
      new.commission_amount := (new.amount::numeric * puntos / 10000)::bigint;
    else
      new.allocation := 'prorated';
      new.fraction_id := null;
      new.commission_basis_points := null;
      new.commission_amount := null;
    end if;
  elsif new.commission_amount is not null then
    raise exception 'RF-40.4 · la comisión de gestión solo existe sobre el ingreso de una reserva.';
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

-- ── RF-40.2 · RF-40.4 · la cuota única es el neto de comisión ───────────────
-- Prorrateado: `q = M div 8`, `r = M mod 8`, las primeras `r` fracciones reciben
-- `q + 1`; el Propietario paga solo si su calendario está activo desde una fecha (en
-- la zona del negocio) no posterior a la causación. Imputado o atribuido: una cuota
-- por el monto menos la comisión —cero en un gasto—, a cargo del Propietario de la
-- fracción, sin residuo y sin mirar el calendario.
create or replace function private.generar_cuotas_de_movimiento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cociente bigint := new.amount / 8;
  residuo integer := (new.amount % 8)::integer;
  neto bigint := new.amount - coalesce(new.commission_amount, 0);
begin
  if new.allocation = 'single_fraction' then
    insert into public.movement_shares (
      movement_id, property_id, fraction_id, fraction_number, amount, has_remainder, payer, payer_id
    )
    select new.id, new.property_id, f.id, f.number, neto, false, 'owner'::public.share_payer, f.owner_id
      from public.fractions f
     where f.id = new.fraction_id;

    -- RF-40.4 · D-01 · la comisión entra al libro de Arena y no se prorratea.
    if coalesce(new.commission_amount, 0) > 0 then
      insert into public.platform_ledger (kind, amount, category_id, property_id, source_type, source_id, accrued_on, note)
      select 'income', new.commission_amount,
             (select c.id from public.expense_categories c
               where c.scope = 'platform' and c.kind = 'income' and c.name = 'Comisión de gestión de renta'),
             new.property_id, 'rental_commission', new.id, new.incurred_on,
             'Comisión de gestión sobre la renta de una semana liberada';
    end if;

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

-- ── CA-40.7 · anular revierte la cuota y la comisión ────────────────────────
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

    -- CA-40.7 · la comisión de plataforma se revierte con la misma anulación.
    update public.platform_ledger l
       set reversed_at = new.voided_at, reverse_reason = new.void_reason
     where l.source_type = 'rental_commission' and l.source_id = new.id and l.reversed_at is null;
  end if;
  return null;
end;
$$;

-- ── RF-40.4 · el Superadmin fija la comisión de gestión de la propiedad ─────
create or replace function public.fijar_comision_de_renta(propiedad uuid, puntos_basicos integer)
returns public.properties
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resultado public.properties;
begin
  if not private.es_superadmin() then
    raise exception 'RF-40.4 · solo el Superadmin fija la comisión de gestión de una propiedad.';
  end if;
  if puntos_basicos is not null and (puntos_basicos < 0 or puntos_basicos > 10000) then
    raise exception 'RF-40.4 · TR-02 · la comisión de gestión va de 0 a 10 000 puntos básicos.';
  end if;

  perform set_config('app.audit_reason', 'Comisión de gestión de la renta', true);
  update public.properties set rental_commission_basis_points = puntos_basicos
   where id = propiedad
  returning * into resultado;
  perform set_config('app.audit_reason', '', true);

  if resultado.id is null then
    raise exception 'La propiedad no existe o no es visible para esta cuenta.';
  end if;

  return resultado;
end;
$$;

comment on function public.fijar_comision_de_renta(uuid, integer) is
  'HU-40 · RF-40.4 · D-39 · el Superadmin fija el porcentaje de comisión de gestión de la renta de una propiedad.';

revoke execute on function public.fijar_comision_de_renta(uuid, integer) from public, anon;
grant execute on function public.fijar_comision_de_renta(uuid, integer) to authenticated, service_role;

-- ── RF-40.1 · registrar el ingreso de una reserva ───────────────────────────
-- `SECURITY INVOKER`: la RLS de `movements` sigue decidiendo quién registra. El
-- reparto, la comisión y la fracción los deriva el disparador; quien llama solo
-- aporta el bruto y las entradas de la maestra.
create or replace function public.registrar_ingreso_de_renta(
  reserva uuid,
  monto bigint,
  categoria uuid,
  medio uuid,
  cuenta uuid,
  causacion date default current_date,
  descripcion text default 'Renta a tercero'
)
returns public.movements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  b public.third_party_bookings;
  resultado public.movements;
begin
  select * into b from public.third_party_bookings where id = reserva;
  if b.id is null then
    raise exception 'RF-40.1 · la reserva no existe o no es visible para esta cuenta.';
  end if;

  insert into public.movements (
    property_id, kind, amount, category_id, payment_method_id, account_id,
    incurred_on, description, booking_id
  )
  values (b.property_id, 'income', monto, categoria, medio, cuenta, causacion, descripcion, reserva)
  returning * into resultado;

  return resultado;
end;
$$;

comment on function public.registrar_ingreso_de_renta(uuid, bigint, uuid, uuid, uuid, date, text) is
  'HU-40 · RF-40.1, RF-40.2 · registra el ingreso de una reserva; la base deriva el reparto y la comisión.';

revoke execute on function public.registrar_ingreso_de_renta(uuid, bigint, uuid, uuid, uuid, date, text) from public, anon;
grant execute on function public.registrar_ingreso_de_renta(uuid, bigint, uuid, uuid, uuid, date, text) to authenticated, service_role;
