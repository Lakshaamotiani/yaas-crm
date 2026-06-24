"use client";

/**
 * Root page — single entry point for all Supabase auth redirects.
 *
 * Invite / reset emails redirect here with the token in the URL hash:
 *   https://yaas-crm.vercel.app/#access_token=...&type=invite
 *
 * Strategy:
 * - Read hash tokens synchronously before Supabase can consume them
 * - Sign out any existing session so the new token isn't ignored
 * - Call setSession() directly — no listener, no race condition
 * - invite + recovery always → /set-password
 * - No token in URL → /dashboard (normal visit)
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  React.useEffect(() => {
    const supabase = createClient();

    const hashParams   = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);

    const accessToken  = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const code         = searchParams.get("code");

    // No auth token — normal visit, go straight to dashboard
    if (!accessToken && !code) {
      window.location.replace("/dashboard");
      return;
    }

    const type = hashParams.get("type") || searchParams.get("type");
    const needsPassword = type === "invite" || type === "recovery";

    // PKCE flow (?code=) — exchange then redirect
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { window.location.replace("/login"); return; }
        window.location.replace(needsPassword ? "/set-password" : "/dashboard");
      });
      return;
    }

    // Hash flow — sign out first so Supabase doesn't skip the new token,
    // then set the session directly and redirect immediately.
    async function handle() {
      if (!accessToken || !refreshToken) {
        window.location.replace("/login");
        return;
      }

      // Clear any existing session so the invite/recovery token is processed fresh
      await supabase.auth.signOut({ scope: "local" });

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        window.location.replace("/login");
        return;
      }

      window.location.replace(needsPassword ? "/set-password" : "/dashboard");
    }

    handle();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}
