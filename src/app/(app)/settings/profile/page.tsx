"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Camera, Loader2, Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActions, useCurrentUser } from "@/lib/store";
import { initials } from "@/lib/utils";
import { AvatarUploadDialog } from "@/components/profile/avatar-upload-dialog";
import { createClient } from "@/lib/supabase/client";

export default function ProfileSettingsPage() {
  const me = useCurrentUser();
  const actions = useActions();
  const { theme, setTheme } = useTheme();

  const [name, setName] = React.useState(me?.full_name ?? "");
  const [savingName, setSavingName] = React.useState(false);
  const [avatarOpen, setAvatarOpen] = React.useState(false);

  // Sync local input when the source updates (e.g. another tab edited it,
  // or the initial load arrives after the page mounts).
  React.useEffect(() => {
    setName(me?.full_name ?? "");
  }, [me?.full_name]);

  if (!me) return null;

  const nameDirty = name.trim() !== (me.full_name ?? "");

  async function handleSaveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name can't be empty");
      return;
    }
    setSavingName(true);
    actions.updateProfile({ full_name: trimmed });
    // The action is fire-and-forget on the React side (optimistic + rollback
    // inside the store); release the saving state on the next tick.
    setTimeout(() => setSavingName(false), 200);
  }

  function handleAvatarUploaded(publicUrl: string) {
    actions.updateProfile({ avatar_url: publicUrl });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SettingsSection title="Profile" description="How you appear across the workspace.">
        <Card className="p-5">
          <div className="flex items-start gap-5">
            {/* Avatar with hover-to-edit overlay */}
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              aria-label="Change profile picture"
              className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar className="h-16 w-16">
                {me.avatar_url ? <AvatarImage src={me.avatar_url} alt="" /> : null}
                <AvatarFallback className="bg-foreground text-base font-semibold text-background">
                  {initials(me.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="h-4 w-4" />
              </div>
            </button>

            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nameDirty) handleSaveName();
                  }}
                  placeholder="Your name"
                />
              </Field>
              <Field label="Email">
                <Input value={me.email ?? ""} disabled />
              </Field>
              <Field label="Role">
                <Input value={me.role ?? ""} disabled />
              </Field>
              <Field label="Timezone">
                <Select defaultValue="America/Los_Angeles">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {nameDirty ? (
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setName(me.full_name ?? "")}
                disabled={savingName}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveName} disabled={savingName}>
                {savingName ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save name"
                )}
              </Button>
            </div>
          ) : null}
        </Card>
      </SettingsSection>

      <SettingsSection title="Appearance" description="Theme and density preferences.">
        <Card className="p-5">
          <Field label="Theme">
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">Match system</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Card>
      </SettingsSection>

      <Separator />

      <SettingsSection title="Security" description="Change your login password.">
        <ChangePasswordCard />
      </SettingsSection>

      <Separator />

      <AvatarUploadDialog
        open={avatarOpen}
        onOpenChange={setAvatarOpen}
        userId={me.id}
        onUploaded={handleAvatarUploaded}
      />
    </div>
  );
}

function ChangePasswordCard() {
  const [pw1, setPw1] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (pw1.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw1 !== pw2) { setError("Passwords don't match."); return; }
    setSaving(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password: pw1 });
    setSaving(false);
    if (err) { setError(err.message); return; }
    toast.success("Password updated successfully");
    setPw1(""); setPw2("");
  }

  return (
    <Card className="p-5">
      <form onSubmit={handleSave} className="space-y-3 max-w-sm">
        <Field label="New password">
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="Min. 8 characters"
              className="pr-9"
              autoComplete="new-password"
            />
            <button type="button" tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </Field>
        <Field label="Confirm new password">
          <Input
            type={show ? "text" : "password"}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
          />
        </Field>
        {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
        <Button type="submit" size="sm" disabled={saving || !pw1 || !pw2}>
          {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : "Update password"}
        </Button>
      </form>
    </Card>
  );
}

function SettingsSection({
  title, description, children,
}: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
