import type { DealStage } from "./constants";
import type { ServiceTypeId, PriorityLevel } from "./constants";

export type LeadSource =
  | "yaas_form" | "referral" | "outbound" | "inbound_email"
  | "linkedin" | "event" | "other";

/** Currencies the app supports end-to-end (DB check + UI pickers). */
export type Currency = "USD" | "INR" | "GBP" | "AED";

/** Budget recurrence — does the lead's stated budget reset monthly, or is
 *  it a single-shot allocation? */
export type Recurrence = "one_time" | "monthly";

export type ActivityType =
  | "note" | "call" | "email" | "meeting" | "task" | "stage_change" | "system";

export type ActivityStatus = "pending" | "completed" | "cancelled";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string | null;
  /** Set to true when an admin invites the user with a temporary password.
   *  The app forces a password change on the next sign-in and flips this to
   *  false once the user picks their own password. */
  must_change_password?: boolean;
}

// ============================================================================
// Companies
// ============================================================================

/**
 * Types of external links a company can have. Each company can have any
 * number of links of any type — fully flexible. Use "other" for one-offs.
 */
export type CompanyLinkType =
  | "website"
  | "youtube"
  | "linkedin"
  | "twitter"
  | "instagram"
  | "tiktok"
  | "threads"
  | "github"
  | "discord"
  | "other";

export interface CompanyLink {
  id: string;
  type: CompanyLinkType;
  /** Optional override label, e.g. "Founder's personal X account". */
  label?: string | null;
  url: string;
}

export type CompanySize = "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";

export interface Company {
  id: string;
  name: string;
  domain: string | null;       // e.g. "hammondco.com"
  industry: string | null;
  size: CompanySize | null;
  notes: string | null;
  tags: string[];
  links: CompanyLink[];
  /** Triage priority — surfaced as a column on the companies list. */
  priority: PriorityLevel | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Leads
// ============================================================================

export interface Lead {
  id: string;
  owner_id: string | null;
  company_id: string | null;   // → Company. Resolved name lives on Company.

  name: string;
  email: string | null;
  /** WhatsApp / phone — single field. The onboarding sheet labels this as
   *  "WhatsApp Number" since that's the practical use, but the data is one
   *  contact number, not two. */
  phone: string | null;
  role: string | null;

  /** Single-select from SERVICE_TYPES. Replaces the legacy free-text
   *  `service_interest`. */
  service_type: ServiceTypeId | null;
  additional_info: string | null;
  source: LeadSource;
  status: string;
  tags: string[];

  /** Stable id from the originating form export (YAAS "Submission ID").
   *  Used to make CSV re-imports idempotent. Null for manually-created. */
  source_submission_id?: string | null;

  created_at: string;
  updated_at: string;
}

export interface Deal {
  id: string;
  lead_id: string;
  owner_id: string | null;
  title: string | null;
  stage: DealStage;
  value_mrr: number;
  value_one_time: number;
  /** Currency that both `value_mrr` and `value_one_time` are denominated in.
   *  Each deal carries its own currency — workspaces with multi-region
   *  customers don't have to translate at entry time. */
  value_currency: Currency;
  probability: number;
  expected_close_date: string | null;
  closed_at: string | null;
  loss_reason: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Qualification {
  lead_id: string;
  /** Legacy free-text budget — kept for back-compat reads of older rows.
   *  New writes go to the structured fields below. */
  budget_range: string | null;
  budget_amount: number | null;
  budget_currency: Currency | null;
  budget_recurrence: Recurrence | null;
  decision_maker: boolean | null;
  pain_points: string | null;
  goals: string | null;
  fit_score: number;
  notes: string | null;
  updated_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  deal_id: string | null;
  user_id: string | null;
  type: ActivityType;
  status: ActivityStatus;
  title: string | null;
  body: string | null;
  metadata: Record<string, any>;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// ============================================================================
// Onboarding — operationalisation sheet for closed deals
// ============================================================================
//
// Created automatically when a deal reaches the `closed_won` stage (mirrors
// how `deals` and `qualifications` get bootstrapped from a new lead). 1:1
// with leads.

export interface Onboarding {
  lead_id: string;

  // ---- scope of work ----
  final_scope_of_work: string | null;
  number_of_videos: number | null;
  format: string | null;
  go_live_timeline: string | null;
  platform: string | null;
  team_required: string | null;

  // ---- ops checkpoints ----
  operationalised: boolean;
  first_video_live_link: string | null;
  finance_team_looped_in: boolean;
  account_manager_assigned: boolean;

  // ---- contact ----
  poc_name: string | null;
  /** Mirror of lead.source for convenience on this sheet. */
  lead_source: LeadSource | null;
  /** Mirror of lead.phone. WhatsApp and phone are a single field by design. */
  whatsapp_number: string | null;
  /** Mirror of lead.email. */
  email: string | null;

  // ---- workflow ----
  next_action: string | null;
  next_action_date: string | null;
  daily_notes: string | null;

  // ---- document links ----
  briefing_doc_url: string | null;
  pitch_deck_url: string | null;
  proposal_doc_url: string | null;
  final_msa_url: string | null;
  signed_sow_url: string | null;
  po_first_invoice_url: string | null;
  final_int_brief_url: string | null;

  created_at: string;
  updated_at: string;
}

/** Flattened row used by the pipeline list/board. */
export interface LeadOverview extends Lead {
  /** Joined company entity — null if the lead is unassigned. */
  company: Company | null;

  deal_id: string | null;
  deal_stage: DealStage | null;
  value_mrr: number | null;
  value_one_time: number | null;
  value_currency: Currency | null;
  probability: number | null;
  expected_close_date: string | null;
  closed_at: string | null;
  deal_position: number | null;
  fit_score: number | null;
}
