import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** GET /api/onboarding-view/data
 *  Header: x-onboarding-token: <password>
 *  Returns the full onboarding overview dataset using the service role key so
 *  RLS is bypassed — safe because this endpoint validates the password first.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-onboarding-token") ?? "";
  const expected = process.env.ONBOARDING_VIEW_PASSWORD;

  if (!expected || token !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Fetch everything we need for the onboarding list + detail pages.
  const [leadsRes, dealsRes, companiesRes, onboardingRes] = await Promise.all([
    sb.from("leads").select("id, name, email, phone, service_type, company_id"),
    sb.from("deals").select("id, lead_id, stage, value_mrr, value_one_time, value_currency, updated_at"),
    sb.from("companies").select("id, name, domain"),
    sb.from("onboardings").select("*"),
  ]);

  for (const res of [leadsRes, dealsRes, companiesRes, onboardingRes]) {
    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    leads: leadsRes.data,
    deals: dealsRes.data,
    companies: companiesRes.data,
    onboardings: onboardingRes.data,
  });
}
