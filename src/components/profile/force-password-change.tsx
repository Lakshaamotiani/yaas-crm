"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useActions, useCurrentUser } from "@/lib/store";

const MIN_LENGTH = 8;

/**
 * Modal that renders for any signed-in user whose `profiles.must_change_password`
 * flag is true (set when an admin invites them with a temporary password).
 * The dialog can't be dismissed until they pick a new password — clicking
 * outside, hitting Escape, etc. all do nothing. Once they save, we update
 * the auth password via Supabase, flip the flag, and let them through.
 *
 * Mounted at the (app) layout level so it covers the entire authenticated
 * surface area (including settings, dashboard, etc.).
 */
export function ForcePasswordChange() {
  const me = useCurrentUser();
  const actions = useActions();
  const supabase = React.useMemo(() => createClient(), []);

  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show1, setShow1] = React.useState(false);
  const [show2, setShow2] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const open = !!me?.must_change_password;

  // Reset form whenever the dialog (re)opens.
  React.useEffect(() => {
    if (open) {
      setPw1("");
      setPw2("");
      setShow1(false);
      setShow2(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!me) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pw1.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (pw1 !== pw2) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: pw1 });
      if (authErr) throw new Error(authErr.message);
      // Flip the flag so the modal stops appearing on subsequent signs-in.
      actions.updateProfile({ must_change_password: false });
      toast.success("Password updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password");
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      // Prevent any kind of dismissal — they MUST pick a new password.
      onOpenChange={() => {}}
    >
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the default close button — this dialog is non-dismissable.
        className="sm:max-w-[440px] [&>button.absolute]:hidden"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            Set a new password
          </DialogTitle>
          <DialogDescription>
            Your account was created with a temporary password by an admin. Choose a new password
            to continue. You can't access the workspace until this is done.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="pw1" className="text-[12px]">New password</Label>
            <div className="relative">
              <Input
                id="pw1"
                type={show1 ? "text" : "password"}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                disabled={submitting}
                autoComplete="new-password"
                autoFocus
                required
                className="pr-9"
              />
              <button
                type="button"
                aria-label={show1 ? "Hide password" : "Show password"}
                onClick={() => setShow1((s) => !s)}
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground/70 hover:bg-accent hover:text-foreground"
              >
                {show1 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pw2" className="text-[12px]">Confirm new password</Label>
            <div className="relative">
              <Input
                id="pw2"
                type={show2 ? "text" : "password"}
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                disabled={submitting}
                autoComplete="new-password"
                required
                className="pr-9"
              />
              <button
                type="button"
                aria-label={show2 ? "Hide password" : "Show password"}
                onClick={() => setShow2((s) => !s)}
                className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground/70 hover:bg-accent hover:text-foreground"
              >
                {show2 ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              At least {MIN_LENGTH} characters.
            </p>
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

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
              </>
            ) : (
              "Set password & continue"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
