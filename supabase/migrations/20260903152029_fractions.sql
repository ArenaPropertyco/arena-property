-- HU-09 · RF-09.1…RF-09.5 y HU-10 · RF-10.1, RF-10.3 — las 8 fracciones y la vista global.
--
-- Cinco decisiones que conviene leer antes que el código:
--
-- 1. **Ocho, siempre (RF-09.3).** La numeración única y el rango 1..8 impiden la
--    novena y la repetida; que no queden siete lo impide un disparador de restricción
--    **diferido**, que se evalúa al confirmar la transacción. Es la única forma de
--    exigir un cardinal exacto: durante el `insert` de las ocho filas, las siete
--    primeras dejan la propiedad incompleta y una comprobación inmediata las
--    rechazaría.
--
-- 2. **`sold` es terminal salvo para el Superadmin.** La única vía de vuelta es
--    D-17 (traspaso) y D-31 (anulación de compra), y las dos son suyas.
--
-- 3. **`calendar_active` no se marca a mano (D-31, DT-04).** Es el derecho de uso y
--    lo deriva el plan de pagos (HU-58 · RF-58.7). Hasta que esa historia llegue,
--    ninguna sesión con JWT puede tocarlo: se rechaza en disparador.
--
-- 4. **El estado comercial no se almacena.** `property_overview` lo deriva de las
--    fracciones cada vez que se consulta, así que no puede desincronizarse de los
--    hechos. Es la misma regla que `shared/properties/estados.ts`.
--
-- 5. **El traspaso escribe su propia auditoría.** El disparador genérico copia la
--    fila, y la fila no contiene el destino de las reservas ni el de las cuotas, que
--    es justo lo que RF-09.5 exige dejar registrado.

create type public.fraction_status as enum ('available', 'reserved', 'sold');

create table public.fractions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,

  -- RF-09.1 · 1/8…8/8, única por propiedad y no editable.
  number smallint not null,

  -- TR-02 · RF-D.1 · el dinero es entero de pesos; nunca punto flotante.
  list_price bigint not null,

  status public.fraction_status not null default 'available',
  -- D-31 · eje 1: titularidad. La da el cierre de la compra (HU-06).
  owner_id uuid references auth.users (id),
  -- D-31 · eje 2: derecho de uso. Lo deriva el plan de pagos (HU-58).
  calendar_active boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fractions_numero_en_rango check (number between 1 and 8),
  constraint fractions_numero_unico unique (property_id, number),
  constraint fractions_precio_positivo check (list_price > 0),
  -- Solo una fracción vendida tiene titular: reservar no otorga titularidad.
  constraint fractions_titular_solo_si_vendida check (status = 'sold' or owner_id is null),
  -- Sin titular no hay derecho de uso que activar.
  constraint fractions_calendario_exige_titular check (not calendar_active or owner_id is not null)
);

comment on table public.fractions is
  'HU-09 · las 8 fracciones de una propiedad, con precio, estado, titular e interruptor de calendario (D-31).';
comment on column public.fractions.calendar_active is
  'D-31 · derecho de uso. Lo deriva el plan de pagos (HU-58 · RF-58.7); no se marca a mano.';

create index fractions_property_idx on public.fractions (property_id);
create index fractions_owner_idx on public.fractions (owner_id) where owner_id is not null;

alter table public.fractions enable row level security;
alter table public.fractions force row level security;

-- Sin DELETE para nadie: una fracción no desaparece, cambia de estado (RF-09.2).
revoke all on table public.fractions from anon, authenticated, service_role;
grant select on table public.fractions to anon;
grant select, insert, update on table public.fractions to authenticated, service_role;

-- ── Políticas ───────────────────────────────────────────────────────────────
-- El catálogo público necesita el conteo de disponibles del detalle (HU-02 · RF-09.4).
create policy fractions_lectura_publica
  on public.fractions for select to anon, authenticated
  using (private.propiedad_publicada(property_id));

create policy fractions_lectura_gestion
  on public.fractions for select to authenticated
  using (private.puede_gestionar_propiedad(property_id));

-- D-16 · el titular ve la suya aunque la propiedad no esté publicada.
create policy fractions_lectura_titular
  on public.fractions for select to authenticated
  using (owner_id = (select auth.uid()));

create policy fractions_creacion
  on public.fractions for insert to authenticated
  with check (private.puede_gestionar_propiedad(property_id));

create policy fractions_edicion
  on public.fractions for update to authenticated
  using (private.puede_gestionar_propiedad(property_id))
  with check (private.puede_gestionar_propiedad(property_id));

-- ── RF-09.3 · ni 7 ni 9: el cardinal se comprueba al confirmar ──────────────
create or replace function private.validar_cardinal_de_fracciones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  propiedad uuid := coalesce(new.property_id, old.property_id);
  cuantas integer;
