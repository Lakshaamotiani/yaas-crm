"use client";

/**
 * Pure CSV-import logic: parse → auto-map columns → normalize rows →
 * detect duplicates → group by company. No React, no Supabase — the
 * import dialog drives this and the store performs the actual writes.
 */

import Papa from "papaparse";
import { extractDomain } from "./utils";
import type { Lead, Company } from "./types";

/** The CRM fields a CSV column can map to. */
export type ImportField =
  | "name"
  | "email"
  | "phone"
  | "role"
  | "companyName"
  | "companyWebsite"
  | "youtube"
  | "serviceInterest"
  | "additionalInfo"
  | "submittedAt"
  | "submissionId";

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  name: "Lead name",
  email: "Email",
  phone: "Phone",
  role: "Job title",
  companyName: "Company name",
  companyWebsite: "Company website",
  youtube: "YouTube link",
  serviceInterest: "Service interest",
  additionalInfo: "Additional info",
  submittedAt: "Submitted at (date)",
  submissionId: "Submission ID",
};

export const REQUIRED_FIELDS: ImportField[] = ["name"];

/** Header → field heuristics. First matching header wins per field. */
const FIELD_MATCHERS: Record<ImportField, RegExp> = {
  name: /\b(your name|full name|contact name|name)\b/i,
  email: /e-?mail/i,
  phone: /phone|mobile|contact number/i,
  role: /job title|designation|\brole\b|\btitle\b/i,
  companyName: /company name|\bcompany\b|organisation|organization/i,
  companyWebsite: /company website|website|company url|\bdomain\b/i,
  youtube: /youtube/i,
  serviceInterest: /service.*(interest|interested)|interested in|service\b/i,
  additionalInfo: /additional information|additional info|message|comments?|notes?/i,
  submittedAt: /submitted at|submission date|created at|timestamp|\bdate\b/i,
  submissionId: /submission id|submission_id|entry id/i,
};

export type Mapping = Partial<Record<ImportField, string>>; // field → CSV header

export interface ParseResult {
  headers: string[];
  rows: Record<string, string>[];
  autoMapping: Mapping;
  /** Headers whose values look like the field even if the name didn't match. */
  errors: string[];
}

/** Parse a CSV File into headers + row objects, and auto-map columns. */
export function parseCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = res.meta.fields ?? [];
        const autoMapping: Mapping = {};
        for (const field of Object.keys(FIELD_MATCHERS) as ImportField[]) {
          const re = FIELD_MATCHERS[field];
          const hit = headers.find((h) => re.test(h));
          if (hit) autoMapping[field] = hit;
        }
        resolve({
          headers,
          rows: res.data,
          autoMapping,
          errors: res.errors.slice(0, 5).map((e) => `Row ${e.row}: ${e.message}`),
        });
      },
      error: (err) => reject(err),
    });
  });
}

export type RowStatus = "new" | "duplicate" | "invalid";

export interface NormalizedRow {
  rowIndex: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  serviceInterest: string | null;
  additionalInfo: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  youtube: string | null;
  submissionId: string | null;
  submittedAtIso: string | null;
  /** domain (preferred) or lowercased company name; null if neither given. */
  companyKey: string | null;
  status: RowStatus;
  /** Why it's a duplicate / invalid — shown in the review table. */
  note?: string;
  /** User can flip a duplicate to import anyway. */
  importAnyway: boolean;
}

function clean(v: string | undefined | null): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

