-- HU-23 · RF-23.1, RF-23.5 · D-01 — la maestra contable: categorías, medios de
-- pago y cuentas contables que todo movimiento financiero referencia.
--
-- Tres decisiones que conviene leer antes que el código:
--
-- 1. **Un catálogo administrable, no un enum.** El Superadmin da de alta y
--    desactiva entradas sin migración; los movimientos ya registrados conservan la
--    suya aunque se desactive, porque la baja es lógica (`active`), nunca física.
--
-- 2. **El ámbito de la categoría es D-01 escrito en la tabla.** Una categoría
--    `platform` (comisiones a Embajadores) existe para el libro de plataforma de
--    HU-25, pero el disparador de `movements` la rechaza (CA-23.6): jamás se
--    prorratea entre las fracciones.
--
-- 3. **Nace con lo mínimo para operar.** Se siembran las categorías, medios y
--    cuentas con los que arranca cualquier propiedad; el Superadmin las ajusta
--    después. Los medios de pago llevan el mismo código que el vocabulario
--    provisional de HU-58 (`shared/payments/abonos.ts`), para que los abonos
--    puedan referenciarlos cuando esa historia se alinee con la maestra.
--
-- Las mismas reglas están en `shared/finance/maestra.ts`.

create type public.movement_kind as enum ('expense', 'income');
create type public.category_scope as enum ('property', 'platform');

-- ── Categorías ──────────────────────────────────────────────────────────────
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.movement_kind not null,
  -- D-01 · a qué libro pertenece: al de la propiedad o al de Arena.
  scope public.category_scope not null default 'property',
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expense_categories_nombre check (btrim(name) <> '' and length(btrim(name)) <= 80)
);

comment on table public.expense_categories is
  'HU-23 · RF-23.1 · D-01 · categorías de ingreso y egreso de la maestra contable, con el libro al que pertenecen.';
comment on column public.expense_categories.scope is
  'D-01 · `platform` es del libro de Arena (comisiones); un movimiento de propiedad no puede usarla (CA-23.6).';

create unique index expense_categories_nombre_unico
  on public.expense_categories (kind, lower(btrim(name)));
create index expense_categories_activas_idx on public.expense_categories (kind, name) where active;

-- ── Medios de pago ──────────────────────────────────────────────────────────
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  -- Identificador estable para la interfaz (`transfer`, `cash`…).
  code text not null,
  name text not null,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payment_methods_codigo check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint payment_methods_nombre check (btrim(name) <> '' and length(btrim(name)) <= 60),
  constraint payment_methods_codigo_unico unique (code)
);

comment on table public.payment_methods is
  'HU-23 · RF-23.1 · medios de pago de la maestra contable.';

-- ── Cuentas contables ───────────────────────────────────────────────────────
create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ledger_accounts_codigo check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  constraint ledger_accounts_nombre check (btrim(name) <> '' and length(btrim(name)) <= 60),
  constraint ledger_accounts_codigo_unico unique (code)
);

comment on table public.ledger_accounts is
  'HU-23 · RF-23.1 · cuentas contables de la maestra.';

-- ── Marca de actualización ──────────────────────────────────────────────────
create or replace function private.marcar_actualizacion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger expense_categories_actualizadas
  before update on public.expense_categories
  for each row execute function private.marcar_actualizacion();
create trigger payment_methods_actualizados
  before update on public.payment_methods
  for each row execute function private.marcar_actualizacion();
create trigger ledger_accounts_actualizadas
  before update on public.ledger_accounts
  for each row execute function private.marcar_actualizacion();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- La maestra la lee cualquier cuenta: el Administrador para registrar y el
-- Propietario para entender su cuota. La escribe solo el Superadmin, y nunca borra:
-- una entrada referenciada por un movimiento tiene que seguir existiendo.
alter table public.expense_categories enable row level security;
alter table public.expense_categories force row level security;
alter table public.payment_methods enable row level security;
alter table public.payment_methods force row level security;
alter table public.ledger_accounts enable row level security;
alter table public.ledger_accounts force row level security;

revoke all on table public.expense_categories, public.payment_methods, public.ledger_accounts
  from anon, authenticated, service_role;
grant select, insert, update on table public.expense_categories, public.payment_methods, public.ledger_accounts
  to authenticated, service_role;

create policy expense_categories_lectura on public.expense_categories for select to authenticated using (true);
create policy expense_categories_creacion on public.expense_categories for insert to authenticated
  with check (private.es_superadmin());
create policy expense_categories_edicion on public.expense_categories for update to authenticated
  using (private.es_superadmin()) with check (private.es_superadmin());

create policy payment_methods_lectura on public.payment_methods for select to authenticated using (true);
create policy payment_methods_creacion on public.payment_methods for insert to authenticated
  with check (private.es_superadmin());
create policy payment_methods_edicion on public.payment_methods for update to authenticated
  using (private.es_superadmin()) with check (private.es_superadmin());

create policy ledger_accounts_lectura on public.ledger_accounts for select to authenticated using (true);
create policy ledger_accounts_creacion on public.ledger_accounts for insert to authenticated
  with check (private.es_superadmin());
create policy ledger_accounts_edicion on public.ledger_accounts for update to authenticated
  using (private.es_superadmin()) with check (private.es_superadmin());

-- ── TR-01 · la maestra queda auditada ───────────────────────────────────────
create trigger expense_categories_auditadas
  after insert or update or delete on public.expense_categories
  for each row execute function public.registrar_auditoria('expense_category');
create trigger payment_methods_auditados
  after insert or update or delete on public.payment_methods
  for each row execute function public.registrar_auditoria('payment_method');
create trigger ledger_accounts_auditadas
  after insert or update or delete on public.ledger_accounts
  for each row execute function public.registrar_auditoria('ledger_account');

-- ── Siembra mínima ──────────────────────────────────────────────────────────
insert into public.expense_categories (name, kind, scope) values
  ('Mantenimiento', 'expense', 'property'),
  ('Servicios públicos', 'expense', 'property'),
  ('Aseo y limpieza', 'expense', 'property'),
  ('Seguros', 'expense', 'property'),
  ('Administración', 'expense', 'property'),
  ('Impuestos', 'expense', 'property'),
  ('Renta a terceros', 'income', 'property'),
  -- D-01 · RF-23.5 · vive en el libro de plataforma; la maestra de propiedad la rechaza.
  ('Comisiones a Embajadores', 'expense', 'platform')
on conflict (kind, lower(btrim(name))) do nothing;

insert into public.payment_methods (code, name) values
  ('transfer', 'Transferencia'),
  ('cash', 'Efectivo'),
  ('card', 'Tarjeta'),
  ('check', 'Cheque'),
  ('other', 'Otro')
on conflict (code) do nothing;

insert into public.ledger_accounts (code, name) values
  ('bank', 'Cuenta bancaria'),
  ('cash_box', 'Caja general')
on conflict (code) do nothing;
