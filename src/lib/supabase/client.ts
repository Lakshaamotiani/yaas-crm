"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { LockFunc } from "@supabase/auth-js";

/**
 * No-op lock — short-circuits the SDK's `navigator.locks`-backed coordination
 * (used to serialize session refresh across tabs). Brave and a few privacy
 * extensions silently neuter `navigator.locks`, which causes the SDK to await
 * a lock that never resolves and hangs `signInWithPassword` forever. We don't
 * have multi-tab session coordination concerns here, so just bypass it.
 */
const noLock: LockFunc = async (_name, _acquireTimeout, fn) => fn();

/**
 * Build-time placeholders. Next.js prerenders every "use client" page during
 * `next build` by running the component once on the server — if the env vars
 * aren't present (e.g. a fresh Vercel deploy where the user hasn't added
 * them yet), `createBrowserClient` throws and every page in the export
 * collapses. Falling back to a syntactically-valid placeholder keeps build
 * green; real network calls at runtime are gated on a real session anyway.
 */
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-key";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY,
    {
      auth: { lock: noLock },
    },
  );
}
