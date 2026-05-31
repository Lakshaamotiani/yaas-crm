"use client";

/**
 * /auth/callback
 *
 * Handles Supabase invite + password-reset links.
 * Uses window.location.replace (not Next.js router) for all redirects
 * so hash fragments and query params are never silently dropped.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const [status, setStatus] = React.useState("Verifying your link…");

  React.useEffect(() => {
    const supabase = createClient();

    async function handle() {
      // ── PKCE code flow (?code=xxx) ─────────────────────────────────────────
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setStatus("Link invalid or expired. Ask your admin to resend the invite.");
          return;
        }
        const type = params.get("type");
        window.location.replace(
          type === "invite" || type === "recovery" ? "/set-password" : "/dashboard"
        );
        return;
      }

      // ── Hash / token flow (#access_token=xxx&type=invite) ─────────────────
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken  = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type         = hash.get("type");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setStatus("Link invalid or expired. Ask your admin to resend the invite.");
          return;
        }
        window.location.replace(
          type === "invite" || type === "recovery" ? "/set-password" : "/dashboard"
        );
        return;
      }

      // Nothing in URL — direct navigation, send to login
      window.location.replace("/login");
    }

    handle();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <p className="text-[13px] text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
