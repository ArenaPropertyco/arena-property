-- HU-29 · RF-29.1…RF-29.4 · HU-30 · RF-30.1, RF-30.3 · HU-31 · RF-31.1…RF-31.4 —
-- la comunicación con los propietarios: la novedad de una propiedad y el
-- comunicado global del Superadmin, ambos emitidos por el canal TR-03.
--
-- Cuatro decisiones que conviene leer antes que el código:
--
-- 1. **Publicar es notificar (RF-29.2).** Al insertarse la novedad, un disparador
--    la emite a todos los titulares de la propiedad, una vez cada uno aunque
--    alguien tenga dos fracciones (CA-29.1). Es la misma regla que
--    `destinatariosDePropiedad` en `shared/notifications/destinatarios.ts`, escrita
--    en SQL para que la emisión sea atómica con la publicación y no dependa de
--    que un servidor la recuerde. La idempotencia la da `emitir_notificacion`.
--
-- 2. **Publicada, la novedad no se reescribe (RF-29.3).** Los propietarios ya la
--    recibieron por correo: cambiarle el texto después dejaría dos versiones. Lo
--    único que cambia es su estado, de abierta a resuelta, y solo una vez. Para
--    corregir, se publica otra. Nadie borra: es historial (HU-30).
--
-- 3. **Quien gestiona la propiedad publica; el copropietario lee (RF-29.1, RF-30.3).**
--    La matriz de HU-07 da «enviar novedades» al Superadmin y al Administrador, y
--    la RLS lo repite con `puede_gestionar_propiedad`. El Propietario ve el
--    historial completo de sus propiedades, resueltas incluidas.
--
-- 4. **El comunicado global es del Superadmin y se resuelve en la base (RF-31.2,
--    RF-31.4).** El segmento —todos, por roles o por propiedad— se guarda como se
--    declaró y un disparador lo convierte en cuentas concretas, sin duplicados y
--    sin cuentas suspendidas, dejando registrado cuántas fueron. La regla pura
--    vive en `destinatariosDeComunicado`; aquí está su espejo.

-- ── RF-29.1 · la novedad ────────────────────────────────────────────────────
create type public.announcement_urgency as enum ('informative', 'important', 'urgent');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  title text not null,
  body text not null,
  urgency public.announcement_urgency not null,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  -- RF-29.3 · abierta mientras no tenga resolución; el estado se deriva, no se escribe.
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  status text generated always as (case when resolved_at is null then 'open' else 'resolved' end) stored,

  -- CA-29.2 · sin título no hay aviso; la urgencia la exige el `not null` del enum.
  constraint announcements_titulo check (btrim(title) <> '' and length(title) <= 120),
  constraint announcements_cuerpo check (btrim(body) <> '' and length(body) <= 2000),
  constraint announcements_resolucion_coherente check (
    (resolved_at is null and resolved_by is null) or (resolved_at is not null and resolved_by is not null)
  )
);

comment on table public.announcements is
  'HU-29 · RF-29.1, RF-29.3 · novedad publicada sobre una propiedad, con urgencia y estado abierta/resuelta; forma el historial de HU-30.';
comment on column public.announcements.status is
  'RF-29.3 · derivado de resolved_at: «open» alimenta las alertas del tablero (HU-21); «resolved» queda en el historial.';

create index announcements_propiedad_idx on public.announcements (property_id, status, created_at desc);

alter table public.announcements enable row level security;
alter table public.announcements force row level security;

revoke all on table public.announcements from anon, authenticated, service_role;
-- RF-29.3 · sin DELETE para nadie: la novedad es historial.
grant select, insert, update on table public.announcements to authenticated, service_role;

-- RF-30.3 · quien gestiona la propiedad y sus copropietarios leen el historial completo.
create policy announcements_lectura on public.announcements for select to authenticated
  using (private.puede_gestionar_propiedad(property_id) or private.es_copropietario(property_id));

-- RF-29.1 · publica quien gestiona la propiedad, a su propio nombre.
create policy announcements_publicacion on public.announcements for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id) and created_by = (select auth.uid()));

