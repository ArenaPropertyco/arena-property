-- HU-54 · RF-54.2, RF-54.3 · HU-51 · RF-51.3 · D-02, D-04 — la comisión del
-- referido cuya atribución llegó después de su compra.
--
-- **El hueco.** Quien hace clic en un enlace de referido, se registra sin escribir
-- el código y compra antes de entrar por primera vez al panel queda atribuido
-- **después** de que su compra se cerró: `attribute_referral` corre al montar el
-- panel, no al registrarse. El cauce normal provisiona la comisión en el
-- disparador de alta de `payment_plans`, de modo que para esa persona no se
-- provisionaba nunca y el Embajador perdía una comisión que su enlace sí generó.
--
-- **La corrección.** Al crearse la atribución, el referido se pone al día con la
-- compra que ya tenía: se provisiona y, si el pago ya estaba completo, se acredita.
--
-- Cuatro reglas la acotan, las mismas del cauce normal:
--
-- 1. **Solo un referido que siga en «registrado» y nunca haya cobrado.** Uno que
--    ya va por su cauce no se toca (RF-51.3), y la primera compra viva sigue siendo
--    la única que paga (D-04).
-- 2. **Una compra anulada no recupera nada** (RF-58.8); se pasa a la siguiente viva.
-- 3. **La gracia cuenta desde el pago completo real, no desde la atribución
--    tardía** (D-02). Si esos 30 días ya pasaron, el saldo sale a disponible en el
--    acto: la ventana de riesgo que la gracia protege ya transcurrió sin anulación.
-- 4. **Todo sigue siendo idempotente** (RF-54.4): repetir la atribución no duplica.
--
-- De paso, la provisión y la liberación dejan de vivir dentro de un disparador y
-- de un bucle: cada una es ahora una función con nombre, que el cauce normal y la
-- recuperación llaman por igual. La misma regla en un solo sitio.
--
-- Las mismas reglas están en `shared/referrals/ledger.ts` (`recoveryFor`).

