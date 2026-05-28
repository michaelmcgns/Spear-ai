-- Spear subscriptions table
-- Run this in: Supabase Dashboard → SQL Editor → New query → Paste → Run

create table if not exists public.subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  plan                    text not null default 'free',
  status                  text not null default 'inactive',
  current_period_end      timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes for fast lookups
create index if not exists subscriptions_user_id_idx              on public.subscriptions(user_id);
create index if not exists subscriptions_stripe_customer_id_idx   on public.subscriptions(stripe_customer_id);
create index if not exists subscriptions_stripe_sub_id_idx        on public.subscriptions(stripe_subscription_id);

-- RLS
alter table public.subscriptions enable row level security;

-- Users can read their own subscription
create policy "users_read_own_subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Service role (webhook) can do everything — no policy needed for service_role
-- Anon/authenticated roles cannot write directly

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();
