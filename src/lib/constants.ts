/**
 * Stage ids are no longer a closed set — admins can add custom stages, so
 * this is just `string`. Semantic behavior keys on `PipelineStage.kind`,
 * never on a literal id.
 */
export type DealStage = string;

export type StageKind = "open" | "won" | "lost";

/** Fixed colour palette. Tailwind can't JIT a dynamic `bg-stage-${x}`, so
 *  every tone maps to explicit, statically-present class strings. */
export type StageTone =
  | "new" | "contacted" | "booked" | "held"
  | "proposal" | "negotiating" | "won" | "lost";

export interface PipelineStage {
  id: string;
  label: string;
  position: number;
  kind: StageKind;
  tone: StageTone;
  is_default: boolean;
}

/** tone → { dot bg, soft chip bg/text }. Static so Tailwind keeps them. */
export const STAGE_TONE: Record<StageTone, { dot: string; soft: string }> = {
  new:         { dot: "bg-stage-new",         soft: "bg-stage-new/10 text-stage-new" },
  contacted:   { dot: "bg-stage-contacted",   soft: "bg-stage-contacted/10 text-stage-contacted" },
  booked:      { dot: "bg-stage-booked",      soft: "bg-stage-booked/10 text-stage-booked" },
  held:        { dot: "bg-stage-held",        soft: "bg-stage-held/10 text-stage-held" },
  proposal:    { dot: "bg-stage-proposal",    soft: "bg-stage-proposal/10 text-stage-proposal" },
  negotiating: { dot: "bg-stage-negotiating", soft: "bg-stage-negotiating/10 text-stage-negotiating" },
  won:         { dot: "bg-stage-won",         soft: "bg-stage-won/10 text-stage-won" },
  lost:        { dot: "bg-stage-lost",        soft: "bg-stage-lost/10 text-stage-lost" },
};

export const STAGE_TONE_OPTIONS: StageTone[] = [
  "new", "contacted", "booked", "held", "proposal", "negotiating", "won", "lost",
];

/** YAAS Sales pipeline stages. */
export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: "outreach_done",      label: "Outreach Done",      position: 0, kind: "open", tone: "new",         is_default: true },
  { id: "scoping_call_done",  label: "Scoping Call Done",  position: 1, kind: "open", tone: "contacted",   is_default: false },
  { id: "discovery_call_done",label: "Discovery Call Done",position: 2, kind: "open", tone: "booked",      is_default: false },
  { id: "pitch_done",         label: "Pitch Done",         position: 3, kind: "open", tone: "held",        is_default: false },
  { id: "costing_sent",       label: "Costing Sent",       position: 4, kind: "open", tone: "proposal",    is_default: false },
  { id: "negotiating",        label: "Negotiating",        position: 5, kind: "open", tone: "negotiating", is_default: false },
  { id: "closed_won",         label: "Closed",             position: 6, kind: "won",  tone: "won",         is_default: false },
  { id: "contract",           label: "Contract",           position: 7, kind: "won",  tone: "won",         is_default: false },
  { id: "operationalized",    label: "Operationalized",    position: 8, kind: "won",  tone: "won",         is_default: false },
  { id: "closed_lost",        label: "Lost",               position: 9, kind: "lost", tone: "lost",        is_default: false },
];

// --- Legacy static exports (fallbacks). Prefer the store hooks in
// components so custom stages are reflected; kept for non-reactive callers. ---

export const STAGES = DEFAULT_PIPELINE_STAGES.map((s) => ({
  id: s.id, label: s.label, tone: `stage-${s.tone}`,
}));

export const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  DEFAULT_PIPELINE_STAGES.map((s) => [s.id, s.label]),
);

export const OPEN_STAGES: DealStage[] = DEFAULT_PIPELINE_STAGES
  .filter((s) => s.kind === "open")
  .map((s) => s.id);

export const FUNNEL_STAGES: DealStage[] = DEFAULT_PIPELINE_STAGES
  .filter((s) => s.kind !== "lost")
  .map((s) => s.id);

