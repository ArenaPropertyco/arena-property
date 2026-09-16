-- HU-17 · RF-17.1…RF-17.4 · HU-16 · RF-16.1, RF-16.2 · TR-01 · TR-03 · D-42, D-43 —
-- la reasignación administrativa de una semana.
--
-- Con la semana como única unidad de uso (D-42), las acciones del Administrador
-- sobre el calendario (RF-17.1) son: **crear** una reserva confirmando en nombre
-- del titular (`confirm_week` ya lo permite a quien gestiona), **bloquear**
-- (`block_weeks`, HU-15), **intercambiar** entre fracciones (`swap_weeks`, HU-12)
-- y **reasignar**: mover la semana de una fracción a otra semana libre. Esta
-- migración añade la última y cierra el circuito de HU-15: el conflicto que deja
-- un bloqueo sobre una semana confirmada se resuelve moviéndola.
--
-- Reglas (RF-17.3): solo el Administrador asignado o el Superadmin (CA-17.4);
-- motivo obligatorio (RF-17.4 · TR-01 RF-A.4); nunca dos fracciones en la misma
-- semana (CA-17.2); el destino no puede estar bloqueado, rentado, fuera de la
-- rejilla ni en el pasado; y la temporada se respeta salvo decisión explícita, que
-- queda auditada junto al motivo (CA-17.3). La confirmación del titular viaja con
-- la semana: reasignar no le cancela nada. Una semana ya liberada a la bolsa de
-- renta no se mueve: dejó de ser de la fracción (D-43).
--
-- El titular afectado recibe el aviso en la misma transacción (RF-17.2 · HU-16
-- RF-16.1), y solo él (RF-16.2): el destinatario es el titular de la fracción cuya
-- semana se movió.

-- ── TR-01 · RF-A.4 · ningún cambio de una semana asignada se audita sin motivo ─
-- Todas las rutas que hoy actualizan `allocations` (confirmar, cancelar, liberar,
-- caducar, intercambiar, reubicar, rentar) ya fijan `app.audit_reason`; con esta
-- fila la base lo exige en vez de confiar en que cada función se acuerde.
insert into public.audit_reason_required (action, source) values
  ('allocation.actualizada', 'HU-17')
on conflict (action) do nothing;

