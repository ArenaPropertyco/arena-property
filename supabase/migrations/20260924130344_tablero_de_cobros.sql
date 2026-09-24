-- HU-63 · RF-63.1, RF-63.7, RF-63.8, RF-63.10 · D-08, D-10, D-51 — el tablero de
-- cobros de la administración.
--
-- Dos decisiones que conviene leer antes que el código:
--
-- 1. **El tablero no crea otro modelo de cobro: lee el de HU-62.** Los cortes,
--    los saldos, los cobros, los pagos y los retiros ya existen y ya tienen su
--    RLS. Lo único que faltaba era ver, por fracción y mes, las cuotas de quien
--    responde por cada fracción —el Propietario o el titular del inventario
--    (D-08)— para que la propiedad cuadre (RF-63.7). Esa es la vista de aquí,
--    acotada a quien gestiona la propiedad (RF-63.8).
--
-- 2. **El botón de confirmación es solo para el canal manual (RF-63.10).** Un
--    pago de pasarela llegará resuelto por su proveedor; la base rechaza que se
--    confirme o se rechace a mano, igual que el tablero no ofrece el botón.

-- ── RF-63.1 · RF-63.7 · las cuotas vivas por fracción y mes, por responsable ─
create view public.property_board_shares
with (security_invoker = true) as
select
  s.property_id,
  s.fraction_id,
  s.fraction_number,
  date_trunc('month', m.incurred_on)::date as period,
  s.payer::text as responsible,
  s.payer_id as owner_id,
  coalesce(sum(s.amount) filter (where m.kind = 'income'), 0)::bigint as income,
  coalesce(sum(s.amount) filter (where m.kind = 'expense'), 0)::bigint as expenses,
  (coalesce(sum(s.amount) filter (where m.kind = 'income'), 0) - coalesce(sum(s.amount) filter (where m.kind = 'expense'), 0))::bigint as net
from public.movement_shares s
join public.movements m on m.id = s.movement_id
where s.reversed_at is null
  and private.puede_gestionar_propiedad(s.property_id)
group by s.property_id, s.fraction_id, s.fraction_number, date_trunc('month', m.incurred_on), s.payer, s.payer_id;

comment on view public.property_board_shares is
  'HU-63 · RF-63.1 · RF-63.7 · D-08 · las cuotas vivas de cada fracción por mes de causación y por quien responde (Propietario o titular del inventario); solo para quien gestiona la propiedad.';

revoke all on public.property_board_shares from anon, authenticated, service_role;
grant select on public.property_board_shares to authenticated, service_role;

-- ── RF-63.10 · CA-63.12 · un pago de pasarela no se resuelve a mano ─────────
create or replace function public.confirm_owner_payment(payment uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.owner_payments;
begin
  select * into p from public.owner_payments where id = payment for update;
  if p.id is null then
    raise exception 'RF-62.8 · el pago no existe.';
  end if;
  if not private.puede_gestionar_propiedad(p.property_id) then
    raise exception 'RF-62.12 · RF-62.8 · solo el Administrador de la propiedad o el Superadmin confirma un pago.';
  end if;
  if p.channel <> 'manual' then
    raise exception 'RF-63.10 · D-10 · un pago de pasarela lo resuelve su proveedor, no el tablero.';
  end if;
  if p.status <> 'reported' then
    raise exception 'CA-62.9 · RF-62.8 · solo se confirma un pago reportado (está %).', p.status;
  end if;

  perform set_config('app.audit_reason', 'Pago confirmado tras revisar el comprobante (RF-62.8); sin movimiento en la maestra (D-51)', true);
  update public.owner_payments
     set status = 'confirmed', resolved_at = now(), resolved_by = (select auth.uid()), updated_at = now()
   where id = p.id;
  -- RF-62.2 · CA-62.7 · solo ahora entra a la billetera.
  insert into public.owner_wallet_movements (owner_id, property_id, kind, amount, occurred_on, payment_id)
  values (p.owner_id, p.property_id, 'payment_confirmed', p.amount, current_date, p.id)
  on conflict (payment_id) do nothing;
  perform private.derivar_cobro(p.charge_id);
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_payment_confirmed', 'owner_payment', p.id::text, p.property_id,
    jsonb_build_object('amount', p.amount, 'property_name', private.nombre_de_propiedad(p.property_id), 'reason', null),
    array[p.owner_id]
  );
end;
$$;

comment on function public.confirm_owner_payment(uuid) is
  'HU-62 · RF-62.8 · CA-62.7 · CA-62.9 · HU-63 · RF-63.10 · D-51 · la administración confirma un pago manual reportado: entra a la billetera y el cobro se deriva.';

create or replace function public.reject_owner_payment(payment uuid, reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.owner_payments;
  motivo text := nullif(btrim(coalesce(reason, '')), '');
begin
  if motivo is null then
    raise exception 'CA-62.8 · RF-62.8 · el rechazo exige un motivo.';
  end if;
  select * into p from public.owner_payments where id = payment for update;
  if p.id is null then
    raise exception 'RF-62.8 · el pago no existe.';
  end if;
  if not private.puede_gestionar_propiedad(p.property_id) then
    raise exception 'RF-62.12 · RF-62.8 · solo el Administrador de la propiedad o el Superadmin rechaza un pago.';
  end if;
  if p.channel <> 'manual' then
    raise exception 'RF-63.10 · D-10 · un pago de pasarela lo resuelve su proveedor, no el tablero.';
  end if;
  if p.status <> 'reported' then
    raise exception 'CA-62.9 · RF-62.8 · solo se rechaza un pago reportado (está %).', p.status;
  end if;

  perform set_config('app.audit_reason', 'Pago rechazado: ' || motivo, true);
  update public.owner_payments
     set status = 'rejected', rejection_reason = motivo, resolved_at = now(), resolved_by = (select auth.uid()), updated_at = now()
   where id = p.id;
  -- CA-62.8 · sin movimiento: el saldo no cambia; el cobro vuelve a pendiente si nada más está en revisión.
  perform private.derivar_cobro(p.charge_id);
  perform set_config('app.audit_reason', '', true);

  perform public.emitir_notificacion(
    'owner_payment_rejected', 'owner_payment', p.id::text, p.property_id,
    jsonb_build_object('amount', p.amount, 'property_name', private.nombre_de_propiedad(p.property_id), 'reason', motivo),
    array[p.owner_id]
  );
end;
$$;

comment on function public.reject_owner_payment(uuid, text) is
  'HU-62 · RF-62.8 · CA-62.8 · HU-63 · RF-63.10 · la administración rechaza un pago manual con motivo; el saldo no se toca y el Propietario se entera.';
