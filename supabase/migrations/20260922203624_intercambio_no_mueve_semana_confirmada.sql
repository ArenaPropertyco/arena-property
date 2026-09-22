-- HU-12 · RF-12.6, RF-12.9 · CA-12.11 · D-33 — la solicitud de intercambio no
-- nace sobre una semana confirmada o liberada.
--
-- `swap_weeks` ya rechaza mover una semana confirmada o liberada (RF-12.9), pero
-- `request_week_swap` no lo comprobaba: el Propietario podía confirmar su semana
-- y, acto seguido, ofrecerla en un intercambio. La solicitud se guardaba y solo
-- reventaba al aprobarla, dejando al Administrador con una petición imposible que
-- únicamente podía rechazar sin saber por qué.
--
-- La comprobación se adelanta al momento de pedir, con la misma regla y el mismo
-- código, para que el rechazo se explique donde se origina. Que siga en las dos
-- funciones no es duplicar por duplicar: entre pedir y aprobar pasa el tiempo, y
-- una semana puede confirmarse en medio.

create or replace function public.request_week_swap(
  calendar uuid,
  fraction uuid,
  offered_week integer,
  target_fraction integer,
  requested_week integer,
  message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  f public.fractions;
  tf public.fractions;
  wo public.calendar_weeks;
  wr public.calendar_weeks;
  ao public.allocations;
  ar public.allocations;
  request uuid;
begin
  select * into cal from public.season_calendars where id = calendar;
  select * into f from public.fractions where id = fraction;
  if cal.id is null or f.id is null or f.property_id <> cal.property_id or f.owner_id is distinct from (select auth.uid()) then
    raise exception 'CA-12.11 · RF-12.6 · solo el titular de la fracción solicita intercambios.';
  end if;
  select * into tf from public.fractions where property_id = cal.property_id and number = target_fraction;
  if tf.id is null or tf.id = f.id then
    raise exception 'CA-12.11 · RF-12.6 · la otra fracción debe existir y ser distinta.';
  end if;
  select * into wo from public.calendar_weeks where calendar_id = calendar and index = offered_week;
  select * into wr from public.calendar_weeks where calendar_id = calendar and index = requested_week;
  select * into ao from public.allocations where calendar_id = calendar and week_id = wo.id and fraction_id = f.id;
  select * into ar from public.allocations where calendar_id = calendar and week_id = wr.id and fraction_id = tf.id;
  if wo.id is null or ao.id is null then
    raise exception 'CA-12.11 · RF-12.6 · solo se ofrece una semana propia.';
  end if;
  if wr.id is null or ar.id is null then
    raise exception 'CA-12.11 · RF-12.6 · la semana pedida debe ser de la fracción %.', target_fraction;
  end if;
  if wo.season <> wr.season then
    raise exception 'CA-12.11 · RF-12.6 · solo se intercambian semanas de la misma temporada.';
  end if;
  -- RF-12.9 · D-33 · lo mismo que comprueba `swap_weeks` al aplicar: una semana
  -- confirmada o liberada no se mueve, así que tampoco se ofrece ni se pide.
  if ao.confirmed_at is not null or ar.confirmed_at is not null
     or ao.released_at is not null or ar.released_at is not null then
    raise exception 'CA-12.11 · RF-12.9 · alguna de las semanas ya está confirmada o liberada.';
  end if;

  insert into public.week_swap_requests (calendar_id, property_id, requester_fraction_id, offered_week_id, target_fraction_id, requested_week_id, message, created_by)
  values (calendar, cal.property_id, f.id, wo.id, tf.id, wr.id, nullif(btrim(coalesce(message, '')), ''), f.owner_id)
  returning id into request;

  return request;
end;
$$;

comment on function public.request_week_swap(uuid, uuid, integer, integer, integer, text) is
  'HU-12 · RF-12.6, RF-12.9 · CA-12.11 · D-33 · el titular ofrece una semana propia, sin confirmar ni liberar, por una ajena de la misma temporada.';
