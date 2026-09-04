-- HU-06 · RF-06.4 — el código del embajador viaja en la invitación de compra.
--
-- Hasta aquí la atribución solo podía nacer con el registro (HU-04) o con la
-- cookie del proveedor externo (HU-61). El Administrador que invita a un comprador
-- traído por un embajador necesita dejar constancia del código en ese momento:
--
-- 1. **La invitación lo guarda.** Normalizado y con formato plausible; escrito a
--    propósito, un formato inválido se rechaza (a diferencia del registro, donde
--    se descarta, CA-04.3). Inmutable después, como el resto de la invitación.
--
-- 2. **La cuenta nueva nace con él.** La ruta de servidor lo pone en los metadatos
--    de la invitación de Auth y `private.crear_perfil_y_rol()` lo convierte en
--    atribución del perfil, por la vía que ya existe.
--
-- 3. **El cierre lo arrastra al plan si el perfil no tenía.** La atribución del
--    perfil se escribió una sola vez y manda (D-03); la de la invitación suple
--    cuando el comprador ya tenía cuenta sin atribución. Es lo que HU-51 leerá
--    para liquidar la comisión.

alter table public.purchase_invitations add column referral_code text;

comment on column public.purchase_invitations.referral_code is
  'RF-06.4 · código del embajador que trajo al comprador, normalizado. Suple la atribución del perfil al cerrar, nunca la reemplaza.';

-- ── RF-06.1 · RF-06.5 · RF-06.4 · alta: fracción vendible y código plausible ─
create or replace function private.validar_invitacion_de_compra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fraccion public.fractions;
  codigo text := nullif(btrim(coalesce(new.referral_code, '')), '');
begin
  select * into fraccion from public.fractions where id = new.fraction_id;
  if not found then
    raise exception 'La fracción invitada no existe.';
  end if;

  -- La propiedad la fija la fracción; el cliente no puede apuntar a otra.
  new.property_id := fraccion.property_id;

  -- CA-06.4 · RF-06.5 · una fracción vendida no admite nueva invitación.
  if fraccion.status not in ('available', 'reserved') then
    raise exception 'RF-06.5 · solo se invita sobre una fracción disponible o reservada; esta está %.', fraccion.status;
  end if;

  -- RF-06.4 · vacío es «sin código»; escrito, tiene que tener formato plausible.
  if codigo is not null and private.normalizar_codigo_referido(codigo) is null then
    raise exception 'RF-06.4 · el código de referido «%» no tiene un formato válido.', codigo;
  end if;
  new.referral_code := private.normalizar_codigo_referido(codigo);

  new.invitee_email := lower(btrim(new.invitee_email));
  new.invitee_id := coalesce(new.invitee_id, private.cuenta_por_correo(new.invitee_email));
  new.invited_by := coalesce(new.invited_by, (select auth.uid()));
  new.status := 'pending';
  new.accepted_at := null;
  new.cancelled_at := null;

  return new;
end;
$$;

-- ── El código es parte de lo pactado: no se edita después ───────────────────
create or replace function private.validar_cambio_de_invitacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cerrando boolean := coalesce(current_setting('app.cerrando_compra', true), '') = 'true';
begin
  if new.fraction_id <> old.fraction_id
     or new.property_id <> old.property_id
     or new.invitee_email <> old.invitee_email
     or new.agreed_price <> old.agreed_price
     or new.referral_code is distinct from old.referral_code
     or new.invited_by is distinct from old.invited_by
     or new.created_at <> old.created_at then
    raise exception 'Una invitación no se edita: se cancela y se crea otra.';
  end if;

  if old.status <> 'pending' and new.status is distinct from old.status then
    raise exception 'Una invitación % ya no cambia de estado.', old.status;
  end if;

  if new.status = 'accepted' and not cerrando then
    raise exception 'RF-06.2 · una invitación se acepta cerrando la compra con public.cerrar_compra().';
  end if;

  if new.status = 'cancelled' and old.status = 'pending' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, (select auth.uid()));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- ── RF-06.2 · RF-06.3 · RF-06.4 · cierre: el perfil manda, la invitación suple ─
create or replace function public.cerrar_compra(invitacion uuid, precio_pactado bigint default null)
returns public.payment_plans
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inv public.purchase_invitations;
  fraccion public.fractions;
  comprador uuid;
  codigo text;
  precio bigint;
  plan public.payment_plans;
begin
  select * into inv from public.purchase_invitations where id = invitacion;
  if not found then
    raise exception 'La invitación no existe o no es visible para esta cuenta.';
  end if;
  if inv.status <> 'pending' then
    raise exception 'La invitación ya está %.', inv.status;
  end if;
  if not private.puede_gestionar_propiedad(inv.property_id) then
    raise exception 'CA-06.1 · solo el Administrador asignado cierra compras de esta propiedad.';
  end if;

  comprador := coalesce(inv.invitee_id, private.cuenta_por_correo(inv.invitee_email));
  if comprador is null then
    raise exception 'El invitado todavía no tiene cuenta: la compra se cierra cuando la tenga.';
  end if;

  select * into fraccion from public.fractions where id = inv.fraction_id;
  if fraccion.status not in ('available', 'reserved') then
    raise exception 'RF-06.5 · la fracción ya está %; no se vuelve a vender.', fraccion.status;
  end if;

  precio := coalesce(precio_pactado, inv.agreed_price);
  if precio is null or precio <= 0 then
    raise exception 'RF-58.1 · el precio pactado debe ser mayor que cero.';
  end if;

  -- RF-06.4 · la atribución del perfil manda (D-03); la de la invitación suple.
  codigo := coalesce(private.atribucion_de(comprador), inv.referral_code);

  -- RF-09.2 · la máquina de la fracción no se salta: de disponible, por reservada.
  if fraccion.status = 'available' then
    update public.fractions set status = 'reserved' where id = fraccion.id;
  end if;

  -- RF-06.2 · D-31 · eje 1: vendida y vinculada a su titular. El calendario no se toca.
  update public.fractions
     set status = 'sold', owner_id = comprador
   where id = fraccion.id;

  perform private.otorgar_rol_propietario(comprador);

  -- RF-06.3 · RF-58.1 · el plan, con el precio pactado congelado.
  perform set_config('app.cerrando_compra', 'true', true);

  insert into public.payment_plans (invitation_id, fraction_id, property_id, owner_id, agreed_price, referral_code)
  values (inv.id, fraccion.id, inv.property_id, comprador, precio, codigo)
  returning * into plan;

  update public.purchase_invitations
     set status = 'accepted', accepted_at = now(), invitee_id = comprador
   where id = inv.id;

  perform set_config('app.cerrando_compra', 'false', true);

  return plan;
end;
$$;