// ============================================================================
// Sales script schema — block-based scripts with capture / say-this / discovery
// / calc / pitch blocks. Tokens reference field ids across blocks.
// ============================================================================

export type FieldType =
  | "text"        // short free text
  | "long-text"   // multi-line free text
  | "number"      // raw integer / decimal
  | "currency"    // dollars; rendered as $1,234
  | "percent"     // 0-100; rendered as 45%
  | "select"      // single choice from options
  | "multi-select"// multiple choices
  | "boolean";    // yes / no

export interface FieldOption {
  id: string;
  label: string;
  weight?: number; // used by calc engine; e.g. "asap" = 100, "exploring" = 20
}

/** Bindings sync a captured value back to lead / qualification fields. */
export type FieldBinding =
  | "qualification.budget_range"
  | "qualification.decision_maker"
  | "qualification.pain_points"
  | "qualification.goals"
  | "qualification.fit_score"
  | "lead.tags"
  | "lead.service_type"
  | "deal.value_mrr";

export interface CaptureField {
  id: string;                  // also the token name, e.g. "current_mrr"
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
  options?: FieldOption[];
  bindTo?: FieldBinding;
  required?: boolean;
}

export interface DiscoveryPrompt {
  id: string;
  /** Short checklist line shown next to the checkbox. */
  text: string;
  /**
   * Optional suggested phrasing the rep can read out loud. Renders indented
   * below the checklist line during the live call.
   */
  script?: string;
  /**
   * Optional capture field id (in the same script). When the capture is
   * filled, the checklist line auto-checks.
   */
  captureId?: string;
}

export type BlockKind =
  | "capture"
  | "say-this"
  | "discovery"
  | "calc"
  | "pitch"
  | "objection";

export interface ObjectionItem {
  id: string;
  trigger: string;        // "It's too expensive"
  response: string;       // rebuttal text; supports {{token}} substitutions
}

export interface ScriptBlock {
  id: string;
  kind: BlockKind;
  /** Optional small grey label shown at the top of the block. */
  hint?: string;

  // capture
  fields?: CaptureField[];

  // say-this, pitch
  text?: string; // may contain {{token}} substitutions

  // discovery
  prompts?: DiscoveryPrompt[];

  // calc
  label?: string;
  formula?: string;           // e.g. "current_mrr * 12"
  format?: "currency" | "percent" | "number";

  // objection
  objections?: ObjectionItem[];
}

export interface ScriptSection {
  id: string;
  heading: string;
  minutes?: number;
  blocks: ScriptBlock[];
}

