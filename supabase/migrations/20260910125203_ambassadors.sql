-- HU-49 · RF-49.1…RF-49.6 y HU-50 · RF-50.1, RF-50.2 — la inscripción al Programa
-- de Referidos y el código único e inmutable.
--
-- 1. **Se inscribe quien puede.** `enroll_as_ambassador` rechaza al Superadmin y
--    al Administrador de Propiedad (RF-49.1, CA-49.4) y a quien ya se inscribió
--    (RF-49.6, CA-49.3). Guarda la **versión de términos aceptada**, para que un
--    cambio posterior de los términos no reescriba lo que la persona aceptó.
--
-- 2. **La aprobación suma, no reemplaza.** `approve_ambassador` añade el rol
--    Embajador dejando el anterior (RF-49.4, CA-49.2) y genera el código; el
--    disparador de HU-07 rechaza combinaciones inválidas por su cuenta.
--
-- 3. **El código no cambia jamás.** Se genera con el alfabeto legible de
--    `shared/referrals/code.ts` (sin 0/O ni 1/I/L), la unicidad la impone una
--    restricción (RF-50.1, CA-50.1) y un disparador rechaza cualquier cambio
--    posterior (RF-50.2, CA-50.2). La aplicación ni siquiera tiene permiso de
--    `update` sobre la tabla.

create type public.ambassador_status as enum ('pending', 'approved', 'rejected', 'suspended');

-- ── Inscripción ─────────────────────────────────────────────────────────────
create table public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status public.ambassador_status not null default 'pending',

  -- RF-49.2 · lo aceptado y cuándo; la versión congela los términos de ese día.
  terms_version text not null,
  terms_accepted_at timestamptz not null default now(),

  -- RF-49.3 · datos de pago para el desembolso (HU-56).
  bank text not null,
  account_kind text not null,
  account_number text not null,
  holder text not null,

  approved_by uuid references auth.users (id),
  approved_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CA-49.1 · los datos de pago se validan también aquí: la base es la última palabra.
  constraint ambassadors_terminos_no_vacios check (length(btrim(terms_version)) > 0),
  constraint ambassadors_banco_no_vacio check (length(btrim(bank)) > 0),
  constraint ambassadors_titular_no_vacio check (length(btrim(holder)) > 0),
  constraint ambassadors_tipo_de_cuenta_valido check (account_kind in ('savings', 'checking')),
  constraint ambassadors_numero_de_cuenta_valido check (account_number ~ '^[0-9]{5,20}$'),
  -- RF-49.4 · un rechazo sin motivo no explica nada.
  constraint ambassadors_rechazo_con_motivo check (
    status <> 'rejected' or length(btrim(coalesce(rejection_reason, ''))) > 0
  )
);

comment on table public.ambassadors is
  'HU-49 · RF-49.2, RF-49.3 · inscripción al Programa de Referidos con la versión de términos aceptada y los datos de pago.';

create index ambassadors_estado_idx on public.ambassadors (status);

-- ── Código único e inmutable ────────────────────────────────────────────────
create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null unique references public.ambassadors (id) on delete cascade,
  code text not null unique,
  -- HU-33 · la suspensión del Embajador inhabilita el código sin borrarlo.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),

  -- RF-50.1 · el mismo formato que genera `shared/referrals/code.ts`.
  constraint referral_codes_formato check (code ~ '^[2-9A-HJKMNP-Z]{8}$')
);

comment on table public.referral_codes is
  'HU-50 · RF-50.1, RF-50.2 · el código de referido de un Embajador: único, con formato legible y sin cambiar nunca.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.ambassadors enable row level security;
alter table public.ambassadors force row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_codes force row level security;

revoke all on table public.ambassadors, public.referral_codes from anon, authenticated, service_role;
grant select on table public.ambassadors, public.referral_codes to authenticated, service_role;

-- RF-49.5 · cada quien ve la suya; el Superadmin ve todas.
create policy ambassadors_lectura on public.ambassadors for select to authenticated
  using (user_id = (select auth.uid()) or private.es_superadmin());

create policy referral_codes_lectura on public.referral_codes for select to authenticated
  using (exists (select 1 from public.ambassadors a where a.id = referral_codes.ambassador_id
                  and (a.user_id = (select auth.uid()) or private.es_superadmin())));

-- ── RF-50.2 · CA-50.2 · el código no se edita ni se borra ───────────────────
create or replace function private.referral_codes_inmutables()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'RF-50.2 · CA-50.2 · el código de referido no se borra: se inhabilita.';
  end if;
  if new.code is distinct from old.code or new.ambassador_id is distinct from old.ambassador_id then
    raise exception 'RF-50.2 · CA-50.2 · el código de referido queda asociado al Embajador y no cambia.';
  end if;
  return new;
end;
$$;

create trigger referral_codes_sin_cambios
  before update or delete on public.referral_codes
  for each row execute function private.referral_codes_inmutables();

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger ambassadors_auditados
  after insert or update or delete on public.ambassadors
  for each row execute function public.registrar_auditoria('ambassador');
create trigger referral_codes_auditados
  after insert or update on public.referral_codes
  for each row execute function public.registrar_auditoria('referral_code');

insert into public.audit_reason_required (action, source) values
  ('ambassador.actualizada', 'HU-49')
