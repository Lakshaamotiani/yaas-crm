/**
 * In-memory fixture for YAAS Sales CRM.
 * Indian enterprises, INR pricing (₹ lakhs), Lakshaa as owner.
 * Swap for real Supabase data by wiring store.tsx.
 */

import type {
  Lead, Deal, Activity, Qualification, Profile, LeadOverview, Company, CompanyLink,
} from "./types";
import type { DealStage } from "./constants";
import { extractDomain } from "./utils";

const uid = () => Math.random().toString(36).slice(2, 10);

const me: Profile = {
  id: "me",
  full_name: "Lakshaa",
  email: "lakshaa@yaas.in",
  avatar_url: null,
  role: "owner",
};

const teammates: Profile[] = [
  me,
  { id: "u_rohit",  full_name: "Rohit Kamath",     email: "rohit@yaas.in",    avatar_url: null, role: "admin" },
  { id: "u_varun",  full_name: "Varun Mayya",       email: "varun@yaas.in",    avatar_url: null, role: "admin" },
  { id: "u_loveena",full_name: "Loveena",           email: "loveena@yaas.in",  avatar_url: null, role: "member" },
  { id: "u_nitesh", full_name: "Nitesh Wankhede",   email: "nitesh@yaas.in",   avatar_url: null, role: "member" },
];

interface Seed {
  daysAgo: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  owner_id: string;
  source: Lead["source"];
  service_type: import("./constants").ServiceTypeId;
  additional_info: string;
  tags: string[];
  company_name: string;
  company_website: string | null;
  youtube_url: string | null;
  extra_links?: Omit<CompanyLink, "id">[];
  company_industry?: string;
  company_size?: Company["size"];
  deal: Partial<Pick<Deal, "stage" | "value_mrr" | "value_one_time" | "probability" | "expected_close_date" | "closed_at" | "value_currency">>;
  qualification: Partial<Omit<Qualification, "lead_id" | "updated_at">>;
  activities: Array<Pick<Activity, "type" | "title" | "body" | "status" | "due_at" | "completed_at" | "metadata">>;
}

const INR = "INR" as const;

