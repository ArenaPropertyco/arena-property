-- HU-46 · RF-46.5 y HU-03 · RF-03.4 — solicitudes de contacto del sitio público.
--
-- Dos decisiones:
--
-- 1. **El Visitante no escribe en la tabla.** El formulario pasa por una ruta Nitro
--    que valida con el esquema compartido, aplica el límite de tasa por IP y correo
--    (D-24) y persiste con la llave de servicio. Abrir INSERT a `anon` convertiría
--    la tabla en un buzón sin candado.
--
-- 2. **Solo leen el Superadmin y el Administrador de la propiedad asociada.** Una
--    solicitud general (sin propiedad) es del Superadmin.

create table public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  -- RF-03.4 · la propiedad de la ficha desde la que se escribió; null en el general.
  property_id uuid references public.properties (id) on delete set null,

  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  message text not null,

  -- RF-03.2 · RF-46.4 · las 4 intenciones, en el vocabulario de `shared/contact`.
  intent text not null,
  -- RF-46.2 · RF-46.3 · solo el formulario general las pregunta.
  property_type text,
  income_range text,

  -- RF-46.6 · RF-03.5 · atribución de referido, normalizada por el disparador.
  referral_code text,
  locale text not null default 'es',
  -- D-24 · huella de la IP para auditar abuso sin guardar la IP en claro.
  ip_hash text,
  email_sent_at timestamptz,

  created_at timestamptz not null default now(),

  constraint contact_requests_nombre_no_vacio check (length(btrim(first_name)) > 0),
  constraint contact_requests_apellido_no_vacio check (length(btrim(last_name)) > 0),
  constraint contact_requests_correo_valido check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint contact_requests_telefono_no_vacio check (length(btrim(phone)) > 0),
  constraint contact_requests_mensaje_no_vacio check (length(btrim(message)) > 0),
  constraint contact_requests_intencion_valida check (
    intent in ('second_home', 'truly_mine', 'same_place_every_summer', 'investment')
  ),
  constraint contact_requests_tipo_valido check (
    property_type is null or property_type in ('vacation', 'residential', 'land')
  ),
  constraint contact_requests_renta_valida check (
    income_range is null or income_range in ('under_4m', 'between_4m_7m', 'over_7m')
  ),
  constraint contact_requests_idioma_valido check (locale in ('es', 'en'))
);

comment on table public.contact_requests is
  'HU-46 y HU-03 · solicitudes de contacto del sitio público, con intención de compra y código de referido. Solo escribe el servidor.';

create index contact_requests_property_idx on public.contact_requests (property_id) where property_id is not null;
create index contact_requests_created_idx on public.contact_requests (created_at desc);

alter table public.contact_requests enable row level security;
alter table public.contact_requests force row level security;

revoke all on table public.contact_requests from anon, authenticated, service_role;
grant select on table public.contact_requests to authenticated;
grant select, insert, update on table public.contact_requests to service_role;

-- ── Lectura ─────────────────────────────────────────────────────────────────
create policy contact_requests_lectura_superadmin
  on public.contact_requests for select to authenticated
  using (private.es_superadmin());

create policy contact_requests_lectura_admin
  on public.contact_requests for select to authenticated
  using (property_id is not null and private.puede_gestionar_propiedad(property_id));

-- ── Normalización al entrar ─────────────────────────────────────────────────
-- Un código con formato inválido no bloquea al Visitante: se descarta (RF-51.6).
create or replace function private.normalizar_solicitud_de_contacto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.first_name := btrim(new.first_name);
  new.last_name := btrim(new.last_name);
  new.referral_code := private.normalizar_codigo_referido(new.referral_code);
  return new;
end;
$$;

create trigger contact_requests_normalizar
  before insert on public.contact_requests
  for each row execute function private.normalizar_solicitud_de_contacto();
