"use client";

/**
 * Workspace store.
 *
 * Shape: a React reducer that holds the full workspace as in-memory state,
 * hydrated from Supabase the first time we have an authenticated user.
 *
 * Writes follow an **optimistic + reconcile** pattern:
 *   1. Dispatch a local update with a client-generated UUID (so the UI
 *      changes instantly).
 *   2. Fire the Supabase mutation in the background.
 *   3. On success, dispatch a reconcile with the server's authoritative row
 *      (picks up trigger side-effects: timestamps, bootstrapped deal + qual,
 *      logged stage_change activity, etc.).
 *   4. On failure, dispatch a rollback to the pre-mutation snapshot and toast.
 *
 * That keeps the UI snappy while the database stays the source of truth.
 */

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "./supabase/client";
import {
  fetchWorkspace,
  fetchDealForLead, fetchQualForLead, fetchActivitiesForLead,
  insertLeadRow, updateLeadRow,
  insertCompanyRow, updateCompanyRow, deleteCompanyRow,
  updateDealRow,
  upsertQualRow,
  insertActivityRow, updateActivityRow, deleteActivityRow,
  updateProfileRow,
  bulkInsertCompanies, bulkInsertLeads,
  clearWorkspaceData, restoreWorkspace,
  bulkUpdateLeadsField, bulkAssignOwners, bulkSetStage, bulkAddTag, bulkDeleteLeads,
  fetchPipelineStages, insertStageRow, updateStageRow, deleteStageRow, reassignAllDeals,
  type WorkspaceBackup,
} from "./supabase/api";
import type {
  Lead, Deal, Activity, Qualification, Onboarding, Profile, LeadOverview, Company,
} from "./types";
import {
  DEFAULT_TEMPLATES, DEFAULT_PIPELINE_STAGES,
  type DealStage, type WorkspaceTemplates, type PipelineStage, type StageKind, type StageTone,
} from "./constants";
import { extractDomain } from "./utils";
import { useAuth } from "./auth";

const TEMPLATES_KEY = "yaas.templates";
const TEMPLATES_VERSION_KEY = "yaas.templates.v";

/**
 * Bump this when the default scripts change in a way users should see.
 * Any localStorage payload tagged with a lower version has its `salesScripts`
 * field reset to the new defaults on next load.
 */
const TEMPLATES_SCHEMA_VERSION = 4;

interface State {
  companies: Company[];
  leads: Lead[];
  deals: Deal[];
  qualifications: Qualification[];
  onboardings: Onboarding[];
  activities: Activity[];
  profiles: Profile[];
  pipelineStages: PipelineStage[];
  templates: WorkspaceTemplates;
  /** True until the first Supabase hydration finishes for the current user. */
  hydrating: boolean;
  /** The user id whose workspace is currently loaded (null = none). */
  hydratedFor: string | null;
}

type Action =
  | { type: "hydrate"; payload: Omit<State, "templates" | "hydrating" | "hydratedFor"> & { userId: string } }
  | { type: "reset" }
  | { type: "update_lead"; id: string; patch: Partial<Lead> }
  | { type: "reconcile_lead"; lead: Lead }
  | { type: "create_lead"; lead: Lead; deal: Deal; qualification: Qualification }
  | { type: "remove_lead"; id: string }
  | { type: "update_deal"; id: string; patch: Partial<Deal> }
  | { type: "reconcile_deal"; deal: Deal }
  | { type: "move_deal"; id: string; toStage: DealStage; toIndex: number }
  | { type: "update_qualification"; lead_id: string; patch: Partial<Qualification> }
  | { type: "reconcile_qual"; qual: Qualification }
  | { type: "update_onboarding"; lead_id: string; patch: Partial<Onboarding> }
  | { type: "create_onboarding"; onboarding: Onboarding }
  | { type: "add_activity"; activity: Activity }
  | { type: "set_activities_for_lead"; lead_id: string; activities: Activity[] }
  | { type: "remove_activity"; id: string }
  | { type: "update_activity"; id: string; patch: Partial<Activity> }
  | { type: "reconcile_activity"; activity: Activity }
  | { type: "update_templates"; patch: Partial<WorkspaceTemplates> }
  | { type: "create_company"; company: Company }
  | { type: "reconcile_company"; company: Company }
  | { type: "update_company"; id: string; patch: Partial<Company> }
  | { type: "delete_company"; id: string }
  | { type: "update_profile"; profile: Profile }
  | { type: "set_pipeline_stages"; stages: PipelineStage[] };

const emptyState: State = {
  companies: [],
  leads: [],
  deals: [],
  qualifications: [],
  onboardings: [],
  activities: [],
  profiles: [],
  pipelineStages: DEFAULT_PIPELINE_STAGES,
  templates: DEFAULT_TEMPLATES,
  hydrating: true,
  hydratedFor: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        companies: action.payload.companies,
        leads: action.payload.leads,
        deals: action.payload.deals,
        qualifications: action.payload.qualifications,
        onboardings: action.payload.onboardings ?? [],
        activities: action.payload.activities,
        profiles: action.payload.profiles,
        pipelineStages: action.payload.pipelineStages?.length
          ? action.payload.pipelineStages
          : DEFAULT_PIPELINE_STAGES,
        hydrating: false,
        hydratedFor: action.payload.userId,
      };
    case "set_pipeline_stages":
      return { ...state, pipelineStages: action.stages };
    case "reset":
      return { ...emptyState, templates: state.templates, hydrating: false };
    case "update_lead":
      return {
        ...state,
        leads: state.leads.map((l) =>
          l.id === action.id ? { ...l, ...action.patch, updated_at: new Date().toISOString() } : l,
        ),
      };
    case "reconcile_lead":
      return {
        ...state,
        leads: state.leads.map((l) => (l.id === action.lead.id ? action.lead : l)),
      };
    case "create_lead":
      return {
        ...state,
        leads: [action.lead, ...state.leads],
        deals: [action.deal, ...state.deals],
        qualifications: [action.qualification, ...state.qualifications],
      };
    case "remove_lead":
      return {
        ...state,
        leads: state.leads.filter((l) => l.id !== action.id),
        deals: state.deals.filter((d) => d.lead_id !== action.id),
        qualifications: state.qualifications.filter((q) => q.lead_id !== action.id),
        onboardings: state.onboardings.filter((o) => o.lead_id !== action.id),
        activities: state.activities.filter((a) => a.lead_id !== action.id),
      };
    case "update_deal":
      return {
        ...state,
        deals: state.deals.map((d) =>
          d.id === action.id ? { ...d, ...action.patch, updated_at: new Date().toISOString() } : d,
        ),
      };
    case "reconcile_deal":
      return {
        ...state,
        deals: state.deals.map((d) => (d.id === action.deal.id ? action.deal : d)),
      };
    case "move_deal": {
      const moving = state.deals.find((d) => d.id === action.id);
      if (!moving) return state;
      const fromStage = moving.stage;
      const toStage = action.toStage;
      const targetIdx = action.toIndex;

      const others = state.deals.filter((d) => d.id !== action.id);
      const targetCol = others.filter((d) => d.stage === toStage).sort((a, b) => a.position - b.position);
      // Mirror the server-side `log_stage_change` trigger: a deal is "closed"
      // when its destination stage is won/lost-kind, open otherwise. Keyed
      // off the live stage config so custom closing stages behave correctly.
      const toKind = state.pipelineStages.find((s) => s.id === toStage)?.kind;
      const closing = toKind === "won" || toKind === "lost";
      const updated: Deal = {
        ...moving,
        stage: toStage,
        position: targetIdx,
        updated_at: new Date().toISOString(),
        ...(closing
          ? { closed_at: moving.closed_at ?? new Date().toISOString() }
          : { closed_at: null }),
      };

      targetCol.splice(targetIdx, 0, updated);
      const repackedTarget = targetCol.map((d, i) => ({ ...d, position: i }));
      const fromCol = others
        .filter((d) => d.stage === fromStage && fromStage !== toStage)
        .sort((a, b) => a.position - b.position)
        .map((d, i) => ({ ...d, position: i }));
      const untouched = others.filter(
        (d) => d.stage !== toStage && d.stage !== fromStage,
      );

      return {
        ...state,
        deals: [...untouched, ...fromCol, ...repackedTarget],
      };
    }
    case "update_qualification":
      return {
        ...state,
        qualifications: state.qualifications.map((q) =>
          q.lead_id === action.lead_id ? { ...q, ...action.patch, updated_at: new Date().toISOString() } : q,
        ),
      };
    case "reconcile_qual":
      return {
        ...state,
        qualifications: state.qualifications.map((q) =>
          q.lead_id === action.qual.lead_id ? action.qual : q,
        ),
      };
    case "update_onboarding": {
      const exists = state.onboardings.some((o) => o.lead_id === action.lead_id);
      if (exists) {
        return {
          ...state,
          onboardings: state.onboardings.map((o) =>
            o.lead_id === action.lead_id
              ? { ...o, ...action.patch, updated_at: new Date().toISOString() }
              : o,
          ),
        };
      }
      // Upsert — create a fresh onboarding row from the patch if none exists.
      const now = new Date().toISOString();
      const fresh: Onboarding = {
        lead_id: action.lead_id,
        final_scope_of_work: null, number_of_videos: null,
        format: null, go_live_timeline: null, platform: null, team_required: null,
        operationalised: false, first_video_live_link: null,
        finance_team_looped_in: false, account_manager_assigned: false,
        poc_name: null, lead_source: null, whatsapp_number: null, email: null,
        next_action: null, next_action_date: null, daily_notes: null,
        briefing_doc_url: null, pitch_deck_url: null, proposal_doc_url: null,
        final_msa_url: null, signed_sow_url: null, po_first_invoice_url: null,
        final_int_brief_url: null,
        created_at: now, updated_at: now,
        ...action.patch,
      };
      return { ...state, onboardings: [fresh, ...state.onboardings] };
    }
    case "create_onboarding":
      return { ...state, onboardings: [action.onboarding, ...state.onboardings] };
    case "add_activity":
      return { ...state, activities: [action.activity, ...state.activities] };
    case "set_activities_for_lead": {
      const others = state.activities.filter((a) => a.lead_id !== action.lead_id);
      return { ...state, activities: [...action.activities, ...others] };
    }
    case "remove_activity":
      return { ...state, activities: state.activities.filter((a) => a.id !== action.id) };
    case "update_activity":
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.id ? { ...a, ...action.patch } : a,
        ),
      };
    case "reconcile_activity":
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.activity.id ? action.activity : a,
        ),
      };
    case "update_templates":
      return { ...state, templates: { ...state.templates, ...action.patch } };
    case "create_company":
      return { ...state, companies: [action.company, ...state.companies] };
    case "reconcile_company":
      return {
        ...state,
        companies: state.companies.map((c) =>
          c.id === action.company.id ? action.company : c,
        ),
      };
    case "update_company":
      return {
        ...state,
        companies: state.companies.map((c) =>
          c.id === action.id ? { ...c, ...action.patch, updated_at: new Date().toISOString() } : c,
        ),
      };
    case "delete_company":
      return {
        ...state,
        companies: state.companies.filter((c) => c.id !== action.id),
        leads: state.leads.map((l) =>
          l.company_id === action.id ? { ...l, company_id: null } : l,
        ),
      };
    case "update_profile":
      return {
        ...state,
        profiles: state.profiles.map((p) =>
          p.id === action.profile.id ? action.profile : p,
        ),
      };
  }
}

