"use client";

/**
 * /auth/callback
 *
 * Supabase redirects here after email invite, password reset, and magic-link
 * flows. The URL contains either:
 *   - a hash fragment (#access_token=...&type=invite) — older token flow
 *   - a ?code= query param — newer PKCE flow
 *
 * We exchange the token/code for a session, then route the user:
 *   - invite / recovery → /auth/set-password  (they must set a password)
 *   - everything else   → /dashboard
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function CallbackPage() {
  const router = useRouter();
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
        router.replace("/dashboard");
        return;
      }

      // ── Hash / token flow (#access_token=xxx&type=invite) ─────────────────
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken  = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type         = hash.get("type"); // "invite" | "recovery" | "signup"

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setStatus("Link invalid or expired. Ask your admin to resend the invite.");
          return;
        }
        // Invite / password-reset → force them to set a real password
        if (type === "invite" || type === "recovery") {
          router.replace("/auth/set-password");
        } else {
          router.replace("/dashboard");
        }
        return;
      }

      // Nothing in URL — maybe they landed here directly
      router.replace("/login");
    }

    handle();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <p className="text-[13px] text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
