-- HU-08 · RF-08.1, RF-08.2, RF-08.5, RF-08.6 y HU-11 · RF-11.1, RF-11.2 —
-- la propiedad, sus medios y quién puede tocarlos.
--
-- Cuatro decisiones que conviene leer antes que el código:
--
-- 1. **Dos ejes de estado que no se mezclan (D-18).** `visibility` dice quién la ve;
--    el eje comercial dice si está a la venta. Del comercial solo se guarda lo único
--    que es una decisión humana —«Próximamente», aquí `coming_soon`—; `Fracciones
--    disponibles` y `Vendido` se **derivan** de las 8 fracciones y no se almacenan
--    (DT-04: nada de estados marcados a mano que puedan desincronizarse). La vista
--    `property_overview` los expone; la migración de HU-09 la completa.
--
-- 2. **No hay borrado para el Administrador (RF-11.2).** La baja es lógica:
--    `inactive`. El Superadmin sí conserva DELETE porque la matriz de permisos de
--    HU-07 le da `eliminar_propiedades`; el Administrador no tiene ni política ni
--    forma de llegar a ella.
--
-- 3. **El bucket de medios es privado (RF-08.5).** Las fotos de un borrador no
--    pueden quedar accesibles a quien adivine la URL. La lectura se abre a cualquiera
--    solo cuando la propiedad está `published`; el cliente pide una URL firmada, y
--    poder firmarla ya depende de esta misma política.
--
-- 4. **La carpeta raíz del objeto es la propiedad.** La política de Storage decide
--    por ahí, así que la ruta la construye `shared/properties/medios.ts` con el
--    nombre saneado: un `../` en el nombre del archivo sacaría el objeto de su
--    carpeta y la política dejaría de acotar.

-- ── Tipos ───────────────────────────────────────────────────────────────────
create type public.property_visibility as enum ('draft', 'published', 'inactive');
create type public.property_media_kind as enum ('photo', 'video', 'floor_plan');

-- ── Ficha técnica (RF-08.1) ─────────────────────────────────────────────────
create table public.properties (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  description text not null,

  -- Los m² admiten decimales; las cuentas son enteros no negativos (un estudio
  -- tiene 0 habitaciones y una propiedad sin garaje, 0 estacionamientos).
  area_m2 numeric(10, 2) not null,
  bedrooms smallint not null default 0,
  bathrooms smallint not null default 0,
  parking_spots smallint not null default 0,

  amenities text[] not null default '{}',

  -- Ubicación. `region` alimenta el filtro de la vista global (RF-10.2), así que no
  -- es opcional; la dirección exacta sí, porque no toda propiedad la publica.
  country char(2) not null,
  region text not null,
  city text not null,
  address text,

  video_url text,

  visibility public.property_visibility not null default 'draft',
  -- D-18 · lo único manual del eje comercial. Al apagarse, manda la derivación.
  coming_soon boolean not null default true,

  -- RF-08.6 · el Administrador que la creó.
  created_by uuid references auth.users (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint properties_name_no_vacio check (length(btrim(name)) > 0),
  constraint properties_description_no_vacia check (length(btrim(description)) > 0),
  constraint properties_area_positiva check (area_m2 > 0),
  constraint properties_conteos_no_negativos check (
    bedrooms >= 0 and bathrooms >= 0 and parking_spots >= 0
  ),
  constraint properties_ubicacion_completa check (
    length(btrim(country)) = 2 and length(btrim(region)) > 0 and length(btrim(city)) > 0
  ),
  -- Solo http(s): un `javascript:` guardado aquí acabaría en un atributo `src`.
  constraint properties_video_url_valida check (
    video_url is null or video_url ~ '^https?://'
  )
);

comment on table public.properties is
  'HU-08 · ficha técnica de la propiedad con sus dos ejes de estado (D-18). Sin borrado para el Administrador (RF-11.2).';
comment on column public.properties.coming_soon is
  'D-18 · «Próximamente»: lo único del eje comercial que se marca a mano. Lo demás se deriva de las fracciones.';

create index properties_visibility_idx on public.properties (visibility);
create index properties_region_idx on public.properties (region);

-- ── Medios: fotos, video y plano elevado (RF-08.5) ──────────────────────────
create table public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  kind public.property_media_kind not null,
  -- Ruta del objeto dentro del bucket; su primera carpeta es `property_id`.
  path text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),

  constraint property_media_path_no_vacia check (length(btrim(path)) > 0),
  constraint property_media_orden_no_negativo check (sort_order >= 0),
  constraint property_media_path_unica unique (path)
);

comment on table public.property_media is
  'HU-08 · RF-08.5 · fotos, video y plano de cada propiedad, en el bucket property-media.';

create index property_media_propiedad_idx on public.property_media (property_id, kind, sort_order);

