-- ============================================================
-- YAAS Sales CRM — currency on deals, structured budget on qualifications
-- ============================================================
-- Previously every money number was assumed to be USD and the lead's stated
-- budget was an ad-hoc text string ("$2-5k/mo"). This migration:
--
--   1. Adds `value_currency` to `deals` so each deal's MRR + one-time live in
--      their own currency. Default USD for back-compat.
--   2. Replaces the `qualifications.budget_range` text field with structured
--      `budget_amount` + `budget_currency` + `budget_recurrence` columns so
--      the qualification form can render a real money input.
--   3. Backfills the new budget columns by best-effort parsing the legacy
--      `budget_range` strings (e.g. "$2-5k/mo" → amount: 3500, monthly).
--   4. Keeps `budget_range` around as a fallback column for one release in
--      case anything still reads it; safe to drop in a later migration.
--
-- Supported currencies (enforced by check constraint):
--   USD ($), INR (₹), GBP (£), AED (د.إ)
-- ============================================================

-- ---------- deals.value_currency ------------------------------------------

alter table public.deals
  add column if not exists value_currency text not null default 'USD'
    check (value_currency in ('USD', 'INR', 'GBP', 'AED'));

-- ---------- qualifications: structured budget -----------------------------

alter table public.qualifications
  add column if not exists budget_amount     numeric(12, 2),
  add column if not exists budget_currency   text default 'USD'
    check (budget_currency in ('USD', 'INR', 'GBP', 'AED')),
  add column if not exists budget_recurrence text default 'monthly'
    check (budget_recurrence in ('one_time', 'monthly'));

-- ---------- backfill from legacy budget_range -----------------------------
-- Patterns we try to match (case-insensitive, all assumed USD):
--   $X-Yk/mo   → midpoint × 1000, monthly
--   $Xk/mo     → X × 1000, monthly
--   $X-Y/mo    → midpoint, monthly
--   $X/mo      → X, monthly
--   $X-Yk      → midpoint × 1000, one_time
--   $Xk        → X × 1000, one_time
-- Everything else is left null so the user can re-enter cleanly.

update public.qualifications q
   set budget_currency   = 'USD',
       budget_recurrence = case when q.budget_range ~* '/mo' then 'monthly' else 'one_time' end,
       budget_amount =
         case
           when q.budget_range ~* '\$\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)k' then
             ((substring(q.budget_range from '\$\s*([0-9]+(?:\.[0-9]+)?)')::numeric
               + substring(q.budget_range from '-\s*([0-9]+(?:\.[0-9]+)?)k')::numeric) / 2) * 1000
           when q.budget_range ~* '\$\s*([0-9]+(?:\.[0-9]+)?)k' then
             substring(q.budget_range from '\$\s*([0-9]+(?:\.[0-9]+)?)k')::numeric * 1000
           when q.budget_range ~* '\$\s*([0-9]+(?:\.[0-9]+)?)\s*-\s*([0-9]+(?:\.[0-9]+)?)' then
             (substring(q.budget_range from '\$\s*([0-9]+(?:\.[0-9]+)?)')::numeric
              + substring(q.budget_range from '-\s*([0-9]+(?:\.[0-9]+)?)')::numeric) / 2
           when q.budget_range ~* '\$\s*([0-9]+(?:\.[0-9]+)?)' then
             substring(q.budget_range from '\$\s*([0-9]+(?:\.[0-9]+)?)')::numeric
           else null
         end
 where q.budget_range is not null
   and q.budget_range <> ''
   and q.budget_amount is null;

-- ---------- rebuild lead_overview to surface new columns ------------------
-- Same drop+recreate dance as 0003: adding columns to leads/deals shifts
-- the `select l.*` column order so `create or replace view` rejects it.

drop view if exists public.lead_overview;

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
