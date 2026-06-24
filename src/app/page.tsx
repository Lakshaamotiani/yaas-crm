"use client";

/**
 * Root page — single entry point for all Supabase auth redirects.
 *
 * Invite / reset emails redirect here with the token in the URL hash:
 *   https://yaas-crm.vercel.app/#access_token=...&type=invite
 *
 * Strategy:
 * - Read type from the hash BEFORE Supabase processes it (synchronous)
 * - Let Supabase auto-exchange the token via detectSessionInUrl
 * - React to onAuthStateChange (SIGNED_IN + INITIAL_SESSION) — never call setSession()
 * - invite + recovery always → /set-password (never skip to /dashboard)
 * - 6s timeout fallback so the spinner never gets permanently stuck
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  React.useEffect(() => {
    const supabase = createClient();

    // Read URL params synchronously before Supabase consumes the hash
    const hashParams   = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);

    const accessToken = hashParams.get("access_token");
    const code        = searchParams.get("code");

    // No auth token in URL — normal visit, go to dashboard
    if (!accessToken && !code) {
      window.location.replace("/dashboard");
      return;
    }

    // Read the token type before Supabase clears the hash
    const type = hashParams.get("type") || searchParams.get("type");
    const needsPassword = type === "invite" || type === "recovery";

    // PKCE flow (?code=) — exchange manually, then redirect
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) { window.location.replace("/login"); return; }
        window.location.replace(needsPassword ? "/set-password" : "/dashboard");
      });
      return;
    }

    // Hash flow — Supabase auto-processes the token via detectSessionInUrl.
    // We listen for any session event and redirect accordingly.
    // INITIAL_SESSION fires when the user is already logged in (existing session).
    // SIGNED_IN fires when the invite/reset token creates a new session.
    // PASSWORD_RECOVERY fires specifically for reset-password links.
    let redirected = false;
    function go(dest: string) {
      if (redirected) return;
      redirected = true;
      window.location.replace(dest);
    }

    // Fallback: if no auth event fires within 6s (expired/invalid token), go to login
    const timeout = setTimeout(() => go("/login"), 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearTimeout(timeout);
        go("/set-password");
      } else if (event === "SIGNED_IN") {
        clearTimeout(timeout);
        go(needsPassword ? "/set-password" : "/dashboard");
      }
      // INITIAL_SESSION fires before the hash token is processed — ignore it here.
      // If neither SIGNED_IN nor PASSWORD_RECOVERY fires, the 6s timeout sends to /login.
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Show a spinner while the token is being processed
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
    </div>
  );
}
