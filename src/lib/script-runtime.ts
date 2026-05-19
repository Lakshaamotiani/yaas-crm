/**
 * Sales-script runtime helpers used by the live call page.
 *
 *  - buildContext: merges captures + computed CALC blocks + ambient lead context
 *  - renderTokens: substitutes {{token}} placeholders in script text
 *  - fieldsIndex / sectionProgress: small helpers for the UI
 */

import type {
  SalesScript, ScriptBlock, CaptureField, FieldType, FieldOption,
} from "./constants";
import type { Lead, Deal, Company } from "./types";
import { tryEvaluate } from "./calc";
import { formatCurrency } from "./utils";

/** Ambient values exposed as tokens regardless of capture state. */
function ambientFromLead(
  lead: Lead | null,
  deal: Deal | null,
  company: Company | null,
): Record<string, unknown> {
  return {
    contact_name:    lead?.name ?? "",
    contact_email:   lead?.email ?? "",
    contact_company: company?.name ?? lead?.name ?? "",
    contact_domain:  company?.domain ?? "",
    contact_role:    lead?.role ?? "",
    deal_mrr:        deal?.value_mrr ?? 0,
    deal_stage:      deal?.stage ?? "",
  };
}

/**
 * Collect every CAPTURE field across the script so we know each field's type
 * (used for rendering / formatting).
 */
export function fieldsIndex(script: SalesScript): Record<string, CaptureField> {
  const index: Record<string, CaptureField> = {};
  for (const sec of script.sections) {
    for (const blk of sec.blocks) {
      if (blk.kind === "capture" && blk.fields) {
        for (const f of blk.fields) index[f.id] = f;
      }
    }
  }
  return index;
}

/**
 * Walk every CALC block in script order, evaluating each against
 * (captures + already-computed calcs + ambient). Returns the full context
 * the UI / token renderer should use.
 */
export function buildContext(
  script: SalesScript,
  captures: Record<string, unknown>,
  lead: Lead | null,
  deal: Deal | null,
  company: Company | null = null,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    ...ambientFromLead(lead, deal, company),
    ...captures,
  };

  for (const sec of script.sections) {
    for (const blk of sec.blocks) {
      if (blk.kind === "calc" && blk.formula) {
        const v = tryEvaluate(blk.formula, ctx);
        // Prefer a stable id; fall back to a slug of the label
        const key = blk.id || slug(blk.label ?? "calc");
        ctx[key] = v ?? NaN;

        // Also expose a slugged label key so the default rich script
        // can reference calcs like {{annual_revenue_current}} without
        // requiring authors to manually set ids.
        const labelKey = slug(blk.label ?? "");
        if (labelKey && labelKey !== key) ctx[labelKey] = v ?? NaN;
      }
    }
  }

  return ctx;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ---------- value formatting -------------------------------------------------

export function formatValue(value: unknown, type?: FieldType | "currency" | "percent" | "number"): string {
  if (value === undefined || value === null || value === "" || (typeof value === "number" && Number.isNaN(value))) {
    return "";
  }
  switch (type) {
    case "currency":
      return formatCurrency(Number(value) || 0, { compact: false });
    case "percent":
      return `${Number(value)}%`;
    case "number":
      return new Intl.NumberFormat("en-US").format(Number(value));
    case "boolean":
      return value ? "Yes" : "No";
    default:
      return String(value);
  }
}

/**
 * Pretty-print a selected option label. For multi-select returns "a, b, c".
 */
export function formatSelected(value: unknown, options?: FieldOption[]): string {
  if (!options) return formatValue(value);
  if (Array.isArray(value)) {
    return value
      .map((v) => options.find((o) => o.id === v)?.label ?? String(v))
      .join(", ");
  }
  return options.find((o) => o.id === value)?.label ?? String(value ?? "");
}

// ---------- token rendering --------------------------------------------------

export interface TokenPart {
  kind: "text" | "token";
  text: string;       // for text: literal; for token: formatted value (or empty)
  raw?: string;       // for token: original id
  filled?: boolean;   // token has a real value
}

/**
 * Parse text containing {{token}} placeholders into an array of parts so the
 * UI can highlight filled vs. empty tokens distinctly.
 */