export interface SalesScript {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  sections: ScriptSection[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body?: string;
}

export interface OptionItem {
  id: string;
  label: string;
}

export interface WorkspaceTemplates {
  salesScripts: SalesScript[];
  tagVocabulary: string[];
  timelineOptions: OptionItem[];
  currentEditorOptions: OptionItem[];
  budgetRanges: string[];
  serviceInterests: string[];
  emailTemplates: EmailTemplate[];
  sourceLabels: Record<string, string>;
}

// ============================================================================
// Default scripts
// ============================================================================

const block = (kind: BlockKind, rest: Partial<ScriptBlock>): ScriptBlock => ({
  id: Math.random().toString(36).slice(2, 10),
  kind,
  ...rest,
});

export const DEFAULT_DISCOVERY_SCRIPT: SalesScript = {
  id: "scoping-call",
  name: "Scoping Call — YAAS",
  description:
    "First call with a prospect. Goal: qualify the opportunity, understand their brand, surface the right service, and set up for a killer Discovery pitch.",
  isDefault: true,
  sections: [
    {
      id: "open",
      heading: "Open — Set the Frame",
      minutes: 2,
      blocks: [
        block("say-this", {
          hint: "Warm, sharp, confident. Not apologetic. They came to you.",
          text:
            "Hey {{contact_name}}, [Your Name] here from YAAS.\n\n" +
            "Thanks for making the time. I'll keep this quick and focused — I just want to understand what you're building and where you're trying to take the brand. Once I have that, I'll tell you exactly how we can help.\n\n" +
            "Sound good?",
        }),
      ],
    },

    {
      id: "problem_statement",
      heading: "Problem Statement",
      minutes: 4,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "p1",
              text: "What's the core content problem you're trying to solve right now?",
              script: "Walk me through where things are today — what's working, what's not, what's the thing you wish was different?",
            },
            {
              id: "p2",
              text: "Is this a visibility problem, a production problem, or a strategy problem?",
              script: "Are you not getting enough reach? Or you know what to do but don't have the bandwidth to execute? Or are you unsure what content even makes sense for your brand?",
            },
            {
              id: "p3",
              text: "Why now? What changed or what's the deadline?",
              script: "Is there a launch, a campaign, or a board mandate driving this? Or has it just been on the list for a while?",
            },
          ],
        }),
        block("capture", {
          fields: [
            { id: "pain_point", label: "Core pain in their words", type: "long-text", bindTo: "qualification.pain_points" },
          ],
        }),
      ],
    },

    {
      id: "service_type",
      heading: "Type of Service",
      minutes: 3,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "s1",
              text: "Are they thinking retainer or a one-time project?",
              script: "Is this something you want an ongoing team running for you, or is there a specific deliverable — like a campaign, a series, a launch film — you need done?",
            },
            {
              id: "s2",
              text: "What platform is the priority — Instagram, YouTube, or both?",
              script: "Where is your audience today, and where do you want to grow?",
            },
            {
              id: "s3",
              text: "Long-form or short-form or both?",
              script: "Are you thinking 10-minute YouTube documentaries, reels, or a mix of both?",
            },
          ],
        }),
        block("capture", {
          fields: [
            {
              id: "service_type",
              label: "Service type",
              type: "select",
              bindTo: "lead.service_type",
              options: [
                { id: "e2e_surrogate",        label: "E2E — Surrogate" },
                { id: "e2e_branded",          label: "E2E — Branded" },
                { id: "influencer_marketing", label: "Influencer Marketing" },
                { id: "podcast_production",   label: "Podcast Production" },
                { id: "one_time_project",     label: "One-time Project" },
                { id: "e2e_founder_led",      label: "E2E — Founder-led" },
                { id: "ai_videos",            label: "AI Videos" },
              ],
            },
          ],
        }),
      ],
    },

    {
      id: "budget_range",
      heading: "Budget Range",
      minutes: 2,
      blocks: [
        block("say-this", {
          hint: "Ask this directly and confidently. Don't hedge.",
          text:
            "Just so I scope this right — what kind of monthly investment are you looking at? Give me a ballpark. We work with clients from ₹10L to ₹25L+ a month depending on the scope.",
        }),
        block("capture", {
          fields: [
            {
              id: "budget",
              label: "Budget range (₹ lakhs / month)",
              type: "select",
              bindTo: "qualification.budget_range",
              options: [
                { id: "sub5",   label: "< ₹5L/mo" },
                { id: "5to10",  label: "₹5–10L/mo" },
                { id: "10to15", label: "₹10–15L/mo" },
                { id: "15to20", label: "₹15–20L/mo" },
                { id: "20plus", label: "₹20L+/mo" },
              ],
            },
          ],
        }),
      ],
    },

    {
      id: "timeline",
      heading: "Timeline",
      minutes: 2,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "t1",
              text: "When do they want to start?",
              script: "If we move quickly on this, when would you want the team live? Is there a specific date — a launch, a quarter, a campaign — you're working backwards from?",
            },
            {
              id: "t2",
              text: "Is there a decision deadline internally?",
            },
          ],
        }),
      ],
    },

    {
      id: "brand_understanding",
      heading: "Brand Understanding",
      minutes: 3,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "b1",
              text: "What does the brand stand for? What's the core narrative?",
              script: "If I asked your CMO to describe the brand in one sentence — what would they say?",
            },
            {
              id: "b2",
              text: "Do they have existing content? What's worked, what hasn't?",
              script: "Have you run a content channel before? What performed well? What flopped?",
            },
            {
              id: "b3",
              text: "Are there reference channels or creators they admire?",
              script: "Any brand or creator whose content style you aspire to? Send me 2-3 examples if you have them.",
            },
          ],
        }),
        block("capture", {
          fields: [
            { id: "brand_notes", label: "Brand context notes", type: "long-text" },
            { id: "reference_channels", label: "Reference channels / inspiration", type: "text" },
          ],
        }),
      ],
    },

    {
      id: "objective",
      heading: "Objective",
      minutes: 2,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "o1",
              text: "What does success look like in 6 months?",
              script: "If we're on a call 6 months from now and you're happy — what happened? What metric moved? What feeling changed?",
            },
            {
              id: "o2",
              text: "Is the goal brand-building, lead gen, revenue, or something else?",
            },
          ],
        }),
        block("capture", {
          fields: [
            { id: "goals", label: "Primary objective", type: "long-text", bindTo: "qualification.goals" },
          ],
        }),
      ],
    },

    {
      id: "tg",
      heading: "Target Audience (TG)",
      minutes: 2,
      blocks: [
        block("discovery", {
          prompts: [
            {
              id: "tg1",
              text: "Who is the content for — who is the ideal viewer / customer?",
              script: "Paint me a picture of your target customer. Age, income, mindset, what they care about.",
            },
            {
              id: "tg2",
              text: "India-1 (English metro) or India-2 (Hindi/vernacular) or both?",
            },
            {
              id: "tg3",
              text: "Any specific psychographic — aspirational, curious, technical, lifestyle?",
            },
          ],
        }),
        block("capture", {
          fields: [
            { id: "tg_description", label: "TG in their words", type: "long-text" },
          ],
        }),
      ],
    },

    {
      id: "close",
      heading: "Close — Lock the Next Step",
      minutes: 2,
      blocks: [
        block("say-this", {
          hint: "Never end a call without a committed next step.",
          text:
            "This is really helpful. Based on everything you've shared, I think there's a very strong fit here.\n\n" +
            "What I'll do is send you our intro deck today so you have the full YAAS story. Then let's get a Discovery Call on the calendar — I'll bring our content strategy lead, we'll deep-dive into your brand, and come out of that call with a clear proposal.\n\n" +
            "Does next week work? What's your availability?",
        }),
        block("capture", {
          fields: [
            { id: "decision_maker", label: "Are they the decision maker?", type: "boolean", bindTo: "qualification.decision_maker" },
            { id: "next_step", label: "Agreed next step", type: "text" },
          ],
        }),
      ],
    },
  ],
};

