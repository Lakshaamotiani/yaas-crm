"use client";

/**
 * Thin Supabase data layer. Each function takes the browser client and returns
 * typed rows. The store (src/lib/store.tsx) wraps these in React state and
 * optimistic updates — keeping the I/O in one place makes the store readable
 * and lets us swap the backend (e.g. to React Query) without churn elsewhere.
 *
 * Conventions:
 *   - Mutations return the canonical row from Supabase (after triggers fire),
 *     so the caller can update local state with authoritative data.
 *   - We always select explicit columns rather than `*` so adding fields to
 *     the DB doesn't silently broaden what we ship to the client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Lead, Deal, Activity, Qualification, Profile, LeadOverview, Company,
} from "@/lib/types";
import type { PipelineStage } from "@/lib/constants";

// ============================================================================
// Selects — keep field lists in one place so reads stay consistent.
// ============================================================================

const COMPANY_COLS =
  "id, name, domain, industry, size, notes, tags, links, priority, is_sample, created_at, updated_at";

const LEAD_COLS =
  "id, owner_id, company_id, name, email, phone, role, service_type, " +
  "additional_info, source, status, tags, is_sample, source_submission_id, created_at, updated_at";

const DEAL_COLS =
  "id, lead_id, owner_id, title, stage, value_mrr, value_one_time, value_currency, " +
  "probability, expected_close_date, closed_at, loss_reason, position, created_at, updated_at";

const QUAL_COLS =
  "lead_id, budget_range, budget_amount, budget_currency, budget_recurrence, " +
  "decision_maker, pain_points, goals, fit_score, notes, updated_at";

const ACTIVITY_COLS =
  "id, lead_id, deal_id, user_id, type, status, title, body, metadata, " +
  "due_at, completed_at, created_at";

const PROFILE_COLS = "id, full_name, email, avatar_url, role, must_change_password";

const STAGE_COLS = "id, label, position, kind, tone, is_default";

// ============================================================================
// Pipeline stages
// ============================================================================

export async function fetchPipelineStages(sb: SupabaseClient): Promise<PipelineStage[]> {
  const { data, error } = await sb
    .from("pipeline_stages")
    .select(STAGE_COLS)
    .order("position", { ascending: true });
  if (error) throw new Error(`fetch pipeline_stages: ${error.message}`);
  return (data ?? []) as unknown as PipelineStage[];
}

export async function insertStageRow(sb: SupabaseClient, stage: PipelineStage): Promise<void> {
  const { error } = await sb.from("pipeline_stages").insert(stage);
  if (error) throw new Error(`create stage: ${error.message}`);
}

export async function updateStageRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Omit<PipelineStage, "id">>,
): Promise<void> {
  const { error } = await sb.from("pipeline_stages").update(patch).eq("id", id);
  if (error) throw new Error(`update stage: ${error.message}`);
}

export async function deleteStageRow(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("pipeline_stages").delete().eq("id", id);
  if (error) throw new Error(`delete stage: ${error.message}`);
}

/** Move every deal currently in `fromStage` to `toStage` (used before
 *  deleting a stage so the FK doesn't block, and deals aren't orphaned). */
export async function reassignAllDeals(
  sb: SupabaseClient,
  fromStage: string,
  toStage: string,
): Promise<void> {
  const { error } = await sb.from("deals").update({ stage: toStage }).eq("stage", fromStage);
  if (error) throw new Error(`reassign deals: ${error.message}`);
}

// ============================================================================
// Reads
// ============================================================================

export interface InitialWorkspaceData {
  companies: Company[];
  leads: Lead[];
  deals: Deal[];
  qualifications: Qualification[];
  activities: Activity[];
  profiles: Profile[];
  pipelineStages: PipelineStage[];
}

const PAGE = 1000;