export function renderTokens(
  text: string,
  context: Record<string, unknown>,
  fields: Record<string, CaptureField>,
): TokenPart[] {
  const parts: TokenPart[] = [];
  const regex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push({ kind: "text", text: text.slice(lastIndex, m.index) });
    }
    const id = m[1];
    const raw = context[id];
    const field = fields[id];
    let formatted = "";
    let filled = false;

    if (raw !== undefined && raw !== null && raw !== "" && !(typeof raw === "number" && Number.isNaN(raw))) {
      if (field?.options) {
        formatted = formatSelected(raw, field.options);
      } else if (field?.type) {
        formatted = formatValue(raw, field.type);
      } else if (typeof raw === "number") {
        // CALC-style value with no field metadata — heuristically pick a format
        formatted = looksLikeCurrencyKey(id)
          ? formatValue(raw, "currency")
          : looksLikePercentKey(id)
            ? formatValue(raw, "percent")
            : formatValue(raw, "number");
      } else {
        formatted = String(raw);
      }
      filled = formatted.trim().length > 0;
    }

    parts.push({
      kind: "token",
      text: filled ? formatted : "—",
      raw: id,
      filled,
    });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return parts;
}

function looksLikeCurrencyKey(id: string): boolean {
  return /mrr|revenue|value|goal|ltv|price|cost|budget|spend|gap/i.test(id);
}
function looksLikePercentKey(id: string): boolean {
  return /rate|pct|percent|margin|share/i.test(id);
}

// ---------- progress + completeness -----------------------------------------

/** Treat undefined / empty string / empty array / NaN as "not filled". */
export function isFieldFilled(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return true;
}

/**
 * Effective "done" state for a discovery prompt: either the rep manually
 * checked it OR a bound capture field has been filled.
 */
export function isPromptDone(
  prompt: { id: string; captureId?: string },
  captures: Record<string, unknown>,
  promptDone: Record<string, boolean>,
): boolean {
  if (promptDone[prompt.id]) return true;
  if (prompt.captureId && isFieldFilled(captures[prompt.captureId])) return true;
  return false;
}

export interface SectionProgress {
  filledFields: number;
  totalFields: number;
  filledPrompts: number;
  totalPrompts: number;
  filledObjections: number;
  totalObjections: number;
  pct: number;
}

export function sectionProgress(
  blocks: ScriptBlock[],
  captures: Record<string, unknown>,
  promptDone: Record<string, boolean>,
  objectionHandled: Record<string, boolean> = {},
): SectionProgress {
  let filledFields = 0;
  let totalFields = 0;
  let filledPrompts = 0;
  let totalPrompts = 0;
  let filledObjections = 0;
  let totalObjections = 0;

  for (const blk of blocks) {
    if (blk.kind === "capture" && blk.fields) {
      for (const f of blk.fields) {
        totalFields++;
        if (isFieldFilled(captures[f.id])) filledFields++;
      }
    }
    if (blk.kind === "discovery" && blk.prompts) {
      for (const p of blk.prompts) {
        totalPrompts++;
        if (isPromptDone(p, captures, promptDone)) filledPrompts++;
      }
    }
    if (blk.kind === "objection" && blk.objections) {
      for (const o of blk.objections) {
        totalObjections++;
        if (objectionHandled[o.id]) filledObjections++;
      }
    }
  }
  const total = totalFields + totalPrompts + totalObjections;
  const filled = filledFields + filledPrompts + filledObjections;
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);
  return { filledFields, totalFields, filledPrompts, totalPrompts, filledObjections, totalObjections, pct };
}

// ---------- back-sync to lead -----------------------------------------------

export interface BoundUpdates {
  qualification: Record<string, unknown>;
  lead: Record<string, unknown>;
  deal: Record<string, unknown>;
}

export function resolveBindings(
  script: SalesScript,
  captures: Record<string, unknown>,
): BoundUpdates {
  const out: BoundUpdates = { qualification: {}, lead: {}, deal: {} };
  for (const sec of script.sections) {
    for (const blk of sec.blocks) {
      if (blk.kind !== "capture" || !blk.fields) continue;
      for (const f of blk.fields) {
        if (!f.bindTo) continue;
        const v = captures[f.id];
        if (v === undefined || v === null || v === "") continue;
        const [scope, key] = f.bindTo.split(".") as ["qualification" | "lead" | "deal", string];
        // For select fields the option label is what the lead record expects
        let stored: unknown = v;
        if (f.options) {
          stored = f.options.find((o) => o.id === v)?.label ?? v;
        }
        out[scope][key] = stored;
      }
    }
  }
  return out;
}
