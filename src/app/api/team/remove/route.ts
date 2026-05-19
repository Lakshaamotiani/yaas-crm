import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

interface RemoveBody {
  userId: string;
}

/**
 * Admin-only: delete an auth user. Cascades to profiles (FK on delete cascade)
 * and detaches their owner_id from any leads/deals/activities they touched
 * (those FKs are `on delete set null`). Includes guards against admins
 * deleting themselves and against deleting the last admin.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: RemoveBody;
  try {
    body = (await request.json()) as RemoveBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (body.userId === guard.userId) {
    return NextResponse.json(
      { error: "You can't remove yourself. Have another admin do it." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Last-admin guard.
  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", body.userId)
    .single();
  if (target?.role === "admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Can't remove the last admin — promote someone else first." },
        { status: 400 },
      );
    }
  }

  const { error } = await admin.auth.admin.deleteUser(body.userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