interface StoreContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  refresh: () => Promise<void>;
}

const StoreContext = React.createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const supabase = React.useMemo(() => createClient(), []);
  const [state, dispatch] = React.useReducer(reducer, emptyState);

  const hydrate = React.useCallback(async (userId: string) => {
    // No Supabase configured — load mock data so the app works out of the box.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { MOCK_LEADS, MOCK_DEALS, MOCK_QUALIFICATIONS, MOCK_ACTIVITIES, MOCK_PROFILES, MOCK_COMPANIES } = await import("./mock-data");
      dispatch({ type: "hydrate", payload: {
        userId,
        companies: MOCK_COMPANIES,
        leads: MOCK_LEADS,
        deals: MOCK_DEALS,
        qualifications: MOCK_QUALIFICATIONS,
        onboardings: [],
        activities: MOCK_ACTIVITIES,
        profiles: MOCK_PROFILES,
        pipelineStages: DEFAULT_PIPELINE_STAGES,
      }});
      return;
    }
    try {
      const data = await fetchWorkspace(supabase);
      dispatch({ type: "hydrate", payload: { ...data, userId } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load workspace";
      toast.error(`Couldn't load workspace: ${msg}`);
      dispatch({ type: "hydrate", payload: {
        userId,
        companies: [], leads: [], deals: [], qualifications: [], onboardings: [], activities: [], profiles: [],
        pipelineStages: DEFAULT_PIPELINE_STAGES,
      } });
    }
  }, [supabase]);

  // Hydrate when an authenticated user appears (or changes). Reset to empty
  // when the user signs out.
  React.useEffect(() => {
    if (authLoading) return;
    if (!user) {
      dispatch({ type: "reset" });
      return;
    }
    if (state.hydratedFor === user.id) return;
    void hydrate(user.id);
  }, [authLoading, user, state.hydratedFor, hydrate]);

  // Hydrate templates from localStorage on first mount. Templates are
  // workspace-config (sales scripts, email blurbs) and stay local for now —
  // they don't have a Supabase table yet.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      const storedVersion = parseInt(localStorage.getItem(TEMPLATES_VERSION_KEY) ?? "1", 10);
      if (!raw) {
        localStorage.setItem(TEMPLATES_VERSION_KEY, String(TEMPLATES_SCHEMA_VERSION));
        return;
      }
      const parsed = JSON.parse(raw) as Partial<WorkspaceTemplates> & {
        salesScript?: { title?: string; sections?: Array<{ heading: string; points: string[] }> };
      };
      if (parsed.salesScript && !parsed.salesScripts) {
        const old = parsed.salesScript;
        parsed.salesScripts = [
          {
            id: "discovery-call",
            name: old.title ?? "Discovery Call",
            isDefault: true,
            sections: (old.sections ?? []).map((s, i) => ({
              id: `s${i}`,
              heading: s.heading,
              blocks: [
                {
                  id: `b${i}`,
                  kind: "discovery" as const,
                  prompts: s.points.map((p, j) => ({ id: `p${i}-${j}`, text: p })),
                },
              ],
            })),
          },
          ...DEFAULT_TEMPLATES.salesScripts.filter((s) => s.id !== "discovery-call"),
        ];
        delete (parsed as any).salesScript;
      }
      if (storedVersion < TEMPLATES_SCHEMA_VERSION) {
        parsed.salesScripts = DEFAULT_TEMPLATES.salesScripts;
      }
      if (!parsed.salesScripts || parsed.salesScripts.length === 0) {
        parsed.salesScripts = DEFAULT_TEMPLATES.salesScripts;
      }
      localStorage.setItem(TEMPLATES_VERSION_KEY, String(TEMPLATES_SCHEMA_VERSION));
      dispatch({ type: "update_templates", patch: parsed });
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(state.templates));
    } catch {}
  }, [state.templates]);

  const refresh = React.useCallback(async () => {
    if (!user) return;
    await hydrate(user.id);
  }, [user, hydrate]);

  const value = React.useMemo(
    () => ({ state, dispatch, refresh }),
    [state, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Manually re-fetch the workspace from Supabase. Useful after bulk operations
 *  (e.g. inserting sample data) where many tables change at once. */
export function useRefreshWorkspace() {
  return useStore().refresh;
}

/** True while the initial workspace load is in flight. */
export function useWorkspaceLoading() {
  return useStore().state.hydrating;
}

// ============================================================================
// Selectors — unchanged from the in-memory store
// ============================================================================

export function useOverview(): LeadOverview[] {
  const { state } = useStore();
  return React.useMemo(() => {
    // Precompute lookups once (O(n)). The previous `.find()` inside `.map()`
    // was O(leads × (deals + quals + companies)) — ~millions of ops at 1k+
    // rows, recomputed on every state change, which froze the tab.
    const dealByLead = new Map<string, Deal>();
    for (const d of state.deals) dealByLead.set(d.lead_id, d);
    const qualByLead = new Map<string, Qualification>();
    for (const q of state.qualifications) qualByLead.set(q.lead_id, q);
    const companyById = new Map<string, Company>();
    for (const c of state.companies) companyById.set(c.id, c);

    return state.leads.map((l) => {
      const d = dealByLead.get(l.id);
      const q = qualByLead.get(l.id);
      const company = l.company_id ? companyById.get(l.company_id) ?? null : null;
      return {
        ...l,
        company,
        deal_id: d?.id ?? null,
        deal_stage: d?.stage ?? null,
        value_mrr: d?.value_mrr ?? 0,
        value_one_time: d?.value_one_time ?? 0,
        value_currency: d?.value_currency ?? "USD",
        probability: d?.probability ?? null,
        expected_close_date: d?.expected_close_date ?? null,
        closed_at: d?.closed_at ?? null,
        deal_position: d?.position ?? 0,
        fit_score: q?.fit_score ?? null,
      };
    });
  }, [state.leads, state.deals, state.qualifications, state.companies]);
}

export function useLead(id: string) {
  const { state } = useStore();
  return React.useMemo(() => {
    // Single-id lookups — linear scans are fine here, but we still do one
    // pass each rather than nested loops.
    const lead = state.leads.find((l) => l.id === id) ?? null;
    const deal = state.deals.find((d) => d.lead_id === id) ?? null;
    const qualification = state.qualifications.find((q) => q.lead_id === id) ?? null;
    const company = lead?.company_id
      ? state.companies.find((c) => c.id === lead.company_id) ?? null
      : null;
    const activities = state.activities
      .filter((a) => a.lead_id === id)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return { lead, deal, qualification, company, activities };
  }, [id, state.leads, state.deals, state.qualifications, state.activities, state.companies]);
}

// ---------- onboarding -----------------------------------------------------

/** Single onboarding sheet for a lead — returns null until first write. */
export function useOnboarding(leadId: string | null | undefined) {
  const { state } = useStore();
  return React.useMemo(() => {
    if (!leadId) return null;
    return state.onboardings.find((o) => o.lead_id === leadId) ?? null;
  }, [leadId, state.onboardings]);
}

export interface OnboardingRow {
  lead: Lead;
  company: Company | null;
  deal: Deal | null;
  onboarding: Onboarding | null;
}

/** List rows for /onboarding — every lead whose deal sits in a "won" stage
 *  (closed_won, contract, operationalized). Sorted by deal updated_at desc
 *  so the freshest action is on top. */
export function useOnboardingOverview(): OnboardingRow[] {
  const { state } = useStore();
  return React.useMemo(() => {
    const { won } = roleSets(state.pipelineStages);
    const dealByLead = new Map<string, Deal>();
    for (const d of state.deals) {
      // Keep the most recently-updated deal per lead (usually only one).
      const cur = dealByLead.get(d.lead_id);
      if (!cur || +new Date(d.updated_at) > +new Date(cur.updated_at)) {
        dealByLead.set(d.lead_id, d);
      }
    }
    const onboardingByLead = new Map<string, Onboarding>();
    for (const o of state.onboardings) onboardingByLead.set(o.lead_id, o);
    const companyById = new Map(state.companies.map((c) => [c.id, c] as const));

    // Build rows in two steps so the filter narrows `deal` cleanly without
    // tripping the type predicate / inferred-null paths.
    const rows: OnboardingRow[] = [];
    for (const l of state.leads) {
      const d = dealByLead.get(l.id);
      if (!d || !won.has(d.stage)) continue;
      rows.push({
        lead: l,
        company: l.company_id ? companyById.get(l.company_id) ?? null : null,
        deal: d,
        onboarding: onboardingByLead.get(l.id) ?? null,
      });
    }
    rows.sort((a, b) =>
      +new Date(b.deal?.updated_at ?? 0) - +new Date(a.deal?.updated_at ?? 0),
    );
    return rows;
  }, [state.leads, state.deals, state.onboardings, state.companies, state.pipelineStages]);
}

// ---------- companies ------------------------------------------------------

export function useCompanies(): Company[] {
  return useStore().state.companies;
}

export function useCompany(id: string | null | undefined) {
  const { state } = useStore();
  return React.useMemo(() => {
    if (!id) return null;
    return state.companies.find((c) => c.id === id) ?? null;
  }, [id, state.companies]);
}

export interface CompanyAggregate {
  company: Company | null;
  contacts: Lead[];
  deals: Deal[];
  activities: Activity[];
  totals: {
    contacts: number;
    openDeals: number;
    totalMrr: number;
    closedMrr: number;
    latestActivityAt: string | null;
  };
}

export interface CompanyRow {
  company: Company;
  contactsCount: number;
  openDeals: number;
  totalMrr: number;
  closedMrr: number;
  /** Sum of per-deal value across all of the company's deals
   *  (annualised MRR + one-time). Surfaced as the "Deal value" column. */
  dealValue: number;
  /** Latest deal's stage id — used as the company's headline stage. */
  latestStage: string | null;
  latestActivity: string | null;
}

/** Build open/won/lost id sets from the live stage config (kind-based). */
function roleSets(stages: PipelineStage[]) {
  const open = new Set<string>();
  const won = new Set<string>();
  const lost = new Set<string>();
  for (const s of stages) {
    if (s.kind === "open") open.add(s.id);
    else if (s.kind === "won") won.add(s.id);
    else if (s.kind === "lost") lost.add(s.id);
  }
  return { open, won, lost };
}

export function useCompaniesOverview(): CompanyRow[] {
  const { state } = useStore();
  return React.useMemo(() => {
    const { open: openSet, won: wonSet } = roleSets(state.pipelineStages);
    // One pass to bucket leads/deals/activities by company, instead of
    // re-scanning all leads + all deals + all activities for every company
    // (was O(companies × (leads + deals + activities))).
    const companyIdByLead = new Map<string, string>();
    const contactCount = new Map<string, number>();
    for (const l of state.leads) {
      if (!l.company_id) continue;
      companyIdByLead.set(l.id, l.company_id);
      contactCount.set(l.company_id, (contactCount.get(l.company_id) ?? 0) + 1);
    }

    const agg = new Map<string, {
      open: number; totalMrr: number; closedMrr: number;
      dealValue: number;
      latestStage: string | null;
      latestStageAt: number;
    }>();
    for (const d of state.deals) {
      const cid = companyIdByLead.get(d.lead_id);
      if (!cid) continue;
      const a = agg.get(cid) ?? {
        open: 0, totalMrr: 0, closedMrr: 0,
        dealValue: 0, latestStage: null, latestStageAt: 0,
      };
      if (openSet.has(d.stage)) {
        a.open += 1;
        a.totalMrr += d.value_mrr ?? 0;
      } else if (wonSet.has(d.stage)) {
        a.closedMrr += d.value_mrr ?? 0;
      }
      // Per-deal value: annualised MRR + one-time. Sum across all deals
      // for this company (open + won + lost).
      a.dealValue += (d.value_mrr ?? 0) * 12 + (d.value_one_time ?? 0);
      const t = +new Date(d.updated_at);
      if (t > a.latestStageAt) {
        a.latestStageAt = t;
        a.latestStage = d.stage;
      }
      agg.set(cid, a);
    }

    const latestByCompany = new Map<string, string>();
    for (const act of state.activities) {
      const cid = companyIdByLead.get(act.lead_id);
      if (!cid) continue;
      const cur = latestByCompany.get(cid);
      if (!cur || +new Date(act.created_at) > +new Date(cur)) {
        latestByCompany.set(cid, act.created_at);
      }
    }

    return state.companies.map((c) => {
      const a = agg.get(c.id);
      return {
        company: c,
        contactsCount: contactCount.get(c.id) ?? 0,
        openDeals: a?.open ?? 0,
        totalMrr: a?.totalMrr ?? 0,
        closedMrr: a?.closedMrr ?? 0,
        dealValue: a?.dealValue ?? 0,
        latestStage: a?.latestStage ?? null,
        latestActivity: latestByCompany.get(c.id) ?? null,
      };
    });
  }, [state.companies, state.leads, state.deals, state.activities, state.pipelineStages]);
}

export function useCompanyAggregate(id: string | null | undefined): CompanyAggregate {
  const { state } = useStore();
  return React.useMemo(() => {
    const { open: openSet, won: wonSet } = roleSets(state.pipelineStages);
    const company = id ? state.companies.find((c) => c.id === id) ?? null : null;
    const contacts = company ? state.leads.filter((l) => l.company_id === company.id) : [];
    const leadIds = new Set(contacts.map((c) => c.id));
    const deals = state.deals.filter((d) => leadIds.has(d.lead_id));
    const activities = state.activities
      .filter((a) => leadIds.has(a.lead_id))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

    const openDeals = deals.filter((d) => openSet.has(d.stage));
    const totalMrr = openDeals.reduce((s, d) => s + (d.value_mrr ?? 0), 0);
    const closedMrr = deals
      .filter((d) => wonSet.has(d.stage))
      .reduce((s, d) => s + (d.value_mrr ?? 0), 0);
    const latestActivityAt = activities[0]?.created_at ?? null;

    return {
      company,
      contacts,
      deals,
      activities,
      totals: {
        contacts: contacts.length,
        openDeals: openDeals.length,
        totalMrr,
        closedMrr,
        latestActivityAt,
      },
    };
  }, [id, state.companies, state.leads, state.deals, state.activities, state.pipelineStages]);
}

export function useProfiles() {
  return useStore().state.profiles;
}

// ---------- pipeline stages ------------------------------------------------

/** Stages ordered by position. Falls back to defaults pre-hydration. */
export function usePipelineStages(): PipelineStage[] {
  const { state } = useStore();
  return React.useMemo(
    () => [...state.pipelineStages].sort((a, b) => a.position - b.position),
    [state.pipelineStages],
  );
}

export function useStageMap(): Map<string, PipelineStage> {
  const stages = usePipelineStages();
  return React.useMemo(() => {
    const m = new Map<string, PipelineStage>();
    for (const s of stages) m.set(s.id, s);
    return m;
  }, [stages]);
}

/** Stage id → label lookup. Mirrors `STAGE_LABEL` but live-driven. */
export function useStageLabels(): Record<string, string> {
  const stages = usePipelineStages();
  return React.useMemo(
    () => Object.fromEntries(stages.map((s) => [s.id, s.label])),
    [stages],
  );
}

/**
 * Semantic stage helpers — everything that used to hardcode 'closed_won' /
 * 'closed_lost' / the open-stage list keys off `kind` instead, so custom
 * pipelines don't break analytics.
 */
export function useStageRoles() {
  const stages = usePipelineStages();
  return React.useMemo(() => {
    const openIds = new Set(stages.filter((s) => s.kind === "open").map((s) => s.id));
    const wonIds = new Set(stages.filter((s) => s.kind === "won").map((s) => s.id));
    const lostIds = new Set(stages.filter((s) => s.kind === "lost").map((s) => s.id));
    const defaultStage = stages.find((s) => s.is_default) ?? stages[0] ?? null;
    return {
      openIds,
      wonIds,
      lostIds,
      defaultStageId: defaultStage?.id ?? "new",
      isOpen: (id: string | null | undefined) => !!id && openIds.has(id),
      isWon: (id: string | null | undefined) => !!id && wonIds.has(id),
      isLost: (id: string | null | undefined) => !!id && lostIds.has(id),
    };
  }, [stages]);
}

export function useCurrentUser() {
  const { user } = useAuth();
  const profiles = useStore().state.profiles;
  // Prefer the workspace profile row (richer data after edits) when present,
  // falling back to the auth-side copy when the workspace hasn't hydrated yet.
  return (user && profiles.find((p) => p.id === user.id)) ?? user ?? null;
}

export function useTemplates() {
  return useStore().state.templates;
}

export function useScripts() {
  const { templates } = useStore().state;
  return templates.salesScripts;
}

export function useScript(id?: string | null) {
  const scripts = useScripts();
  if (!scripts.length) return null;
  if (id) {
    const found = scripts.find((s) => s.id === id);
    if (found) return found;
  }
  return scripts.find((s) => s.isDefault) ?? scripts[0];
}

export function useTodaysTasks(): Activity[] {
  const { state } = useStore();
  return React.useMemo(() => {
    const cutoff = Date.now() + 24 * 3600000;
    return state.activities
      .filter((a) => a.status === "pending" && a.due_at && +new Date(a.due_at) <= cutoff)
      .sort((a, b) => +new Date(a.due_at!) - +new Date(b.due_at!));
  }, [state.activities]);
}

/** Raw activities list — used by surfaces that need to render completed
 *  tasks too (e.g. the "completed today" panel on /tasks). */
export function useStoreActivities(): Activity[] {
  return useStore().state.activities;
}

/**
 * True for activities the store wrote purely to record a field change (toast
 * undo, future History tab). False for "narrative" events that belong in the
 * visible activity timeline — notes, calls, emails, meetings, tasks, stage
 * changes, lead-created system events. The activity timeline filters these
 * out so the per-lead story isn't drowned in metadata diffs.
 */
export function isAuditEntry(a: Activity): boolean {
  return a.type === "system" && (a.metadata as any)?.kind === "audit";
}

/** Convenience: filter a list of activities to narrative-only. */
export function narrativeActivities(activities: Activity[]): Activity[] {
  return activities.filter((a) => !isAuditEntry(a));
}

// ============================================================================
// Actions
// ============================================================================

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  // crypto.randomUUID() is available in all modern browsers + Node 19+.
  // Falling back to a low-entropy id only if we're somewhere truly old.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

// ---------- audit summary helpers ------------------------------------------
// Produces the human label shown in the toast and on the audit-log entry.
// Kept tight — the diff itself lives in metadata.before / metadata.after, so
// the title doesn't need to be exhaustive.

function diffPatch<T extends Record<string, any>>(prev: T, patch: Partial<T>): {
  before: Partial<T>; after: Partial<T>;
} {
  const before: Partial<T> = {};
  const after: Partial<T> = {};
  for (const key of Object.keys(patch) as Array<keyof T>) {
    if (JSON.stringify(prev[key]) === JSON.stringify(patch[key])) continue;
    (before as any)[key] = prev[key];
    (after as any)[key] = patch[key];
  }
  return { before, after };
}

function summarizeLeadPatch(after: Partial<Lead>): string {
  const keys = Object.keys(after);
  if (keys.length === 0) return "Updated lead";
  if (keys.length === 1) {
    const k = keys[0];
    if (k === "name") return `Renamed to "${after.name}"`;
    if (k === "email") return "Updated email";
    if (k === "phone") return "Updated phone";
    if (k === "role") return "Updated role";
    if (k === "company_id") return "Reassigned company";
    if (k === "owner_id") return "Reassigned owner";
    if (k === "tags") return "Updated tags";
    return `Updated ${k.replace(/_/g, " ")}`;
  }
  return `Updated lead (${keys.length} fields)`;
}

function summarizeDealPatch(after: Partial<Deal>): string {
  const keys = Object.keys(after);
  if (keys.length === 0) return "Updated deal";
  if (keys.length === 1) {
    const k = keys[0];
    if (k === "value_mrr") return `MRR set to $${after.value_mrr}`;
    if (k === "value_one_time") return `One-time set to $${after.value_one_time}`;
    if (k === "probability") return `Probability: ${after.probability}%`;
    if (k === "expected_close_date") return "Updated expected close date";
    if (k === "loss_reason") return "Updated loss reason";
    if (k === "title") return "Renamed deal";
    return `Updated deal ${k.replace(/_/g, " ")}`;
  }
  return `Updated deal (${keys.length} fields)`;
}

function summarizeQualPatch(after: Partial<Qualification>): string {
  const keys = Object.keys(after);
  if (keys.length === 0) return "Updated qualification";
  if (keys.length === 1) {
    const k = keys[0];
    if (k === "fit_score") return `Fit score: ${after.fit_score}`;
    if (k === "budget_range") return `Budget: ${after.budget_range}`;
    if (k === "decision_maker") return `Decision maker: ${after.decision_maker ? "yes" : "no"}`;
    return `Updated qualification ${k.replace(/_/g, " ")}`;
  }
  return `Updated qualification (${keys.length} fields)`;
}

export function useActions() {
  const { state, dispatch, refresh } = useStore();
  const supabase = React.useMemo(() => createClient(), []);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Convenience wrapper: optimistic dispatch → server call → reconcile or
  // rollback. The `onErrorRevert` callback restores the pre-mutation state.
  const persist = React.useCallback(
    async <T,>(
      label: string,
      serverCall: () => Promise<T>,
      onSuccess: (result: T) => void,
      onErrorRevert: () => void,
    ) => {
      try {
        const result = await serverCall();
        onSuccess(result);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Unknown error";
        // Rephrase the cryptic RLS rejection so reps know why a write was
        // refused — happens when a rep triggers an admin-only mutation
        // through some path that didn't get UI-gated.
        const friendly = /row-level security|permission denied/i.test(raw)
          ? "Admin access required for this action."
          : raw;
        toast.error(`${label} failed: ${friendly}`);
        onErrorRevert();
      }
    },
    [],
  );

  /**
   * Insert an audit-flagged activity into the lead's timeline. Uses the
   * existing `system` activity type with `metadata.kind = 'audit'` so the
   * timeline can render undo affordances for it. Best-effort persistence —
   * the underlying mutation is what matters; if the audit log fails to save,
   * we just lose the timeline entry (and log to console).
   */
  function recordAudit(opts: {
    leadId: string;
    entity: "lead" | "deal" | "qual" | "activity";
    entityId: string;
    summary: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }): string | null {
    if (!userId) return null;
    const id = newId();
    const activity: Activity = {
      id,
      lead_id: opts.leadId,
      deal_id: null,
      user_id: userId,
      type: "system",
      status: "completed",
      title: opts.summary,
      body: null,
      metadata: {
        kind: "audit",
        entity: opts.entity,
        entity_id: opts.entityId,
        before: opts.before,
        after: opts.after,
      },
      due_at: null,
      completed_at: nowIso(),
      created_at: nowIso(),
    };
    dispatch({ type: "add_activity", activity });
    insertActivityRow(supabase, {
      id: activity.id,
      lead_id: activity.lead_id,
      deal_id: activity.deal_id,
      user_id: activity.user_id,
      type: activity.type,
      status: activity.status,
      title: activity.title,
      body: activity.body,
      metadata: activity.metadata,
      due_at: activity.due_at,
      completed_at: activity.completed_at,
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("audit log persistence failed", err);
    });
    return id;
  }

  /** Mark an audit activity as undone so the UI can hide its undo button. */
  function markAuditUndone(auditId: string) {
    const audit = state.activities.find((a) => a.id === auditId);
    if (!audit) return;
    const newMeta = { ...(audit.metadata ?? {}), undone_at: nowIso() };
    dispatch({ type: "update_activity", id: auditId, patch: { metadata: newMeta } });
    updateActivityRow(supabase, auditId, { metadata: newMeta }).catch(() => {});
  }

  /** Toast helper: short message + Undo action. ~6s lifetime keeps it in
   *  reach without lingering after the user has moved on. */
  function showUndoToast(label: string, undoFn: () => void) {
    toast(label, {
      action: { label: "Undo", onClick: undoFn },
      duration: 6000,
    });
  }

  /**
   * Apply a reverse stage update to a deal, then suppress the spurious
   * `stage_change` activity the BEFORE-UPDATE trigger will spawn for the
   * reverse (otherwise the timeline ends up with `original (UNDONE) +
   * reverse` for what the user did as one undo).
   *
   * `knownStageChangeIds` is a snapshot of the stage_change activity ids
   * for this lead BEFORE the reverse update — any new one after refetch is
   * the trigger's side-effect and gets deleted.
   */
  async function applyReverseStageChange(
    dealId: string,
    toStage: DealStage,
    toIndex: number,
    knownStageChangeIds: Set<string>,
    originalActivityId: string | null,
  ) {
    try {
      const rev = await updateDealRow(supabase, dealId, { stage: toStage, position: toIndex });
      dispatch({ type: "reconcile_deal", deal: rev });
      const fresh = await fetchActivitiesForLead(supabase, rev.lead_id);
      const spurious = fresh.find(
        (a) => a.type === "stage_change" && !knownStageChangeIds.has(a.id),
      );
      if (spurious) {
        await deleteActivityRow(supabase, spurious.id).catch(() => {});
      }
      const filtered = spurious ? fresh.filter((a) => a.id !== spurious.id) : fresh;
      dispatch({ type: "set_activities_for_lead", lead_id: rev.lead_id, activities: filtered });
      if (originalActivityId) markAuditUndone(originalActivityId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Undo failed: ${msg}`);
    }
  }

  return {
    deleteLead: async (id: string): Promise<void> => {
      dispatch({ type: "remove_lead", id });
      try {
        await bulkDeleteLeads(supabase, [id]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Delete failed: ${msg}`);
        // Re-fetch to restore state if delete failed
        await refresh();
      }
    },

    updateLead: (id: string, patch: Partial<Lead>) => {
      const prev = state.leads.find((l) => l.id === id);
      if (!prev) return;
      const { before, after } = diffPatch(prev, patch);
      if (Object.keys(after).length === 0) return; // no-op edit

      dispatch({ type: "update_lead", id, patch });
      void persist(
        "Update lead",
        () => updateLeadRow(supabase, id, patch),
        (lead) => {
          dispatch({ type: "reconcile_lead", lead });
          const summary = summarizeLeadPatch(after);
          const auditId = recordAudit({
            leadId: id, entity: "lead", entityId: id, summary, before, after,
          });
          showUndoToast(summary, () => {
            dispatch({ type: "update_lead", id, patch: before });
            updateLeadRow(supabase, id, before)
              .then((rev) => dispatch({ type: "reconcile_lead", lead: rev }))
              .catch((err) => toast.error(`Undo failed: ${err.message}`));
            if (auditId) markAuditUndone(auditId);
          });
        },
        () => dispatch({ type: "reconcile_lead", lead: prev }),
      );
    },

    /**
     * Insert a lead. The `bootstrap_lead` SQL trigger auto-creates a deal +
     * qualification with defaults; we then fetch them back so the local store
     * mirrors the DB exactly.
     */
    createLead: (input: Partial<Lead>): string => {
      if (!userId) {
        toast.error("Sign in to create leads");
        return "";
      }
      const id = newId();
      const now = nowIso();
      const lead: Lead = {
        id,
        owner_id: userId,
        company_id: input.company_id ?? null,
        name: input.name ?? "Untitled",
        email: input.email ?? null,
        phone: input.phone ?? null,
        role: input.role ?? null,
        service_type: input.service_type ?? null,
        additional_info: input.additional_info ?? null,
        source: input.source ?? "yaas_form",
        status: input.status ?? "active",
        tags: input.tags ?? [],
        created_at: now,
        updated_at: now,
      };
      // Optimistic deal + qual so the lead-detail page renders immediately.
      // We replace them with the trigger's authoritative rows once the
      // server insert returns. Start stage mirrors `bootstrap_lead`: the
      // is_default stage (fallback: first by position, then "new").
      const startStage =
        [...state.pipelineStages].sort((a, b) => a.position - b.position)
          .find((s) => s.is_default)?.id ??
        [...state.pipelineStages].sort((a, b) => a.position - b.position)[0]?.id ??
        "new";
      const optimisticDeal: Deal = {
        id: newId(),
        lead_id: id,
        owner_id: userId,
        title: lead.name,
        stage: startStage,
        value_mrr: 0,
        value_one_time: 0,
        value_currency: "USD",
        probability: 10,
        expected_close_date: null,
        closed_at: null,
        loss_reason: null,
        position: state.deals.filter((d) => d.stage === startStage).length,
        created_at: now,
        updated_at: now,
      };
      const optimisticQual: Qualification = {
        lead_id: id,
        budget_range: null,
        budget_amount: null,
        budget_currency: "USD",
        budget_recurrence: "monthly",
        decision_maker: null,
        pain_points: null,
        goals: null, fit_score: 0, notes: null, updated_at: now,
      };
      dispatch({ type: "create_lead", lead, deal: optimisticDeal, qualification: optimisticQual });

      (async () => {
        try {
          await insertLeadRow(supabase, {
            id,
            owner_id: lead.owner_id,
            company_id: lead.company_id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            role: lead.role,
            service_type: lead.service_type,
            additional_info: lead.additional_info,
            source: lead.source,
            status: lead.status,
            tags: lead.tags,
          });
          // Bootstrap trigger inserts the canonical deal + qual; fetch them
          // back so the optimistic placeholders are replaced.
          const [deal, qual, activities] = await Promise.all([
            fetchDealForLead(supabase, id),
            fetchQualForLead(supabase, id),
            fetchActivitiesForLead(supabase, id),
          ]);
          if (deal) dispatch({ type: "reconcile_deal", deal });
          if (qual) dispatch({ type: "reconcile_qual", qual });
          dispatch({ type: "set_activities_for_lead", lead_id: id, activities });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Create lead failed: ${msg}`);
          dispatch({ type: "remove_lead", id });
        }
      })();

      return id;
    },

    updateDeal: (id: string, patch: Partial<Deal>) => {
      const prev = state.deals.find((d) => d.id === id);
      if (!prev) return;
      const { before, after } = diffPatch(prev, patch);
      if (Object.keys(after).length === 0) return;

      // Stage changes are audited by the SQL trigger (creates a stage_change
      // activity); other field edits get a client-side audit entry.
      const stageChanged = "stage" in after;
      // Strip stage from the audit-recorded diff to avoid duplication.
      const auditedBefore: Partial<Deal> = { ...before };
      const auditedAfter: Partial<Deal> = { ...after };
      delete auditedBefore.stage;
      delete auditedAfter.stage;

      dispatch({ type: "update_deal", id, patch });
      void persist(
        "Update deal",
        () => updateDealRow(supabase, id, patch),
        async (deal) => {
          dispatch({ type: "reconcile_deal", deal });
          if (stageChanged) {
            const activities = await fetchActivitiesForLead(supabase, deal.lead_id);
            dispatch({ type: "set_activities_for_lead", lead_id: deal.lead_id, activities });
            const originalStageChange = activities.find(
              (a) => a.type === "stage_change" && a.deal_id === deal.id,
            );
            const knownIds = new Set(
              activities.filter((a) => a.type === "stage_change").map((a) => a.id),
            );
            showUndoToast(`Stage: ${prev.stage} → ${after.stage}`, () => {
              dispatch({ type: "update_deal", id, patch: { stage: prev.stage, position: prev.position } });
              void applyReverseStageChange(id, prev.stage, prev.position, knownIds, originalStageChange?.id ?? null);
            });
          }
          if (Object.keys(auditedAfter).length > 0) {
            const summary = summarizeDealPatch(auditedAfter);
            const auditId = recordAudit({
              leadId: deal.lead_id, entity: "deal", entityId: id,
              summary, before: auditedBefore, after: auditedAfter,
            });
            showUndoToast(summary, () => {
              dispatch({ type: "update_deal", id, patch: auditedBefore });
              updateDealRow(supabase, id, auditedBefore)
                .then((rev) => dispatch({ type: "reconcile_deal", deal: rev }))
                .catch((err) => toast.error(`Undo failed: ${err.message}`));
              if (auditId) markAuditUndone(auditId);
            });
          }
        },
        () => dispatch({ type: "reconcile_deal", deal: prev }),
      );
    },

    moveDeal: (id: string, toStage: DealStage, toIndex: number) => {
      const prev = state.deals.find((d) => d.id === id);
      if (!prev) return;
      const prevStage = prev.stage;
      const prevIndex = prev.position;
      const prevAll = state.deals;
      dispatch({ type: "move_deal", id, toStage, toIndex });

      // Auto-bootstrap an onboarding sheet the first time a deal enters a
      // "won" stage (closed_won, contract, operationalized). Mirrors the
      // server-side bootstrap_lead trigger pattern. The reducer's update
      // case upserts, so calling it with an empty patch is enough to
      // create the row; subsequent stage moves within won stages no-op
      // because the row already exists.
      const newStageKind = state.pipelineStages.find((s) => s.id === toStage)?.kind;
      const prevStageKind = state.pipelineStages.find((s) => s.id === prevStage)?.kind;
      if (newStageKind === "won" && prevStageKind !== "won") {
        const lead = state.leads.find((l) => l.id === prev.lead_id);
        if (lead) {
          // Seed contact mirrors from the lead so the onboarding sheet
          // doesn't start empty when ops opens it.
          dispatch({
            type: "update_onboarding",
            lead_id: prev.lead_id,
            patch: {
              poc_name: lead.name ?? null,
              email: lead.email,
              whatsapp_number: lead.phone,
              lead_source: lead.source ?? null,
            },
          });
        }
      }

      void (async () => {
        try {
          const deal = await updateDealRow(supabase, id, { stage: toStage, position: toIndex });
          dispatch({ type: "reconcile_deal", deal });
          if (toStage !== prevStage) {
            const activities = await fetchActivitiesForLead(supabase, deal.lead_id);
            dispatch({ type: "set_activities_for_lead", lead_id: deal.lead_id, activities });
            const originalStageChange = activities.find(
              (a) => a.type === "stage_change" && a.deal_id === deal.id,
            );
            const knownIds = new Set(
              activities.filter((a) => a.type === "stage_change").map((a) => a.id),
            );
            showUndoToast(`Stage: ${prevStage} → ${toStage}`, () => {
              dispatch({ type: "move_deal", id, toStage: prevStage, toIndex: prevIndex });
              void applyReverseStageChange(id, prevStage, prevIndex, knownIds, originalStageChange?.id ?? null);
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Move deal failed: ${msg}`);
          for (const d of prevAll) {
            dispatch({ type: "reconcile_deal", deal: d });
          }
        }
      })();
    },

    advanceStage: (dealId: string) => {
      const d = state.deals.find((x) => x.id === dealId);
      if (!d) return;
      const order: DealStage[] = [
        "new", "contacted", "call_booked", "call_held",
        "proposal_sent", "negotiating", "closed_won",
      ];
      const next = order[Math.min(order.indexOf(d.stage) + 1, order.length - 1)];
      if (next === d.stage) return;
      const idx = state.deals.filter((x) => x.stage === next).length;
      const prevStage = d.stage;
      const prevIndex = d.position;
      const prevAll = state.deals;
      dispatch({ type: "move_deal", id: dealId, toStage: next, toIndex: idx });
      void (async () => {
        try {
          const deal = await updateDealRow(supabase, dealId, { stage: next, position: idx });
          dispatch({ type: "reconcile_deal", deal });
          const activities = await fetchActivitiesForLead(supabase, deal.lead_id);
          dispatch({ type: "set_activities_for_lead", lead_id: deal.lead_id, activities });
          const originalStageChange = activities.find(
            (a) => a.type === "stage_change" && a.deal_id === deal.id,
          );
          const knownIds = new Set(
            activities.filter((a) => a.type === "stage_change").map((a) => a.id),
          );
          showUndoToast(`Stage: ${prevStage} → ${next}`, () => {
            dispatch({ type: "move_deal", id: dealId, toStage: prevStage, toIndex: prevIndex });
            void applyReverseStageChange(dealId, prevStage, prevIndex, knownIds, originalStageChange?.id ?? null);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Advance stage failed: ${msg}`);
          for (const x of prevAll) dispatch({ type: "reconcile_deal", deal: x });
        }
      })();
    },

    updateQualification: (lead_id: string, patch: Partial<Qualification>) => {
      const prev = state.qualifications.find((q) => q.lead_id === lead_id);
      if (!prev) return;
      const { before, after } = diffPatch(prev, patch);
      if (Object.keys(after).length === 0) return;

      dispatch({ type: "update_qualification", lead_id, patch });
      const merged: Qualification = { ...prev, ...patch, updated_at: nowIso() };
      void persist(
        "Update qualification",
        () => upsertQualRow(supabase, merged),
        (qual) => {
          dispatch({ type: "reconcile_qual", qual });
          const summary = summarizeQualPatch(after);
          const auditId = recordAudit({
            leadId: lead_id, entity: "qual", entityId: lead_id, summary, before, after,
          });
          showUndoToast(summary, () => {
            const reverted: Qualification = { ...qual, ...before, updated_at: nowIso() };
            dispatch({ type: "update_qualification", lead_id, patch: before });
            upsertQualRow(supabase, reverted)
              .then((rev) => dispatch({ type: "reconcile_qual", qual: rev }))
              .catch((err) => toast.error(`Undo failed: ${err.message}`));
            if (auditId) markAuditUndone(auditId);
          });
        },
        () => dispatch({ type: "reconcile_qual", qual: prev }),
      );
    },

    /** Patch the onboarding sheet for a lead. Creates the record on first
     *  write — there is no separate `createOnboarding` action; the upsert
     *  in the reducer handles bootstrap. */
    updateOnboarding: (lead_id: string, patch: Partial<Onboarding>) => {
      dispatch({ type: "update_onboarding", lead_id, patch });
      // Persistence to Supabase is a no-op until the onboarding table is
      // wired up in the api layer. The reducer keeps the in-memory state
      // consistent so the UI works end-to-end against mock data.
    },

    logActivity: (input: Partial<Activity> & { lead_id: string }): string => {
      if (!userId) {
        toast.error("Sign in to log activity");
        return "";
      }
      const now = nowIso();
      const deal = state.deals.find((d) => d.lead_id === input.lead_id);
      const activity: Activity = {
        id: newId(),
        lead_id: input.lead_id,
        deal_id: input.deal_id ?? deal?.id ?? null,
        user_id: userId,
        type: input.type ?? "note",
        status: input.status ?? "completed",
        title: input.title ?? null,
        body: input.body ?? null,
        metadata: input.metadata ?? {},
        due_at: input.due_at ?? null,
        completed_at: input.completed_at ?? (input.status === "pending" ? null : now),
        created_at: now,
      };
      dispatch({ type: "add_activity", activity });
      void persist(
        "Log activity",
        () => insertActivityRow(supabase, {
          id: activity.id,
          lead_id: activity.lead_id,
          deal_id: activity.deal_id,
          user_id: activity.user_id,
          type: activity.type,
          status: activity.status,
          title: activity.title,
          body: activity.body,
          metadata: activity.metadata,
          due_at: activity.due_at,
          completed_at: activity.completed_at,
        }),
        (reconciled) => dispatch({ type: "reconcile_activity", activity: reconciled }),
        () => dispatch({ type: "remove_activity", id: activity.id }),
      );
      return activity.id;
    },

    completeActivity: (id: string) => {
      const prev = state.activities.find((a) => a.id === id);
      if (!prev) return;
      if (prev.status === "completed") return; // idempotent
      const patch = { status: "completed" as const, completed_at: nowIso() };
      dispatch({ type: "update_activity", id, patch });
      void persist(
        "Complete task",
        () => updateActivityRow(supabase, id, patch),
        (activity) => {
          dispatch({ type: "reconcile_activity", activity });
          showUndoToast(`Completed: ${activity.title ?? "task"}`, () => {
            const revertPatch = { status: prev.status, completed_at: prev.completed_at };
            dispatch({ type: "update_activity", id, patch: revertPatch });
            updateActivityRow(supabase, id, revertPatch)
              .then((act) => dispatch({ type: "reconcile_activity", activity: act }))
              .catch((err) => toast.error(`Undo failed: ${err.message}`));
          });
        },
        () => dispatch({ type: "reconcile_activity", activity: prev }),
      );
    },

    /** Undo a previously-completed task — flips status back to pending. Used
     *  by the "Completed today" panel on /tasks where the user wants to
     *  recover from an accidental click beyond the toast window. */
    /**
     * Persist updates to an existing call activity — used when the user
     * re-opens a logged call in the live script view and amends captures,
     * prompts, or the summary. Updates body + metadata in one shot rather
     * than firing per-field audits, since this is one cohesive "re-saved"
     * action, not a stream of edits.
     */
    updateCallActivity: (
      id: string,
      patch: { body?: string | null; metadata?: Record<string, unknown> },
    ) => {
      const prev = state.activities.find((a) => a.id === id);
      if (!prev) return;
      dispatch({ type: "update_activity", id, patch });
      void persist(
        "Update call",
        () => updateActivityRow(supabase, id, patch as Partial<Activity>),
        (activity) => dispatch({ type: "reconcile_activity", activity }),
        () => dispatch({ type: "reconcile_activity", activity: prev }),
      );
    },

    uncompleteActivity: (id: string) => {
      const prev = state.activities.find((a) => a.id === id);
      if (!prev) return;
      if (prev.status !== "completed") return;
      const patch = { status: "pending" as const, completed_at: null };
      dispatch({ type: "update_activity", id, patch });
      void persist(
        "Restore task",
        () => updateActivityRow(supabase, id, patch),
        (activity) => dispatch({ type: "reconcile_activity", activity }),
        () => dispatch({ type: "reconcile_activity", activity: prev }),
      );
    },

    updateTemplates: (patch: Partial<WorkspaceTemplates>) =>
      dispatch({ type: "update_templates", patch }),

    resetTemplates: () =>
      dispatch({ type: "update_templates", patch: DEFAULT_TEMPLATES }),

    // ---------- companies ----------

    findOrCreateCompany: (input: {
      name: string;
      website?: string | null;
      youtube?: string | null;
      links?: Company["links"];
      industry?: string | null;
      size?: Company["size"] | null;
    }): string => {
      const cleaned = input.name.trim();
      if (!cleaned) return "";
      const existing = state.companies.find(
        (c) => c.name.toLowerCase() === cleaned.toLowerCase(),
      );
      if (existing) return existing.id;

      const now = nowIso();
      const links: Company["links"] = [...(input.links ?? [])];
      if (input.website && !links.some((l) => l.type === "website")) {
        links.unshift({
          id: newId(),
          type: "website",
          url: input.website.startsWith("http") ? input.website : `https://${input.website}`,
        });
      }
      if (input.youtube && !links.some((l) => l.type === "youtube")) {
        links.push({ id: newId(), type: "youtube", url: input.youtube });
      }

      const id = newId();
      const company: Company = {
        id,
        name: cleaned,
        domain: extractDomain(input.website ?? null),
        industry: input.industry ?? null,
        size: input.size ?? null,
        notes: null,
        tags: [],
        links: links.map((l) => ({ id: l.id || newId(), type: l.type, label: l.label ?? null, url: l.url })),
        priority: null,
        created_at: now,
        updated_at: now,
      };
      dispatch({ type: "create_company", company });
      void persist(
        "Create company",
        () => insertCompanyRow(supabase, {
          id: company.id,
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          size: company.size,
          notes: company.notes,
          tags: company.tags,
          links: company.links,
          priority: company.priority,
        }),
        (c) => dispatch({ type: "reconcile_company", company: c }),
        () => dispatch({ type: "delete_company", id }),
      );
      return id;
    },

    createCompany: (input: Partial<Company> & { name: string }): string => {
      const id = input.id ?? newId();
      const now = nowIso();
      const company: Company = {
        id,
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        links: (input.links ?? []).map((l) => ({
          id: l.id || newId(),
          type: l.type,
          label: l.label ?? null,
          url: l.url,
        })),
        priority: input.priority ?? null,
        created_at: now,
        updated_at: now,
      };
      dispatch({ type: "create_company", company });
      void persist(
        "Create company",
        () => insertCompanyRow(supabase, {
          id: company.id,
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          size: company.size,
          notes: company.notes,
          tags: company.tags,
          links: company.links,
          priority: company.priority,
        }),
        (c) => dispatch({ type: "reconcile_company", company: c }),
        () => dispatch({ type: "delete_company", id }),
      );
      return id;
    },

    updateCompany: (id: string, patch: Partial<Company>) => {
      const prev = state.companies.find((c) => c.id === id);
      if (!prev) return;
      dispatch({ type: "update_company", id, patch });
      void persist(
        "Update company",
        () => updateCompanyRow(supabase, id, patch),
        (company) => dispatch({ type: "reconcile_company", company }),
        () => dispatch({ type: "reconcile_company", company: prev }),
      );
    },

    /**
     * Update the current user's profile row (full_name, avatar_url, role).
     * Optimistic — updates the in-store profile copy immediately, reverts on
     * error. The auth provider's `onAuthStateChange` won't fire for plain
     * profile edits (no auth event), so consumers should rely on
     * `useCurrentUser()` which reads from the store first.
     */
    updateProfile: (patch: Partial<Pick<Profile, "full_name" | "avatar_url" | "role" | "must_change_password">>) => {
      if (!userId) {
        toast.error("Sign in to update your profile");
        return;
      }
      const prev = state.profiles.find((p) => p.id === userId);
      if (!prev) return;
      const optimistic: Profile = { ...prev, ...patch };
      dispatch({ type: "update_profile", profile: optimistic });
      void persist(
        "Update profile",
        () => updateProfileRow(supabase, userId, patch),
        (profile) => dispatch({ type: "update_profile", profile }),
        () => dispatch({ type: "update_profile", profile: prev }),
      );
    },

    /**
     * Reverse a previously-logged change from the activity timeline. Reads
     * the audit metadata (or stage_change metadata) and applies the inverse
     * mutation. Marks the audit entry as undone so its UI hides the button.
     */
    undoFromAudit: (auditActivityId: string) => {
      const audit = state.activities.find((a) => a.id === auditActivityId);
      if (!audit) return;
      const meta = (audit.metadata ?? {}) as Record<string, any>;
      if (meta.undone_at) return; // already undone

      // Stage change activity (SQL-trigger inserted)
      if (audit.type === "stage_change") {
        const fromStage = meta.from as DealStage | undefined;
        if (!fromStage || !audit.deal_id) return;
        const deal = state.deals.find((d) => d.id === audit.deal_id);
        if (!deal) return;
        const newIndex = state.deals.filter((d) => d.stage === fromStage && d.id !== deal.id).length;
        const knownStageChangeIds = new Set(
          state.activities
            .filter((a) => a.lead_id === deal.lead_id && a.type === "stage_change")
            .map((a) => a.id),
        );
        dispatch({ type: "move_deal", id: deal.id, toStage: fromStage, toIndex: newIndex });
        void applyReverseStageChange(deal.id, fromStage, newIndex, knownStageChangeIds, auditActivityId);
        return;
      }

      // Audit-flagged system activity
      if (meta.kind !== "audit") return;
      const before = (meta.before ?? {}) as Record<string, any>;
      const entityId = meta.entity_id as string | undefined;
      if (!entityId) return;

      switch (meta.entity) {
        case "lead": {
          dispatch({ type: "update_lead", id: entityId, patch: before });
          updateLeadRow(supabase, entityId, before)
            .then((lead) => dispatch({ type: "reconcile_lead", lead }))
            .catch((err) => toast.error(`Undo failed: ${err.message}`));
          break;
        }
        case "deal": {
          dispatch({ type: "update_deal", id: entityId, patch: before });
          updateDealRow(supabase, entityId, before)
            .then((deal) => dispatch({ type: "reconcile_deal", deal }))
            .catch((err) => toast.error(`Undo failed: ${err.message}`));
          break;
        }
        case "qual": {
          const prevQ = state.qualifications.find((q) => q.lead_id === entityId);
          if (!prevQ) return;
          const reverted: Qualification = { ...prevQ, ...before, updated_at: nowIso() };
          dispatch({ type: "update_qualification", lead_id: entityId, patch: before });
          upsertQualRow(supabase, reverted)
            .then((q) => dispatch({ type: "reconcile_qual", qual: q }))
            .catch((err) => toast.error(`Undo failed: ${err.message}`));
          break;
        }
        case "activity": {
          dispatch({ type: "update_activity", id: entityId, patch: before });
          updateActivityRow(supabase, entityId, before)
            .then((a) => dispatch({ type: "reconcile_activity", activity: a }))
            .catch((err) => toast.error(`Undo failed: ${err.message}`));
          break;
        }
      }
      markAuditUndone(auditActivityId);
    },

    deleteCompany: (id: string) => {
      const prev = state.companies.find((c) => c.id === id);
      const affectedLeads = state.leads.filter((l) => l.company_id === id);
      if (!prev) return;
      dispatch({ type: "delete_company", id });
      void persist(
        "Delete company",
        () => deleteCompanyRow(supabase, id),
        () => {},
        () => {
          // Best-effort restore: re-create the company entry locally and
          // re-link the affected leads. (We don't undelete the row on the
          // server because we never deleted it — this rollback only matters
          // when the server delete fails before it lands.)
          dispatch({ type: "create_company", company: prev });
          for (const l of affectedLeads) {
            dispatch({ type: "update_lead", id: l.id, patch: { company_id: prev.id } });
          }
        },
      );
    },

    // ---------- bulk import / workspace data ----------

    /**
     * Persist a CSV import: insert any new companies, then the leads (the
     * bootstrap_lead trigger spawns deal + qualification per lead). Full
     * workspace refetch afterward so the new rows + their triggered deals
     * land in local state consistently.
     */
    importLeads: async (payload: {
      newCompanies: Array<Record<string, unknown>>;
      leads: Array<Record<string, unknown>>;
    }): Promise<void> => {
      await bulkInsertCompanies(supabase, payload.newCompanies);
      await bulkInsertLeads(supabase, payload.leads);
      await refresh();
    },

    // ---------- bulk edit (list selection) ----------

    bulkSetSource: async (ids: string[], source: Lead["source"]): Promise<void> => {
      await bulkUpdateLeadsField(supabase, ids, { source });
      await refresh();
    },

    bulkSetStage: async (leadIds: string[], stage: DealStage): Promise<void> => {
      await bulkSetStage(supabase, leadIds, stage);
      await refresh();
    },

    bulkAddTag: async (leadIds: string[], tag: string): Promise<void> => {
      const t = tag.trim();
      if (!t) return;
      await bulkAddTag(supabase, leadIds, t);
      await refresh();
    },

    /** Assign every selected lead to one owner. */
    bulkAssignOwner: async (ids: string[], ownerId: string): Promise<void> => {
      await bulkUpdateLeadsField(supabase, ids, { owner_id: ownerId });
      await refresh();
    },

    /**
     * Round-robin: distribute the selected leads evenly across the chosen
     * owners in order. Deterministic — lead[i] → owners[i % owners.length].
     * Returns the per-owner counts so the UI can confirm the split.
     */
    bulkRotateOwners: async (
      ids: string[],
      ownerIds: string[],
    ): Promise<Record<string, number>> => {
      if (ownerIds.length === 0) return {};
      const assignments = ids.map((id, i) => ({
        id,
        owner_id: ownerIds[i % ownerIds.length],
      }));
      await bulkAssignOwners(supabase, assignments);
      await refresh();
      const counts: Record<string, number> = {};
      for (const a of assignments) counts[a.owner_id] = (counts[a.owner_id] ?? 0) + 1;
      return counts;
    },

    bulkDeleteLeads: async (ids: string[]): Promise<void> => {
      await bulkDeleteLeads(supabase, ids);
      await refresh();
    },

    // ---------- pipeline stages (admin) ----------

    createStage: async (input: {
      label: string;
      kind: StageKind;
      tone: StageTone;
    }): Promise<void> => {
      const label = input.label.trim();
      if (!label) return;
      const base =
        label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "stage";
      const existing = new Set(state.pipelineStages.map((s) => s.id));
      let id = base;
      let n = 2;
      while (existing.has(id)) id = `${base}_${n++}`;
      const position = state.pipelineStages.reduce((m, s) => Math.max(m, s.position), -1) + 1;
      const stages = await (async () => {
        await insertStageRow(supabase, {
          id, label, position, kind: input.kind, tone: input.tone, is_default: false,
        });
        return fetchPipelineStages(supabase);
      })();
      dispatch({ type: "set_pipeline_stages", stages });
    },

    updateStage: async (
      id: string,
      patch: Partial<Pick<PipelineStage, "label" | "tone" | "kind">>,
    ): Promise<void> => {
      await updateStageRow(supabase, id, patch);
      dispatch({ type: "set_pipeline_stages", stages: await fetchPipelineStages(supabase) });
    },

    /** Single source of default — clears the flag everywhere, sets it on one. */
    setDefaultStage: async (id: string): Promise<void> => {
      const others = state.pipelineStages.filter((s) => s.is_default && s.id !== id);
      for (const s of others) await updateStageRow(supabase, s.id, { is_default: false });
      await updateStageRow(supabase, id, { is_default: true });
      dispatch({ type: "set_pipeline_stages", stages: await fetchPipelineStages(supabase) });
    },

    reorderStages: async (orderedIds: string[]): Promise<void> => {
      await Promise.all(
        orderedIds.map((sid, i) => updateStageRow(supabase, sid, { position: i })),
      );
      dispatch({ type: "set_pipeline_stages", stages: await fetchPipelineStages(supabase) });
    },

    /** Move every deal in `id` to `reassignToId`, then delete the stage.
     *  Full refresh because deals changed. */
    deleteStage: async (id: string, reassignToId: string): Promise<void> => {
      await reassignAllDeals(supabase, id, reassignToId);
      await deleteStageRow(supabase, id);
      await refresh();
    },

    /** Wipe all CRM data (admin-only at RLS). Caller handles confirmation. */
    clearWorkspace: async (): Promise<void> => {
      await clearWorkspaceData(supabase);
      await refresh();
    },

    /** Restore a JSON backup. Replace clears first; merge keeps existing. */
    restoreBackup: async (
      backup: WorkspaceBackup,
      mode: "merge" | "replace",
    ): Promise<void> => {
      if (mode === "replace") {
        await clearWorkspaceData(supabase);
      }
      await restoreWorkspace(supabase, backup, mode);
      await refresh();
    },
  };
}
