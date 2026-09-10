#!/usr/bin/env bash
# Datos de desarrollo para el Supabase LOCAL: cuentas por rol y propiedades.
#
# El volumen local se pierde cada vez que se recrea el contenedor, y con él las
# cuentas y las propiedades con las que se prueba cada rol. Este script lo vuelve
# a dejar como estaba, sin tocar ningún proyecto de la nube: si la API de Auth no
# es la de localhost, aborta.
#
# El reparto de propiedades es deliberado: dos son del Administrador y una no es
# de nadie, para que se vea que el Superadmin las ve todas sin excepción.
#
# Uso:  ./scripts/datos-locales.sh            (contraseña por defecto)
#       ARENA_DEV_PASSWORD='otra' ./scripts/datos-locales.sh
set -euo pipefail

API="${SUPABASE_URL:-http://127.0.0.1:54321}"
PASSWORD="${ARENA_DEV_PASSWORD:-Arena2026!}"
CONTENEDOR="${SUPABASE_DB_CONTAINER:-supabase_db_arena-property}"

case "$API" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "Solo para el Supabase local. API recibida: $API" >&2; exit 1 ;;
esac

CLAVE="$(pnpm exec supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"')"
[ -n "$CLAVE" ] || { echo "Supabase local sin arrancar: pnpm db:start" >&2; exit 1; }

# `< /dev/null` es obligatorio: si no, psql se come la lista de cuentas del bucle.
# `-q` también: sin él, un `insert ... returning id` devuelve el identificador con
# la línea «INSERT 0 1» pegada detrás y deja de ser un uuid.
sql() { docker exec -i "$CONTENEDOR" psql -U postgres -q -v ON_ERROR_STOP=1 -Atc "$1" < /dev/null; }

# Crea la cuenta si falta y devuelve su id.
cuenta() {
  local correo="$1" nombre="$2" id
  id="$(sql "select id from auth.users where email = \$\$$correo\$\$;")"
  if [ -z "$id" ]; then
    id="$(curl -sS -X POST "$API/auth/v1/admin/users" \
      -H "apikey: $CLAVE" -H "Authorization: Bearer $CLAVE" -H 'Content-Type: application/json' \
      -d "{\"email\":\"$correo\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$nombre\"}}" \
      < /dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))')"
    [ -n "$id" ] || { echo "No se pudo crear $correo" >&2; exit 1; }
  else
    curl -sS -o /dev/null -X PUT "$API/auth/v1/admin/users/$id" \
      -H "apikey: $CLAVE" -H "Authorization: Bearer $CLAVE" -H 'Content-Type: application/json' \
      -d "{\"password\":\"$PASSWORD\",\"email_confirm\":true}" < /dev/null
  fi
  sql "update public.profiles set full_name = \$\$$nombre\$\$ where id = \$\$$id\$\$;" > /dev/null
  echo "$id"
}

# El disparador de alta ya concede 'user'; aquí solo se suma el rol de la prueba.
rol() {
  [ "$2" = 'user' ] && return 0
  sql "insert into public.user_roles (user_id, role) values (\$\$$1\$\$, \$\$$2\$\$) on conflict do nothing;" > /dev/null
}

printf '%-26s %-16s %s\n' CORREO ROL CONTRASEÑA
while IFS='|' read -r correo nombre papel; do
  id="$(cuenta "$correo" "$nombre")"
  rol "$id" "$papel"
  printf '%-26s %-16s %s\n' "$correo" "$papel" "$PASSWORD"
done <<'CUENTAS'
superadmin@arena.local|Superadmin Arena|superadmin
admin@arena.local|Administrador de Propiedad|property_admin
propietario@arena.local|Copropietario Arena|owner
embajador@arena.local|Embajador Arena|ambassador
usuario@arena.local|Usuario Arena|user
CUENTAS

