"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <React.Suspense fallback={null}>
        <RedirectIfAuthed />
      </React.Suspense>
      {children}
    </div>
  );
}

function RedirectIfAuthed() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace(params.get("next") ?? "/dashboard");
    }
  }, [loading, user, router, params]);

  return null;
}
