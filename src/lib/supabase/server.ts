import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Same build-time fallbacks as the browser client — keeps `next build`
// green when the deploy env hasn't set the keys yet. See client.ts for the
// reasoning.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-key";

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Setting cookies in a Server Component is a no-op when a middleware
            // session refresh is also wired up — safe to ignore.
          }
        },
      },
    }
  );
}