/** "2026-05-14 13:25:19" (or ISO, or m/d/Y) → ISO string, or null. */
function parseSubmittedAt(raw: string | null): string | null {
  if (!raw) return null;
  // Treat a space-separated "YYYY-MM-DD HH:MM:SS" as local time.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)
    ? raw.replace(" ", "T")
    : raw;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Company identity key. The DB enforces uniqueness on `lower(name)` (the
 * `companies_name_lower` index from migration 0002), so we MUST key on the
 * normalized name — otherwise two CSV rows for the same company with
 * different website domains produce two groups, two inserts, and a
 * duplicate-key violation. Domain is enrichment only; it's the fallback
 * key purely for rows that have a website but somehow no company name.
 */
function companyKeyFrom(website: string | null, name: string | null): string | null {
  if (name && name.trim()) return name.trim().toLowerCase();
  const domain = extractDomain(website);
  return domain ? domain.toLowerCase() : null;
}

/**
 * Map + normalize + dedup. Duplicates are detected against existing leads
 * (by email or submission id) and within the file itself (repeated email).
 */
export function normalizeRows(
  rows: Record<string, string>[],
  mapping: Mapping,
  existingLeads: Lead[],
): NormalizedRow[] {
  const get = (row: Record<string, string>, field: ImportField) => {
    const header = mapping[field];
    return header ? clean(row[header]) : null;
  };

  const existingEmails = new Set(
    existingLeads.map((l) => l.email?.trim().toLowerCase()).filter(Boolean) as string[],
  );
  const existingSubmissionIds = new Set(
    existingLeads.map((l) => l.source_submission_id ?? undefined).filter(Boolean) as string[],
  );

  const seenEmails = new Set<string>();
  const seenSubmissionIds = new Set<string>();

  return rows.map((row, i): NormalizedRow => {
    const name = get(row, "name");
    const email = get(row, "email");
    const emailKey = email?.toLowerCase() ?? null;
    const submissionId = get(row, "submissionId");
    const companyName = get(row, "companyName");
    const companyWebsite = get(row, "companyWebsite");

    let status: RowStatus = "new";
    let note: string | undefined;

    if (!name) {
      status = "invalid";
      note = "Missing name";
    } else if (submissionId && (existingSubmissionIds.has(submissionId) || seenSubmissionIds.has(submissionId))) {
      status = "duplicate";
      note = "Already imported (submission id)";
    } else if (emailKey && existingEmails.has(emailKey)) {
      status = "duplicate";
      note = "A lead with this email exists";
    } else if (emailKey && seenEmails.has(emailKey)) {
      status = "duplicate";
      note = "Repeated in this file";
    }

    if (emailKey) seenEmails.add(emailKey);
    if (submissionId) seenSubmissionIds.add(submissionId);

    return {
      rowIndex: i,
      name: name ?? "",
      email,
      phone: get(row, "phone"),
      role: get(row, "role"),
      serviceInterest: get(row, "serviceInterest"),
      additionalInfo: get(row, "additionalInfo"),
      companyName,
      companyWebsite,
      youtube: get(row, "youtube"),
      submissionId,
      submittedAtIso: parseSubmittedAt(get(row, "submittedAt")),
      companyKey: companyKeyFrom(companyWebsite, companyName),
      status,
      note,
      importAnyway: false,
    };
  });
}

export interface CompanyGroup {
  key: string;
  /** Best display name across the rows in the group. */
  name: string;
  website: string | null;
  youtube: string | null;
  /** Existing company id if this group matches one already in the workspace. */
  existingCompanyId: string | null;
  rowIndexes: number[];
}

/**
 * Group importable rows by company key, attaching each group to an existing
 * company when the domain or name already matches one in the workspace.
 */
export function groupByCompany(
  normalized: NormalizedRow[],
  existingCompanies: Company[],
): CompanyGroup[] {
  const byKey = new Map<string, CompanyGroup>();

  const domainIndex = new Map<string, Company>();
  const nameIndex = new Map<string, Company>();
  for (const c of existingCompanies) {
    if (c.domain) domainIndex.set(c.domain.toLowerCase(), c);
    nameIndex.set(c.name.trim().toLowerCase(), c);
  }

  for (const r of normalized) {
    if (!r.companyKey) continue;
    let g = byKey.get(r.companyKey);
    if (!g) {
      // companyKey is the normalized name (matches the DB's name-unique
      // index), so check the name index first; domain is a secondary match
      // for the rare name-less, website-only row.
      const existing =
        nameIndex.get(r.companyKey) ?? domainIndex.get(r.companyKey) ?? null;
      g = {
        key: r.companyKey,
        name: r.companyName ?? existing?.name ?? r.companyKey,
        website: r.companyWebsite,
        youtube: r.youtube,
        existingCompanyId: existing?.id ?? null,
        rowIndexes: [],
      };
      byKey.set(r.companyKey, g);
    }
    // Prefer a real company name + first non-null website/youtube.
    if (r.companyName && (!g.name || g.name === g.key)) g.name = r.companyName;
    if (!g.website && r.companyWebsite) g.website = r.companyWebsite;
    if (!g.youtube && r.youtube) g.youtube = r.youtube;
    g.rowIndexes.push(r.rowIndex);
  }

  return Array.from(byKey.values());
}

export interface ImportSummary {
  total: number;
  willImport: number;
  duplicates: number;
  invalid: number;
  companies: number;
  multiContactCompanies: number;
  newCompanies: number;
}

export function summarize(
  normalized: NormalizedRow[],
  groups: CompanyGroup[],
): ImportSummary {
  const duplicates = normalized.filter((r) => r.status === "duplicate").length;
  const invalid = normalized.filter((r) => r.status === "invalid").length;
  const willImport = normalized.filter(
    (r) => r.status === "new" || (r.status === "duplicate" && r.importAnyway),
  ).length;
  return {
    total: normalized.length,
    willImport,
    duplicates,
    invalid,
    companies: groups.length,
    multiContactCompanies: groups.filter((g) => g.rowIndexes.length > 1).length,
    newCompanies: groups.filter((g) => !g.existingCompanyId).length,
  };
}
