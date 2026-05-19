import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

interface RoleBody {
  userId: string;
  role: "admin" | "rep";
}

/**
 * Admin-only: change a teammate's role. Includes a guard against the only
 * admin demoting themselves (which would lock the workspace out of all
 * admin actions).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: RoleBody;
  try {
    body = (await request.json()) as RoleBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (body.role !== "admin" && body.role !== "rep") {
    return NextResponse.json({ error: "Role must be 'admin' or 'rep'" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Lockout guard: if this would leave zero admins, refuse.
  if (body.role === "rep") {
    const { count: adminCount } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    const { data: target } = await admin
      .from("profiles")
      .select("role")
      .eq("id", body.userId)
      .single();
    if (target?.role === "admin" && (adminCount ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can't demote the last admin — promote someone else first." },
        { status: 400 },
      );
    }
  }

  const { error } = await admin
    .from("profiles")
    .update({ role: body.role })
    .eq("id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