-- RF-29.3 · resuelve quien gestiona; qué puede cambiar lo acota el disparador.
create policy announcements_resolucion on public.announcements for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- ── RF-29.1 · RF-29.3 · las reglas de la novedad, en la base ────────────────
create or replace function private.validar_novedad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.title := btrim(new.title);
    new.body := btrim(new.body);
    new.resolved_at := null;
    new.resolved_by := null;
    return new;
  end if;

  -- RF-29.3 · publicada, solo cambia su resolución.
  if new.property_id <> old.property_id
     or new.title <> old.title
     or new.body <> old.body
     or new.urgency <> old.urgency
     or new.created_by is distinct from old.created_by
     or new.created_at <> old.created_at then
    raise exception 'RF-29.3 · una novedad publicada no se reescribe: para corregirla se publica otra.';
  end if;
  if old.resolved_at is not null and (new.resolved_at is distinct from old.resolved_at or new.resolved_by is distinct from old.resolved_by) then
    raise exception 'RF-29.3 · la novedad ya está resuelta.';
  end if;
  if new.resolved_at is not null and old.resolved_at is null then
    new.resolved_by := coalesce(new.resolved_by, (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger announcements_validadas
  before insert or update on public.announcements
  for each row execute function private.validar_novedad();

-- ── RF-29.2 · CA-29.1 · CA-29.3 · publicar es notificar a todos los propietarios ─
-- Espejo SQL de `destinatariosDePropiedad`: titular por titular, sin repetir.
create or replace function private.notificar_novedad(novedad uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  p public.properties;
  destinatarios uuid[];
begin
  select * into a from public.announcements where id = novedad;
  if not found then
    return;
  end if;
  select * into p from public.properties where id = a.property_id;

  select coalesce(array_agg(distinct f.owner_id), '{}'::uuid[]) into destinatarios
    from public.fractions f
   where f.property_id = a.property_id and f.owner_id is not null;

  perform public.emitir_notificacion(
    'announcement_published', 'announcement', a.id::text, a.property_id,
    jsonb_build_object('title', a.title, 'body', a.body, 'urgency', a.urgency, 'property_name', p.name, 'announcement_id', a.id),
    destinatarios
  );
end;
$$;

comment on function private.notificar_novedad(uuid) is
  'HU-29 · RF-29.2 · emite la novedad a todos los titulares de la propiedad, una vez cada uno; idempotente por TR-03.';

create or replace function private.notificar_novedad_publicada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notificar_novedad(new.id);
  return new;
end;
$$;

create trigger announcements_notificadas
  after insert on public.announcements
  for each row execute function private.notificar_novedad_publicada();

-- TR-01 · publicar y resolver dejan registro.
create trigger announcements_auditadas
  after insert or update on public.announcements
  for each row execute function public.registrar_auditoria('announcement');

-- ── RF-29.3 · resolver ──────────────────────────────────────────────────────
-- SECURITY INVOKER: la RLS decide quién resuelve y el disparador qué cambia.
create or replace function public.resolve_announcement(announcement uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cuando timestamptz;
begin
  if exists (select 1 from public.announcements where id = announcement and resolved_at is not null) then
    raise exception 'RF-29.3 · la novedad ya está resuelta.';
  end if;

  update public.announcements
     set resolved_at = now(), resolved_by = (select auth.uid())
   where id = announcement and resolved_at is null
  returning resolved_at into cuando;

  if cuando is null then
    raise exception 'RF-29.3 · la novedad no existe, no es visible o no puedes resolverla.';
  end if;
  return cuando;
end;
$$;

comment on function public.resolve_announcement(uuid) is
  'HU-29 · RF-29.3 · marca una novedad como resuelta, una sola vez; deja de contar como alerta (HU-21).';

revoke execute on function public.resolve_announcement(uuid) from public, anon;
grant execute on function public.resolve_announcement(uuid) to authenticated, service_role;

-- ── RF-31.1 · RF-31.3 · el comunicado global ────────────────────────────────
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  -- RF-31.1 · el segmento tal como se declaró: todos, por roles o por propiedad.
  segment_kind text not null,
  segment_roles public.app_role[],
  segment_property_id uuid references public.properties (id) on delete set null,
  -- RF-31.3 · cuántas cuentas lo recibieron, resuelto al enviar.
  recipient_count integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),

  constraint broadcasts_titulo check (btrim(title) <> '' and length(title) <= 120),
  constraint broadcasts_cuerpo check (btrim(body) <> '' and length(body) <= 4000),
  constraint broadcasts_segmento_valido check (segment_kind in ('all', 'roles', 'property')),
  -- RF-31.1 · solo se segmenta por Administrador, Propietario o Embajador.
  constraint broadcasts_roles_segmentables check (
    segment_roles is null or segment_roles <@ array['property_admin', 'owner', 'ambassador']::public.app_role[]
  ),
  constraint broadcasts_segmento_coherente check (
    (segment_kind = 'all' and segment_roles is null and segment_property_id is null)
    or (segment_kind = 'roles' and coalesce(array_length(segment_roles, 1), 0) > 0 and segment_property_id is null)
    or (segment_kind = 'property' and segment_roles is null and segment_property_id is not null)
  )
);

comment on table public.broadcasts is
  'HU-31 · RF-31.1, RF-31.3 · comunicado global del Superadmin, registrado con su segmento, su fecha y cuántos lo recibieron.';

create index broadcasts_fecha_idx on public.broadcasts (created_at desc);

alter table public.broadcasts enable row level security;
alter table public.broadcasts force row level security;

revoke all on table public.broadcasts from anon, authenticated, service_role;
-- RF-31.3 · enviado, no se edita ni se borra.
grant select, insert on table public.broadcasts to authenticated, service_role;

-- RF-31.4 · solo el Superadmin.
create policy broadcasts_lectura on public.broadcasts for select to authenticated
  using (private.es_superadmin());
create policy broadcasts_envio on public.broadcasts for insert to authenticated
  with check (private.es_superadmin() and created_by = (select auth.uid()));

-- ── RF-31.2 · el segmento resuelto a cuentas, sin duplicados ni suspendidas ──
-- Espejo SQL de `destinatariosDeComunicado`.
create or replace function private.destinatarios_de_comunicado(tipo text, roles public.app_role[], propiedad uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct pr.id order by pr.id), '{}'::uuid[])
    from public.profiles pr
   where pr.status = 'active'
     and (
       tipo = 'all'
       or (tipo = 'roles' and exists (
             select 1 from public.user_roles ur where ur.user_id = pr.id and ur.role = any (roles)))
       or (tipo = 'property' and (
             exists (select 1 from public.fractions f where f.property_id = propiedad and f.owner_id = pr.id)
             or exists (select 1 from public.property_admins pa where pa.property_id = propiedad and pa.admin_id = pr.id and pa.revoked_at is null)))
     );
$$;

comment on function private.destinatarios_de_comunicado(text, public.app_role[], uuid) is
  'HU-31 · RF-31.2 · resuelve el segmento de un comunicado a cuentas activas concretas, una vez cada una.';

create or replace function private.preparar_comunicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.title := btrim(new.title);
  new.body := btrim(new.body);
  new.recipient_count := coalesce(array_length(
    private.destinatarios_de_comunicado(new.segment_kind, new.segment_roles, new.segment_property_id), 1), 0);
  return new;
end;
$$;

create trigger broadcasts_preparados
  before insert on public.broadcasts
  for each row execute function private.preparar_comunicado();

-- RF-31.3 · el envío sale por TR-03; por propiedad, queda ligado a ella para el filtro de la bandeja.
create or replace function private.notificar_comunicado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.emitir_notificacion(
    'broadcast', 'broadcast', new.id::text, new.segment_property_id,
    jsonb_build_object('title', new.title, 'body', new.body, 'segment_kind', new.segment_kind, 'broadcast_id', new.id),
    private.destinatarios_de_comunicado(new.segment_kind, new.segment_roles, new.segment_property_id)
  );
  return new;
end;
$$;

create trigger broadcasts_emitidos
  after insert on public.broadcasts
  for each row execute function private.notificar_comunicado();

-- TR-01 · el envío deja registro.
create trigger broadcasts_auditados
  after insert on public.broadcasts
  for each row execute function public.registrar_auditoria('broadcast');
