-- ============================================================
-- YAAS Sales CRM — sample-data flag + missing editors_needed
-- ============================================================
-- Adds:
--   1. `editors_needed` to deals (was in the TS type but not the schema).
--   2. `is_sample` flag on companies + leads so the workspace settings page
--      can insert / clear demo data without nuking real rows.
--      Deals/qualifications/activities cascade from leads, so they don't need
--      their own flag — clearing leads where is_sample=true takes them too.
--   3. Updated `lead_overview` view to surface editors_needed.
-- ============================================================

-- ---------- deals.editors_needed ------------------------------------------

alter table public.deals
  add column if not exists editors_needed int not null default 1;

-- ---------- is_sample flags ------------------------------------------------

alter table public.companies add column if not exists is_sample boolean not null default false;
alter table public.leads     add column if not exists is_sample boolean not null default false;

create index if not exists companies_sample_idx on public.companies(is_sample) where is_sample;
create index if not exists leads_sample_idx     on public.leads(is_sample)     where is_sample;

-- ---------- rebuild lead_overview to include editors_needed ----------------
-- `create or replace view` can't change column order, and adding `is_sample`
-- to leads shifts the columns produced by `l.*`. Drop and recreate instead.

drop view if exists public.lead_overview;

create view public.lead_overview as
  select
    l.*,
    -- joined company columns
    c.name              as company_name,
    c.domain            as company_domain,
    c.links             as company_links,
    c.industry          as company_industry,
    -- joined deal columns
    d.id                 as deal_id,
    d.stage              as deal_stage,
    d.editors_needed,
    d.value_mrr,
    d.value_one_time,
    d.probability,
    d.expected_close_date,
    d.closed_at,
    d.position           as deal_position,
    q.fit_score
  from public.leads l
  left join public.companies c on c.id = l.company_id
  left join public.deals d     on d.lead_id = l.id
  left join public.qualifications q on q.lead_id = l.id;
