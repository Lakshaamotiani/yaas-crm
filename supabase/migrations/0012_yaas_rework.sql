-- ============================================================
-- YAAS Sales CRM — schema migration for branding + scope rework
-- ============================================================
-- Changes in this migration:
--   1. Pipeline stages: add `contract` stage between closed_won and
--      operationalized (kind = 'won').
--   2. Leads: replace `service_interest` (free text) with `service_type`
--      (enum-constrained text), dropping the old column.
--   3. Qualifications: drop `timeline`, `current_editor`, `videos_per_month`.
--   4. Deals: drop `editors_needed`.
--   5. Companies: add `priority` (high | medium | low | null).
--   6. New table `onboardings` (1:1 with leads, auto-created when a deal
--      enters a 'won' stage). Mirrors the bootstrap_lead trigger pattern.
--
-- Destructive: drops 4 columns (service_interest, timeline,
-- current_editor, videos_per_month, editors_needed). Take a backup before
-- running this in any environment that has real data.
-- ============================================================

-- ---------- pipeline_stages: insert 'contract' --------------------------
-- Shift operationalized + closed_lost down a slot to make room. The FK on
-- deals.stage references pipeline_stages.id, which is text (not the
-- old enum), so we can reorder by updating `position` without touching
-- any deal rows.

update public.pipeline_stages set position = 9 where id = 'closed_lost';
update public.pipeline_stages set position = 8 where id = 'operationalized';

insert into public.pipeline_stages (id, label, position, kind, tone, is_default)
values ('contract', 'Contract', 7, 'won', 'won', false)
on conflict (id) do nothing;

-- ---------- leads.service_type (replaces service_interest) --------------

alter table public.leads
  add column if not exists service_type text;

-- Constrain to the 7 supported service ids. Null is allowed for leads
-- that haven't been qualified yet.
alter table public.leads
  drop constraint if exists leads_service_type_check;
alter table public.leads
  add constraint leads_service_type_check
  check (service_type is null or service_type in (
    'e2e_surrogate', 'e2e_branded', 'influencer_marketing',
    'podcast_production', 'one_time_project', 'e2e_founder_led', 'ai_videos'
  ));

-- Best-effort migration of existing free-text service_interest values
-- into the new enum. Unmatched values become NULL — operators can
-- re-qualify them from the UI.
update public.leads set service_type = case
  when service_interest ilike '%podcast%'                       then 'podcast_production'
  when service_interest ilike '%one-time%' or
       service_interest ilike '%one time%'                      then 'one_time_project'
  when service_interest ilike '%ai%'                            then 'ai_videos'
  when service_interest ilike '%influencer%'                    then 'influencer_marketing'
  when service_interest ilike '%founder%'                       then 'e2e_founder_led'
  when service_interest ilike '%surrogate%'                     then 'e2e_surrogate'
  when service_interest ilike '%branded%' or
       service_interest ilike '%channel%'  or
       service_interest ilike '%youtube%'                       then 'e2e_branded'
  else null
end
where service_interest is not null and service_type is null;

alter table public.leads drop column if exists service_interest;

-- ---------- qualifications: drop deprecated fields ----------------------

alter table public.qualifications drop column if exists timeline;
alter table public.qualifications drop column if exists current_editor;
alter table public.qualifications drop column if exists videos_per_month;

-- ---------- deals: drop editors_needed ----------------------------------

alter table public.deals drop column if exists editors_needed;

-- ---------- companies.priority ------------------------------------------

alter table public.companies
  add column if not exists priority text;

alter table public.companies
  drop constraint if exists companies_priority_check;
alter table public.companies
  add constraint companies_priority_check
  check (priority is null or priority in ('high', 'medium', 'low'));

-- ---------- onboardings -------------------------------------------------

