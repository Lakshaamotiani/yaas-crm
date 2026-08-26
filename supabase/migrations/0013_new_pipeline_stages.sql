-- ============================================================
-- YAAS Sales CRM — replace pipeline stages with YAAS v2 set
-- ============================================================
-- New stage set (11 stages):
--   New → Discovery → Pitched → Verbal yes → Email confirmation (WON)
--   └─ operationalisation: Legal → Contract Signed → Handed to Content Ops
--      → Live → Paused
--   Lost
--
-- "Email confirmation" is the sales-close moment: a deal entering it gets
-- closed_at stamped automatically by the existing log_stage_change trigger.
-- All stages after it (Legal … Paused) are also kind='won' — the deal is
-- already sealed and this tracks delivery progress.
--
-- Existing deal remapping:
--   contacted        → discovery
--   call_booked      → pitched
--   call_held        → verbal_yes
--   proposal_sent    → verbal_yes
--   negotiating      → verbal_yes
--   closed_won       → email_confirmation
--   contract         → contract_signed
--   operationalized  → handed_to_content_ops  (if the row existed)
--   closed_lost      → lost
--   new              → new  (no-op, kept as is_default)
-- ============================================================

-- Disable the stage-change trigger so the bulk deal remaps below don't
-- create spurious "Stage changed" activity log entries for every lead.
alter table public.deals disable trigger trg_deal_stage_change;
alter table public.deals disable trigger trg_bootstrap_onboarding;

-- ------------------------------------------------------------------
-- 1. Upsert all new stages
-- ------------------------------------------------------------------
insert into public.pipeline_stages (id, label, position, kind, tone, is_default) values
  ('new',                   'New',                   0,  'open', 'new',         true),
  ('discovery',             'Discovery',             1,  'open', 'contacted',   false),
  ('pitched',               'Pitched',               2,  'open', 'booked',      false),
  ('verbal_yes',            'Verbal yes',            3,  'open', 'held',        false),
  ('email_confirmation',    'Email confirmation',    4,  'won',  'proposal',    false),
  ('legal',                 'Legal',                 5,  'won',  'won',         false),
  ('contract_signed',       'Contract Signed',       6,  'won',  'won',         false),
  ('handed_to_content_ops', 'Handed to Content Ops', 7,  'won',  'won',         false),
  ('live',                  'Live',                  8,  'won',  'won',         false),
  ('paused',                'Paused',                9,  'won',  'negotiating', false),
  ('lost',                  'Lost',                  10, 'lost', 'lost',        false)
on conflict (id) do update set
  label      = excluded.label,
  position   = excluded.position,
  kind       = excluded.kind,
  tone       = excluded.tone,
  is_default = excluded.is_default;

-- ------------------------------------------------------------------
-- 2. Remap existing deals to new stage ids
-- ------------------------------------------------------------------
update public.deals set stage = 'discovery'              where stage = 'contacted';
update public.deals set stage = 'pitched'                where stage = 'call_booked';
update public.deals set stage = 'verbal_yes'             where stage = 'call_held';
update public.deals set stage = 'verbal_yes'             where stage = 'proposal_sent';
update public.deals set stage = 'verbal_yes'             where stage = 'negotiating';
update public.deals set stage = 'email_confirmation'     where stage = 'closed_won';
update public.deals set stage = 'contract_signed'        where stage = 'contract';
update public.deals set stage = 'handed_to_content_ops'  where stage = 'operationalized';
update public.deals set stage = 'lost'                   where stage = 'closed_lost';

-- ------------------------------------------------------------------
-- 3. Stamp closed_at on any won/lost deals that are missing it
--    (deals that were remapped from pre-existing won stages but had
--    no closed_at yet, or old data that predates the trigger)
-- ------------------------------------------------------------------
update public.deals d
set    closed_at = coalesce(d.updated_at, now())
from   public.pipeline_stages ps
where  d.stage      = ps.id
  and  ps.kind      in ('won', 'lost')
  and  d.closed_at  is null;

-- ------------------------------------------------------------------
-- 4. Remove old stage rows now that no deals reference them
-- ------------------------------------------------------------------
delete from public.pipeline_stages
where id in (
  'contacted', 'call_booked', 'call_held',
  'proposal_sent', 'negotiating',
  'closed_won', 'contract', 'operationalized', 'closed_lost'
);

-- ------------------------------------------------------------------
-- 5. Re-enable triggers
-- ------------------------------------------------------------------
alter table public.deals enable trigger trg_deal_stage_change;
alter table public.deals enable trigger trg_bootstrap_onboarding;

-- ------------------------------------------------------------------
-- 6. Bootstrap missing onboarding records for any won deals that
--    slipped through (pre-trigger-install data)
-- ------------------------------------------------------------------
insert into public.onboardings (lead_id, poc_name, email, whatsapp_number, lead_source)
select l.id, l.name, l.email, l.phone, l.source::text
from   public.leads l
join   public.deals d  on d.lead_id = l.id
join   public.pipeline_stages ps on ps.id = d.stage and ps.kind = 'won'
left   join public.onboardings o on o.lead_id = l.id
where  o.lead_id is null
on conflict (lead_id) do nothing;