const DEFAULT_FOLLOWUP_SCRIPT: SalesScript = {
  id: "followup-call",
  name: "Follow-up / Re-engage",
  description: "For leads that went cold after Scoping or Discovery. Anchor to prior context, update the situation, lock a next step.",
  sections: [
    {
      id: "reopen",
      heading: "Reopen",
      minutes: 2,
      blocks: [
        block("say-this", {
          text:
            "Hey {{contact_name}} — just wanted to circle back. Last time we spoke, the main thing was {{pain_point}}. I've been thinking about that.\n\nWhat's changed on your end since we last talked?",
        }),
        block("discovery", {
          prompts: [
            { id: "r1", text: "Anchor to their exact problem from last call" },
            { id: "r2", text: "What's changed? New leadership, campaign, budget cycle?" },
            { id: "r3", text: "Are the same priorities still in place?" },
          ],
        }),
      ],
    },
    {
      id: "update",
      heading: "Requalify",
      minutes: 3,
      blocks: [
        block("capture", {
          fields: [
            { id: "budget_update",   label: "Budget situation now",   type: "select", options: [
              { id: "sub5",   label: "< ₹5L/mo" },
              { id: "5to10",  label: "₹5–10L/mo" },
              { id: "10to15", label: "₹10–15L/mo" },
              { id: "15to20", label: "₹15–20L/mo" },
              { id: "20plus", label: "₹20L+/mo" },
            ]},
            { id: "timeline_update", label: "Timeline now", type: "select", options: [
              { id: "asap",      label: "ASAP" },
              { id: "1-3mo",     label: "1–3 months" },
              { id: "3-6mo",     label: "3–6 months" },
              { id: "exploring", label: "Still exploring" },
            ]},
          ],
        }),
      ],
    },
    {
      id: "lock",
      heading: "Lock Next Step",
      minutes: 2,
      blocks: [
        block("discovery", {
          prompts: [
            { id: "n1", text: "Pick one path: Discovery Call / Proposal / Pass" },
            { id: "n2", text: "Book the actual next call before hanging up" },
          ],
        }),
      ],
    },
  ],
};


