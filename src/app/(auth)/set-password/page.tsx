"use client";

/**
 * /auth/set-password
 *
 * Shown after a new user accepts an invite (or uses a password-reset link).
 * At this point Supabase has already exchanged the token for a live session —
 * we just need the user to pick their password.
 */

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (err) {
      setError(err.message);
      return;
    }

    setDone(true);
    setTimeout(() => router.replace("/dashboard"), 1500);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="text-[15px] font-semibold">Password set! Taking you in…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-[360px] space-y-7">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-white shadow-sm">
            <Image src="/logo.png" alt="YAAS" width={36} height={36} className="h-full w-full object-contain" />
          </div>
          <span className="text-[14px] font-semibold tracking-tight">YAAS Sales CRM</span>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-[22px] font-semibold tracking-tight">Set your password</h1>
          <p className="text-[13px] text-muted-foreground">
            Choose a password to finish setting up your account.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[12px]">New password</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoFocus
                required
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Confirm password</Label>
            <Input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
              required
            />
          </div>

          {error ? (
            <p className="text-[12px] text-destructive">{error}</p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Set password & sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
