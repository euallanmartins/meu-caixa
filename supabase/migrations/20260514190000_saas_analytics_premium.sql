-- SaaS plans, feature flags and premium analytics foundation.

create table if not exists public.plans (
  id text primary key,
  name text not null,
  description text null,
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  max_barbers integer null,
  max_appointments_month integer null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  limit_value integer null,
  created_at timestamptz not null default now(),
  constraint plan_features_unique unique (plan_id, feature_key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null unique references public.barbearias(id) on delete cascade,
  plan_id text not null default 'free' references public.plans(id),
  status text not null default 'active',
  trial_ends_at timestamptz null,
  current_period_start timestamptz null,
  current_period_end timestamptz null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_check check (status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended'))
);

create table if not exists public.billing_history (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  subscription_id uuid null references public.subscriptions(id) on delete set null,
  amount_cents integer not null,
  currency text not null default 'BRL',
  status text not null,
  description text null,
  external_reference text null,
  paid_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  barbearia_id uuid not null references public.barbearias(id) on delete cascade,
  user_id uuid null references auth.users(id) on delete set null,
  cliente_id uuid null references public.clientes(id) on delete set null,
  barbeiro_id uuid null references public.barbeiros(id) on delete set null,
  agendamento_id uuid null references public.agendamentos(id) on delete set null,
  event_type text not null,
  event_source text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_plan_features_plan_feature on public.plan_features (plan_id, feature_key);
create index if not exists idx_subscriptions_barbearia on public.subscriptions (barbearia_id, plan_id, status);
create index if not exists idx_billing_history_barbearia_created on public.billing_history (barbearia_id, created_at desc);
create index if not exists idx_analytics_events_barbearia_type_created on public.analytics_events (barbearia_id, event_type, created_at desc);
create index if not exists idx_analytics_events_barbearia_created on public.analytics_events (barbearia_id, created_at desc);

create or replace function public.set_saas_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_saas_updated_at();

alter table public.plans enable row level security;
alter table public.plan_features enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_history enable row level security;
alter table public.analytics_events enable row level security;

grant select on public.plans to anon, authenticated;
grant select on public.plan_features to anon, authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.billing_history to authenticated;
grant select, insert on public.analytics_events to authenticated;

drop policy if exists "plans_select_public" on public.plans;
create policy "plans_select_public"
on public.plans for select
to anon, authenticated
using (is_active = true or public.current_user_is_platform_admin());

drop policy if exists "plan_features_select_public" on public.plan_features;
create policy "plan_features_select_public"
on public.plan_features for select
to anon, authenticated
using (
  exists (
    select 1 from public.plans p
    where p.id = plan_features.plan_id
      and (p.is_active = true or public.current_user_is_platform_admin())
  )
);

drop policy if exists "subscriptions_select_tenant_or_platform" on public.subscriptions;
create policy "subscriptions_select_tenant_or_platform"
on public.subscriptions for select
to authenticated
using (
  public.current_user_is_platform_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = subscriptions.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
  )
);

drop policy if exists "subscriptions_platform_all" on public.subscriptions;
create policy "subscriptions_platform_all"
on public.subscriptions for all
to authenticated
using (public.current_user_is_platform_admin())
with check (public.current_user_is_platform_admin());

drop policy if exists "billing_history_select_tenant_or_platform" on public.billing_history;
create policy "billing_history_select_tenant_or_platform"
on public.billing_history for select
to authenticated
using (
  public.current_user_is_platform_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = billing_history.barbearia_id
      and coalesce(p.role, '') in ('owner', 'proprietario', 'admin')
  )
);

drop policy if exists "billing_history_platform_all" on public.billing_history;
create policy "billing_history_platform_all"
on public.billing_history for all
to authenticated
using (public.current_user_is_platform_admin())
with check (public.current_user_is_platform_admin());

drop policy if exists "analytics_events_select_tenant_or_platform" on public.analytics_events;
create policy "analytics_events_select_tenant_or_platform"
on public.analytics_events for select
to authenticated
using (
  public.current_user_is_platform_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.barbearia_id = analytics_events.barbearia_id
      and (
        coalesce(p.role, '') in ('owner', 'proprietario', 'admin', 'gerente')
        or (coalesce(p.role, '') = 'barbeiro' and p.barbeiro_id = analytics_events.barbeiro_id)
      )
  )
);

