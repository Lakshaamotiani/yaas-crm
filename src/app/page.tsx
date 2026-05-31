"use client";

/**
 * Root page.
 *
 * Supabase invite/reset emails redirect to the Site URL (the root "/") with
 * the auth token in the hash fragment: /#access_token=...&type=invite
 *
 * A server-side redirect would lose the hash before JS can read it, so this
 * must be a client-side component. We forward auth hashes to /auth/callback
 * for processing; everything else goes straight to /dashboard.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Auth token in hash — forward to callback page which knows how to handle it.
      router.replace("/auth/callback" + hash);
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  // Show nothing while redirecting.
  return null;
}