begin
  -- La propiedad pudo borrarla el Superadmin en esta misma transacción: sin
  -- propiedad no hay cardinal que exigir.
  if not exists (select 1 from public.properties where id = propiedad) then
    return null;
  end if;

  select count(*) into cuantas from public.fractions where property_id = propiedad;

  if cuantas <> 8 then
    raise exception 'Una propiedad se divide en exactamente 8 fracciones; esta quedó con %.', cuantas;
  end if;

  return null;
end;
$$;

create constraint trigger fractions_cardinal
  after insert or delete on public.fractions
  deferrable initially deferred
  for each row execute function private.validar_cardinal_de_fracciones();

-- ── RF-09.2 · máquina de estados de la fracción ─────────────────────────────
-- La misma tabla que `shared/properties/fracciones.ts`. Allí da el mensaje al
-- formulario; aquí impide que una ruta nueva o el Studio dejen un estado imposible.
create or replace function private.validar_transicion_de_fraccion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Nombres distintos a los de las funciones: una variable llamada `es_superadmin`
  -- eclipsa a `private.es_superadmin()` y la llamada deja de resolver.
  manda_superadmin boolean := private.es_superadmin();
  hay_sesion boolean := (select auth.uid()) is not null;
begin
  -- RF-09.1 · la numeración no es editable, y la fracción no cambia de propiedad.
  if new.number <> old.number or new.property_id <> old.property_id then
    raise exception 'Ni el número ni la propiedad de una fracción se editan.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'available' and new.status = 'reserved')
      or (old.status = 'reserved' and new.status in ('available', 'sold'))
      -- Única salida del estado terminal, y solo del Superadmin (D-17, D-31).
      or (old.status = 'sold' and new.status = 'available' and manda_superadmin)
    ) then
      raise exception 'Transición de fracción inválida: % → %.', old.status, new.status;
    end if;
  end if;

  -- RF-09.5 · D-17 · cambiar el titular de una fracción vendida es del Superadmin.
  if new.owner_id is distinct from old.owner_id
     and old.status = 'sold' and new.status = 'sold'
     and hay_sesion and not manda_superadmin then
    raise exception 'Solo el Superadmin traspasa el titular de una fracción vendida.';
  end if;

  -- D-31 · DT-04 · el derecho de uso lo deriva el plan de pagos, no una edición.
  -- Sin JWT (disparadores del sistema, rutas de servidor) no se interpone: ahí ya no
  -- hay cliente a quien impedirle marcarlo a mano.
  if new.calendar_active is distinct from old.calendar_active and hay_sesion then
    raise exception 'El interruptor de calendario se deriva del plan de pagos (HU-58); no se marca a mano.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger fractions_validar_transicion
  before update on public.fractions
  for each row execute function private.validar_transicion_de_fraccion();

-- ── RF-09.3 · fraccionamiento atómico ───────────────────────────────────────
-- `SECURITY INVOKER`: la RLS de `fractions` sigue decidiendo si quien llama puede
-- crearlas. La función no concede nada, solo garantiza que las ocho entran juntas.
create or replace function public.fraccionar_propiedad(propiedad uuid, precios bigint[])
returns setof public.fractions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  lista bigint[];
begin
  -- Un precio único vale para las ocho; ocho precios, uno por fracción en orden.
  if array_length(precios, 1) = 1 then
    lista := array_fill(precios[1], array[8]);
  else
    lista := precios;
  end if;

  if array_length(lista, 1) is distinct from 8 then
    raise exception 'Una propiedad se divide en exactamente 8 fracciones; llegaron % precios.',
      coalesce(array_length(lista, 1), 0);
  end if;

  return query
    insert into public.fractions (property_id, number, list_price)
    select propiedad, numero, lista[numero]
    from generate_series(1, 8) as numero
    returning *;
end;
$$;

comment on function public.fraccionar_propiedad(uuid, bigint[]) is
  'HU-09 · RF-09.3 · crea las 8 fracciones de una propiedad en una sola operación.';

revoke execute on function public.fraccionar_propiedad(uuid, bigint[]) from public, anon;
grant execute on function public.fraccionar_propiedad(uuid, bigint[]) to authenticated, service_role;

