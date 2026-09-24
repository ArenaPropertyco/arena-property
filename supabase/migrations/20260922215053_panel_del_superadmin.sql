-- HU-33 · RF-33.1…RF-33.6 · HU-32 · RF-32.1, RF-32.3 · D-07 · TR-01 — el panel
-- del Superadmin en la base: suspender y reactivar cuentas, y las métricas
-- globales.
--
-- 1. **La RLS también evalúa el estado (RF-33.1).** `roles_efectivos` devuelve
--    un arreglo vacío para una cuenta suspendida: toda política que mira roles
--    deja de dejarla pasar en el mismo instante, sin tocar ninguna política. El
--    middleware ya la echa de las rutas; esto cierra la otra puerta.
--
-- 2. **Suspender exige motivo y tipo (RF-33.1, RF-33.3, D-07).** Solo el
--    Superadmin, nunca a sí mismo ni a otro Superadmin. El tipo lo lee el motor
--    de comisiones (HU-54 · RF-54.7); aquí además se inhabilita el código del
--    Embajador (RF-33.2) para que no atribuya. Reactivar restaura todo (RF-33.5).
--    Los dos eventos quedan en la auditoría con su motivo (RF-33.6).
--
-- 3. **Las métricas son de toda la plataforma (RF-32.3).** Una sola función,
--    reservada al Superadmin, entrega los conteos y las series sin filtro de
--    asignación; el porcentaje y los buckets los calcula `shared/metrics`.

-- ── RF-33.1 · una cuenta suspendida no tiene roles para la RLS ──────────────
create or replace function private.roles_efectivos()
returns public.app_role[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.role order by r.role), '{}'::public.app_role[])
    from public.user_roles r
    join public.profiles p on p.id = r.user_id
   where r.user_id = (select auth.uid())
     and p.status = 'active';
$$;

comment on function private.roles_efectivos() is
  'HU-07 · HU-33 · RF-33.1 · roles de la cuenta que consulta; vacío si está suspendida. SECURITY DEFINER: evalúa user_roles y profiles bajo su propia RLS.';

