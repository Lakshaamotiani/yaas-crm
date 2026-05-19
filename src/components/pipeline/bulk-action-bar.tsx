"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  X, UserCog, Tag as TagIcon, GitBranch, Inbox, Trash2, Loader2, Shuffle, User, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useActions, useProfiles, useTemplates, usePipelineStages } from "@/lib/store";
import { useIsAdmin } from "@/lib/roles";
import { cn, initials } from "@/lib/utils";
import { type DealStage } from "@/lib/constants";
import type { LeadSource } from "@/lib/types";

const SOURCES: LeadSource[] = [
  "yaas_form", "referral", "outbound", "inbound_email", "linkedin", "event", "other",
];

/**
 * Floating bulk-action bar — appears when ≥1 lead is selected in the list.
 * Owner assignment supports both a single owner and round-robin rotation
 * across a chosen, ordered set of teammates.
 */
export function BulkActionBar({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const actions = useActions();
  const profiles = useProfiles();
  const { sourceLabels } = useTemplates();
  const stages = usePipelineStages();
  const isAdmin = useIsAdmin();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const n = selectedIds.length;
  if (n === 0) return null;

  async function run(label: string, fn: () => Promise<unknown>, done: string) {
    setBusy(label);
    try {
      await fn();
      toast.success(done);
      onClear();
    } catch (err) {
      toast.error(`${label} failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
        <div className="flex max-w-[calc(100vw-2rem)] items-center gap-1.5 overflow-x-auto rounded-lg border bg-card px-3 py-2 shadow-lg no-scrollbar">
          <span className="shrink-0 pr-1 text-[12px] font-medium tabular-nums">
            {n} selected
          </span>
          <span className="h-5 w-px shrink-0 bg-border" />

          {/* Owner — single or round-robin */}
          <OwnerPopover
            count={n}
            profiles={profiles}
            busy={busy === "Assign owner"}
            onSingle={(ownerId) =>
              run("Assign owner", () => actions.bulkAssignOwner(selectedIds, ownerId), `Assigned ${n} to one owner`)
            }
            onRotate={(ownerIds) =>
              run("Assign owner", async () => {
                const counts = await actions.bulkRotateOwners(selectedIds, ownerIds);
                const summary = ownerIds
                  .map((id) => {
                    const p = profiles.find((x) => x.id === id);
                    return `${p?.full_name ?? "—"}: ${counts[id] ?? 0}`;
                  })
                  .join(" · ");
                toast.message("Rotated", { description: summary });
              }, `Rotated ${n} leads`)
            }
          />

          <PickerPopover
            icon={GitBranch}
            label="Stage"
            busy={busy === "Set stage"}
            options={stages.map((s) => ({ id: s.id, label: s.label }))}
            onPick={(id) =>
              run("Set stage", () => actions.bulkSetStage(selectedIds, id as DealStage),
                `Moved ${n} to ${stages.find((s) => s.id === id)?.label}`)
            }
          />

          <PickerPopover
            icon={Inbox}
            label="Source"
            busy={busy === "Set source"}
            options={SOURCES.map((s) => ({ id: s, label: sourceLabels[s] ?? s }))}
            onPick={(id) =>
              run("Set source", () => actions.bulkSetSource(selectedIds, id as LeadSource),
                `Set source on ${n} leads`)
            }
          />

          <TagPopover
            busy={busy === "Add tag"}
            onAdd={(tag) =>
              run("Add tag", () => actions.bulkAddTag(selectedIds, tag), `Tagged ${n} leads`)
            }
          />

          {isAdmin ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              disabled={!!busy}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : null}

          <span className="h-5 w-px shrink-0 bg-border" />
          <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={onClear} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {n} leads?</DialogTitle>
            <DialogDescription>
              This permanently deletes the selected leads and their deals,
              qualifications, and activities. Can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
                run("Delete leads", () => actions.bulkDeleteLeads(selectedIds), `Deleted ${n} leads`);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete {n}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OwnerPopover({
  count, profiles, busy, onSingle, onRotate,
}: {
  count: number;
  profiles: { id: string; full_name: string | null; role: string | null }[];
  busy: boolean;
  onSingle: (ownerId: string) => void;
  onRotate: (ownerIds: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"single" | "rotate">("single");
  // Rotation participants — ordered. Default: everyone, in profile order.
  const [picked, setPicked] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (open) {
      setMode("single");
      setPicked(profiles.map((p) => p.id));
    }
  }, [open, profiles]);

  function togglePick(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCog className="h-3.5 w-3.5" />}
          Owner
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[300px] p-0">
        <div className="flex border-b p-1">
          {(["single", "rotate"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] transition-colors",
                mode === m ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "single" ? <User className="h-3.5 w-3.5" /> : <Shuffle className="h-3.5 w-3.5" />}
              {m === "single" ? "One person" : "Round-robin"}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <ul className="max-h-[260px] overflow-y-auto p-1 scrollbar-thin">
            {profiles.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => { setOpen(false); onSingle(p.id); }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{initials(p.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{p.full_name ?? "—"}</span>
                  <span className="text-[10px] capitalize text-muted-foreground">{p.role}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2 p-2">
            <p className="px-1 text-[11px] text-muted-foreground">
              {count} leads spread evenly across the checked teammates, in order.
            </p>
            <ul className="max-h-[200px] space-y-0.5 overflow-y-auto scrollbar-thin">
              {profiles.map((p) => {
                const order = picked.indexOf(p.id);
                const on = order !== -1;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => togglePick(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                        on ? "bg-accent/60" : "hover:bg-accent/40",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-4 w-4 shrink-0 place-items-center rounded border text-[9px] font-mono",
                          on ? "border-foreground bg-foreground text-background" : "border-border text-transparent",
                        )}
                      >
                        {on ? order + 1 : ""}
                      </span>
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px]">{initials(p.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 truncate">{p.full_name ?? "—"}</span>
                      {on ? <Check className="h-3.5 w-3.5 text-muted-foreground" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button
              size="sm"
              className="w-full"
              disabled={picked.length === 0}
              onClick={() => { setOpen(false); onRotate(picked); }}
            >
              <Shuffle className="h-3.5 w-3.5" />
              Distribute across {picked.length}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function PickerPopover({
  icon: Icon, label, options, onPick, busy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  options: { id: string; label: string }[];
  onPick: (id: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[220px] p-1">
        <ul className="max-h-[280px] overflow-y-auto scrollbar-thin">
          {options.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => { setOpen(false); onPick(o.id); }}
                className="w-full rounded-md px-2 py-1.5 text-left text-[13px] capitalize hover:bg-accent"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function TagPopover({ onAdd, busy }: { onAdd: (tag: string) => void; busy: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [tag, setTag] = React.useState("");
  React.useEffect(() => { if (open) setTag(""); }, [open]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="shrink-0" disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TagIcon className="h-3.5 w-3.5" />}
          Add tag
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[240px] space-y-2 p-2">
        <Input
          autoFocus
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tag.trim()) { setOpen(false); onAdd(tag); }
          }}
          placeholder="e.g. high-intent"
          className="h-8"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={!tag.trim()}
          onClick={() => { setOpen(false); onAdd(tag); }}
        >
          Add to selected
        </Button>
      </PopoverContent>
    </Popover>
  );
}