-- ── RF-08.3 · RF-09.4 · el estado comercial derivado, sin almacenarse ───────
create or replace function public.estado_comercial(propiedad uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.coming_soon then 'coming_soon'
    when count(f.id) <> 8 then null
    when count(f.id) filter (where f.status = 'sold') = 8 then 'sold_out'
    else 'fractions_available'
  end
  from public.properties p
  left join public.fractions f on f.property_id = p.id
  where p.id = propiedad
  group by p.id, p.coming_soon;
$$;

comment on function public.estado_comercial(uuid) is
  'HU-08 · RF-08.3 · D-18 · estado comercial derivado de las 8 fracciones. `null` mientras la propiedad no esté fraccionada.';

revoke execute on function public.estado_comercial(uuid) from public;
grant execute on function public.estado_comercial(uuid) to anon, authenticated, service_role;

-- RF-08.3 · salir de «Próximamente» exige estar fraccionada: sin las 8 no hay nada
-- que derivar, y la propiedad quedaría sin estado comercial.
create or replace function private.validar_salida_de_proximamente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.coming_soon and not new.coming_soon
     and (select count(*) from public.fractions where property_id = new.id) <> 8 then
    raise exception 'Una propiedad sale de «Próximamente» solo cuando tiene sus 8 fracciones.';
  end if;

  return new;
end;
$$;

create trigger properties_validar_salida_proximamente
  before update on public.properties
  for each row execute function private.validar_salida_de_proximamente();

-- ── HU-10 · RF-10.1 · la vista global, con los estados ya derivados ─────────
-- `security_invoker`: la vista no es una puerta trasera. Cada quien ve por ella
-- exactamente las filas que su RLS le deja ver en `properties` (RF-10.3).
create view public.property_overview
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.region,
  p.city,
  p.country,
  p.visibility,
  p.coming_soon,
  p.created_by,
  p.created_at,
  case
    when p.coming_soon then 'coming_soon'
    when count(f.id) <> 8 then null
    when count(f.id) filter (where f.status = 'sold') = 8 then 'sold_out'
    else 'fractions_available'
  end as commercial_status,
  count(f.id) as fraction_count,
  count(f.id) filter (where f.status = 'available') as available_fractions,
  count(f.id) filter (where f.status = 'sold') as sold_fractions,
  min(f.list_price) filter (where f.status = 'available') as lowest_available_price
from public.properties p
left join public.fractions f on f.property_id = p.id
group by p.id;

comment on view public.property_overview is
  'HU-10 · RF-10.1 · propiedades con su estado comercial derivado y el conteo de fracciones. RLS de properties por security_invoker.';

-- Las vistas nacen con los privilegios por omisión del esquema `public`, que en
-- Supabase incluyen escritura. Se cierra y se abre solo la lectura.
revoke all on public.property_overview from anon, authenticated, service_role;
grant select on public.property_overview to anon, authenticated, service_role;

-- ── RF-09.5 · D-17 · traspaso de titular, auditado con sus dos destinos ─────
insert into public.audit_reason_required (action, source) values
  ('fraction.transferida', 'HU-09')
on conflict (action) do nothing;

create or replace function public.traspasar_fraccion(
  fraccion uuid,
  nuevo_titular uuid,
  destino_reservas text,
  destino_cuotas text,
  motivo text
)
returns public.fractions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actual public.fractions;
  resultado public.fractions;
begin
  if not private.es_superadmin() then
    raise exception 'Solo el Superadmin traspasa el titular de una fracción.';
  end if;

  select * into actual from public.fractions where id = fraccion;
  if not found then
    raise exception 'La fracción no existe o no es visible para esta cuenta.';
  end if;

  if actual.status <> 'sold' then
    raise exception 'Solo se traspasa una fracción vendida; esta está %.', actual.status;
  end if;
  if nuevo_titular is null or nuevo_titular = actual.owner_id then
    raise exception 'El nuevo titular debe existir y ser distinto del actual.';
  end if;
  if destino_reservas is null or destino_reservas not in ('transfer', 'cancel') then
    raise exception 'El destino de las reservas debe decidirse: transfer o cancel.';
  end if;
  if destino_cuotas is null or destino_cuotas not in ('transfer', 'settle_with_previous') then
    raise exception 'El destino de las cuotas debe decidirse: transfer o settle_with_previous.';
  end if;
  if length(btrim(coalesce(motivo, ''))) = 0 then
    raise exception 'RF-A.4 · el traspaso de una fracción no se registra sin motivo.';
  end if;

  perform set_config('app.audit_reason', motivo, true);

  update public.fractions
     set owner_id = nuevo_titular
   where id = fraccion
  returning * into resultado;

  -- El disparador genérico ya dejó `fraction.actualizada` con el cambio de titular.
  -- Esta entrada añade lo que la fila no contiene y RF-09.5 exige: qué se decidió
  -- sobre las semanas confirmadas y sobre las cuotas pendientes.
  insert into public.audit_log (
    actor_id, actor_role, action, entity_type, entity_id, property_id,
    reason, previous_state, next_state
  )
  values (
    (select auth.uid()), 'superadmin', 'fraction.transferida', 'fraction',
    fraccion, actual.property_id, motivo,
    jsonb_build_object('owner_id', actual.owner_id),
    jsonb_build_object(
      'owner_id', nuevo_titular,
      'bookings_destination', destino_reservas,
      'installments_destination', destino_cuotas
    )
  );

  perform set_config('app.audit_reason', '', true);

  return resultado;
end;
$$;

comment on function public.traspasar_fraccion(uuid, uuid, text, text, text) is
  'HU-09 · RF-09.5 · D-17 · traspaso de titular por el Superadmin, con destino explícito de reservas y cuotas.';

revoke execute on function public.traspasar_fraccion(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.traspasar_fraccion(uuid, uuid, text, text, text) to authenticated, service_role;

-- ── TR-01 · RF-A.3 · toda la vida de la fracción queda auditada ─────────────
create trigger fractions_auditada
  after insert or update or delete on public.fractions
  for each row execute function public.registrar_auditoria('fraction');