-- ── RF-33.1 · RF-33.2 · RF-33.3 · RF-33.6 · suspender ───────────────────────
create or replace function public.suspend_account(account uuid, kind public.suspension_kind, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  motivo text := nullif(btrim(coalesce(reason, '')), '');
  objetivo public.profiles;
  emb public.ambassadors;
begin
  if not private.es_superadmin() then
    raise exception 'RF-33.6 · solo el Superadmin suspende cuentas.';
  end if;
  if kind is null then
    raise exception 'RF-33.3 · D-07 · la suspensión exige su tipo: administrativa o por incumplimiento o fraude.';
  end if;
  if motivo is null then
    raise exception 'CA-33.1 · RF-33.1 · la suspensión exige un motivo.';
  end if;
  select * into objetivo from public.profiles where id = account;
  if objetivo.id is null then
    raise exception 'RF-33.1 · la cuenta no existe.';
  end if;
  if account = (select auth.uid()) then
    raise exception 'RF-33.6 · el Superadmin no se suspende a sí mismo.';
  end if;
  if exists (select 1 from public.user_roles where user_id = account and role = 'superadmin') then
    raise exception 'RF-33.6 · un Superadmin no se suspende desde la plataforma.';
  end if;
  if objetivo.status = 'suspended' then
    raise exception 'RF-33.1 · la cuenta ya está suspendida.';
  end if;

  perform set_config('app.audit_reason',
    'Suspensión ' || case kind when 'administrative' then 'administrativa' else 'por incumplimiento o fraude' end || ': ' || motivo, true);
  -- El disparador de HU-54 lee el tipo y aplica D-07 sobre las comisiones.
  update public.profiles
     set status = 'suspended', suspension_kind = kind, suspension_reason = motivo, suspended_at = now()
   where id = account;

  -- RF-33.2 · el código del Embajador deja de atribuir; HU-51 exige código habilitado y Embajador aprobado.
  -- El disparador de HU-54 limpia el motivo al terminar: se vuelve a fijar para lo que sigue.
  perform set_config('app.audit_reason',
    'Suspensión ' || case kind when 'administrative' then 'administrativa' else 'por incumplimiento o fraude' end || ': ' || motivo, true);
  select * into emb from public.ambassadors where user_id = account;
  if emb.id is not null then
    if emb.status = 'approved' then
      update public.ambassadors set status = 'suspended', updated_at = now() where id = emb.id;
    end if;
    update public.referral_codes set enabled = false where ambassador_id = emb.id;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.suspend_account(uuid, public.suspension_kind, text) is
  'HU-33 · RF-33.1, RF-33.2, RF-33.3, RF-33.6 · D-07 · el Superadmin suspende una cuenta con motivo y tipo; el código de referido queda inhabilitado.';

revoke execute on function public.suspend_account(uuid, public.suspension_kind, text) from public, anon;
grant execute on function public.suspend_account(uuid, public.suspension_kind, text) to authenticated, service_role;

-- ── RF-33.5 · RF-33.6 · reactivar ───────────────────────────────────────────
create or replace function public.reactivate_account(account uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  objetivo public.profiles;
  emb public.ambassadors;
begin
  if not private.es_superadmin() then
    raise exception 'RF-33.6 · solo el Superadmin reactiva cuentas.';
  end if;
  select * into objetivo from public.profiles where id = account;
  if objetivo.id is null then
    raise exception 'RF-33.5 · la cuenta no existe.';
  end if;
  if objetivo.status = 'active' then
    return;
  end if;

  perform set_config('app.audit_reason', 'Reactivación de la cuenta por el Superadmin', true);
  update public.profiles
     set status = 'active', suspension_kind = null, suspension_reason = null, suspended_at = null
   where id = account;

  -- RF-33.5 · si era Embajador aprobado, vuelve a serlo y su código opera de nuevo.
  select * into emb from public.ambassadors where user_id = account;
  if emb.id is not null and emb.status = 'suspended' then
    update public.ambassadors set status = 'approved', updated_at = now() where id = emb.id;
    update public.referral_codes set enabled = true where ambassador_id = emb.id;
  end if;
  perform set_config('app.audit_reason', '', true);
end;
$$;

comment on function public.reactivate_account(uuid) is
  'HU-33 · RF-33.5, RF-33.6 · el Superadmin reactiva una cuenta suspendida; el código de referido vuelve a operar.';

revoke execute on function public.reactivate_account(uuid) from public, anon;
grant execute on function public.reactivate_account(uuid) to authenticated, service_role;

-- ── RF-32.1 · RF-32.3 · las métricas globales ───────────────────────────────
create or replace function public.platform_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.es_superadmin() then
    raise exception 'CA-32.3 · RF-32.3 · solo el Superadmin consulta las métricas globales.';
  end if;

  return jsonb_build_object(
    'properties', (select count(*) from public.properties),
    'fractions_total', (select count(*) from public.fractions),
    'fractions_sold', (select count(*) from public.fractions where status = 'sold'),
    -- HU-05 · activo: con el rol, cuenta activa y alguna asignación vigente.
    'active_admins', (
      select count(distinct pa.admin_id)
        from public.property_admins pa
        join public.profiles p on p.id = pa.admin_id
        join public.user_roles r on r.user_id = pa.admin_id and r.role = 'property_admin'
       where pa.revoked_at is null and p.status = 'active'
    ),
    'owners', (
      select count(distinct f.owner_id)
        from public.fractions f
        join public.profiles p on p.id = f.owner_id
       where f.status = 'sold' and p.status = 'active'
    ),
    -- HU-49 · activo: aprobado y con la cuenta activa.
    'active_ambassadors', (
      select count(*)
        from public.ambassadors a
        join public.profiles p on p.id = a.user_id
       where a.status = 'approved' and p.status = 'active'
    ),
    -- RF-32.1 · cada comisión está en un solo estado; lo reversado no se generó.
    'commissions', (
      select jsonb_build_object(
        'pending', coalesce(sum(amount) filter (where status = 'pending'), 0),
        'in_grace', coalesce(sum(amount) filter (where status = 'in_grace'), 0),
        'available', coalesce(sum(amount) filter (where status = 'available'), 0),
        'withdrawn', coalesce(sum(amount) filter (where status = 'withdrawn'), 0)
      ) from public.commissions
    ),
    -- RF-32.2 · una venta es una compra cerrada y no anulada, en la fecha de Bogotá.
    'sales', (
      select coalesce(jsonb_agg(jsonb_build_object('on', (pp.closed_at at time zone 'America/Bogota')::date) order by pp.closed_at), '[]'::jsonb)
        from public.payment_plans pp
       where pp.voided_at is null
    ),
    'commission_events', (
      select coalesce(jsonb_agg(jsonb_build_object('on', c.provisioned_on, 'amount', c.amount) order by c.provisioned_on), '[]'::jsonb)
        from public.commissions c
       where c.status <> 'reversed'
    )
  );
end;
$$;

comment on function public.platform_metrics() is
  'HU-32 · RF-32.1, RF-32.2, RF-32.3 · conteos, sumas por estado de comisión y series de toda la plataforma, solo para el Superadmin.';

revoke execute on function public.platform_metrics() from public, anon;
grant execute on function public.platform_metrics() to authenticated, service_role;