drop policy if exists "analytics_events_insert_authenticated_tenant" on public.analytics_events;
create policy "analytics_events_insert_authenticated_tenant"
on public.analytics_events for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.barbearias b
    where b.id = analytics_events.barbearia_id
  )
);

insert into public.plans (id, name, description, price_cents, currency, max_barbers, max_appointments_month, is_active)
values
  ('free', 'Free', 'Agenda basica para comecar.', 0, 'BRL', 1, 30, true),
  ('starter', 'Starter', 'Operacao inicial com CRM basico e links publicos.', 6900, 'BRL', 3, 300, true),
  ('pro', 'Pro', 'Relatorios premium, automacoes e barbeiros ilimitados.', 14900, 'BRL', null, null, true),
  ('premium', 'Premium', 'Analytics marketplace, IA insights e suporte prioritario.', 29900, 'BRL', null, null, true)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    max_barbers = excluded.max_barbers,
    max_appointments_month = excluded.max_appointments_month,
    is_active = excluded.is_active;

insert into public.plan_features (plan_id, feature_key, enabled, limit_value)
values
  ('free', 'premium_reports', false, null),
  ('free', 'advanced_analytics', false, null),
  ('free', 'marketing_automation', false, null),
  ('free', 'push_notifications', false, null),
  ('free', 'waitlist', false, null),
  ('free', 'promotions', false, null),
  ('free', 'custom_forms', false, null),
  ('free', 'qr_code_links', false, null),
  ('free', 'multi_barber', false, 1),
  ('free', 'unlimited_barbers', false, 1),
  ('free', 'barber_commissions', false, null),
  ('free', 'marketplace_analytics', false, null),
  ('free', 'ai_insights', false, null),
  ('free', 'priority_support', false, null),
  ('free', 'multi_unit', false, null),
  ('starter', 'premium_reports', false, null),
  ('starter', 'advanced_analytics', false, null),
  ('starter', 'marketing_automation', false, null),
  ('starter', 'push_notifications', false, null),
  ('starter', 'waitlist', false, null),
  ('starter', 'promotions', false, null),
  ('starter', 'custom_forms', false, null),
  ('starter', 'qr_code_links', true, null),
  ('starter', 'multi_barber', true, 3),
  ('starter', 'unlimited_barbers', false, 3),
  ('starter', 'barber_commissions', false, null),
  ('starter', 'marketplace_analytics', false, null),
  ('starter', 'ai_insights', false, null),
  ('starter', 'priority_support', false, null),
  ('starter', 'multi_unit', false, null),
  ('pro', 'premium_reports', true, null),
  ('pro', 'advanced_analytics', true, null),
  ('pro', 'marketing_automation', true, null),
  ('pro', 'push_notifications', true, null),
  ('pro', 'waitlist', true, null),
  ('pro', 'promotions', true, null),
  ('pro', 'custom_forms', true, null),
  ('pro', 'qr_code_links', true, null),
  ('pro', 'multi_barber', true, null),
  ('pro', 'unlimited_barbers', true, null),
  ('pro', 'barber_commissions', true, null),
  ('pro', 'marketplace_analytics', false, null),
  ('pro', 'ai_insights', false, null),
  ('pro', 'priority_support', false, null),
  ('pro', 'multi_unit', false, null),
  ('premium', 'premium_reports', true, null),
  ('premium', 'advanced_analytics', true, null),
  ('premium', 'marketing_automation', true, null),
  ('premium', 'push_notifications', true, null),
  ('premium', 'waitlist', true, null),
  ('premium', 'promotions', true, null),
  ('premium', 'custom_forms', true, null),
  ('premium', 'qr_code_links', true, null),
  ('premium', 'multi_barber', true, null),
  ('premium', 'unlimited_barbers', true, null),
  ('premium', 'barber_commissions', true, null),
  ('premium', 'marketplace_analytics', true, null),
  ('premium', 'ai_insights', true, null),
  ('premium', 'priority_support', true, null),
  ('premium', 'multi_unit', true, null)
