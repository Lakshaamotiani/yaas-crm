"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Copy, Eye, EyeOff, Loader2, MoreHorizontal, Shield, Sparkles, Trash2, UserPlus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser, useProfiles, useRefreshWorkspace } from "@/lib/store";
import { useIsAdmin } from "@/lib/roles";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

/**
 * Team tab content. Lists every workspace member; admins get controls to
 * invite new teammates, change roles, and remove members. Reps see the
 * same list as a read-only directory.
 */
export function TeamManagement() {
  const team = useProfiles();
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const refresh = useRefreshWorkspace();

  const [inviteOpen, setInviteOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold">Team</h2>
          <p className="text-[12px] text-muted-foreground">
            {team.length} {team.length === 1 ? "member" : "members"}
            {isAdmin ? " · admins can invite, change roles, and remove teammates" : ""}
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-3.5 w-3.5" /> Add teammate
          </Button>
        ) : null}
      </div>

      <Card className="divide-y p-0">
        {team.map((m) => (
          <TeammateRow
            key={m.id}
            profile={m}
            isMe={m.id === me?.id}
            isAdmin={isAdmin}
            onChanged={refresh}
          />
        ))}
      </Card>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={refresh}
      />
    </div>
  );
}

function TeammateRow({
  profile, isMe, isAdmin, onChanged,
}: {
  profile: Profile;
  isMe: boolean;
  isAdmin: boolean;
  onChanged: () => Promise<void>;
}) {
  const [working, setWorking] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  async function changeRole(role: "admin" | "rep") {
    setWorking(true);
    try {
      const res = await fetch("/api/team/role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Role change failed");
      await onChanged();
      toast.success(`Set ${profile.full_name ?? profile.email} to ${role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Role change failed");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    setConfirmRemove(false);
    setWorking(true);
    try {
      const res = await fetch("/api/team/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed");
      await onChanged();
      toast.success(`Removed ${profile.full_name ?? profile.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setWorking(false);
    }
  }

  const role = profile.role === "admin" ? "admin" : "rep";

  return (
    <>
      <div className="flex items-center gap-3 p-3">
        <Avatar className="h-8 w-8">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-[10px]">{initials(profile.full_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm">{profile.full_name ?? profile.email ?? "—"}</span>
            {isMe ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                You
              </span>
            ) : null}
            {profile.must_change_password ? (
              <span
                className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400"
                title="Must change password on first sign-in"
              >
                Pending
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{profile.email}</div>
        </div>
        <Badge
          variant={role === "admin" ? "default" : "secondary"}
          className="text-[10px] capitalize"
        >
          {role === "admin" ? <Shield className="h-3 w-3" /> : null}
          {role}
        </Badge>
        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" disabled={working} aria-label="Actions">
                {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoreHorizontal className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {role === "rep" ? (
                <DropdownMenuItem onSelect={() => changeRole("admin")}>
                  <Shield className="h-3.5 w-3.5" /> Make admin
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => changeRole("rep")} disabled={isMe}>
                  <Shield className="h-3.5 w-3.5" /> Demote to rep
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmRemove(true);
                }}
                disabled={isMe}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {profile.full_name ?? profile.email}?</DialogTitle>
            <DialogDescription>
              They'll lose access to the workspace immediately. Their leads, deals, and activity
              records stay — they're just unassigned. This action can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" /> Remove teammate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InviteDialog({
  open, onOpenChange, onInvited,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onInvited: () => Promise<void>;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<"admin" | "rep">("rep");
  const [password, setPassword] = React.useState(() => randomPassword());
  const [showPw, setShowPw] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<{ email: string; password: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setRole("rep");
      setPassword(randomPassword());
      setShowPw(false);
      setSubmitting(false);
      setSuccess(null);
    }
  }, [open]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: name, password, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Invite failed");
      await onInvited();
      setSuccess({ email, password });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  }

  function copyCredentials() {
    if (!success) return;
    const text = `Email: ${success.email}\nTemporary password: ${success.password}\nSign-in URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Credentials copied to clipboard"),
      () => toast.error("Couldn't copy to clipboard"),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {success ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Teammate added
              </DialogTitle>
              <DialogDescription>
                Share these credentials with them — they'll be prompted to set their own password
                on first sign-in. This is the only time you'll see the temporary password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3 font-mono text-[12px]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</div>
                <div className="mt-0.5">{success.email}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Temporary password</div>
                <div className="mt-0.5">{success.password}</div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={copyCredentials}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add teammate</DialogTitle>
              <DialogDescription>
                Create an account with a temporary password. They'll be forced to change it on
                first sign-in.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="invite-name" className="text-[12px]">Full name</Label>
                <Input
                  id="invite-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maya Patel"
                  disabled={submitting}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-[12px]">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maya@yaas.in"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px]">Role</Label>
                <div className="flex gap-2">
                  <RoleOption
                    value="rep"
                    selected={role === "rep"}
                    onClick={() => setRole("rep")}
                    title="Rep"
                    desc="Edit + create everything; can't delete or change settings."
                    disabled={submitting}
                  />
                  <RoleOption
                    value="admin"
                    selected={role === "admin"}
                    onClick={() => setRole("admin")}
                    title="Admin"
                    desc="Everything a rep can do, plus delete + manage teammates + edit workspace settings."
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="invite-pw" className="text-[12px]">Temporary password</Label>
                  <button
                    type="button"
                    onClick={() => setPassword(randomPassword())}
                    disabled={submitting}
                    className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    Generate new
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="invite-pw"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-9 font-mono"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground/70 hover:bg-accent hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Min 6 characters. They'll change it themselves on first sign-in.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <UserPlus className="h-3.5 w-3.5" /> Add teammate
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RoleOption({
  selected, onClick, title, desc, disabled,
}: {
  value: "rep" | "admin";
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex-1 rounded-md border px-3 py-2.5 text-left transition-colors disabled:opacity-50 " +
        (selected
          ? "border-foreground bg-accent"
          : "border-border bg-card hover:border-foreground/50")
      }
    >
      <div className="text-[12px] font-medium">{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{desc}</div>
    </button>
  );
}

/** Generate a 12-character mixed-case+digits temp password. */
function randomPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}
