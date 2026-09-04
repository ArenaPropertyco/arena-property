-- HU-06 · RF-06.1, RF-06.5 — invitación a comprar una fracción.
--
-- Tres decisiones que conviene leer antes que el código:
--
-- 1. **La invitación es un hecho con estado, no un correo.** Vincula un correo con
--    la fracción X de la propiedad Y y vive hasta que se acepta (cierre de compra) o
--    se cancela. No se borra: el histórico de a quién se le ofreció qué es parte de
--    la trazabilidad de la venta (principio 9).
--
-- 2. **Solo sobre una fracción que aún se pueda vender.** Disponible o reservada
--    (RF-06.1); vendida, jamás (RF-06.5). Lo comprueba un disparador, no la
--    interfaz, y una sola invitación pendiente por fracción evita ofrecerla a dos
--    compradores a la vez.
--
-- 3. **Aceptar es cerrar la compra.** No hay pasarela (D-10): el Administrador
--    cierra la compra cuando el trato está hecho y el invitado ya tiene cuenta.
--    Por eso `accepted` solo lo escribe `public.cerrar_compra()` (migración
--    siguiente), nunca un UPDATE directo.

create type public.purchase_invitation_status as enum ('pending', 'accepted', 'cancelled');

create table public.purchase_invitations (
  id uuid primary key default gen_random_uuid(),
  fraction_id uuid not null references public.fractions (id),
  -- Copia de la propiedad: las políticas la evalúan sin unir con `fractions`, y
  -- el registro de auditoría la necesita para acotar la lectura del Administrador.
  property_id uuid not null references public.properties (id),

  invitee_email text not null,
  -- Cuenta del invitado, si ya existe. Sin ella no puede cerrarse la compra.
  invitee_id uuid references auth.users (id),

  -- RF-58.1 · lo que se negoció con este comprador; el plan lo congela al cerrar.
  agreed_price bigint not null,

  status public.purchase_invitation_status not null default 'pending',
  invited_by uuid references auth.users (id),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancel_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_invitations_correo_valido check (invitee_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint purchase_invitations_precio_positivo check (agreed_price > 0),
  constraint purchase_invitations_estado_coherente check (
    (status = 'pending' and accepted_at is null and cancelled_at is null)
    or (status = 'accepted' and accepted_at is not null and cancelled_at is null and invitee_id is not null)
    or (status = 'cancelled' and cancelled_at is not null and accepted_at is null)
  )
);

comment on table public.purchase_invitations is
  'HU-06 · invitación a comprar la fracción X de la propiedad Y. Se acepta al cerrar la compra o se cancela; no se borra.';
comment on column public.purchase_invitations.agreed_price is
  'RF-58.1 · precio pactado con el comprador, en pesos enteros. El plan de pagos lo congela al cerrar.';

-- Una sola invitación pendiente por fracción.
create unique index purchase_invitations_pendiente_unica
  on public.purchase_invitations (fraction_id) where status = 'pending';
create index purchase_invitations_property_idx on public.purchase_invitations (property_id);
create index purchase_invitations_invitee_idx on public.purchase_invitations (invitee_id) where invitee_id is not null;

alter table public.purchase_invitations enable row level security;
alter table public.purchase_invitations force row level security;

-- Sin DELETE para nadie desde la API.
revoke all on table public.purchase_invitations from anon, authenticated, service_role;
grant select, insert, update on table public.purchase_invitations to authenticated, service_role;

-- ── Quién es la cuenta de un correo (para vincular al invitado) ─────────────
-- SECURITY DEFINER porque `profiles` solo deja leer el propio: el Administrador
-- necesita saber si el correo invitado ya tiene cuenta, y nada más que eso.
create or replace function private.cuenta_por_correo(correo text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles
  where lower(email) = lower(btrim(correo))
  limit 1;
$$;

revoke execute on function private.cuenta_por_correo(text) from public, anon;
grant execute on function private.cuenta_por_correo(text) to authenticated, service_role;

-- ── Políticas ───────────────────────────────────────────────────────────────
create policy purchase_invitations_lectura_gestion
  on public.purchase_invitations for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

-- El invitado ve la suya: es lo que le da acceso a saber qué se le ofreció.
create policy purchase_invitations_lectura_invitado
  on public.purchase_invitations for select to authenticated
  using (invitee_id = (select auth.uid()));

-- CA-06.1 · solo el Administrador asignado (o el Superadmin) invita sobre la propiedad.
create policy purchase_invitations_creacion
  on public.purchase_invitations for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy purchase_invitations_edicion
  on public.purchase_invitations for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- ── RF-06.1 · RF-06.5 · la fracción debe poder venderse ─────────────────────
create or replace function private.validar_invitacion_de_compra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fraccion public.fractions;
begin
  select * into fraccion from public.fractions where id = new.fraction_id;
  if not found then
    raise exception 'La fracción invitada no existe.';
  end if;

  -- La propiedad la fija la fracción; el cliente no puede apuntar a otra.
  new.property_id := fraccion.property_id;

  -- CA-06.4 · RF-06.5 · una fracción vendida no admite nueva invitación.
  if fraccion.status not in ('available', 'reserved') then
    raise exception 'RF-06.5 · solo se invita sobre una fracción disponible o reservada; esta está %.', fraccion.status;
  end if;

  new.invitee_email := lower(btrim(new.invitee_email));
  new.invitee_id := coalesce(new.invitee_id, private.cuenta_por_correo(new.invitee_email));
  new.invited_by := coalesce(new.invited_by, (select auth.uid()));
  new.status := 'pending';
  new.accepted_at := null;
  new.cancelled_at := null;

  return new;
end;
$$;

create trigger purchase_invitations_validar_alta
  before insert on public.purchase_invitations
  for each row execute function private.validar_invitacion_de_compra();

-- ── Una invitación solo se cancela desde la API; aceptarla es cerrar la compra ─
create or replace function private.validar_cambio_de_invitacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cerrando boolean := coalesce(current_setting('app.cerrando_compra', true), '') = 'true';
begin
  if new.fraction_id <> old.fraction_id
     or new.property_id <> old.property_id
     or new.invitee_email <> old.invitee_email
     or new.agreed_price <> old.agreed_price
     or new.invited_by is distinct from old.invited_by
     or new.created_at <> old.created_at then
    raise exception 'Una invitación no se edita: se cancela y se crea otra.';
  end if;

  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'Una invitación % ya no cambia de estado.', old.status;
  end if;

  if new.status = 'accepted' and not cerrando then
    raise exception 'RF-06.2 · una invitación se acepta cerrando la compra con public.cerrar_compra().';
  end if;

  if new.status = 'cancelled' and old.status = 'pending' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, (select auth.uid()));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger purchase_invitations_validar_cambio
  before update on public.purchase_invitations
  for each row execute function private.validar_cambio_de_invitacion();

-- ── TR-01 · RF-A.3 · la invitación queda auditada con su propiedad ──────────
create trigger purchase_invitations_auditada
  after insert or update or delete on public.purchase_invitations
  for each row execute function public.registrar_auditoria('purchase_invitation');