const seeds: Seed[] = [
  {
    daysAgo: 2,
    name: "Aarav Mehta", email: "aarav@growfast.in", phone: "+91 98765 43210", role: "CMO",
    owner_id: "me", source: "yaas_form",
    service_type: "e2e_branded",
    additional_info: "Funded Series B, wants to build a thought-leadership channel for the CEO.",
    tags: ["high-intent", "funded", "long-form"],
    company_name: "GrowFast", company_website: "growfast.in",
    youtube_url: null,
    company_industry: "B2B SaaS", company_size: "51-200",
    deal: { stage: "scoping_call_done", value_mrr: 1500000, probability: 40, expected_close_date: "2026-06-20", value_currency: INR },
    qualification: { budget_range: "₹15–20L/mo", decision_maker: true, fit_score: 82 },
    activities: [
      { type: "system", title: "Lead created", body: "Submitted via Tally form", status: "completed", due_at: null, completed_at: new Date(Date.now() - 2 * 86400000).toISOString(), metadata: {} },
      { type: "call", title: "Scoping call", body: "Strong fit. CEO wants a documentary-style channel. Budget around ₹15–20L confirmed. Booking discovery next week.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 1 * 86400000).toISOString(), metadata: {} },
    ],
  },
  {
    daysAgo: 7,
    name: "Priya Sharma", email: "priya@clearstate.co", phone: "+91 87654 32109", role: "CMO",
    owner_id: "me", source: "referral",
    service_type: "e2e_branded",
    additional_info: "Fast-growing D2C brand. Wants 40+ reels/month. Current agency not delivering quality.",
    tags: ["high-intent", "retainer", "short-form"],
    company_name: "Clearstate", company_website: "clearstate.co",
    youtube_url: null,
    company_industry: "D2C / Consumer", company_size: "11-50",
    deal: { stage: "pitch_done", value_mrr: 1200000, probability: 60, expected_close_date: "2026-05-30", value_currency: INR },
    qualification: { budget_range: "₹10–15L/mo", decision_maker: true, fit_score: 88 },
    activities: [
      { type: "call", title: "Scoping call", body: "Very warm. Referred by Aspora contact.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 6 * 86400000).toISOString(), metadata: {} },
      { type: "call", title: "Discovery call", body: "Deep-dived on brand. Sent intro deck. Strong alignment on short-form first approach.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 4 * 86400000).toISOString(), metadata: {} },
      { type: "meeting", title: "Pitch meeting", body: "Presented full scope. 40 reels/month + strategy. They loved the Coca-Cola reference.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 2 * 86400000).toISOString(), metadata: {} },
      { type: "task", title: "Send costing", body: "Send SOW and costing by EOD Friday", status: "pending", due_at: new Date(Date.now() + 1 * 86400000).toISOString(), completed_at: null, metadata: {} },
    ],
  },
  {
    daysAgo: 14,
    name: "Rajesh Nair", email: "rajesh@infraedge.in", phone: "+91 76543 21098", role: "Head of Marketing",
    owner_id: "me", source: "inbound_email",
    service_type: "e2e_branded",
    additional_info: "Enterprise infrastructure company. Large budget. Slow decision cycle. 3 stakeholders to align.",
    tags: ["enterprise", "retainer", "long-form"],
    company_name: "InfraEdge", company_website: "infraedge.in",
    youtube_url: null,
    company_industry: "Enterprise Tech", company_size: "501-1000",
    deal: { stage: "costing_sent", value_mrr: 2000000, probability: 50, expected_close_date: "2026-06-30", value_currency: INR },
    qualification: { budget_range: "₹20L+/mo", decision_maker: false, fit_score: 72 },
    activities: [
      { type: "call", title: "Scoping call", body: "Rajesh is not the final decision maker — CFO approval needed.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 13 * 86400000).toISOString(), metadata: {} },
      { type: "call", title: "Discovery call", body: "Brought in Rohit. Strong credibility play. Zerodha and Amazon references landed well.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 10 * 86400000).toISOString(), metadata: {} },
      { type: "email", title: "Sent proposal + costing", body: "Full 12-month SOW sent. ₹20L/mo. Awaiting CFO review.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 5 * 86400000).toISOString(), metadata: {} },
      { type: "task", title: "Follow up with Rajesh", body: "Check CFO status and push for a timeline", status: "pending", due_at: new Date(Date.now() + 2 * 86400000).toISOString(), completed_at: null, metadata: {} },
    ],
  },
  {
    daysAgo: 21,
    name: "Sneha Kapoor", email: "sneha@urbanfit.in", phone: "+91 65432 10987", role: "Co-founder",
    owner_id: "me", source: "yaas_form",
    service_type: "e2e_surrogate",
    additional_info: "Fitness brand. Wants to do a 10-episode microdrama for brand awareness. One-time project to start.",
    tags: ["one-time", "microdrama"],
    company_name: "UrbanFit", company_website: "urbanfit.in",
    youtube_url: "https://youtube.com/@urbanfit",
    company_industry: "Health & Fitness", company_size: "11-50",
    deal: { stage: "negotiating", value_mrr: 2000000, probability: 70, expected_close_date: "2026-05-25", value_currency: INR },
    qualification: { budget_range: "₹15–20L/mo", decision_maker: true, fit_score: 91 },
    activities: [
      { type: "call", title: "Scoping call", body: "Super enthusiastic. Has a clear vision for the series.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 20 * 86400000).toISOString(), metadata: {} },
      { type: "call", title: "Discovery call", body: "Defined 10-episode arc. Sent deck with Varun Mayya case study.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 17 * 86400000).toISOString(), metadata: {} },
      { type: "meeting", title: "Pitch done", body: "Presented microdrama concept. They want to negotiate on episode count vs price.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 10 * 86400000).toISOString(), metadata: {} },
      { type: "email", title: "Negotiation ongoing", body: "They want 12 episodes at ₹18L. We're at ₹20L for 10. Holding the line.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 3 * 86400000).toISOString(), metadata: {} },
    ],
  },
  {
    daysAgo: 45,
    name: "Amit Verma", email: "amit@zenohealth.in", phone: "+91 54321 09876", role: "CMO",
    owner_id: "me", source: "referral",
    service_type: "e2e_branded",
    additional_info: "Healthtech startup. Series A. 12-month retainer signed. Monthly short-form package.",
    tags: ["retainer", "short-form", "funded"],
    company_name: "ZenoHealth", company_website: "zenohealth.in",
    youtube_url: null,
    company_industry: "Healthtech", company_size: "51-200",
    deal: { stage: "closed_won", value_mrr: 1500000, probability: 100, expected_close_date: "2026-04-01", closed_at: new Date(Date.now() - 44 * 86400000).toISOString(), value_currency: INR },
    qualification: { budget_range: "₹15–20L/mo", decision_maker: true, fit_score: 94 },
    activities: [
      { type: "stage_change", title: "Deal closed", body: "12-month retainer signed. ₹15L/mo. Nitesh briefed. Loveena onboarding.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 44 * 86400000).toISOString(), metadata: { from: "negotiating", to: "closed_won" } },
    ],
  },
  {
    daysAgo: 60,
    name: "Kavya Reddy", email: "kavya@brandcraft.in", phone: "+91 43210 98765", role: "Founder",
    owner_id: "me", source: "outbound",
    service_type: "ai_videos",
    additional_info: "Budget was there but decision-making authority wasn't with Kavya. Deal fell through.",
    tags: ["one-time"],
    company_name: "BrandCraft", company_website: "brandcraft.in",
    youtube_url: null,
    company_industry: "Marketing Agency", company_size: "11-50",
    deal: { stage: "closed_lost", value_mrr: 0, value_one_time: 500000, probability: 0, value_currency: INR, closed_at: new Date(Date.now() - 55 * 86400000).toISOString() },
    qualification: { budget_range: "₹5–10L/mo", decision_maker: false, fit_score: 45 },
    activities: [
      { type: "stage_change", title: "Deal lost", body: "No decision-making authority. Board did not approve. Loss reason: decision maker misaligned.", status: "completed", due_at: null, completed_at: new Date(Date.now() - 55 * 86400000).toISOString(), metadata: { from: "costing_sent", to: "closed_lost" } },
    ],
  },
  {
    daysAgo: 3,
    name: "Vikram Anand", email: "vikram@stealthco.in", phone: null, role: "CMO",
    owner_id: "me", source: "yaas_form",
    service_type: "e2e_branded",
    additional_info: "Pre-launch stealth startup. Well-funded. Building founder brand before product launch.",
    tags: ["high-intent", "funded", "long-form"],
    company_name: "StealthCo", company_website: null,
    youtube_url: null,
    company_industry: "Fintech", company_size: "1-10",
    deal: { stage: "outreach_done", value_mrr: 2000000, probability: 20, expected_close_date: "2026-07-01", value_currency: INR },
    qualification: { budget_range: "₹20L+/mo", decision_maker: true, fit_score: 65 },
    activities: [
      { type: "system", title: "Lead created", body: "Submitted via Tally form", status: "completed", due_at: null, completed_at: new Date(Date.now() - 3 * 86400000).toISOString(), metadata: {} },
      { type: "task", title: "Book scoping call", body: "Reach out via WhatsApp and book first call", status: "pending", due_at: new Date(Date.now() + 1 * 86400000).toISOString(), completed_at: null, metadata: {} },
    ],
  },
];

// ─── Build the fixture ─────────────────────────────────────────────────────

const companyMap = new Map<string, Company>();

function ensureCompany(s: Seed): Company {
  const key = s.company_name.toLowerCase();
  if (companyMap.has(key)) return companyMap.get(key)!;
  const links: CompanyLink[] = [];
  if (s.youtube_url) links.push({ id: uid(), type: "youtube", url: s.youtube_url });
  if (s.extra_links) links.push(...s.extra_links.map((l) => ({ ...l, id: uid() })));
  const company: Company = {
    id: uid(),
    name: s.company_name,
    domain: s.company_website ? extractDomain(s.company_website) : null,
    industry: s.company_industry ?? null,
    size: s.company_size ?? null,
    notes: null,
    tags: [],
    links,
    priority: null,
    created_at: new Date(Date.now() - s.daysAgo * 86400000).toISOString(),
    updated_at: new Date(Date.now() - s.daysAgo * 86400000).toISOString(),
  };
  companyMap.set(key, company);
  return company;
}

const now = Date.now();

export const MOCK_PROFILES: Profile[] = teammates;

export const MOCK_COMPANIES: Company[] = (() => {
  seeds.forEach(ensureCompany);
  return [...companyMap.values()];
})();

interface MockData {
  leads: Lead[];
  deals: Deal[];
  qualifications: Qualification[];
  activities: Activity[];
  overviews: LeadOverview[];
}

function buildMockData(): MockData {
  const leads: Lead[] = [];
  const deals: Deal[] = [];
  const qualifications: Qualification[] = [];
  const activities: Activity[] = [];
  const overviews: LeadOverview[] = [];

  for (const s of seeds) {
    const company = ensureCompany(s);
    const createdAt = new Date(now - s.daysAgo * 86400000).toISOString();
    const leadId = uid();
    const dealId = uid();

    const lead: Lead = {
      id: leadId,
      owner_id: s.owner_id,
      company_id: company.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      role: s.role,
      service_type: s.service_type,
      additional_info: s.additional_info,
      source: s.source,
      status: "open",
      tags: s.tags,
      source_submission_id: null,
      created_at: createdAt,
      updated_at: createdAt,
    };
    leads.push(lead);

    const deal: Deal = {
      id: dealId,
      lead_id: leadId,
      owner_id: s.owner_id,
      title: `${company.name} — ${s.service_type}`,
      stage: s.deal.stage ?? "outreach_done",
      value_mrr: s.deal.value_mrr ?? 0,
      value_one_time: s.deal.value_one_time ?? 0,
      value_currency: s.deal.value_currency ?? "INR",
      probability: s.deal.probability ?? 20,
      expected_close_date: s.deal.expected_close_date ?? null,
      closed_at: s.deal.closed_at ?? null,
      loss_reason: null,
      position: seeds.indexOf(s),
      created_at: createdAt,
      updated_at: createdAt,
    };
    deals.push(deal);

    const qual: Qualification = {
      lead_id: leadId,
      budget_range: s.qualification.budget_range ?? null,
      budget_amount: null,
      budget_currency: "INR",
      budget_recurrence: "monthly",
      decision_maker: s.qualification.decision_maker ?? null,
      pain_points: s.qualification.pain_points ?? null,
      goals: s.qualification.goals ?? null,
      fit_score: s.qualification.fit_score ?? 50,
      notes: null,
      updated_at: createdAt,
    };
    qualifications.push(qual);

    for (const a of s.activities) {
      activities.push({
        id: uid(),
        lead_id: leadId,
        deal_id: dealId,
        user_id: s.owner_id,
        ...a,
        created_at: a.completed_at ?? a.due_at ?? createdAt,
      });
    }

    const overview: LeadOverview = {
      ...lead,
      company,
      deal_id: dealId,
      deal_stage: deal.stage,
      value_mrr: deal.value_mrr,
      value_one_time: deal.value_one_time,
      value_currency: deal.value_currency,
      probability: deal.probability,
      expected_close_date: deal.expected_close_date,
      closed_at: deal.closed_at,
      deal_position: deal.position,
      fit_score: qual.fit_score,
    };
    overviews.push(overview);
  }

  return { leads, deals, qualifications, activities, overviews };
}

const data = buildMockData();
export const MOCK_LEADS = data.leads;
export const MOCK_DEALS = data.deals;
export const MOCK_QUALIFICATIONS = data.qualifications;
export const MOCK_ACTIVITIES = data.activities;
export const MOCK_OVERVIEWS = data.overviews;