create table if not exists public.onboardings (
  lead_id                   uuid primary key references public.leads(id) on delete cascade,

  -- final scope of work
  final_scope_of_work       text,
  number_of_videos          int,
  format                    text,
  go_live_timeline          text,
  platform                  text,
  team_required             text,

  -- ops checkpoints
  operationalised           boolean not null default false,
  first_video_live_link     text,
  finance_team_looped_in    boolean not null default false,
  account_manager_assigned  boolean not null default false,

  -- contact mirrors (kept in sync via app code; lead is source of truth)
  poc_name                  text,
  lead_source               text,
  whatsapp_number           text,
  email                     text,

  -- workflow
  next_action               text,
  next_action_date          date,
  daily_notes               text,

  -- document trail
  briefing_doc_url          text,
  pitch_deck_url            text,
  proposal_doc_url          text,
  final_msa_url             text,
  signed_sow_url            text,
  po_first_invoice_url      text,
  final_int_brief_url       text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

drop trigger if exists trg_onboardings_updated on public.onboardings;
create trigger trg_onboardings_updated before update on public.onboardings
  for each row execute function public.set_updated_at();

-- ---------- bootstrap_onboarding ----------------------------------------
-- When a deal enters a 'won' kind stage for the first time, insert an
-- empty onboarding row for the lead. Seeded with mirrors from the lead
-- (poc_name, email, whatsapp_number, lead_source) so ops doesn't open an
-- empty form. Idempotent — on subsequent moves within won stages the
-- ON CONFLICT no-ops.

create or replace function public.bootstrap_onboarding()
returns trigger language plpgsql as $$
declare
  new_kind text;
  old_kind text;
  v_name   text;
  v_email  text;
  v_phone  text;
  v_source text;
begin
  -- Resolve the stage kinds for old + new values. If we can't resolve
  -- (e.g. stage row deleted mid-flight) treat as 'open' to avoid spurious
  -- inserts.
  select kind into new_kind from public.pipeline_stages where id = new.stage;
  if tg_op = 'UPDATE' then
    select kind into old_kind from public.pipeline_stages where id = old.stage;
  end if;

  if new_kind = 'won' and coalesce(old_kind, 'open') <> 'won' then
    select name, email, phone, source::text
      into v_name, v_email, v_phone, v_source
      from public.leads where id = new.lead_id;
    insert into public.onboardings (
      lead_id, poc_name, email, whatsapp_number, lead_source
    ) values (
      new.lead_id, v_name, v_email, v_phone, v_source
    ) on conflict (lead_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bootstrap_onboarding on public.deals;
create trigger trg_bootstrap_onboarding
  after insert or update of stage on public.deals
  for each row execute function public.bootstrap_onboarding();

-- ---------- RLS on onboardings ------------------------------------------
-- Mirror the policy on qualifications: authenticated users have full
-- access. Swap for tenant-scoped policies before going multi-org.

alter table public.onboardings enable row level security;

drop policy if exists onboardings_all on public.onboardings;
create policy onboardings_all on public.onboardings
  for all to authenticated using (true) with check (true);

-- ---------- lead_overview view: drop dropped columns --------------------
-- The view was rebuilt in 0011 to include editors_needed; rebuild again
-- without it. We keep the rest of the projection identical so callers
-- don't break.

drop view if exists public.lead_overview;

create view public.lead_overview as
select
  l.id,
  l.owner_id,
  l.company_id,
  l.name,
  l.email,
  l.phone,
  l.role,
  l.service_type,
  l.additional_info,
  l.source,
  l.status,
  l.tags,
  l.source_submission_id,
  l.created_at,
  l.updated_at,
  d.id          as deal_id,
  d.stage       as deal_stage,
  d.value_mrr,
  d.value_one_time,
  d.value_currency,
  d.probability,
  d.expected_close_date,
  d.closed_at,
  d.position    as deal_position,
  q.fit_score
from public.leads l
left join public.deals d on d.lead_id = l.id
left join public.qualifications q on q.lead_id = l.id;

-- ---------- pipeline_summary view: rebuild without editors_needed -------

drop view if exists public.pipeline_summary;

create view public.pipeline_summary as
select
  ps.id   as stage_id,
  ps.label as stage_label,
  ps.position,
  ps.kind,
  count(d.id)            as deal_count,
  coalesce(sum(d.value_mrr), 0)       as total_mrr,
  coalesce(sum(d.value_one_time), 0)  as total_one_time
from public.pipeline_stages ps
left join public.deals d on d.stage = ps.id
group by ps.id, ps.label, ps.position, ps.kind
order by ps.position;