-- ── RF-53.3 · RF-54.3 · la provisión, ahora invocable ───────────────────────
create or replace function private.provisionar_comision_de_plan(plan uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payment_plans;
  atr public.attributions;
  tipo record;
  emb public.ambassadors;
  monto bigint;
  numero smallint;
  nombre text;
  nueva uuid;
begin
  select * into p from public.payment_plans where id = plan;
  -- RF-58.8 · sobre una compra anulada no se provisiona nada.
  if p.id is null or p.voided_at is not null then
    return null;
  end if;

  select * into atr from public.attributions where prospect_id = p.owner_id;
  -- CA-54.7 · sin atribución en proceso de pago no hay nada que provisionar;
  -- CA-54.6 · D-04 · y quien ya generó su única comisión tampoco.
  if atr.id is null or atr.stage = 'registered' or atr.commissioned_purchase_id is not null then
    return null;
  end if;
  -- RF-54.4 · con una comisión viva de esta atribución, no se crea otra.
  if exists (select 1 from public.commissions c where c.attribution_id = atr.id and c.status <> 'reversed') then
    return null;
  end if;

  -- RF-52.5 · el tipo que le toca hoy al Embajador; queda congelado en la fila.
  select * into tipo from public.commission_type_for(atr.ambassador_id);
  if tipo.id is null then
    return null;
  end if;
  -- RF-D.4 · truncado al peso; el producto cabe en bigint sin redondeo intermedio.
  monto := case
    when tipo.kind = 'fixed' then tipo.amount
    else (p.agreed_price * tipo.basis_points) / 10000
  end;
  if coalesce(monto, 0) <= 0 then
    return null;
  end if;

  select f.number into numero from public.fractions f where f.id = p.fraction_id;
  select pr.name into nombre from public.properties pr where pr.id = p.property_id;

  perform set_config('app.audit_reason', 'Comisión provisionada al cerrarse la compra del referido', true);
  insert into public.commissions (
    attribution_id, ambassador_id, plan_id, property_id, fraction_number,
    commission_type_id, agreed_price, amount
  ) values (
    atr.id, atr.ambassador_id, p.id, p.property_id, numero,
    tipo.id, p.agreed_price, monto
  ) returning id into nueva;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · HU-57 · el Embajador se entera de que su referido empezó a pagar.
  select * into emb from public.ambassadors where id = atr.ambassador_id;
  perform public.emitir_notificacion(
    'referral_in_progress', 'commission', nueva::text, p.property_id,
    jsonb_build_object('referral_label', atr.prospect_email, 'property_name', nombre, 'amount', monto),
    array[emb.user_id]
  );

  return nueva;
end;
$$;

comment on function private.provisionar_comision_de_plan(uuid) is
  'HU-54 · RF-53.3, RF-54.3 · D-04 · provisiona la comisión pendiente de una compra; idempotente, la llaman el alta del plan y la recuperación de una atribución tardía.';

revoke execute on function private.provisionar_comision_de_plan(uuid) from public, anon, authenticated;

-- El disparador de alta del plan ya solo delega.
create or replace function private.provisionar_comision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provisionar_comision_de_plan(new.id);
  return new;
end;
$$;

-- ── CA-54.2 · DT-09 · la liberación, ahora de una comisión concreta ─────────
create or replace function private.liberar_comision(comision uuid, hoy date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  cuenta uuid;
begin
  select * into c from public.commissions where id = comision and status = 'in_grace';
  -- D-02 · antes del fin de la gracia no es retirable (RT-08).
  if c.id is null or c.grace_ends_on > hoy then
    return false;
  end if;

  perform set_config('app.audit_reason', 'Fin del periodo de gracia: comisión disponible para retiro (D-02)', true);
  update public.commissions set status = 'available', available_on = hoy, updated_at = now() where id = c.id;
  -- RF-54.4 · el movimiento es único por comisión y tipo: repetir no duplica.
  insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on)
  values (c.ambassador_id, c.id, 'commission_available', c.amount, hoy)
  on conflict (commission_id, kind) do nothing;
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el Embajador se entera de que ya puede retirar.
  select a.user_id into cuenta from public.ambassadors a where a.id = c.ambassador_id;
  perform public.emitir_notificacion(
    'commission_available', 'commission', c.id::text, c.property_id,
    jsonb_build_object('amount', c.amount), array[cuenta]
  );

  return true;
end;
$$;

revoke execute on function private.liberar_comision(uuid, date) from public, anon, authenticated;

create or replace function public.release_commissions_in_grace(hoy date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c record;
  liberadas integer := 0;
begin
  for c in
    select x.id from public.commissions x
     where x.status = 'in_grace' and x.grace_ends_on <= hoy
     order by x.grace_ends_on, x.created_at
  loop
    if private.liberar_comision(c.id, hoy) then
      liberadas := liberadas + 1;
    end if;
  end loop;
  return liberadas;
end;
$$;

comment on function public.release_commissions_in_grace(date) is
  'HU-54 · RF-54.1 · CA-54.2 · D-02 · DT-09 · pasa a disponible toda comisión cuya gracia venció; idempotente, corre a diario en pg_cron.';

revoke execute on function public.release_commissions_in_grace(date) from public, anon, authenticated;
grant execute on function public.release_commissions_in_grace(date) to service_role;

-- ── RF-54.2 · la acreditación admite el día real del pago completo ──────────
-- Una comisión recuperada se completó en el pasado: la gracia cuenta desde ese
-- día y no desde hoy (D-02). El cauce normal sigue pasando la fecha de hoy.
drop function if exists private.acreditar_comision(uuid);

create or replace function private.acreditar_comision(plan uuid, completado_en date default current_date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  emb public.ambassadors;
  categoria uuid;
  habilitada date := completado_en + 30;
begin
  -- CA-54.3 · RF-54.4 · solo una comisión pendiente se acredita: reprocesar no repite.
  select * into c from public.commissions where plan_id = plan and status = 'pending';
  if c.id is null then
    return;
  end if;

  perform set_config('app.audit_reason', 'Pago completado del referido: comisión acreditada en gracia (D-02)', true);
  update public.commissions
     set status = 'in_grace', completed_on = completado_en, grace_ends_on = habilitada, updated_at = now()
   where id = c.id;

  insert into public.wallet_movements (ambassador_id, commission_id, kind, amount, occurred_on)
  values (c.ambassador_id, c.id, 'commission_credited', c.amount, completado_en)
  on conflict (commission_id, kind) do nothing;

  -- CA-54.5 · D-01 · el devengo, una sola vez y en el libro de Arena.
  select id into categoria from public.expense_categories
   where kind = 'expense' and scope = 'platform' and lower(btrim(name)) = lower('Comisión de Embajador');
  insert into public.platform_ledger (kind, amount, category_id, property_id, source_type, source_id, accrued_on, note)
  select 'expense', c.amount, categoria, c.property_id, 'ambassador_commission', c.id, completado_en,
         'Comisión de Embajador por la compra de la fracción ' || c.fraction_number || '/8'
   where not exists (
     select 1 from public.platform_ledger l where l.source_type = 'ambassador_commission' and l.source_id = c.id
   );
  perform set_config('app.audit_reason', '', true);

  -- TR-03 · el Embajador se entera del monto y de cuándo podrá retirarlo.
  select * into emb from public.ambassadors where id = c.ambassador_id;
  perform public.emitir_notificacion(
    'referral_paid', 'commission', c.id::text, c.property_id,
    jsonb_build_object(
      'referral_label', (select a.prospect_email from public.attributions a where a.id = c.attribution_id),
      'amount', c.amount, 'available_on', habilitada
    ),
    array[emb.user_id]
  );
end;
$$;

revoke execute on function private.acreditar_comision(uuid, date) from public, anon, authenticated;

create or replace function private.procesar_evento_de_comision(plan uuid, evento text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commissions;
  motivo text;
begin
  if evento = 'payment_completed' then
    perform private.acreditar_comision(plan, current_date);
  elsif evento = 'purchase_voided' then
    select * into c from public.commissions where plan_id = plan and status <> 'reversed';
    if c.id is null then
      return;
    end if;
    select 'Compra anulada: ' || coalesce(p.void_reason, 'sin motivo registrado') into motivo
      from public.payment_plans p where p.id = plan;
    perform private.reversar_comision(c.id, motivo);
  end if;
end;
$$;

revoke execute on function private.procesar_evento_de_comision(uuid, text) from public, anon, authenticated;

-- ── RF-51.3 · RF-54.2 · D-04 · la recuperación ──────────────────────────────
/**
 * El referido se pone al día con la compra que ya tenía cuando su atribución
 * llegó tarde. Espejo de `recoveryFor` en `shared/referrals/ledger.ts`: solo un
 * referido en «registrado» que nunca cobró, y solo su primera compra viva.
 *
 * Devuelve la comisión creada, o `null` si no había nada que recuperar.
 */
create or replace function private.recuperar_comision_del_referido(prospecto uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  atr public.attributions;
  compra record;
  nueva uuid;
begin
  select * into atr from public.attributions where prospect_id = prospecto;
  -- RF-51.3 · quien ya va por su cauce normal no se toca; D-04 · ni quien ya cobró.
  if atr.id is null or atr.stage <> 'registered' or atr.commissioned_purchase_id is not null then
    return null;
  end if;

  -- D-04 · la primera compra viva es la única que paga. RF-58.8 · anulada no cuenta.
  select p.id,
         (select e.emitted_at::date from public.payment_events e
           where e.plan_id = p.id and e.kind = 'payment_completed') as completada_en
    into compra
    from public.payment_plans p
   where p.owner_id = prospecto and p.voided_at is null
   order by p.closed_at, p.id
   limit 1;

  if compra.id is null then
    return null;
  end if;

  perform private.advance_referral(prospecto, 'purchase_started', compra.id);
  nueva := private.provisionar_comision_de_plan(compra.id);
  if nueva is null then
    return null;
  end if;

  -- RF-54.2 · el pago ya estaba completo: se acredita con su fecha real, y si esos
  -- 30 días ya pasaron el saldo sale a disponible en el acto (D-02).
  if compra.completada_en is not null then
    perform private.advance_referral(prospecto, 'payment_completed', compra.id);
    perform private.acreditar_comision(compra.id, compra.completada_en);
    perform private.liberar_comision(nueva, current_date);
  end if;

  return nueva;
end;
$$;

comment on function private.recuperar_comision_del_referido(uuid) is
  'HU-54 · RF-54.2, RF-54.3 · HU-51 · RF-51.3 · D-02, D-04 · pone al día la comisión de un referido cuya atribución llegó después de su compra.';

revoke execute on function private.recuperar_comision_del_referido(uuid) from public, anon, authenticated;

-- ── RF-51.2 · la atribución, que ahora recupera lo que ya había ─────────────
-- Igual que antes en todo lo demás: la primera atribución gana, nadie se
-- auto-refiere, la ventana de 90 días manda y un código malo no bloquea el
-- registro (RF-51.6). Lo único nuevo es la puesta al día del final.
create or replace function public.attribute_referral(visitor uuid default null, referral_code text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  prospecto uuid := (select auth.uid());
  correo text;
  ya text;
  candidato record;
begin
  if prospecto is null then
    return null;
  end if;
  -- CA-51.1 · RF-51.3 · si ya está atribuido, la primera manda y aquí se acaba.
  select a.code into ya from public.attributions a where a.prospect_id = prospecto;
  if ya is not null then
    -- RF-54.2 · pero su compra puede seguir esperando comisión de una atribución
    -- anterior que también llegó tarde. Es idempotente: si no hay nada, no hace nada.
    perform private.recuperar_comision_del_referido(prospecto);
    return ya;
  end if;

  select u.email into correo from auth.users u where u.id = prospecto;

  for candidato in
    select c.code, c.clicked_at
      from public.referral_clicks c
     where c.visitor_id = visitor
    union all
    select private.normalizar_codigo_referido(referral_code), now()
     where private.normalizar_codigo_referido(referral_code) is not null
    order by 2, 1
  loop
    -- CA-51.6 · D-03 · fuera de la ventana ese clic ya no vale.
    continue when now() - candidato.clicked_at > interval '90 days';

    if exists (
      select 1
        from public.referral_codes rc
        join public.ambassadors a on a.id = rc.ambassador_id
        join auth.users u on u.id = a.user_id
       where rc.code = candidato.code
         -- CA-51.5 · RF-51.6 · el código tiene que estar habilitado.
         and rc.enabled
         and a.status = 'approved'
         -- CA-51.2 · RF-51.4 · nadie se refiere a sí mismo, ni por cuenta ni por correo.
         and a.user_id <> prospecto
         and lower(btrim(u.email)) is distinct from lower(btrim(coalesce(correo, '')))
    ) then
      perform set_config('app.audit_reason', 'Atribución de referido al registrarse', true);
      insert into public.attributions (ambassador_id, code, prospect_id, prospect_email, clicked_at)
      select rc.ambassador_id, rc.code, prospecto, correo, candidato.clicked_at
        from public.referral_codes rc where rc.code = candidato.code;
      perform set_config('app.audit_reason', '', true);

      -- RF-54.2 · D-04 · la atribución llegó después de la compra: el referido se
      -- pone al día para que el Embajador no pierda la comisión que sí generó.
      perform private.recuperar_comision_del_referido(prospecto);

      return candidato.code;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.attribute_referral(uuid, text) is
  'HU-51 · RF-51.1…RF-51.4, RF-51.6 · HU-54 · RF-54.2 · atribuye al prospecto que se registra y pone al día la comisión si su compra ya estaba cerrada; un código inservible no bloquea el flujo.';

revoke execute on function public.attribute_referral(uuid, text) from public, anon;
grant execute on function public.attribute_referral(uuid, text) to authenticated, service_role;

-- ── Reparación de lo que ya quedó atrás ─────────────────────────────────────
-- Las atribuciones que llegaron tarde antes de esta corrección siguen sin su
-- comisión. Se ponen al día con la misma regla, que es idempotente: donde no haya
-- nada que recuperar, no toca nada.
do $$
declare
  atr record;
begin
  for atr in
    select a.prospect_id from public.attributions a
     where a.stage = 'registered' and a.commissioned_purchase_id is null
     order by a.created_at
  loop
    perform private.recuperar_comision_del_referido(atr.prospect_id);
  end loop;
end;
$$;
