/**
 * D-43 · HU-14 · RF-14.7c · CA-14.10 · HU-16 · RF-16.5 — liberar una semana avisa
 * al Administrador de la propiedad.
 *
 * Liberar no es solo renunciar: es ofrecer. Hasta aquí la liberación avisaba solo
 * al Propietario, así que la semana entraba a la bolsa de renta sin que nadie
 * capaz de colocarla se enterara, y el aviso llegaba —si llegaba— cuando alguien
 * abría la pantalla de rentas. El aviso nuevo lleva la propiedad, la fracción de
 * origen, la semana, su fecha de entrada y su temporada, que es lo que hace falta
 * para decidir si conviene rentarla.
 *
 * El destinatario no es un copropietario, así que no rompe el acotamiento estricto
 * de RF-16.2: ese rige entre Propietarios. Sin Administrador asignado el aviso va
 * al Superadmin (D-40), porque la propiedad sin administrador no puede quedarse sin
 * nadie que sepa que hay una semana colocable.
 *
 * Idempotente por `entity_id` como el resto de TR-03, y con tipo de entidad propio
 * para no chocar con el aviso que ya recibe el Propietario por la misma liberación.
 */

create or replace function public.release_week(calendar uuid, fraction uuid, week_index integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.fractions;
  manages boolean;
  p public.properties;
  w record;
  gestores uuid[];
begin
  select * into f from public.fractions where id = fraction;
  manages := f.id is not null and private.puede_gestionar_propiedad(f.property_id);
  if f.id is null or (not manages and f.owner_id is distinct from (select auth.uid())) then
    raise exception 'RF-14.7 · solo el titular de la fracción (o el Administrador) libera sus semanas.';
  end if;
  if not f.calendar_active then
    raise exception 'CA-14.0 · I-08 · la fracción % no tiene el calendario activo.', f.number;
  end if;
  select * into w from private.week_allocation(calendar, week_index);
  if w.week_id is null or w.fraction_id is distinct from fraction then
    raise exception 'CA-14.1 · RF-14.3 · la semana % no es de la fracción %.', week_index, f.number;
  end if;
  if w.released_at is not null then
    raise exception 'CA-14.8 · RF-14.7 · la semana % ya está en la bolsa de renta.', week_index;
  end if;
  if w.starts_on < current_date then
    raise exception 'RF-14.7 · la semana % ya pasó.', week_index;
  end if;

  perform set_config('app.audit_reason', 'Semana liberada por el titular', true);
  update public.allocations
     set released_at = now(), released_by = (select auth.uid()), release_reason = 'voluntary'
   where id = w.allocation_id;
  perform set_config('app.audit_reason', '', true);

  select * into p from public.properties where id = f.property_id;

  if f.owner_id is not null then
    perform public.emitir_notificacion(
      'calendar_changed', 'week_release', w.allocation_id::text, f.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'detail', 'la semana ' || (week_index + 1) || ' (' || w.starts_on || ') fue liberada a la bolsa de renta'),
      array[f.owner_id]
    );
  end if;

  -- RF-14.7c · CA-14.10 · D-43 · quien tiene que colocarla se entera al soltarla.
  -- Sin Administrador asignado el aviso va al Superadmin: si no, la semana entraría
  -- a la bolsa sin que nadie capaz de rentarla lo supiera.
  select coalesce(array_agg(distinct pa.admin_id), '{}') into gestores
    from public.property_admins pa
   where pa.property_id = f.property_id and pa.revoked_at is null;

  if cardinality(gestores) = 0 then
    select coalesce(array_agg(distinct ur.user_id), '{}') into gestores
      from public.user_roles ur
     where ur.role = 'superadmin';
  end if;

  if cardinality(gestores) > 0 then
    perform public.emitir_notificacion(
      'calendar_changed', 'week_release_pool', w.allocation_id::text, f.property_id,
      jsonb_build_object('property_name', p.name, 'fraction_number', f.number,
                         'week_index', week_index, 'starts_on', w.starts_on, 'season', w.season,
                         'detail', 'la fracción ' || f.number || ' liberó la semana ' || (week_index + 1)
                                   || ' (' || w.starts_on || '): está disponible para renta y su ingreso sería de esa fracción'),
      gestores
    );
  end if;
end;
$$;

comment on function public.release_week(uuid, uuid, integer) is
  'HU-14 · RF-14.7, RF-14.7c · D-15, D-43 · el titular pasa a la bolsa de renta una semana propia futura y el Administrador se entera.';
