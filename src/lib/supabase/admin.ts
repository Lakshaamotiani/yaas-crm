/**
 * Service-role Supabase client. Bypasses RLS — use sparingly, only for admin
 * operations that genuinely need elevated permissions (creating auth users,
 * deleting auth users, etc.).
 *
 * NEVER import this from a client component. Doing so would inline the
 * service-role key into the browser bundle, which would let any visitor
 * impersonate the workspace owner. The "use server" directive isn't enough
 * on its own — keep all callers inside `app/api/**` route handlers.
 */

import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
