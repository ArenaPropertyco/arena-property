-- HU-02 · RF-02.1 y HU-01 · RF-01.2, RF-01.4 — la propiedad tiene un slug estable
-- para su ficha pública, y la vista `property_overview` expone lo que el catálogo
-- resume: slug, ciudad y ficha técnica corta.
--
-- El slug nace del nombre una sola vez y no cambia al renombrar: la URL que ya se
-- compartió sigue resolviendo. Un nombre repetido recibe sufijo numérico.

-- Con valor por omisión vacío el alta no tiene que enviarlo: el disparador lo rellena.
alter table public.properties add column slug text default '';

-- Sin acentos, sin eñes, solo [a-z0-9-]. `translate` cubre el alfabeto que usan
-- los nombres en español; lo que no reconoce se vuelve guion.
create or replace function private.slug_de(texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(
    lower(translate(coalesce(texto, ''),
      'áéíóúüñàèìòùâêîôûçÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛÇ',
      'aeiouunaeiouaeioucaeiouunaeiouaeiouc')),
    '[^a-z0-9]+', '-', 'g'), '-'), '');
$$;

revoke execute on function private.slug_de(text) from public, anon;
grant execute on function private.slug_de(text) to authenticated, service_role;

create or replace function private.asignar_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := coalesce(private.slug_de(new.name), 'propiedad');
  candidato text := base;
  n integer := 2;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;

  while exists (select 1 from public.properties where slug = candidato and id <> new.id) loop
    candidato := base || '-' || n;
    n := n + 1;
  end loop;

  new.slug := candidato;
  return new;
end;
$$;

create trigger properties_asignar_slug
  before insert or update of slug, name on public.properties
  for each row execute function private.asignar_slug();

-- Las propiedades que ya existen reciben el suyo, una a una y en orden de alta.
do $$
declare
  fila record;
begin
  for fila in select id from public.properties where coalesce(slug, '') = '' order by created_at, id loop
    update public.properties set slug = '' where id = fila.id;
  end loop;
end;
$$;

alter table public.properties alter column slug set not null;
alter table public.properties add constraint properties_slug_unica unique (slug);
alter table public.properties add constraint properties_slug_formato check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

comment on column public.properties.slug is
  'HU-02 · RF-02.1 · identificador estable de la ficha pública; nace del nombre y no cambia al renombrar.';

-- ── La vista pública, con lo que el catálogo resume (RF-01.2, RF-01.4) ──────
drop view public.property_overview;

create view public.property_overview
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.name,
  p.region,
  p.city,
  p.country,
  p.visibility,
  p.coming_soon,
  p.created_by,
  p.created_at,
  p.area_m2,
  p.bedrooms,
  p.bathrooms,
  p.parking_spots,
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
  'HU-10 · RF-10.1 y HU-01 · RF-01.2 · propiedades con slug, ficha corta, estado comercial derivado y conteo de fracciones. RLS de properties por security_invoker.';

revoke all on public.property_overview from anon, authenticated, service_role;
grant select on public.property_overview to anon, authenticated, service_role;
