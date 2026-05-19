-- ============================================================
-- YAAS Sales CRM — configurable pipeline stages
-- ============================================================
-- Promotes the hardcoded `deal_stage` enum to a `pipeline_stages` config
-- table so admins can add / rename / recolor / reorder / remove stages.
--
-- Semantic safety: every stage has a `kind` of open | won | lost. All
-- dashboard math (win rate, closed MRR, "editors placed", open pipeline)
-- keys on `kind`, never on a literal stage id — so renaming or adding
-- stages can't silently break analytics. `is_default` marks where new
-- deals land (bootstrap_lead).
--
-- deals.stage moves from the enum to text + FK → pipeline_stages(id).
-- Existing rows already hold the seeded ids ('new', …) so the cast and
-- FK validate cleanly.
-- ============================================================

-- ---------- pipeline_stages -------------------------------------------------

create table if not exists public.pipeline_stages (
  id          text primary key,
  label       text not null,
  position    int  not null,
  kind        text not null default 'open' check (kind in ('open', 'won', 'lost')),
  -- One of the fixed colour tokens defined in globals.css / tailwind. The
  -- UI restricts custom stages to this palette (Tailwind can't JIT a
  -- dynamic class name).
  tone        text not null default 'new'
                check (tone in ('new','contacted','booked','held','proposal','negotiating','won','lost')),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed the eight stages that were previously the enum, preserving ids,
-- labels, order, colours, and assigning semantic kinds.
insert into public.pipeline_stages (id, label, position, kind, tone, is_default) values
  ('new',           'New',           0, 'open', 'new',         true),
  ('contacted',     'Contacted',     1, 'open', 'contacted',   false),
  ('call_booked',   'Call Booked',   2, 'open', 'booked',      false),
  ('call_held',     'Call Held',     3, 'open', 'held',        false),
  ('proposal_sent', 'Proposal Sent', 4, 'open', 'proposal',    false),
  ('negotiating',   'Negotiating',   5, 'open', 'negotiating', false),
  ('closed_won',    'Closed Won',    6, 'won',  'won',         false),
  ('closed_lost',   'Closed Lost',   7, 'lost', 'lost',        false)
on conflict (id) do nothing;

drop trigger if exists trg_pipeline_stages_updated on public.pipeline_stages;
create trigger trg_pipeline_stages_updated before update on public.pipeline_stages
  for each row execute function public.set_updated_at();

-- ---------- deals.stage : enum → text + FK ---------------------------------
-- Drop everything that depends on the column / enum first, alter, recreate.

drop view if exists public.lead_overview;
drop view if exists public.pipeline_summary;
drop trigger if exists trg_deal_stage_change on public.deals;

alter table public.deals alter column stage drop default;
alter table public.deals alter column stage type text using stage::text;
alter table public.deals alter column stage set default 'new';

-- The enum is no longer referenced anywhere; remove it.
drop type if exists deal_stage;

alter table public.deals
  drop constraint if exists deals_stage_fkey;
alter table public.deals
  add constraint deals_stage_fkey
  foreign key (stage) references public.pipeline_stages (id) on update cascade;

-- ---------- log_stage_change : kind-aware ----------------------------------
-- closed_at is set when entering a won/lost stage and cleared when moving
-- back to an open one — so a mis-click that reopens a deal also reopens
-- its close date instead of leaving stale analytics.

create or replace function public.log_stage_change()
returns trigger language plpgsql as $$
declare
  new_kind text;
begin
  if new.stage is distinct from old.stage then
    insert into public.activities
      (lead_id, deal_id, user_id, type, title, body, metadata, completed_at)
    values (
      new.lead_id, new.id, new.owner_id, 'stage_change', 'Stage changed',
      format('%s → %s', old.stage, new.stage),
      jsonb_build_object('from', old.stage, 'to', new.stage),
      now()
    );

    select kind into new_kind from public.pipeline_stages where id = new.stage;
    if new_kind in ('won', 'lost') then
      if new.closed_at is null then new.closed_at = now(); end if;
    else
      new.closed_at = null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_deal_stage_change on public.deals;
create trigger trg_deal_stage_change before update on public.deals
  for each row execute function public.log_stage_change();

-- ---------- bootstrap_lead : start at the default stage --------------------

create or replace function public.bootstrap_lead()
returns trigger language plpgsql as $$
declare
  derived_title text;
  start_stage   text;
begin
  if new.company_id is not null then
    select c.name into derived_title
      from public.companies c
     where c.id = new.company_id;
  end if;

  select id into start_stage
    from public.pipeline_stages
   where is_default
   order by position asc
   limit 1;
  start_stage := coalesce(start_stage, 'new');

  insert into public.deals (lead_id, owner_id, title, stage)
  values (new.id, new.owner_id, coalesce(derived_title, new.name), start_stage)
  on conflict (lead_id) do nothing;

  insert into public.qualifications (lead_id)
  values (new.id)
  on conflict (lead_id) do nothing;

  return new;
end $$;

drop trigger if exists trg_lead_bootstrap on public.leads;
create trigger trg_lead_bootstrap after insert on public.leads
  for each row execute function public.bootstrap_lead();

-- ---------- rebuild views --------------------------------------------------

create view public.pipeline_summary as
  select
    d.stage,
    count(*)::int                                 as deal_count,
    coalesce(sum(d.value_mrr), 0)::numeric         as total_mrr,
    coalesce(sum(d.value_one_time), 0)::numeric    as total_one_time
  from public.deals d
  group by d.stage;

create view public.lead_overview as
  select
    l.*,
    c.name              as company_name,
    c.domain            as company_domain,
    c.links             as company_links,
    c.industry          as company_industry,
    d.id                 as deal_id,
    d.stage              as deal_stage,
    d.editors_needed,
    d.value_mrr,
    d.value_one_time,
    d.value_currency,
    d.probability,
    d.expected_close_date,
    d.closed_at,
    d.position           as deal_position,
    q.fit_score
  from public.leads l
  left join public.companies c on c.id = l.company_id
  left join public.deals d     on d.lead_id = l.id
  left join public.qualifications q on q.lead_id = l.id;

-- ---------- RLS ------------------------------------------------------------
-- Everyone signed in can read stages (the whole app renders them); only
-- admins mutate the pipeline definition.

alter table public.pipeline_stages enable row level security;

drop policy if exists "authenticated read stages" on public.pipeline_stages;
drop policy if exists "admins write stages"        on public.pipeline_stages;

create policy "authenticated read stages" on public.pipeline_stages
  for select to authenticated using (true);

create policy "admins write stages" on public.pipeline_stages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