export const DEFAULT_TAG_VOCABULARY: string[] = [
  "high-intent", "follow-up", "retainer", "one-time",
  "long-form", "short-form", "microdrama", "podcast",
  "ai-ad", "enterprise", "funded", "warm-lead",
];

export const DEFAULT_TIMELINE_OPTIONS: OptionItem[] = [
  { id: "asap",      label: "ASAP" },
  { id: "1-3mo",     label: "1–3 months" },
  { id: "3-6mo",     label: "3–6 months" },
  { id: "exploring", label: "Exploring" },
];

export const DEFAULT_CURRENT_EDITOR_OPTIONS: OptionItem[] = [
  { id: "none",       label: "No content team" },
  { id: "in-house",   label: "In-house team" },
  { id: "freelancer", label: "Freelancers" },
  { id: "agency",     label: "Another agency" },
];

/** Budget ranges in INR/month (₹ lakhs) */
export const DEFAULT_BUDGET_RANGES: string[] = [
  "< ₹5L/mo", "₹5–10L/mo", "₹10–15L/mo", "₹15–20L/mo", "₹20L+/mo",
];

/** YAAS service catalogue — the closed set of offerings sold from the CRM. */
export const SERVICE_TYPES = [
  { id: "e2e_surrogate",       label: "E2E — Surrogate" },
  { id: "e2e_branded",         label: "E2E — Branded" },
  { id: "influencer_marketing",label: "Influencer Marketing" },
  { id: "podcast_production",  label: "Podcast Production" },
  { id: "one_time_project",    label: "One-time Project" },
  { id: "e2e_founder_led",     label: "E2E — Founder-led" },
  { id: "ai_videos",           label: "AI Videos" },
] as const;

export type ServiceTypeId = (typeof SERVICE_TYPES)[number]["id"];

export const SERVICE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.id, s.label]),
);

/** Kept for backwards-compat with the workspace template schema. New code
 *  should reference SERVICE_TYPES directly. */
export const DEFAULT_SERVICE_INTERESTS: string[] = SERVICE_TYPES.map((s) => s.label);

/** Account / company priority — used in the companies list to triage
 *  attention at a glance. */
export const PRIORITY_LEVELS = [
  { id: "high",   label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low",    label: "Low" },
] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number]["id"];

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: "intro",     name: "Intro",     subject: "Quick intro — YAAS Sales CRM" },
  { id: "follow_up", name: "Follow-up", subject: "Following up" },
  { id: "proposal",  name: "Proposal",  subject: "Proposal for {{company}}" },
];

export const DEFAULT_SOURCE_LABELS: Record<string, string> = {
  yaas_form:     "YAAS form",
  referral:      "Referral",
  outbound:      "Outbound",
  inbound_email: "Inbound email",
  linkedin:      "LinkedIn",
  event:         "Event",
  other:         "Other",
};

export const DEFAULT_TEMPLATES: WorkspaceTemplates = {
  salesScripts:         [DEFAULT_DISCOVERY_SCRIPT, DEFAULT_FOLLOWUP_SCRIPT],
  tagVocabulary:        DEFAULT_TAG_VOCABULARY,
  timelineOptions:      DEFAULT_TIMELINE_OPTIONS,
  currentEditorOptions: DEFAULT_CURRENT_EDITOR_OPTIONS,
  budgetRanges:         DEFAULT_BUDGET_RANGES,
  serviceInterests:     DEFAULT_SERVICE_INTERESTS,
  emailTemplates:       DEFAULT_EMAIL_TEMPLATES,
  sourceLabels:         DEFAULT_SOURCE_LABELS,
};
