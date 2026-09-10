-- HU-51 · RF-51.1…RF-51.7 · D-03, D-04 — la atribución del referido.
--
-- Es la historia de mayor riesgo del programa: de estas reglas depende que dos
-- Embajadores no se disputen la misma comisión. La base las repite todas porque
-- ninguna puede quedar solo en el cliente.
--
-- 1. **El clic se registra en el servidor.** `referral_clicks` guarda qué código
--    vio cada visitante y cuándo, contra un identificador anónimo de navegador.
--    Así la ventana de 90 días (D-03) no depende de una fecha que el cliente
--    pueda inventar al registrarse.
--
-- 2. **La primera atribución gana.** `attributions.prospect_id` es único: una vez
--    atribuido, un ingreso posterior con otro código no la sobreescribe
--    (RF-51.3, CA-51.1). Entre varios clics válidos gana el más antiguo.
--
-- 3. **Nadie se auto-refiere ni cobra fuera de plazo.** Mismo usuario o mismo
--    correo se ignora (RF-51.4); un clic de más de 90 días tampoco atribuye. Un
--    código inválido o inhabilitado no crea atribución y **no bloquea** el
--    registro del prospecto (RF-51.6, CA-51.5).
--
-- 4. **Una comisión por prospecto (D-04).** El ciclo del referido sigue a la
--    compra a través de los eventos del plan de pagos (HU-58), y solo la primera
--    compra que se completa queda marcada en `commissioned_purchase_id`.
--
-- Las mismas reglas están en `shared/referrals/attribution.ts`.

create type public.referral_stage as enum ('registered', 'payment_in_progress', 'paid');

-- ── RF-51.1 · el clic, antes de que exista la cuenta ────────────────────────
create table public.referral_clicks (
  id uuid primary key default gen_random_uuid(),
  -- Identificador anónimo del navegador (cookie `arena_ref_v`); no es una persona.
  visitor_id uuid not null,
  code text not null,
  clicked_at timestamptz not null default now(),

  -- Un visitante que vuelve con el mismo código conserva su primer clic.
  constraint referral_clicks_visitante_codigo unique (visitor_id, code)
);

comment on table public.referral_clicks is
  'HU-51 · RF-51.1 · D-03 · qué código vio cada visitante anónimo y cuándo; de aquí sale la ventana de 90 días.';

create index referral_clicks_visitante_idx on public.referral_clicks (visitor_id, clicked_at);

