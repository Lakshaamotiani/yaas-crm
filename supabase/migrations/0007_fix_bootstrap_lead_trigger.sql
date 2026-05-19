-- ============================================================
-- YAAS Sales CRM — fix bootstrap_lead trigger
-- ============================================================
-- The original trigger from migration 0001 references `new.company`, which
-- was a text column on `leads` that migration 0002 dropped (companies were
-- promoted to their own table, joined via `company_id`). Every lead insert
-- has been failing with `record "new" has no field "company"` ever since.
--
-- Fix: derive the deal title from the joined company name when company_id
-- is set, falling back to the lead's own name when it isn't.
-- ============================================================

create or replace function public.bootstrap_lead()
returns trigger language plpgsql as $$
declare
  derived_title text;
begin
  if new.company_id is not null then
    select c.name into derived_title
      from public.companies c
     where c.id = new.company_id;
  end if;

  insert into public.deals (lead_id, owner_id, title, stage)
  values (new.id, new.owner_id, coalesce(derived_title, new.name), 'new')
  on conflict (lead_id) do nothing;

  insert into public.qualifications (lead_id)
  values (new.id)
  on conflict (lead_id) do nothing;

  return new;
end $$;
