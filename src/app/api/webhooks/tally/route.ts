import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/webhooks/tally
 *
 * Receives a Tally form submission, maps fields to the CRM lead schema,
 * and creates an unassigned lead (owner_id = null) so it lands in the Inbox.
 *
 * Field mapping (by label, case-insensitive):
 *   "Your Name"                       → lead.name
 *   "Company Name"                    → company.name
 *   "Company Website"                 → company.domain / website
 *   "Job Title"                       → lead.role
 *   "Your Email Address"              → lead.email
 *   "Your Phone Number"               → lead.phone
 *   "Do you already have a YouTube…"  → metadata
 *   "…YouTube channel link"           → company youtube link
 *   "Which service are you…"          → lead.service_type + additional_info
 */

const SERVICE_MAP: Record<string, string> = {
  "end-to-end youtube channel management": "e2e_branded",
  "end-to-end":                            "e2e_branded",
  "youtube consulting":                    "e2e_founder_led",
  "consulting":                            "e2e_founder_led",
  "production and editing":                "one_time_project",
  "production":                            "one_time_project",
};

function mapService(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(SERVICE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function fieldValue(fields: any[], labelFragment: string): string | null {
  const f = fields.find((f: any) =>
    String(f.label ?? "").toLowerCase().includes(labelFragment.toLowerCase()),
  );
  if (!f) return null;
  const v = f.value;
  if (v === null || v === undefined || v === "") return null;
  // Tally multi-choice returns array of { id, text }
  if (Array.isArray(v)) return v.map((x: any) => x.text ?? x).join(", ");
  return String(v);
}

export async function POST(req: NextRequest) {
  // Optional: verify Tally signing secret
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (secret) {
    const sig = req.headers.get("tally-signature") ?? "";
    const crypto = await import("crypto");
    const body = await req.text();
    const expected = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("base64");
    if (sig !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    // Re-parse since we consumed the body
    try {
      var payload = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    payload = await req.json().catch(() => null);
  }

  if (!payload?.data?.fields) {
    return NextResponse.json({ ok: true }); // ping / test submission
  }

  const fields: any[] = payload.data.fields ?? [];
  const submissionId: string = payload.data.submissionId ?? payload.data.responseId ?? "";

  // Map fields
  const name          = fieldValue(fields, "your name") ?? fieldValue(fields, "name") ?? "Unknown";
  const companyName   = fieldValue(fields, "company name") ?? fieldValue(fields, "company");
  const companyWebsite= fieldValue(fields, "company website") ?? fieldValue(fields, "website");
  const role          = fieldValue(fields, "job title") ?? fieldValue(fields, "title");
  const email         = fieldValue(fields, "email");
  const phone         = fieldValue(fields, "phone");
  const hasYouTube    = fieldValue(fields, "already have a youtube");
  const youtubeLink   = fieldValue(fields, "youtube channel link") ?? fieldValue(fields, "channel link");
  const serviceRaw    = fieldValue(fields, "which service") ?? fieldValue(fields, "service");
  const serviceType   = mapService(serviceRaw);

  const additionalParts = [
    serviceRaw ? `Service interest: ${serviceRaw}` : null,
    hasYouTube ? `Has YouTube channel: ${hasYouTube}` : null,
    youtubeLink ? `YouTube: ${youtubeLink}` : null,
  ].filter(Boolean);
  const additionalInfo = additionalParts.length ? additionalParts.join("\n") : null;

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Dedup by submission id
  if (submissionId) {
    const { data: existing } = await sb
      .from("leads")
      .select("id")
      .eq("source_submission_id", submissionId)
      .maybeSingle();
    if (existing) return NextResponse.json({ ok: true, duplicate: true });
  }

  // Find or create company
  let companyId: string | null = null;
  if (companyName) {
    const domain = extractDomain(companyWebsite);
    const normalizedName = companyName.trim().toLowerCase();

    // Check by name first
    const { data: existingCompany } = await sb
      .from("companies")
      .select("id")
      .ilike("name", normalizedName)
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
    } else {
      // Create new company
      const links = youtubeLink
        ? [{ type: "youtube", url: youtubeLink }]
        : [];
      const { data: newCompany } = await sb
        .from("companies")
        .insert({
          name: companyName.trim(),
          domain: domain,
          links,
        })
        .select("id")
        .single();
      companyId = newCompany?.id ?? null;
    }
  }

  // Create lead — owner_id null so it lands in Inbox
  const { error } = await sb.from("leads").insert({
    name: name.trim(),
    email: email ?? null,
    phone: phone ?? null,
    role: role ?? null,
    company_id: companyId,
    service_type: serviceType,
    additional_info: additionalInfo,
    source: "yaas_form",
    source_submission_id: submissionId || null,
    owner_id: null,   // ← unassigned → lands in Inbox
    status: "active",
    tags: [],
  });

  if (error) {
    console.error("Tally webhook: insert lead failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