/**
 * Fetch every row of a table, walking Supabase's 1,000-row page ceiling.
 * Without this the whole app silently truncates at 1,000 — the import of
 * 1,300 leads "loses" 300 in the UI, dashboard math is wrong, etc.
 */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  cols: string,
  orderBy?: { column: string; ascending: boolean },
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(cols).range(from, from + PAGE - 1);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending });
    const { data, error } = await q;
    if (error) throw new Error(`fetch ${table}: ${error.message}`);
    const batch = (data ?? []) as unknown as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export async function fetchWorkspace(sb: SupabaseClient): Promise<InitialWorkspaceData> {
  const [companies, leads, deals, quals, activities, profiles, pipelineStages] = await Promise.all([
    fetchAll<Company>(sb, "companies", COMPANY_COLS, { column: "created_at", ascending: false }),
    fetchAll<Lead>(sb, "leads", LEAD_COLS, { column: "created_at", ascending: false }),
    fetchAll<Deal>(sb, "deals", DEAL_COLS),
    fetchAll<Qualification>(sb, "qualifications", QUAL_COLS),
    fetchAll<Activity>(sb, "activities", ACTIVITY_COLS, { column: "created_at", ascending: false }),
    fetchAll<Profile>(sb, "profiles", PROFILE_COLS),
    fetchPipelineStages(sb),
  ]);

  return {
    companies,
    leads,
    deals,
    qualifications: quals,
    activities,
    profiles,
    pipelineStages,
  };
}

export async function fetchActivitiesForLead(
  sb: SupabaseClient,
  leadId: string,
): Promise<Activity[]> {
  const { data, error } = await sb
    .from("activities")
    .select(ACTIVITY_COLS)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Activity[];
}

export async function fetchDealForLead(
  sb: SupabaseClient,
  leadId: string,
): Promise<Deal | null> {
  const { data, error } = await sb
    .from("deals")
    .select(DEAL_COLS)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Deal | null;
}

export async function fetchQualForLead(
  sb: SupabaseClient,
  leadId: string,
): Promise<Qualification | null> {
  const { data, error } = await sb
    .from("qualifications")
    .select(QUAL_COLS)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Qualification | null;
}

// ============================================================================
// Writes — leads / deals / qualifications / activities
// ============================================================================