-- ── RF-17.1 · RF-17.3 · reasignar ───────────────────────────────────────────
create or replace function public.reassign_week(
  calendar uuid,
  fraction integer,
  from_week integer,
  to_week integer,
  reason text,
  override_season boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cal public.season_calendars;
  p public.properties;
  f public.fractions;
  wf public.calendar_weeks;
  wt public.calendar_weeks;
  a public.allocations;
  taken public.fractions;
  motivo text;
  registro text;
begin
  select * into cal from public.season_calendars where id = calendar;
  if cal.id is null or not private.puede_gestionar_propiedad(cal.property_id) then
    raise exception 'CA-17.4 · solo el Administrador asignado reasigna semanas de este calendario.';
  end if;
  -- RF-17.4 · CA-17.3 · sin motivo no hay operación ni registro (TR-01 · RF-A.4).
  motivo := nullif(btrim(coalesce(reason, '')), '');
  if motivo is null then
    raise exception 'RF-17.4 · CA-17.3 · toda acción administrativa sobre el calendario exige un motivo.';
  end if;
  if from_week = to_week then
    raise exception 'RF-17.3 · la semana de destino debe ser distinta de la de origen.';
  end if;

  select * into f from public.fractions where property_id = cal.property_id and number = fraction;
  select * into wf from public.calendar_weeks where calendar_id = calendar and index = from_week;
  select * into wt from public.calendar_weeks where calendar_id = calendar and index = to_week;
  if f.id is not null and wf.id is not null then
    select * into a from public.allocations where calendar_id = calendar and week_id = wf.id and fraction_id = f.id;
  end if;
  if a.id is null then
    raise exception 'RF-17.3 · la semana % no es de la fracción %.', from_week, fraction;
  end if;
  -- D-43 · lo que ya está en la bolsa de renta dejó de ser de la fracción.
  if a.released_at is not null then
    raise exception 'RF-17.3 · la semana % ya está en la bolsa de renta y no se reasigna.', from_week;
  end if;
  if wt.id is null then
    raise exception 'RF-17.3 · la semana % no está en la rejilla.', to_week;
  end if;
  if wt.starts_on < current_date then
    raise exception 'RF-17.3 · la semana % ya pasó.', to_week;
  end if;
  -- CA-17.2 · una semana, una fracción.
  select f2.* into taken
    from public.allocations a2
    join public.fractions f2 on f2.id = a2.fraction_id
   where a2.calendar_id = calendar and a2.week_id = wt.id;
  if taken.id is not null then
    raise exception 'CA-17.2 · RF-17.3 · la semana % ya pertenece a la fracción %: la reasignación generaría un solapamiento.', to_week, taken.number;
  end if;
  if exists (select 1 from public.week_blocks b where b.week_id = wt.id and b.lifted_at is null) then
    raise exception 'RF-15.2 · RF-17.3 · la semana % está bloqueada por el Administrador.', to_week;
  end if;
  if exists (select 1 from public.third_party_bookings t where t.week_id = wt.id and t.status = 'confirmed') then
    raise exception 'RF-14.4 · RF-17.3 · la semana % está rentada a un tercero.', to_week;
  end if;

  -- CA-17.3 · D-28 · cruzar de temporada es una excepción que se decide y se registra.
  registro := motivo;
  if wf.season <> wt.season then
    if not coalesce(override_season, false) then
      raise exception 'CA-17.3 · RF-17.3 · la semana % es de temporada % y la % de %: cambiar de temporada exige una decisión explícita del Administrador, con motivo.',
        from_week, wf.season, to_week, wt.season;
    end if;
    registro := 'Excepción de temporada (' || wf.season || ' → ' || wt.season || '): ' || motivo;
  end if;

  -- RF-17.4 · TR-01 · el disparador de `allocations` guarda acción, motivo, semana, autor y fecha.
  perform set_config('app.audit_reason', registro, true);
  update public.allocations set week_id = wt.id where id = a.id;
  -- RF-15.4 · la semana salió de debajo del bloqueo: el conflicto queda resuelto.
  update public.calendar_conflicts
     set status = 'resolved', resolved_at = now()
   where allocation_id = a.id and status = 'open';
  perform set_config('app.audit_reason', '', true);

  -- RF-17.2 · HU-16 · CA-17.1 · el titular afectado se entera junto con el cambio, y nadie más (RF-16.2).
  if f.owner_id is not null then
    select * into p from public.properties where id = cal.property_id;
    perform public.emitir_notificacion(
      'calendar_changed', 'week_reassignment',
      a.id::text || ':' || from_week || ':' || to_week || ':' || extract(epoch from clock_timestamp())::text,
      cal.property_id,
      jsonb_build_object(
        'property_name', p.name, 'fraction_number', f.number,
        'week_index', from_week, 'new_week_index', to_week,
        'starts_on', wt.starts_on, 'season', wt.season, 'reason', motivo,
        'detail', 'el Administrador movió tu semana ' || (from_week + 1) || ' a la semana ' || (to_week + 1)
                  || ' (' || wt.starts_on || ') de ' || cal.year || ': ' || motivo),
      array[f.owner_id]
    );
  end if;
end;
$$;

comment on function public.reassign_week(uuid, integer, integer, integer, text, boolean) is
  'HU-17 · RF-17.1, RF-17.3, RF-17.4 · el Administrador mueve una semana de una fracción a una semana libre, con motivo; la temporada solo cambia por decisión explícita y auditada (CA-17.3). Avisa al titular (RF-17.2).';

revoke execute on function public.reassign_week(uuid, integer, integer, integer, text, boolean) from public, anon;
grant execute on function public.reassign_week(uuid, integer, integer, integer, text, boolean) to authenticated, service_role;
