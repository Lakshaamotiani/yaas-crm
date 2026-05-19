-- ============================================================
-- YAAS Sales CRM — lead source_submission_id (CSV import idempotency)
-- ============================================================
-- The YAAS form export carries a stable "Submission ID" per row. Storing it
-- on the lead lets a re-uploaded CSV silently skip rows already imported,
-- so the user can safely re-run an updated export without doubling data.
--
-- Partial unique index (only over non-null values) so manually-created
-- leads — which have no submission id — aren't forced to collide on NULL.
-- ============================================================

alter table public.leads
  add column if not exists source_submission_id text;

create unique index if not exists leads_source_submission_id_uidx
  on public.leads (source_submission_id)
  where source_submission_id is not null;