export async function insertLeadRow(
  sb: SupabaseClient,
  lead: Omit<Lead, "created_at" | "updated_at"> & { is_sample?: boolean },
): Promise<Lead> {
  const { data, error } = await sb
    .from("leads")
    .insert(lead)
    .select(LEAD_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

export async function updateLeadRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Lead>,
): Promise<Lead> {
  // Strip immutable fields the caller might accidentally send back.
  const { id: _id, created_at, updated_at, ...safe } = patch as Partial<Lead> & {
    id?: string; created_at?: string; updated_at?: string;
  };
  const { data, error } = await sb
    .from("leads")
    .update(safe)
    .eq("id", id)
    .select(LEAD_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Lead;
}

export async function updateDealRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Deal>,
): Promise<Deal> {
  const { id: _id, created_at, updated_at, ...safe } = patch as Partial<Deal> & {
    id?: string; created_at?: string; updated_at?: string;
  };
  const { data, error } = await sb
    .from("deals")
    .update(safe)
    .eq("id", id)
    .select(DEAL_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Deal;
}

export async function upsertQualRow(
  sb: SupabaseClient,
  qual: Qualification,
): Promise<Qualification> {
  const { updated_at, ...safe } = qual;
  const { data, error } = await sb
    .from("qualifications")
    .upsert(safe, { onConflict: "lead_id" })
    .select(QUAL_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Qualification;
}

export async function insertActivityRow(
  sb: SupabaseClient,
  activity: Omit<Activity, "created_at">,
): Promise<Activity> {
  const { data, error } = await sb
    .from("activities")
    .insert(activity)
    .select(ACTIVITY_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Activity;
}

export async function deleteActivityRow(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("activities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateActivityRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Activity>,
): Promise<Activity> {
  const { id: _id, created_at, ...safe } = patch as Partial<Activity> & {
    id?: string; created_at?: string;
  };
  const { data, error } = await sb
    .from("activities")
    .update(safe)
    .eq("id", id)
    .select(ACTIVITY_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Activity;
}

// ============================================================================
// Writes — companies
// ============================================================================

export async function insertCompanyRow(
  sb: SupabaseClient,
  company: Omit<Company, "created_at" | "updated_at"> & { is_sample?: boolean },
): Promise<Company> {
  const { data, error } = await sb
    .from("companies")
    .insert(company)
    .select(COMPANY_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Company;
}

export async function updateCompanyRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Company>,
): Promise<Company> {
  const { id: _id, created_at, updated_at, ...safe } = patch as Partial<Company> & {
    id?: string; created_at?: string; updated_at?: string;
  };
  const { data, error } = await sb
    .from("companies")
    .update(safe)
    .eq("id", id)
    .select(COMPANY_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Company;
}

export async function deleteCompanyRow(sb: SupabaseClient, id: string): Promise<void> {
  const { error } = await sb.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================================
// Bulk import (CSV → leads + companies)
// ============================================================================

export async function bulkInsertCompanies(
  sb: SupabaseClient,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from("companies").insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`import companies: ${error.message}`);
  }
}

/**
 * Lightweight, fully-paginated fetch of every company's id / name / domain.
 * The store's workspace fetch is capped at Supabase's default 1,000-row
 * ceiling, so CSV import can't trust it to resolve existing companies — a
 * name beyond row 1,000 would slip through and trip the `companies_name_lower`
 * unique index. This walks all pages so import dedup is authoritative.
 */
export async function fetchAllCompaniesLite(
  sb: SupabaseClient,
): Promise<Array<{ id: string; name: string; domain: string | null }>> {
  const PAGE = 1000;
  const out: Array<{ id: string; name: string; domain: string | null }> = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("companies")
      .select("id, name, domain")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`company lookup: ${error.message}`);
    const batch = (data ?? []) as Array<{ id: string; name: string; domain: string | null }>;
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export async function bulkInsertLeads(
  sb: SupabaseClient,
  rows: Array<Record<string, unknown>>,
): Promise<void> {
  if (rows.length === 0) return;
  // Chunk so a 1000-row paste doesn't hit a single oversized request; the
  // bootstrap_lead trigger fires per row to create deal + qualification.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb.from("leads").insert(rows.slice(i, i + CHUNK));
    if (error) throw new Error(`import leads: ${error.message}`);
  }
}

// ============================================================================
// Profiles
// ============================================================================

export async function updateProfileRow(
  sb: SupabaseClient,
  id: string,
  patch: Partial<Pick<Profile, "full_name" | "avatar_url" | "role" | "must_change_password">>,
): Promise<Profile> {
  const { data, error } = await sb
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select(PROFILE_COLS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Profile;
}

// ============================================================================
// Bulk edit (selection actions in the leads list)
// ============================================================================

/** PostgREST `in.()` filters ride in the URL; keep id batches modest. */
const ID_CHUNK = 150;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Apply one uniform patch to many leads (e.g. set source / owner for all). */
export async function bulkUpdateLeadsField(
  sb: SupabaseClient,
  ids: string[],
  patch: Partial<Pick<Lead, "source" | "owner_id" | "status">>,
): Promise<void> {
  for (const batch of chunk(ids, ID_CHUNK)) {
    const { error } = await sb.from("leads").update(patch).in("id", batch);
    if (error) throw new Error(`bulk update leads: ${error.message}`);
  }
}

/**
 * Assign owners per-lead (round-robin rotation produces a different owner
 * for each lead). Grouped by owner so it's one chunked UPDATE per owner
 * rather than one request per lead.
 */
export async function bulkAssignOwners(
  sb: SupabaseClient,
  assignments: Array<{ id: string; owner_id: string }>,
): Promise<void> {
  const byOwner = new Map<string, string[]>();
  for (const a of assignments) {
    const list = byOwner.get(a.owner_id) ?? [];
    list.push(a.id);
    byOwner.set(a.owner_id, list);
  }
  for (const [ownerId, ids] of byOwner) {
    for (const batch of chunk(ids, ID_CHUNK)) {
      const { error } = await sb.from("leads").update({ owner_id: ownerId }).in("id", batch);
      if (error) throw new Error(`assign owners: ${error.message}`);
    }
  }
}

/** Move every selected lead's deal to a stage. The log_stage_change trigger
 *  fires per row, so each gets its own stage-change activity. */
export async function bulkSetStage(
  sb: SupabaseClient,
  leadIds: string[],
  stage: string,
): Promise<void> {
  for (const batch of chunk(leadIds, ID_CHUNK)) {
    const { error } = await sb.from("deals").update({ stage }).in("lead_id", batch);
    if (error) throw new Error(`bulk set stage: ${error.message}`);
  }
}

export async function bulkAddTag(
  sb: SupabaseClient,
  leadIds: string[],
  tag: string,
): Promise<void> {
  for (const batch of chunk(leadIds, ID_CHUNK)) {
    const { error } = await sb.rpc("bulk_add_tag", { lead_ids: batch, new_tag: tag });
    if (error) throw new Error(`bulk add tag: ${error.message}`);
  }
}

export async function bulkDeleteLeads(sb: SupabaseClient, ids: string[]): Promise<void> {
  for (const batch of chunk(ids, ID_CHUNK)) {
    const { error } = await sb.from("leads").delete().in("id", batch);
    if (error) throw new Error(`bulk delete leads: ${error.message}`);
  }
}

// ============================================================================
// Workspace data — clear / restore (backup)
// ============================================================================

const ALL_ROWS_FILTER = "00000000-0000-0000-0000-000000000000";

/**
 * Wipe all CRM records. Leads cascade-delete their deals / qualifications /
 * activities; companies are deleted after. Team, profiles, sales scripts,
 * and workspace settings are intentionally NOT touched. Admin-only at the
 * RLS layer (migration 0005).
 */
export async function clearWorkspaceData(sb: SupabaseClient): Promise<void> {
  // Supabase requires a filter on delete; `id <> <zero uuid>` matches all.
  const leads = await sb.from("leads").delete().neq("id", ALL_ROWS_FILTER);
  if (leads.error) throw new Error(`clear leads: ${leads.error.message}`);
  const companies = await sb.from("companies").delete().neq("id", ALL_ROWS_FILTER);
  if (companies.error) throw new Error(`clear companies: ${companies.error.message}`);
}

export interface WorkspaceBackup {
  version: 1;
  exported_at: string;
  companies: Company[];
  leads: Lead[];
  deals: Deal[];
  qualifications: Qualification[];
  activities: Activity[];
}

/**
 * Restore a JSON backup. UUIDs are preserved so a round-trip is exact.
 *   - "replace": caller should clearWorkspaceData() first.
 *   - "merge":  upsert with ignoreDuplicates so existing UUIDs are kept.
 * Companies → leads → deals/quals (upsert over the trigger-created rows) →
 * activities, in FK order.
 */
export async function restoreWorkspace(
  sb: SupabaseClient,
  backup: WorkspaceBackup,
  mode: "merge" | "replace",
): Promise<void> {
  const ignore = mode === "merge";
  if (backup.companies?.length) {
    const { error } = await sb
      .from("companies")
      .upsert(backup.companies, { onConflict: "id", ignoreDuplicates: ignore });
    if (error) throw new Error(`restore companies: ${error.message}`);
  }
  if (backup.leads?.length) {
    const { error } = await sb
      .from("leads")
      .upsert(backup.leads, { onConflict: "id", ignoreDuplicates: ignore });
    if (error) throw new Error(`restore leads: ${error.message}`);
  }
  // The bootstrap_lead trigger creates a deal + qualification per inserted
  // lead; upsert our backed-up rows over them by their natural keys.
  if (backup.deals?.length) {
    const { error } = await sb.from("deals").upsert(backup.deals, { onConflict: "lead_id" });
    if (error) throw new Error(`restore deals: ${error.message}`);
  }
  if (backup.qualifications?.length) {
    const { error } = await sb
      .from("qualifications")
      .upsert(backup.qualifications, { onConflict: "lead_id" });
    if (error) throw new Error(`restore qualifications: ${error.message}`);
  }
  if (backup.activities?.length) {
    const { error } = await sb
      .from("activities")
      .upsert(backup.activities, { onConflict: "id", ignoreDuplicates: ignore });
    if (error) throw new Error(`restore activities: ${error.message}`);
  }
}

// ============================================================================
// Sample data — bulk insert / delete with the is_sample flag
// ============================================================================

export interface SampleDataPayload {
  companies: Array<Omit<Company, "created_at" | "updated_at">>;
  leads: Array<Omit<Lead, "created_at" | "updated_at">>;
  deals: Array<Omit<Deal, "created_at" | "updated_at">>;
  qualifications: Qualification[];
  activities: Array<Omit<Activity, "created_at">>;
}

export async function insertSampleData(
  sb: SupabaseClient,
  payload: SampleDataPayload,
): Promise<void> {
  // Insert in FK order: companies → leads → (update the trigger-created
  // deal + qual via upsert) → activities. Mark is_sample = true so cleanup
  // can find them.
  const companies = payload.companies.map((c) => ({ ...c, is_sample: true }));
  const leads = payload.leads.map((l) => ({ ...l, is_sample: true }));

  if (companies.length) {
    const { error } = await sb.from("companies").insert(companies);
    if (error) throw new Error(`sample companies: ${error.message}`);
  }
  if (leads.length) {
    const { error } = await sb.from("leads").insert(leads);
    if (error) throw new Error(`sample leads: ${error.message}`);
  }

  // The bootstrap_lead trigger already created a deal + qualification per
  // lead with defaults *and* its own UUID. We strip `id` from the upsert
  // payload so the UPDATE branch keeps the trigger-created id intact —
  // otherwise the BEFORE-UPDATE `log_stage_change` trigger sees a NEW.id
  // that doesn't exist yet in the deals table and the activity it tries to
  // insert blows up the foreign key.
  if (payload.deals.length) {
    const stripped = payload.deals.map(({ id: _omit, ...rest }) => rest);
    const { error } = await sb
      .from("deals")
      .upsert(stripped, { onConflict: "lead_id" });
    if (error) throw new Error(`sample deals: ${error.message}`);
  }
  if (payload.qualifications.length) {
    const { error } = await sb
      .from("qualifications")
      .upsert(payload.qualifications, { onConflict: "lead_id" });
    if (error) throw new Error(`sample qualifications: ${error.message}`);
  }

  if (payload.activities.length) {
    // Remap each activity's deal_id from the local placeholder UUID to the
    // real DB id (keyed by lead_id, which is what onConflict used).
    const leadIds = Array.from(
      new Set(payload.activities.map((a) => a.lead_id).filter(Boolean) as string[]),
    );
    let dealIdByLead = new Map<string, string>();
    if (leadIds.length) {
      const { data, error } = await sb
        .from("deals")
        .select("id, lead_id")
        .in("lead_id", leadIds);
      if (error) throw new Error(`sample activities (lookup): ${error.message}`);
      for (const row of (data ?? []) as Array<{ id: string; lead_id: string }>) {
        dealIdByLead.set(row.lead_id, row.id);
      }
    }
    const remapped = payload.activities.map((a) => ({
      ...a,
      deal_id: a.lead_id ? dealIdByLead.get(a.lead_id) ?? null : null,
    }));
    const { error } = await sb.from("activities").insert(remapped);
    if (error) throw new Error(`sample activities: ${error.message}`);
  }
}

export interface SampleDataCounts {
  companies: number;
  leads: number;
}

export async function countSampleData(sb: SupabaseClient): Promise<SampleDataCounts> {
  // We avoid `{ head: true }` because some browsers / privacy extensions
  // mangle the resulting HEAD request, leaving the promise pending forever.
  // Selecting just `id` with the default GET keeps it bulletproof at the
  // cost of returning the row IDs (which we ignore).
  const [c, l] = await Promise.all([
    sb.from("companies").select("id").eq("is_sample", true),
    sb.from("leads").select("id").eq("is_sample", true),
  ]);
  if (c.error) throw new Error(`countSampleData (companies): ${c.error.message}`);
  if (l.error) throw new Error(`countSampleData (leads): ${l.error.message}`);
  return {
    companies: c.data?.length ?? 0,
    leads: l.data?.length ?? 0,
  };
}

export async function clearSampleData(sb: SupabaseClient): Promise<void> {
  // Leads cascade-delete deals/qualifications/activities. Companies are
  // separately FK-linked to leads with set null, so deleting them last is
  // safe and won't orphan anything (we own both sample sides).
  const leadsRes = await sb.from("leads").delete().eq("is_sample", true);
  if (leadsRes.error) throw new Error(`clear sample leads: ${leadsRes.error.message}`);
  const compRes = await sb.from("companies").delete().eq("is_sample", true);
  if (compRes.error) throw new Error(`clear sample companies: ${compRes.error.message}`);
}
