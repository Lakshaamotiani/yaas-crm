"use client";

/**
 * Root page — handles Supabase auth redirects directly here.
 *
 * Supabase invite/reset emails redirect to the Site URL (root "/") with
 * the auth token in the hash: /#access_token=...&type=invite
 *
 * We process the token HERE so there are zero intermediate redirects
 * and zero risk of the hash fragment getting dropped.
 */

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    async function handle() {
      const supabase = createClient();

      // ── PKCE code flow (?code=xxx) ─────────────────────────────────────
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) { setStatus("Link invalid or expired."); return; }
        const type = params.get("type");
        window.location.replace(
          type === "invite" || type === "recovery" ? "/set-password" : "/dashboard"
        );
        return;
      }

      // ── Hash / token flow (#access_token=xxx&type=invite) ───────────────
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const hp = new URLSearchParams(hash.slice(1));
        const accessToken  = hp.get("access_token");
        const refreshToken = hp.get("refresh_token");
        const type         = hp.get("type");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) { setStatus("Link invalid or expired."); return; }
          window.location.replace(
            type === "invite" || type === "recovery" ? "/set-password" : "/dashboard"
          );
          return;
        }
      }

      // ── No auth token — normal visit, go to dashboard ──────────────────
      window.location.replace("/dashboard");
    }

    handle();
  }, []);

  return status ? (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <p className="text-[13px] text-destructive">{status}</p>
    </div>
  ) : null;
}
