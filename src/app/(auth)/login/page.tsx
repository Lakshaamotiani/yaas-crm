"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginPageInner />
    </React.Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const redirectTo = params.get("next") ?? "/dashboard";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err } = await signIn(email.trim(), password);
    if (err) {
      setError(err);
      setPending(false);
      return;
    }
    router.replace(redirectTo);
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — navy, only renders at lg+ to keep mobile focused. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[hsl(var(--sidebar-bg))] p-10 text-[hsl(var(--sidebar-fg))] lg:flex">
        {/* Subtle radial glow so the panel doesn't read as a flat block */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 0% 0%, hsl(220 50% 22% / 0.6) 0%, transparent 55%), radial-gradient(80% 60% at 100% 100%, hsl(220 50% 18% / 0.5) 0%, transparent 50%)",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-sm">
            <Image src="/logo.png" alt="YAAS" width={36} height={36} className="h-full w-full object-contain" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[14px] font-semibold tracking-tight">YAAS Sales CRM</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--sidebar-muted))]">
              Sales CRM
            </span>
          </div>
        </div>

        <div className="relative max-w-md space-y-5">
          <h2 className="text-[28px] font-semibold leading-[1.15] tracking-tight">
            Every deal, every client, every rupee — in one place.
          </h2>
          <p className="text-[13px] leading-relaxed text-[hsl(var(--sidebar-muted))]">
            The YAAS sales workspace. Track your pipeline, run scoping calls, and close retainers.
          </p>
        </div>

        <div className="relative flex items-center justify-between text-[11px] tracking-wide text-[hsl(var(--sidebar-muted))]">
          <span>© {new Date().getFullYear()} YAAS Sales CRM</span>
          <span className="font-mono">v0.1</span>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex flex-col">
        {/* Mobile brand bar */}
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4 lg:hidden">
          <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-sm">
            <Image src="/logo.png" alt="YAAS" width={32} height={32} className="h-full w-full object-contain" />
          </div>
          <span className="text-[13px] font-semibold tracking-tight">YAAS Sales CRM</span>
        </div>

        <div className="flex flex-1 items-center justify-center p-6 lg:p-10">
          <div className="w-full max-w-[360px] space-y-7">
            <div className="space-y-1.5">
              <h1 className="text-[22px] font-semibold tracking-tight">Sign in</h1>
              <p className="text-[13px] text-muted-foreground">
                Welcome back. Enter your details to access the CRM.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[12px]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@yaas.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={pending}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[12px]">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={pending}
                    required
                    className="pr-9"
                  />
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
                >
                  <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              <Button type="submit" disabled={pending} className="w-full">
                {pending ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </form>

            <div className="border-t border-border pt-5">
              <p className="text-[11px] text-muted-foreground">
                Trouble signing in? Contact your workspace admin.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
