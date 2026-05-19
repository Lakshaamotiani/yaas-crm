"use client";

/**
 * Builds a Supabase-ready payload from the in-repo mock fixture.
 *
 * Why this exists: the mock catalog (companies + leads + deals + quals +
 * activities) is a great demo dataset. Once the database is the source of
 * truth, we want a way to push that catalog into Supabase on demand (so a
 * freshly-deployed workspace isn't empty when you walk a stakeholder through
 * it) and pull it back out cleanly.
 *
 * Rows inserted via this path are flagged `is_sample = true` so the cleanup
 * action can remove them in a single query without touching anything the
 * user created themselves.
 */

import {
  MOCK_COMPANIES as mockCompanies,
  MOCK_LEADS as mockLeads,
  MOCK_DEALS as mockDeals,
  MOCK_QUALIFICATIONS as mockQuals,
  MOCK_ACTIVITIES as mockActivities,
} from "./mock-data";
import type { SampleDataPayload } from "./supabase/api";

function newUuid(): string {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("crypto.randomUUID is not available in this environment");
  }
  return crypto.randomUUID();
}

/**
 * Re-key the mock fixture with fresh UUIDs (so it slots into the uuid PKs the
 * DB uses), and re-target every `owner_id` / `user_id` at the currently
 * signed-in user — the mock fixture's `"me"` / `"u_2"` / `"u_3"` ids don't
 * exist in `profiles` and would violate the foreign key.
 */
export function buildSamplePayload(currentUserId: string): SampleDataPayload {
  const companyIdMap = new Map<string, string>();
  const leadIdMap = new Map<string, string>();
  const dealIdMap = new Map<string, string>();

  for (const c of mockCompanies) companyIdMap.set(c.id, newUuid());
  for (const l of mockLeads) leadIdMap.set(l.id, newUuid());
  for (const d of mockDeals) dealIdMap.set(d.id, newUuid());

  const companies = mockCompanies.map((c) => ({
    id: companyIdMap.get(c.id)!,
    name: c.name,
    domain: c.domain,
    industry: c.industry,
    size: c.size,
    notes: c.notes,
    tags: c.tags,
    links: c.links,
    priority: c.priority,
  }));

  const leads = mockLeads.map((l) => ({
    id: leadIdMap.get(l.id)!,
    owner_id: currentUserId,
    company_id: l.company_id ? companyIdMap.get(l.company_id) ?? null : null,
    name: l.name,
    email: l.email,
    phone: l.phone,
    role: l.role,
    service_type: l.service_type,
    additional_info: l.additional_info,
    source: l.source,
    status: l.status,
    tags: l.tags,
  }));

  const deals = mockDeals.map((d) => ({
    id: dealIdMap.get(d.id)!,
    lead_id: leadIdMap.get(d.lead_id)!,
    owner_id: currentUserId,
    title: d.title,
    stage: d.stage,
    value_mrr: d.value_mrr,
    value_one_time: d.value_one_time,
    value_currency: d.value_currency,
    probability: d.probability,
    expected_close_date: d.expected_close_date,
    closed_at: d.closed_at,
    loss_reason: d.loss_reason,
    position: d.position,
  }));

  const qualifications = mockQuals.map((q) => ({
    lead_id: leadIdMap.get(q.lead_id)!,
    budget_range: q.budget_range,
    budget_amount: q.budget_amount,
    budget_currency: q.budget_currency,
    budget_recurrence: q.budget_recurrence,
    decision_maker: q.decision_maker,
    pain_points: q.pain_points,
    goals: q.goals,
    fit_score: q.fit_score,
    notes: q.notes,
    updated_at: q.updated_at,
  }));

  const activities = mockActivities.map((a) => ({
    id: newUuid(),
    lead_id: leadIdMap.get(a.lead_id)!,
    deal_id: a.deal_id ? dealIdMap.get(a.deal_id) ?? null : null,
    user_id: currentUserId,
    type: a.type,
    status: a.status,
    title: a.title,
    body: a.body,
    metadata: a.metadata,
    due_at: a.due_at,
    completed_at: a.completed_at,
  }));

  return { companies, leads, deals, qualifications, activities };
}
