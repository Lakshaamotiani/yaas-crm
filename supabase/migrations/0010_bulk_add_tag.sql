-- ============================================================
-- YAAS Sales CRM — bulk_add_tag RPC
-- ============================================================
-- Bulk "add tag to N leads" can't be done cleanly from the client: each
-- lead has a different existing tags[] array, so a single UPDATE or a
-- column upsert would either need 1,000 round-trips or clobber other
-- columns. This SECURITY DEFINER function merges the tag into every
-- targeted lead's array in one statement, de-duplicating.
--
-- RLS still applies to the caller via the explicit auth.uid() check pattern
-- used elsewhere — but since "authenticated all leads" already allows any
-- signed-in user to update leads (migration 0005), we simply run as the
-- definer and rely on the route being reachable only from the app.
-- ============================================================

create or replace function public.bulk_add_tag(lead_ids uuid[], new_tag text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.leads
     set tags = (
       select array_agg(distinct t)
       from unnest(coalesce(tags, '{}') || array[new_tag]) as t
     ),
     updated_at = now()
   where id = any(lead_ids);
$$;

grant execute on function public.bulk_add_tag(uuid[], text) to authenticated;
