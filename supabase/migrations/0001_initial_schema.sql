-- ============================================================
-- YAAS Sales CRM — Initial schema
-- ============================================================
-- Run this in the Supabase SQL editor (or via the CLI).
-- It creates the core domain (leads, deals, activities, qualification),
-- a minimal users/profiles layer, helpful enums, indexes, RLS, and a
-- couple of convenience views the dashboard reads from.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------- enums ----------------------------------------------------------

do $$ begin
  create type deal_stage as enum (
    'new',
    'contacted',
    'call_booked',
    'call_held',
    'proposal_sent',
    'negotiating',
    'closed_won',
    'closed_lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source as enum (
    'yaas_form',
    'referral',
    'outbound',
    'inbound_email',
    'linkedin',
    'event',
    'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_type as enum (
    'note',
    'call',
    'email',
    'meeting',
    'task',
    'stage_change',
    'system'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type activity_status as enum ('pending', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------- profiles -------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  avatar_url text,
  role text default 'rep',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- leads ----------------------------------------------------------

create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references public.profiles(id) on delete set null,

  -- YAAS form fields
  name text not null,
  email text,
  phone text,
  company text,
  company_website text,
  role text,
  has_youtube_channel boolean default false,
  youtube_channel_link text,
  service_interest text,
  additional_info text,
  source lead_source default 'yaas_form',

  -- derived / CRM
  status text default 'active',
  tags text[] default '{}',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists leads_owner_idx on public.leads(owner_id);
create index if not exists leads_created_idx on public.leads(created_at desc);
create index if not exists leads_email_idx on public.leads(email);

-- ---------- deals ----------------------------------------------------------

create table if not exists public.deals (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete set null,

  title text,
  stage deal_stage not null default 'new',
  value_mrr numeric(12, 2) default 0,    -- monthly recurring
  value_one_time numeric(12, 2) default 0,
  probability int default 10,            -- 0..100
  expected_close_date date,
  closed_at timestamptz,
  loss_reason text,

  position int default 0,                -- per-stage manual ordering
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists deals_one_per_lead on public.deals(lead_id);
create index if not exists deals_stage_idx on public.deals(stage);
create index if not exists deals_owner_idx on public.deals(owner_id);

-- ---------- qualification --------------------------------------------------
-- One row per lead (BANT-ish, tailored for an editing agency)

create table if not exists public.qualifications (
  lead_id uuid primary key references public.leads(id) on delete cascade,

  budget_range text,                      -- e.g. "$2-5k/mo"
  decision_maker boolean,
  timeline text,                          -- "asap" | "1-3mo" | "3-6mo" | "exploring"
  current_editor text,                    -- e.g. "in-house", "freelancer", "none"
  videos_per_month int,
  pain_points text,
  goals text,
  fit_score int default 0,                -- 0..100

  notes text,
  updated_at timestamptz default now()
);

-- ---------- activities -----------------------------------------------------

create table if not exists public.activities (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,

  type activity_type not null,
  status activity_status default 'completed',
  title text,
  body text,
  metadata jsonb default '{}'::jsonb,    -- e.g. call duration, outcome, script checklist

  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists activities_lead_idx on public.activities(lead_id, created_at desc);
create index if not exists activities_due_idx on public.activities(due_at) where status = 'pending';

-- ---------- triggers: updated_at -------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_deals_updated on public.deals;
create trigger trg_deals_updated before update on public.deals
  for each row execute function public.set_updated_at();

-- ---------- triggers: auto-create deal + qualification on new lead ---------

create or replace function public.bootstrap_lead()
returns trigger language plpgsql as $$
begin
  insert into public.deals (lead_id, owner_id, title, stage)
  values (new.id, new.owner_id, coalesce(new.company, new.name), 'new')
  on conflict (lead_id) do nothing;

  insert into public.qualifications (lead_id)
  values (new.id)
  on conflict (lead_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_lead_bootstrap on public.leads;
create trigger trg_lead_bootstrap after insert on public.leads
  for each row execute function public.bootstrap_lead();

-- ---------- triggers: log stage change as activity -------------------------

create or replace function public.log_stage_change()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then
    insert into public.activities (lead_id, deal_id, user_id, type, title, body, metadata, completed_at)
    values (
      new.lead_id,
      new.id,
      new.owner_id,
      'stage_change',
      'Stage changed',
      format('%s → %s', old.stage, new.stage),
      jsonb_build_object('from', old.stage, 'to', new.stage),
      now()
    );

    if new.stage in ('closed_won', 'closed_lost') and new.closed_at is null then
      new.closed_at = now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_deal_stage_change on public.deals;
create trigger trg_deal_stage_change before update on public.deals
  for each row execute function public.log_stage_change();

-- ---------- profile auto-create on signup ----------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- views ----------------------------------------------------------

create or replace view public.pipeline_summary as
  select
    d.stage,
    count(*)::int            as deal_count,
    coalesce(sum(d.value_mrr), 0)::numeric        as total_mrr,
    coalesce(sum(d.value_one_time), 0)::numeric   as total_one_time
  from public.deals d
  group by d.stage;

create or replace view public.lead_overview as
  select
    l.*,
    d.id                 as deal_id,
    d.stage              as deal_stage,
    d.value_mrr,
    d.value_one_time,
    d.probability,
    d.expected_close_date,
    d.closed_at,
    d.position           as deal_position,
    q.fit_score
  from public.leads l
  left join public.deals d on d.lead_id = l.id
  left join public.qualifications q on q.lead_id = l.id;

-- ---------- row level security --------------------------------------------
-- Single-workspace setup: any authenticated user can read/write.
-- Swap these out when you add proper multi-tenancy.

alter table public.profiles       enable row level security;
alter table public.leads          enable row level security;
alter table public.deals          enable row level security;
alter table public.qualifications enable row level security;
alter table public.activities     enable row level security;

do $$ begin
  create policy "authenticated read profiles" on public.profiles
    for select to authenticated using (true);
  create policy "user updates own profile" on public.profiles
    for update to authenticated using (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "authenticated all leads" on public.leads
    for all to authenticated using (true) with check (true);
  create policy "authenticated all deals" on public.deals
    for all to authenticated using (true) with check (true);
  create policy "authenticated all qualifications" on public.qualifications
    for all to authenticated using (true) with check (true);
  create policy "authenticated all activities" on public.activities
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