on conflict (plan_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value;

insert into public.subscriptions (barbearia_id, plan_id, status, current_period_start)
select b.id, coalesce(nullif(lower(b.plan_name), ''), 'pro'), 'active', now()
from public.barbearias b
where coalesce(nullif(lower(b.plan_name), ''), 'pro') in ('free', 'starter', 'pro', 'premium')
on conflict (barbearia_id) do nothing;

insert into public.subscriptions (barbearia_id, plan_id, status, current_period_start)
select b.id, 'pro', 'active', now()
from public.barbearias b
where not exists (select 1 from public.subscriptions s where s.barbearia_id = b.id)
on conflict (barbearia_id) do nothing;

create or replace function public.rpc_can_use_feature(
  p_barbearia_id uuid,
  p_feature_key text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_plan_id text := 'free';
  v_status text := 'active';
  v_enabled boolean := false;
  v_limit integer;
begin
  if p_barbearia_id is null or nullif(trim(coalesce(p_feature_key, '')), '') is null then
    return jsonb_build_object('enabled', false, 'plan_id', 'free', 'status', 'invalid');
  end if;

  select id, role, barbearia_id
    into v_profile
  from public.profiles
  where id = auth.uid();

  if auth.uid() is not null and not public.current_user_is_platform_admin() then
    if v_profile.id is null or v_profile.barbearia_id <> p_barbearia_id then
      return jsonb_build_object('enabled', false, 'plan_id', 'free', 'status', 'forbidden');
    end if;
  end if;

  select s.plan_id, s.status
    into v_plan_id, v_status
  from public.subscriptions s
  where s.barbearia_id = p_barbearia_id
  limit 1;

  v_plan_id := coalesce(v_plan_id, 'free');
  v_status := coalesce(v_status, 'active');

  select coalesce(pf.enabled, false), pf.limit_value
    into v_enabled, v_limit
  from public.plan_features pf
  where pf.plan_id = v_plan_id
    and pf.feature_key = p_feature_key
  limit 1;

  if v_status not in ('active', 'trialing') then
    v_enabled := false;
  end if;

  return jsonb_build_object(
    'enabled', coalesce(v_enabled, false),
    'plan_id', v_plan_id,
    'status', v_status,
    'feature_key', p_feature_key,
    'limit_value', v_limit
  );
end;
$$;

create or replace function public.rpc_track_analytics_event(
  p_barbearia_id uuid,
  p_event_type text,
  p_event_source text default null,
  p_cliente_id uuid default null,
  p_barbeiro_id uuid default null,
  p_agendamento_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text := trim(coalesce(p_event_type, ''));
  v_event_id uuid;
begin
  if p_barbearia_id is null or not exists (select 1 from public.barbearias b where b.id = p_barbearia_id) then
    raise exception 'Barbearia invalida.';
  end if;

  if v_event_type not in (
    'public_profile_view', 'click_agendar', 'click_whatsapp', 'click_instagram',
    'appointment_created', 'appointment_accepted', 'appointment_rejected',
    'appointment_cancelled', 'appointment_completed', 'checkout_completed',
    'review_created', 'campaign_sent', 'campaign_converted'
  ) then
    raise exception 'Evento invalido.';
  end if;

  if p_cliente_id is not null and not exists (
    select 1 from public.clientes c where c.id = p_cliente_id and c.barbearia_id = p_barbearia_id
  ) then
    raise exception 'Cliente invalido.';
  end if;

  if p_barbeiro_id is not null and not exists (
    select 1 from public.barbeiros b where b.id = p_barbeiro_id and b.barbearia_id = p_barbearia_id
  ) then
    raise exception 'Barbeiro invalido.';
  end if;

  if p_agendamento_id is not null and not exists (
    select 1 from public.agendamentos a where a.id = p_agendamento_id and a.barbearia_id = p_barbearia_id
  ) then
    raise exception 'Agendamento invalido.';
  end if;

  insert into public.analytics_events (
    barbearia_id, user_id, cliente_id, barbeiro_id, agendamento_id, event_type, event_source, metadata
  )
  values (
    p_barbearia_id,
    auth.uid(),
    p_cliente_id,
    p_barbeiro_id,
    p_agendamento_id,
    v_event_type,
    nullif(trim(coalesce(p_event_source, '')), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return jsonb_build_object('success', true, 'event_id', v_event_id);
end;
$$;

create or replace function public.rpc_platform_set_subscription_plan(
  p_barbearia_id uuid,
  p_plan_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan_id text := lower(trim(coalesce(p_plan_id, '')));
begin
  if auth.uid() is null or not public.current_user_is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  if not exists (select 1 from public.barbearias b where b.id = p_barbearia_id) then
    raise exception 'Barbearia invalida.';
  end if;

  if not exists (select 1 from public.plans p where p.id = v_plan_id and p.is_active = true) then
    raise exception 'Plano invalido.';
  end if;

  insert into public.subscriptions (barbearia_id, plan_id, status, current_period_start)
  values (p_barbearia_id, v_plan_id, 'active', now())
  on conflict (barbearia_id) do update
  set plan_id = excluded.plan_id,
      status = case when public.subscriptions.status in ('cancelled', 'suspended') then 'active' else public.subscriptions.status end,
      current_period_start = coalesce(public.subscriptions.current_period_start, now());

  update public.barbearias
  set plan_name = v_plan_id
  where id = p_barbearia_id;

  return jsonb_build_object('success', true, 'barbearia_id', p_barbearia_id, 'plan_id', v_plan_id);
end;
$$;

create or replace function public.rpc_platform_update_subscription_status(
  p_barbearia_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if auth.uid() is null or not public.current_user_is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  if v_status not in ('trialing', 'active', 'past_due', 'cancelled', 'suspended') then
    raise exception 'Status invalido.';
  end if;

  insert into public.subscriptions (barbearia_id, plan_id, status, current_period_start)
  values (p_barbearia_id, 'free', v_status, now())
  on conflict (barbearia_id) do update
  set status = excluded.status;

  return jsonb_build_object('success', true, 'barbearia_id', p_barbearia_id, 'status', v_status);
end;
$$;

create or replace function public.rpc_platform_get_subscription_summary()
returns table (
  barbearia_id uuid,
  plan_id text,
  plan_name text,
  status text,
  max_barbers integer,
  max_appointments_month integer,
  current_period_end timestamptz,
  cancel_at_period_end boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.current_user_is_platform_admin() then
    raise exception 'Acesso negado.';
  end if;

  return query
  select
    b.id,
    coalesce(s.plan_id, 'free')::text,
    coalesce(p.name, 'Free')::text,
    coalesce(s.status, 'active')::text,
    p.max_barbers,
    p.max_appointments_month,
    s.current_period_end,
    coalesce(s.cancel_at_period_end, false)
  from public.barbearias b
  left join public.subscriptions s on s.barbearia_id = b.id
  left join public.plans p on p.id = coalesce(s.plan_id, 'free');
end;
$$;

create or replace function public.rpc_get_dashboard_premium_metrics(
  p_barbearia_id uuid,
  p_start_date date,
  p_end_date date
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile record;
  v_start timestamptz := p_start_date::timestamptz;
  v_end timestamptz := (p_end_date + 1)::timestamptz;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Login necessario.';
  end if;

  select id, role, barbearia_id, barbeiro_id
    into v_profile
  from public.profiles
  where id = auth.uid();

  if not public.current_user_is_platform_admin() then
    if v_profile.id is null or v_profile.barbearia_id <> p_barbearia_id then
      raise exception 'Acesso negado.';
    end if;
  end if;

  with appointments as (
    select a.*
    from public.agendamentos a
    where a.barbearia_id = p_barbearia_id
      and a.data_hora_inicio >= v_start
      and a.data_hora_inicio < v_end
      and (
        coalesce(v_profile.role, '') <> 'barbeiro'
        or a.barbeiro_id = v_profile.barbeiro_id
        or public.current_user_is_platform_admin()
      )
  ),
  transactions as (
    select t.*
    from public.transacoes t
    where t.barbearia_id = p_barbearia_id
      and t.data >= v_start
      and t.data < v_end
      and (
        coalesce(v_profile.role, '') <> 'barbeiro'
        or t.barbeiro_id = v_profile.barbeiro_id
        or public.current_user_is_platform_admin()
      )
  ),
  analytics as (
    select event_type, count(*)::int as total
    from public.analytics_events e
    where e.barbearia_id = p_barbearia_id
      and e.created_at >= v_start
      and e.created_at < v_end
    group by event_type
  )
  select jsonb_build_object(
    'total_agendamentos', (select count(*) from appointments),
    'agendamentos_concluidos', (select count(*) from appointments where status in ('concluido', 'realizado', 'atendido')),
    'agendamentos_pendentes', (select count(*) from appointments where status = 'pendente'),
    'agendamentos_cancelados', (select count(*) from appointments where status in ('cancelado', 'recusado')),
    'faturamento', coalesce((select sum(valor_total) from transactions), 0),
    'ticket_medio', coalesce((select avg(valor_total) from transactions), 0),
    'clientes_novos', (
      select count(*) from public.clientes c
      where c.barbearia_id = p_barbearia_id
        and c.created_at >= v_start
        and c.created_at < v_end
    ),
    'profile_views', coalesce((select total from analytics where event_type = 'public_profile_view'), 0),
    'click_agendar', coalesce((select total from analytics where event_type = 'click_agendar'), 0),
    'click_whatsapp', coalesce((select total from analytics where event_type = 'click_whatsapp'), 0),
    'click_instagram', coalesce((select total from analytics where event_type = 'click_instagram'), 0)
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.rpc_get_financial_metrics(p_barbearia_id uuid, p_start_date date, p_end_date date)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.rpc_get_dashboard_premium_metrics(p_barbearia_id, p_start_date, p_end_date) $$;

create or replace function public.rpc_get_client_retention_metrics(p_barbearia_id uuid, p_start_date date, p_end_date date)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.rpc_get_dashboard_premium_metrics(p_barbearia_id, p_start_date, p_end_date) $$;

create or replace function public.rpc_get_barber_performance_metrics(p_barbearia_id uuid, p_start_date date, p_end_date date)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.rpc_get_dashboard_premium_metrics(p_barbearia_id, p_start_date, p_end_date) $$;

create or replace function public.rpc_get_marketplace_metrics(p_barbearia_id uuid, p_start_date date, p_end_date date)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.rpc_get_dashboard_premium_metrics(p_barbearia_id, p_start_date, p_end_date) $$;

create or replace function public.rpc_get_service_performance_metrics(p_barbearia_id uuid, p_start_date date, p_end_date date)
returns jsonb language sql security definer set search_path = public, pg_temp
as $$ select public.rpc_get_dashboard_premium_metrics(p_barbearia_id, p_start_date, p_end_date) $$;

revoke all on function public.rpc_can_use_feature(uuid, text) from public;
revoke all on function public.rpc_track_analytics_event(uuid, text, text, uuid, uuid, uuid, jsonb) from public;
revoke all on function public.rpc_platform_set_subscription_plan(uuid, text) from public;
revoke all on function public.rpc_platform_update_subscription_status(uuid, text) from public;
revoke all on function public.rpc_platform_get_subscription_summary() from public;
revoke all on function public.rpc_get_dashboard_premium_metrics(uuid, date, date) from public;
revoke all on function public.rpc_get_financial_metrics(uuid, date, date) from public;
revoke all on function public.rpc_get_client_retention_metrics(uuid, date, date) from public;
revoke all on function public.rpc_get_barber_performance_metrics(uuid, date, date) from public;
revoke all on function public.rpc_get_marketplace_metrics(uuid, date, date) from public;
revoke all on function public.rpc_get_service_performance_metrics(uuid, date, date) from public;

grant execute on function public.rpc_can_use_feature(uuid, text) to authenticated;
grant execute on function public.rpc_track_analytics_event(uuid, text, text, uuid, uuid, uuid, jsonb) to anon, authenticated;
grant execute on function public.rpc_platform_set_subscription_plan(uuid, text) to authenticated;
grant execute on function public.rpc_platform_update_subscription_status(uuid, text) to authenticated;
grant execute on function public.rpc_platform_get_subscription_summary() to authenticated;
grant execute on function public.rpc_get_dashboard_premium_metrics(uuid, date, date) to authenticated;
grant execute on function public.rpc_get_financial_metrics(uuid, date, date) to authenticated;
grant execute on function public.rpc_get_client_retention_metrics(uuid, date, date) to authenticated;
grant execute on function public.rpc_get_barber_performance_metrics(uuid, date, date) to authenticated;
grant execute on function public.rpc_get_marketplace_metrics(uuid, date, date) to authenticated;
grant execute on function public.rpc_get_service_performance_metrics(uuid, date, date) to authenticated;
