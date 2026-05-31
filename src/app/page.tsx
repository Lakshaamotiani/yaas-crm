"use client";

/**
 * Root page.
 *
 * Supabase invite/reset emails redirect to the Site URL (the root "/") with
 * the auth token in the hash fragment: /#access_token=...&type=invite
 *
 * Uses window.location.replace (not Next.js router) to guarantee the hash
 * fragment is preserved — Next.js router can silently strip hashes.
 */

import * as React from "react";

export default function Home() {
  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      // Use native browser navigation — guaranteed to preserve the hash.
      window.location.replace("/auth/callback" + hash);
    } else {
      window.location.replace("/dashboard");
    }
  }, []);

  return null;
}