on conflict (action) do nothing;

-- ── RF-50.1 · generación del código ─────────────────────────────────────────
/**
 * Un código con el alfabeto legible de HU-50, reintentando ante colisión. La
 * unicidad la garantiza la restricción de la tabla; este bucle solo evita que una
 * colisión improbable llegue como error al Embajador.
 */
create or replace function private.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidato text;
  intento integer := 0;
begin
  loop
    candidato := '';
    for i in 1..8 loop
      candidato := candidato || substr(alfabeto, 1 + floor(random() * length(alfabeto))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.referral_codes where code = candidato);
    intento := intento + 1;
    if intento > 20 then
      raise exception 'RF-50.1 · no fue posible generar un código de referido único.';
    end if;
  end loop;
  return candidato;
end;
$$;

revoke execute on function private.generate_referral_code() from public, anon, authenticated;

-- ── RF-49.1 · RF-49.3 · RF-49.6 · inscribirse ───────────────────────────────
create or replace function public.enroll_as_ambassador(
  terms_version text,
  bank text,
  account_kind text,
  account_number text,
  holder text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cuenta uuid := (select auth.uid());
  nueva uuid;
begin
  if cuenta is null then
    raise exception 'RF-49.1 · hay que tener cuenta para inscribirse en el programa.';
  end if;
  -- CA-49.4 · RF-49.1 · los roles operativos no se inscriben (matriz de HU-07).
  if private.tiene_rol('superadmin') or private.tiene_rol('property_admin') then
    raise exception 'CA-49.4 · RF-49.1 · el Superadmin y el Administrador de Propiedad no se inscriben como Embajador.';
  end if;
  -- CA-49.3 · RF-49.6 · una cuenta no se inscribe dos veces.
  if exists (select 1 from public.ambassadors a where a.user_id = cuenta) then
    raise exception 'CA-49.3 · RF-49.6 · esta cuenta ya está inscrita en el programa.';
  end if;

  perform set_config('app.audit_reason', 'Inscripción al Programa de Referidos', true);
  insert into public.ambassadors (user_id, terms_version, bank, account_kind, account_number, holder)
  values (cuenta, btrim(terms_version), btrim(bank), account_kind, btrim(account_number), btrim(holder))
  returning id into nueva;
  perform set_config('app.audit_reason', '', true);

  return nueva;
end;
$$;

comment on function public.enroll_as_ambassador(text, text, text, text, text) is
  'HU-49 · RF-49.1, RF-49.2, RF-49.3, RF-49.6 · inscribe la cuenta en el Programa de Referidos, pendiente de aprobación.';

revoke execute on function public.enroll_as_ambassador(text, text, text, text, text) from public, anon;
grant execute on function public.enroll_as_ambassador(text, text, text, text, text) to authenticated, service_role;

-- ── RF-49.4 · RF-49.5 · aprobar o rechazar ──────────────────────────────────
create or replace function public.approve_ambassador(ambassador uuid, approve boolean, reason text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fila public.ambassadors;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
  codigo text;
begin
  if not private.es_superadmin() then
    raise exception 'RF-49.5 · solo el Superadmin resuelve las inscripciones al programa.';
  end if;
  select * into fila from public.ambassadors where id = ambassador;
  if fila.id is null then
    raise exception 'RF-49.5 · la inscripción no existe.';
  end if;
  if not approve and motivo is null then
    raise exception 'RF-49.4 · rechazar una inscripción exige un motivo.';
  end if;

  if not approve then
    perform set_config('app.audit_reason', motivo, true);
    update public.ambassadors
       set status = 'rejected', rejection_reason = motivo, approved_by = (select auth.uid()),
           approved_at = now(), updated_at = now()
     where id = ambassador;
    perform set_config('app.audit_reason', '', true);
    return null;
  end if;

  -- RF-49.4 · CA-49.2 · el rol se suma; el disparador de HU-07 valida la combinación.
  perform set_config('app.audit_reason', coalesce(motivo, 'Inscripción aprobada'), true);
  update public.ambassadors
     set status = 'approved', rejection_reason = null, approved_by = (select auth.uid()),
         approved_at = coalesce(approved_at, now()), updated_at = now()
   where id = ambassador;

  insert into public.user_roles (user_id, role, granted_by)
  values (fila.user_id, 'ambassador', (select auth.uid()))
  on conflict (user_id, role) do nothing;

  -- RF-50.1 · el código se genera una sola vez: aprobar de nuevo no crea otro.
  select rc.code into codigo from public.referral_codes rc where rc.ambassador_id = ambassador;
  if codigo is null then
    codigo := private.generate_referral_code();
    insert into public.referral_codes (ambassador_id, code) values (ambassador, codigo);
  end if;
  perform set_config('app.audit_reason', '', true);

  return codigo;
end;
$$;

comment on function public.approve_ambassador(uuid, boolean, text) is
  'HU-49 · RF-49.4, RF-49.5 · CA-49.2 · el Superadmin aprueba (suma el rol Embajador y genera el código) o rechaza con motivo.';

revoke execute on function public.approve_ambassador(uuid, boolean, text) from public, anon;
grant execute on function public.approve_ambassador(uuid, boolean, text) to authenticated, service_role;
