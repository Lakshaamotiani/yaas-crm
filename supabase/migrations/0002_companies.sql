-- ============================================================
-- YAAS SALES CRM — Companies as first-class entities
-- ============================================================
-- Promotes "company" from text fields on `leads` to its own table.
-- Lead.company_id now points to companies.id. Existing data is preserved:
-- we group by the old `company` text, create one row per unique name, and
-- assign company_id back to each lead. Old text columns are then dropped.
-- ============================================================

-- ---------- enum: link types -----------------------------------------------

do $$ begin
  create type company_link_type as enum (
    'website',
    'youtube',
    'linkedin',
    'twitter',
    'instagram',
    'tiktok',
    'threads',
    'github',
    'discord',
    'other'
  );
exception when duplicate_object then null; end $$;

-- ---------- companies ------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  domain text,
  industry text,
  size text,                      -- "1-10" | "11-50" | "51-200" | …
  notes text,
  tags text[] default '{}',
  -- links live as jsonb so the shape can evolve without schema changes:
  --   [{ id: uuid, type: 'youtube', url: '…', label: null }, …]
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists companies_name_lower
  on public.companies (lower(name));
create index if not exists companies_domain_idx on public.companies(domain);

drop trigger if exists trg_companies_updated on public.companies;
create trigger trg_companies_updated before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------- leads.company_id (add column, backfill, drop old) --------------

alter table public.leads
  add column if not exists company_id uuid references public.companies(id) on delete set null;

-- Backfill: one row per unique non-null lead.company text. The `not exists`
-- guard makes this safe to re-run after a partial-failure run that already
-- inserted some rows (the unique index on lower(name) would otherwise reject
-- duplicates on a retry).
insert into public.companies (id, name, domain, links, created_at)
select
  uuid_generate_v4(),
  l.company,
  -- best-effort domain from any website on the leads
  (
    select regexp_replace(
      regexp_replace(coalesce(l2.company_website, ''), '^https?://(www\.)?', ''),
      '/.*$', ''
    )
    from public.leads l2
    where l2.company = l.company
      and l2.company_website is not null
    limit 1
  ),
  -- coalesce website + youtube links across all contacts at this company
  coalesce(
    (
      select jsonb_agg(distinct link)
      from public.leads l2,
      lateral (
        select
          case when l2.company_website is not null then
            jsonb_build_object(
              'id', gen_random_uuid()::text,
              'type', 'website',
              'url', case when l2.company_website ~* '^https?://'
                          then l2.company_website
                          else 'https://' || l2.company_website end,
              'label', null
            )
          end as link
        union all
        select
          case when l2.has_youtube_channel and l2.youtube_channel_link is not null then
            jsonb_build_object(
              'id', gen_random_uuid()::text,
              'type', 'youtube',
              'url', l2.youtube_channel_link,
              'label', null
            )
          end
      ) links
      where l2.company = l.company and link is not null
    ),
    '[]'::jsonb
  ),
  min(l.created_at)
from public.leads l
where l.company is not null and l.company <> ''
  and not exists (
    select 1 from public.companies c where lower(c.name) = lower(l.company)
  )
group by l.company;

-- Hook each existing lead to its newly created company
update public.leads l
   set company_id = c.id
  from public.companies c
 where l.company is not null
   and lower(l.company) = lower(c.name);

-- Drop the legacy text columns now that company_id is the authoritative ref.
-- The lead_overview view (from 0001) does `select l.*`, so we drop it first
-- and let the `create or replace view` later in this file rebuild it with
-- the joined company columns.
drop view if exists public.lead_overview;

alter table public.leads
  drop column if exists company,
  drop column if exists company_website,
  drop column if exists has_youtube_channel,
  drop column if exists youtube_channel_link;

create index if not exists leads_company_idx on public.leads(company_id);

-- ---------- view: rebuild lead_overview to surface the joined company -----

create or replace view public.lead_overview as
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

-- ---------- RLS ------------------------------------------------------------

alter table public.companies enable row level security;

do $$ begin
  create policy "authenticated all companies" on public.companies
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;
