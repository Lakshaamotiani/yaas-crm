"use client";

/**
 * /auth/callback  (real page — NOT a redirect)
 *
 * Supabase invite/reset emails link here. This must be a real client-side
 * page, not a Next.js redirect, because the invite token arrives as a URL
 * hash fragment (#access_token=...) which is NEVER sent to the server and
 * is therefore silently dropped by server-side redirects.
 *
 * Handles both:
 *   - Hash fragment flow  (#access_token=...&type=invite)
 *   - PKCE code flow      (?code=xxx&type=invite)
 *
 * After exchanging the token/code:
 *   - invite / recovery → /set-password
 *   - everything else   → /dashboard
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
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
        const type = params.get("type");
        router.replace(type === "invite" || type === "recovery" ? "/set-password" : "/dashboard");
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
        router.replace(type === "invite" || type === "recovery" ? "/set-password" : "/dashboard");
        return;
      }

      // Nothing in URL — direct navigation
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