-- La asignación de HU-05 ya puede apuntar a la tabla real: su migración dejó dicho
-- que la clave foránea llegaba con HU-08.
alter table public.property_admins
  add constraint property_admins_property_fk
  foreign key (property_id) references public.properties (id) on delete cascade;

-- ── Permisos de tabla ───────────────────────────────────────────────────────
alter table public.properties enable row level security;
alter table public.properties force row level security;
alter table public.property_media enable row level security;
alter table public.property_media force row level security;

revoke all on table public.properties from anon, authenticated, service_role;
revoke all on table public.property_media from anon, authenticated, service_role;

-- El catálogo público (HU-01) lee sin sesión; `anon` no escribe nada.
grant select on table public.properties to anon;
grant select on table public.property_media to anon;
-- RF-11.2 · `delete` se concede, pero la política solo lo abre al Superadmin.
grant select, insert, update, delete on table public.properties to authenticated, service_role;
grant select, insert, update, delete on table public.property_media to authenticated, service_role;

-- ── Predicados de acceso, en un solo sitio ──────────────────────────────────
create or replace function private.puede_gestionar_propiedad(propiedad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.es_superadmin() or private.administra_propiedad(propiedad);
$$;

comment on function private.puede_gestionar_propiedad(uuid) is
  'HU-08/HU-11 · quién edita una propiedad: el Superadmin o su Administrador asignado.';

create or replace function private.propiedad_publicada(propiedad uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.properties
    where id = propiedad and visibility = 'published'
  );
$$;

comment on function private.propiedad_publicada(uuid) is
  'HU-08 · RF-08.2 · si la propiedad está en el catálogo público. SECURITY DEFINER para no recursar sobre la RLS de properties.';

revoke execute on function
  private.puede_gestionar_propiedad(uuid), private.propiedad_publicada(uuid)
from public, anon;
grant execute on function
  private.puede_gestionar_propiedad(uuid), private.propiedad_publicada(uuid)
to authenticated, service_role;

-- El catálogo se lee sin sesión, así que `anon` necesita el predicado de «está
-- publicada» para las políticas de medios y de Storage. Se le abre esa función y
-- nada más: el esquema `private` sigue fuera de la API (no está en `db.schemas`),
-- y lo único que revela es si una propiedad está en el catálogo, que es público
-- por definición.
grant usage on schema private to anon;
grant execute on function private.propiedad_publicada(uuid) to anon;

-- ── Políticas de properties ─────────────────────────────────────────────────
-- La lectura va en dos políticas y no en una con `or`: son dos reglas distintas
-- —«esto es público» y «esto lo administro yo»— y separadas se prueban y se leen
-- una por una. El asesor de Supabase las marca como «multiple permissive policies»,
-- que es un aviso de rendimiento sobre tablas con muchas políticas; aquí son dos y
-- la claridad de la frontera de seguridad vale más que ese microcosto.
-- CA-08.4 · el borrador no sale del panel de quien lo administra: la exclusión del
-- catálogo no es un filtro de la interfaz, es que la fila no llega.
create policy properties_lectura_publica
  on public.properties for select to anon, authenticated
  using (visibility = 'published');

-- CA-10.1 · el Superadmin ve todo estado y todo administrador; RF-11.1 · el
-- Administrador ve y edita solo lo asignado.
create policy properties_lectura_gestion
  on public.properties for select to authenticated
  using (private.puede_gestionar_propiedad(id));

create policy properties_creacion
  on public.properties for insert to authenticated
  with check (private.es_superadmin() or private.tiene_rol('property_admin'));

-- CA-11.3 · un Administrador sin la propiedad asignada no la edita: `using` no le
-- muestra la fila y `with check` le impide dejarla en un estado que no podría leer.
create policy properties_edicion
  on public.properties for update to authenticated
  using (private.puede_gestionar_propiedad(id))
  with check (private.puede_gestionar_propiedad(id));

-- CA-11.1 · RF-11.2 · el Administrador no borra. El Superadmin sí, porque la matriz
-- de HU-07 le da `eliminar_propiedades`; para el Administrador la baja es `inactive`.
create policy properties_borrado_superadmin
  on public.properties for delete to authenticated
  using (private.es_superadmin());

-- ── Políticas de property_media ─────────────────────────────────────────────
create policy property_media_lectura_publica
  on public.property_media for select to anon, authenticated
  using (private.propiedad_publicada(property_id));

create policy property_media_lectura_gestion
  on public.property_media for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

create policy property_media_escritura
  on public.property_media for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy property_media_edicion
  on public.property_media for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- Un medio sí se retira: sustituir una foto no borra histórico de negocio.
create policy property_media_borrado
  on public.property_media for delete to authenticated
  using (private.puede_gestionar_propiedad(property_id));

-- ── RF-08.2 · máquina de visibilidad, también en la base ────────────────────
-- La misma tabla de transiciones que `shared/properties/estados.ts`. Vive en los dos
-- sitios a propósito: la de TypeScript da el mensaje al formulario, esta impide que
-- una ruta nueva, un script o el Studio dejen la fila en un estado imposible.
create or replace function private.validar_estados_de_propiedad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.visibility is distinct from old.visibility then
    if not (
      (old.visibility = 'draft' and new.visibility = 'published')
      or (old.visibility = 'published' and new.visibility = 'inactive')
      or (old.visibility = 'inactive' and new.visibility = 'published')
    ) then
      raise exception 'Transición de visibilidad inválida: % → %.', old.visibility, new.visibility;
    end if;
  end if;

  -- RF-08.3 · «Próximamente» es una puerta de salida sin retorno: una vez a la venta,
  -- volver a anunciarla como futura contradice lo que ya vio quien la miraba.
  if tg_op = 'UPDATE' and new.coming_soon and not old.coming_soon then
    raise exception 'Una propiedad que ya salió a la venta no vuelve a «Próximamente».';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger properties_validar_estados
  before update on public.properties
  for each row execute function private.validar_estados_de_propiedad();

-- ── RF-08.6 · la propiedad creada queda asignada a su Administrador creador ──
create or replace function private.asignar_creador_de_propiedad()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  creador uuid := coalesce(new.created_by, (select auth.uid()));
begin
  if creador is null then
    return new;
  end if;

  new.created_by := creador;
  return new;
end;
$$;

comment on function private.asignar_creador_de_propiedad() is
  'HU-08 · RF-08.6 · deja constancia de qué cuenta creó la propiedad.';

-- La asignación va en un disparador `after` y no en el anterior: referencia
-- `properties.id`, que solo existe una vez insertada la fila.
--
-- El Superadmin crea propiedades sin quedarse de administrador de ellas: su acceso
-- viene del rol, no de la asignación, y una asignación falsa ensuciaría RF-05.4.
--
-- ⚠️ Consecuencia que hay que conocer antes de escribir un cliente: un
-- `insert ... returning` del Administrador **falla**. La política de lectura
-- depende de la asignación, y la asignación la escribe este disparador dentro de
-- la misma orden, así que la proyección del `returning` todavía no la ve y Postgres
-- responde «new row violates row-level security policy». No es un permiso que falte:
-- la fila se inserta y se lee sin problema en la orden siguiente. Por eso el
-- cliente genera el identificador y no pide la fila de vuelta al insertarla
-- (`app/composables/usePropiedades.ts`). Ampliar la política de lectura a
-- `created_by = auth.uid()` lo taparía, pero dejaría a un Administrador ya retirado
-- viendo el borrador que creó, contra RF-05.3.
create or replace function private.registrar_asignacion_de_creador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null and exists (
    select 1 from public.user_roles where user_id = new.created_by and role = 'property_admin'
  ) then
    insert into public.property_admins (admin_id, property_id, assigned_by)
    values (new.created_by, new.id, new.created_by)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create trigger properties_fijar_creador
  before insert on public.properties
  for each row execute function private.asignar_creador_de_propiedad();

create trigger properties_asignar_creador
  after insert on public.properties
  for each row execute function private.registrar_asignacion_de_creador();

-- ── RF-08.5 · bucket privado de medios ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-media', 'property-media', false, 52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif',
    'video/mp4', 'video/webm',
    'application/pdf', 'model/gltf-binary'
  ]
)
on conflict (id) do nothing;