# ── Propiedades de prueba ────────────────────────────────────────────────────
#
# Se ejecuta como `postgres` y sin sesión: los disparadores que exigen que el
# estado de la fracción y el interruptor de calendario los derive el plan de
# pagos (HU-58) solo se aplican cuando hay `auth.uid()`, así que aquí se puede
# dejar la propiedad ya vendida y con el calendario activo.
ADMIN="$(sql "select id from auth.users where email = \$\$admin@arena.local\$\$;")"
DUENO="$(sql "select id from auth.users where email = \$\$propietario@arena.local\$\$;")"

sembrar_propiedad() {
  local nombre="$1" region="$2" ciudad="$3" babosa="$4" admin="$5" id
  id="$(sql "select id from public.properties where slug = \$\$$babosa\$\$;")"
  if [ -z "$id" ]; then
    id="$(sql "
      insert into public.properties
        (name, slug, description, area_m2, bedrooms, bathrooms, parking_spots, amenities,
         country, region, city, address, visibility, coming_soon)
      values
        (\$\$$nombre\$\$, \$\$$babosa\$\$, \$\$Propiedad de prueba para el entorno local.\$\$,
         180, 4, 3, 2, array['piscina','wifi','parrilla'],
         'CO', \$\$$region\$\$, \$\$$ciudad\$\$, \$\$Calle 1 # 2-3\$\$, 'published', false)
      returning id;")"
  fi
  # Las ocho fracciones se crean aparte: si una corrida anterior dejó la propiedad
  # a medias, la siguiente la completa en vez de darla por buena.
  if [ "$(sql "select count(*) from public.fractions where property_id = \$\$$id\$\$;")" = '0' ]; then
    sql "select public.fraccionar_propiedad(\$\$$id\$\$, array[120000000]::bigint[]);" > /dev/null
  fi
  if [ -n "$admin" ]; then
    sql "insert into public.property_admins (admin_id, property_id)
         select \$\$$admin\$\$, \$\$$id\$\$
         where not exists (select 1 from public.property_admins
                           where admin_id = \$\$$admin\$\$ and property_id = \$\$$id\$\$ and revoked_at is null);" > /dev/null
  fi
  echo "$id"
}

CASA="$(sembrar_propiedad 'Casa Arena Guatapé'      'Antioquia' 'Guatapé'     'casa-arena-guatape'      "$ADMIN")"
VILLA="$(sembrar_propiedad 'Villa Arena Santa Marta' 'Magdalena' 'Santa Marta' 'villa-arena-santa-marta' "$ADMIN")"
REFUGIO="$(sembrar_propiedad 'Refugio Arena Salento' 'Quindío'   'Salento'     'refugio-arena-salento'   '')"

# Dos fracciones de la casa ya son del Copropietario, con derecho de uso activo.
# La venta pasa por «reservada»: el disparador de transiciones no admite el salto
# directo desde «disponible», tenga o no sesión quien escribe.
sql "update public.fractions set status = 'reserved'
     where property_id = \$\$$CASA\$\$ and number in (1, 2) and status = 'available';" > /dev/null
sql "update public.fractions
     set status = 'sold', owner_id = \$\$$DUENO\$\$, calendar_active = true,
         calendar_activated_at = coalesce(calendar_activated_at, now())
     where property_id = \$\$$CASA\$\$ and number in (1, 2) and status = 'reserved';" > /dev/null

echo
printf '%-26s %-12s %s\n' PROPIEDAD FRACCIONES ADMINISTRA
sql "select p.name || '|' || count(f.id) || '|' ||
            coalesce(string_agg(distinct a.email, ', '), 'sin administrador')
     from public.properties p
     left join public.fractions f on f.property_id = p.id
     left join public.property_admins pa on pa.property_id = p.id and pa.revoked_at is null
     left join auth.users a on a.id = pa.admin_id
     group by p.id, p.name order by p.name;" | while IFS='|' read -r n c adm; do
  printf '%-26s %-12s %s\n' "$n" "$c" "$adm"
done

# ── Un calendario ya abierto, para ver la ventana de reubicación ─────────────
#
# La ventana de HU-59 reubica semanas ya elegidas, así que la pantalla solo la
# muestra cuando la selección está abierta. Sin un calendario en ese punto no hay
# forma de probarla: la Villa queda con sus ocho fracciones vendidas, la rejilla
# clasificada según el criterio (8 altas, 8 media-altas, 8 medias y el resto
# bajas) y los turnos abiertos.
SUPER="$(sql "select id from auth.users where email = \$\$superadmin@arena.local\$\$;")"
ANIO="$(sql "select (extract(year from now()) + 1)::int;")"

sql "update public.fractions set status = 'reserved'
     where property_id = \$\$$VILLA\$\$ and status = 'available';" > /dev/null
sql "update public.fractions
     set status = 'sold', owner_id = \$\$$DUENO\$\$, calendar_active = true,
         calendar_activated_at = coalesce(calendar_activated_at, now())
     where property_id = \$\$$VILLA\$\$ and status = 'reserved';" > /dev/null

if [ "$(sql "select count(*) from public.season_calendars
             where property_id = \$\$$VILLA\$\$ and year = $ANIO;")" = '0' ]; then
  # Se actúa como el Superadmin: `guardar_calendario` y `open_calendar_selection`
  # exigen sesión, y sin ella `puede_gestionar_propiedad` dice que no.
  sql "begin;
       set local role authenticated;
       set local request.jwt.claim.sub = \$\$$SUPER\$\$;
       select public.guardar_calendario(
         \$\$$VILLA\$\$::uuid, $ANIO, $ANIO,
         \$\${\"alta\":1,\"media_alta\":1,\"media\":1,\"baja\":3}\$\$::jsonb,
         (select jsonb_agg(jsonb_build_object(
                   'index', n,
                   'starts_on', inicio,
                   'ends_on', inicio + 7,
                   'season', case when n < 8 then 'alta'
                                  when n < 16 then 'media_alta'
                                  when n < 24 then 'media'
                                  else 'baja' end,
                   'peak_block', null) order by n)
          from (select row_number() over (order by d) - 1 as n, d::date as inicio
                  from generate_series(
                         make_date($ANIO, 1, 1)
                           + ((6 - extract(dow from make_date($ANIO, 1, 1))::int + 7) % 7),
                         make_date($ANIO, 12, 31) - 6,
                         interval '7 day') as d) as rejilla));
       commit;" > /dev/null
  sql "begin;
       set local role authenticated;
       set local request.jwt.claim.sub = \$\$$SUPER\$\$;
       select public.open_calendar_selection(
         (select id from public.season_calendars
           where property_id = \$\$$VILLA\$\$ and year = $ANIO));
       commit;" > /dev/null
fi

echo
sql "select 'Calendario ' || p.name || ' ' || c.year || ': ' ||
            case when c.published_at is null then 'sin abrir'
                 else 'selección abierta con ' ||
                      (select count(*) from public.selection_turns t where t.calendar_id = c.id) || ' turnos' end
     from public.season_calendars c join public.properties p on p.id = c.property_id
     order by p.name;"

# ── Catálogo de tipos de comisión (HU-52 · D-37) ────────────────────────────
#
# Tres tipos para tener con qué probar la asignación: el Base queda como
# predeterminado por ser el primero que entra.
if [ "$(sql "select count(*) from public.commission_types;")" = '0' ]; then
  sql "begin;
       set local role authenticated;
       set local request.jwt.claim.sub = \$\$$SUPER\$\$;
       select public.create_commission_type(\$\$Base\$\$, 'percentage', null, 300);
       select public.create_commission_type(\$\$Premium\$\$, 'percentage', null, 500);
       select public.create_commission_type(\$\$Bono de lanzamiento\$\$, 'fixed', 1500000, null);
       commit;" > /dev/null
fi

echo
sql "select 'Comisión ' || name || ': ' ||
            case when kind = 'fixed' then to_char(amount, 'FM999G999G999') || ' COP'
                 else trim(trailing '.' from to_char(basis_points / 100.0, 'FM990D99')) || ' %' end ||
            case when is_default then ' (predeterminado)' else '' end
     from public.commission_types order by name;"
