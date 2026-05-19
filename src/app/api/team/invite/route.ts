import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/require-admin";

interface InviteBody {
  email: string;
  full_name: string;
  password: string;
  role: "admin" | "rep";
}

/**
 * Admin-only: creates a new auth user with a temporary password and seeds
 * their `profiles` row with the requested name + role + the
 * `must_change_password = true` flag (so the app forces a password change
 * on their first sign-in).
 *
 * Email is auto-confirmed because we're an internal tool — the admin
 * vouches for the teammate by creating the account.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const password = body.password;
  const role = body.role;

  if (!email || !/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!fullName) {
    return NextResponse.json({ error: "Full name required" }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Temporary password must be at least 6 characters" }, { status: 400 });
  }
  if (role !== "admin" && role !== "rep") {
    return NextResponse.json({ error: "Role must be 'admin' or 'rep'" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Failed to create user";
    // Surface the duplicate-email case in friendlier wording.
    const friendly = /already.*registered|duplicate/i.test(msg)
      ? "A user with that email already exists."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 400 });
  }

  // The handle_new_user trigger auto-inserted a profiles row with default
  // values; overwrite it with the admin-supplied name, role, and the
  // must_change_password flag.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ full_name: fullName, role, must_change_password: true })
    .eq("id", created.user.id);

  if (profileErr) {
    // Best-effort cleanup so we don't leave a half-created user.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: `User created but profile setup failed: ${profileErr.message}. The user has been removed.` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId: created.user.id });
}