-- Primera carpeta del objeto → propiedad. `pg_input_is_valid` evita que un nombre
-- con basura en la raíz haga fallar el cast dentro de una política.
create or replace function private.propiedad_de_objeto(ruta text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when pg_input_is_valid((storage.foldername(ruta))[1], 'uuid')
      then ((storage.foldername(ruta))[1])::uuid
    else null
  end;
$$;

revoke execute on function private.propiedad_de_objeto(text) from public;
grant execute on function private.propiedad_de_objeto(text) to anon, authenticated, service_role;

create policy property_media_objetos_lectura
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'property-media'
    and private.propiedad_publicada(private.propiedad_de_objeto(name))
  );

create policy property_media_objetos_lectura_gestion
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-media'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

create policy property_media_objetos_carga
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-media'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

-- Reemplazar una foto exige INSERT + SELECT + UPDATE: sin las tres, el `upsert`
-- falla en silencio.
create policy property_media_objetos_reemplazo
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-media'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  )
  with check (
    bucket_id = 'property-media'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

create policy property_media_objetos_retiro
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-media'
    and private.puede_gestionar_propiedad(private.propiedad_de_objeto(name))
  );

-- ── TR-01 · RF-A.3 · toda la vida de la propiedad queda auditada ────────────
create trigger properties_auditada
  after insert or update or delete on public.properties
  for each row execute function public.registrar_auditoria('property');

create trigger property_media_auditada
  after insert or update or delete on public.property_media
  for each row execute function public.registrar_auditoria('property_media');