-- ── RF-51.1 · RF-51.5 · la atribución ───────────────────────────────────────
create table public.attributions (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors (id) on delete cascade,
  code text not null,
  -- RF-51.3 · CA-51.1 · un prospecto, una atribución: la primera gana.
  prospect_id uuid not null unique references auth.users (id) on delete cascade,
  prospect_email text not null,
  clicked_at timestamptz not null,
  registered_at timestamptz not null default now(),
  stage public.referral_stage not null default 'registered',
  -- D-04 · la única compra del referido que genera comisión.
  commissioned_purchase_id uuid unique references public.payment_plans (id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- CA-51.6 · D-03 · la ventana se comprueba también aquí: ninguna fila la viola.
  constraint attributions_dentro_de_la_ventana check (registered_at - clicked_at <= interval '90 days'),
  constraint attributions_clic_anterior_al_registro check (clicked_at <= registered_at)
);

comment on table public.attributions is
  'HU-51 · RF-51.1, RF-51.5 · D-03, D-04 · el prospecto atribuido a un Embajador, con su ciclo de vida y su única compra comisionada.';

create index attributions_embajador_idx on public.attributions (ambassador_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.referral_clicks enable row level security;
alter table public.referral_clicks force row level security;
alter table public.attributions enable row level security;
alter table public.attributions force row level security;

revoke all on table public.referral_clicks, public.attributions from anon, authenticated, service_role;
grant select on table public.attributions to authenticated, service_role;

-- Los clics no se leen desde la aplicación: solo los resuelve `attribute_referral`.
-- RF-51.5 · la atribución la ve su Embajador, el propio prospecto y el Superadmin.
create policy attributions_lectura on public.attributions for select to authenticated
  using (
    prospect_id = (select auth.uid())
    or private.es_superadmin()
    or exists (select 1 from public.ambassadors a where a.id = attributions.ambassador_id and a.user_id = (select auth.uid()))
  );

-- ── TR-01 · auditoría ───────────────────────────────────────────────────────
create trigger attributions_auditadas
  after insert or update or delete on public.attributions
  for each row execute function public.registrar_auditoria('attribution');

-- ── RF-51.1 · RF-51.6 · registrar un clic ───────────────────────────────────
create or replace function public.record_referral_click(visitor uuid, referral_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalizado text := private.normalizar_codigo_referido(referral_code);
begin
  if visitor is null or normalizado is null then
    return;
  end if;
  -- CA-51.5 · RF-51.6 · un código que no existe no se guarda y no rompe nada.
  if not exists (select 1 from public.referral_codes rc where rc.code = normalizado) then
    return;
  end if;

  insert into public.referral_clicks (visitor_id, code) values (visitor, normalizado)
  on conflict (visitor_id, code) do nothing;
end;
$$;

comment on function public.record_referral_click(uuid, text) is
  'HU-51 · RF-51.1 · D-03 · deja constancia del clic de un visitante anónimo; un código inexistente se ignora sin error.';

revoke execute on function public.record_referral_click(uuid, text) from public;
grant execute on function public.record_referral_click(uuid, text) to anon, authenticated, service_role;

-- ── RF-51.1…RF-51.4 · RF-51.6 · resolver la atribución ──────────────────────
/**
 * CA-51.1 · CA-51.2 · CA-51.5 · CA-51.6 · a quién queda atribuido quien acaba de
 * registrarse. Devuelve el código atribuido, o `null` si ninguno sirve; nunca
 * lanza por un código malo, porque no puede bloquear el registro (RF-51.6).
 *
 * Los candidatos son los clics del visitante más, al final, el código que llegue
 * suelto (formulario de registro o cookie). Gana el más antiguo que pase todas
 * las reglas.
 */
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
      return candidato.code;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.attribute_referral(uuid, text) is
  'HU-51 · RF-51.1…RF-51.4, RF-51.6 · CA-51.1, CA-51.2, CA-51.5, CA-51.6 · atribuye al prospecto que se registra; un código inservible no bloquea el flujo.';

revoke execute on function public.attribute_referral(uuid, text) from public, anon;
grant execute on function public.attribute_referral(uuid, text) to authenticated, service_role;

-- ── RF-51.5 · CA-51.3 · CA-51.4 · el ciclo de vida ──────────────────────────
/**
 * La tabla de transiciones de `shared/referrals/attribution.ts`, en la base. Una
 * transición inválida se rechaza en lugar de ignorarse: si la compra emite un
 * evento que el ciclo no admite, es un error que hay que ver, no un silencio.
 */
create or replace function private.advance_referral(prospecto uuid, event text, plan uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fila public.attributions;
  siguiente public.referral_stage;
begin
  select * into fila from public.attributions where prospect_id = prospecto;
  if fila.id is null then
    return;
  end if;

  siguiente := case
    when fila.stage = 'registered' and event = 'purchase_started' then 'payment_in_progress'
    when fila.stage = 'payment_in_progress' and event = 'payment_completed' then 'paid'
    when fila.stage = 'payment_in_progress' and event = 'purchase_voided' then 'registered'
    else null
  end;

  if siguiente is null then
    raise exception 'CA-51.4 · RF-51.5 · el referido en «%» no admite el hecho «%».', fila.stage, event;
  end if;

  perform set_config('app.audit_reason', 'Ciclo del referido: ' || event, true);
  update public.attributions
     set stage = siguiente,
         -- D-04 · CA-51.7 · solo la primera compra completada queda comisionada.
         commissioned_purchase_id = case
           when siguiente = 'paid' and fila.commissioned_purchase_id is null then plan
           else fila.commissioned_purchase_id
         end,
         updated_at = now()
   where id = fila.id;
  perform set_config('app.audit_reason', '', true);
end;
$$;

revoke execute on function private.advance_referral(uuid, text, uuid) from public, anon, authenticated;

-- El ciclo lo mueven los hechos de la compra (HU-06, HU-58), no la interfaz.
create or replace function private.referido_tras_cierre_de_compra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Solo avanza si el referido está donde corresponde: una segunda compra del
  -- mismo prospecto no reabre el ciclo (D-04).
  if exists (select 1 from public.attributions a where a.prospect_id = new.owner_id and a.stage = 'registered') then
    perform private.advance_referral(new.owner_id, 'purchase_started', new.id);
  end if;
  return new;
end;
$$;

create trigger payment_plans_mueven_el_referido
  after insert on public.payment_plans
  for each row execute function private.referido_tras_cierre_de_compra();

create or replace function private.referido_tras_evento_de_plan()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  titular uuid;
begin
  select p.owner_id into titular from public.payment_plans p where p.id = new.plan_id;
  if titular is null then
    return new;
  end if;

  if new.kind = 'payment_completed'
     and exists (select 1 from public.attributions a where a.prospect_id = titular and a.stage = 'payment_in_progress') then
    perform private.advance_referral(titular, 'payment_completed', new.plan_id);
  elsif new.kind = 'purchase_voided'
     and exists (select 1 from public.attributions a where a.prospect_id = titular and a.stage = 'payment_in_progress') then
    perform private.advance_referral(titular, 'purchase_voided', new.plan_id);
  end if;
  return new;
end;
$$;

create trigger payment_events_mueven_el_referido
  after insert on public.payment_events
  for each row execute function private.referido_tras_evento_de_plan();
