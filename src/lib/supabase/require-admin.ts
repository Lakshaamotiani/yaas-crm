import "server-only";
import { createClient } from "./server";

/**
 * Returns the current request's auth user if they're an admin, otherwise
 * returns an error tuple suitable for an immediate `NextResponse.json` reply.
 *
 * Use at the top of any API route that performs admin-only work — RLS
 * already protects the database, but we want a clean 401/403 response
 * instead of a confusing pg-error string when the wrong user calls.
 */
export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, status: 401, error: "Not signed in" };

  const { data: profile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { ok: false, status: 403, error: "Admin access required" };
  }
  return { ok: true, userId: user.id };
}
