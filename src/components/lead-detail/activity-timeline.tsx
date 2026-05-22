"use client";

import * as React from "react";
import Link from "next/link";
import {
  StickyNote, Phone, Mail, CalendarDays, CheckSquare, GitBranch, Sparkles, Check, Undo2,
  ChevronDown, ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatDateTime, initials, relativeTime } from "@/lib/utils";
import type { Activity } from "@/lib/types";
import type { ActivityType } from "@/lib/types";
import { useActions, useProfiles } from "@/lib/store";

/** Renders plain text with any URLs converted to clickable links. */
const URL_RE = /https?:\/\/[^\s<>"]+/g;

function LinkedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-foreground underline underline-offset-2 hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

const ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  task: CheckSquare,
  stage_change: GitBranch,
  system: Sparkles,
};

const TONE: Record<ActivityType, string> = {
  note:         "bg-stage-new/15 text-stage-new",
  call:         "bg-stage-held/15 text-stage-held",
  email:        "bg-stage-contacted/15 text-stage-contacted",
  meeting:      "bg-stage-booked/15 text-stage-booked",
  task:         "bg-stage-proposal/15 text-stage-proposal",
  stage_change: "bg-muted text-muted-foreground",
  system:       "bg-muted text-muted-foreground",
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  const profiles = useProfiles();
  const actions = useActions();
  // Per-card expand state. Calls (and any future activity that captures
  // extra detail) collapse to a one-line header by default and reveal the
  // full debrief — captures, prompts, summary — on demand.
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const toggleExpand = React.useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-10 text-center text-xs text-muted-foreground">
        No activity yet. Log a call or send an email to get started.
      </div>
    );
  }

  return (
    <ol className="relative space-y-2 pl-8">
      <span className="absolute left-3 top-1.5 h-[calc(100%-12px)] w-px bg-border" />
      {activities.map((a) => {
        const Icon = ICON[a.type];
        const author = profiles.find((p) => p.id === a.user_id);
        const meta = (a.metadata ?? {}) as Record<string, any>;
        const isAudit = a.type === "system" && meta.kind === "audit";
        const isStageChange = a.type === "stage_change";
        const isUndoable = (isAudit || isStageChange) && !meta.undone_at;
        const wasUndone = !!meta.undone_at;
        const showDueDate = !!a.due_at && a.status === "pending";
        // Call activities always get an expand affordance. Even when the
        // user blew through the script without filling anything in, the
        // expanded view tells them so explicitly (and surfaces script name,
        // outcome, duration in their richer form) — otherwise an empty
        // debrief looks indistinguishable from a missing UI affordance.
        const hasDebrief = a.type === "call";
        const isExpanded = expanded.has(a.id);
        return (
          <li key={a.id} className="relative">
            <span
              className={cn(
                "absolute -left-8 top-2 grid h-6 w-6 place-items-center rounded-full ring-4 ring-background",
                TONE[a.type],
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div
              className={cn(
                "rounded-md border bg-card px-3 py-2 transition-colors hover:border-foreground/15",
                wasUndone && "opacity-60",
              )}
            >
              {/* Single header row: title · pills · author · time · undo.
                  Keeps simple events (stage changes, system notes) at one
                  visible row of vertical space. */}
              <div className="flex items-center gap-2 text-[13px]">
                <span
                  className={cn(
                    "min-w-0 truncate font-medium",
                    wasUndone && "line-through",
                  )}
                >
                  {/* Call titles arrive as "Discovery call · Qualified — advance"
                      because the live-call screen suffixes the outcome label.
                      That outcome already renders as a pill below, so strip
                      the " · …" tail to keep the title clean. */}
                  {a.type === "call" && a.title
                    ? a.title.split(" · ")[0]
                    : (a.title ?? "Activity")}
                </span>
                {a.status === "pending" ? (
                  <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    Pending
                  </span>
                ) : null}
                {wasUndone ? (
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Undone
                  </span>
                ) : null}

                <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  {author ? (
                    <span
                      className="inline-flex items-center gap-1"
                      title={author.full_name ?? "—"}
                    >
                      <Avatar className="h-4 w-4">
                        {author.avatar_url ? <AvatarImage src={author.avatar_url} alt="" /> : null}
                        <AvatarFallback className="text-[8px]">
                          {initials(author.full_name ?? "?")}
                        </AvatarFallback>
                      </Avatar>
                    </span>
                  ) : null}
                  <span suppressHydrationWarning>
                    {showDueDate
                      ? `Due ${formatDateTime(a.due_at!)}`
                      : relativeTime(a.created_at)}
                  </span>
                  {isUndoable ? (
                    <button
                      type="button"
                      onClick={() => actions.undoFromAudit(a.id)}
                      aria-label="Undo"
                      title="Undo this change"
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Undo2 className="h-3 w-3" />
                    </button>
                  ) : null}
                  {hasDebrief ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(a.id)}
                      aria-label={isExpanded ? "Hide call detail" : "Show call detail"}
                      aria-expanded={isExpanded}
                      className="grid h-5 w-5 place-items-center rounded text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")}
                      />
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Body / diff / call meta — only rendered when there's something
                  more to say beyond the title. For calls, the body is part of
                  the expandable debrief so we don't double-render it here. */}
              {a.body && a.type !== "stage_change" && a.type !== "call" ? (
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  <LinkedText text={a.body} />
                </p>
              ) : null}
              {a.metadata && Object.keys(a.metadata).length > 0 ? (
                <ActivityMeta meta={a.metadata} type={a.type} />
              ) : null}

              {hasDebrief && isExpanded ? (
                <CallDebrief activity={a} />
              ) : null}

              {a.status === "pending" ? (
                <div className="mt-1.5 flex items-center justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => actions.completeActivity(a.id)}
                  >
                    <Check className="h-3 w-3" /> Mark done
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActivityMeta({ meta, type }: { meta: Record<string, any>; type: ActivityType }) {
  if (type === "call") {
    // Consolidated pills row — duration, outcome, prompts coverage, script.
    // Everything "about" the call lives here so the expanded body can focus
    // on what was actually captured.
    const promptsDone = (meta.prompts_done ?? {}) as Record<string, boolean>;
    const promptsTotal = Object.keys(promptsDone).length;
    const promptsChecked = Object.values(promptsDone).filter(Boolean).length;
    const hasAny =
      meta.duration || meta.outcome || promptsTotal > 0 || meta.script_name;
    if (!hasAny) return null;
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
        {meta.duration ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums">
            {meta.duration}m
          </span>
        ) : null}
        {meta.outcome ? (
          <span className="rounded bg-muted px-1.5 py-0.5 capitalize">{meta.outcome}</span>
        ) : null}
        {promptsTotal > 0 ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono tabular-nums">
            {promptsChecked}/{promptsTotal} prompts
          </span>
        ) : null}
        {meta.script_name ? (
          <span
            className="truncate rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
            title={String(meta.script_name)}
          >
            {String(meta.script_name)}
          </span>
        ) : null}
      </div>
    );
  }
  if (type === "meeting" && meta.duration_min) {
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{meta.duration_min}m</span>
      </div>
    );
  }
  if (type === "stage_change" && meta.from && meta.to) {
    return (
      <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
        {String(meta.from).replace(/_/g, " ")} → {String(meta.to).replace(/_/g, " ")}
      </div>
    );
  }
  if (meta.kind === "audit" && meta.before && meta.after) {
    const fields = Object.keys(meta.after);
    if (fields.length === 0) return null;
    return (
      <ul className="mt-1.5 space-y-0.5 font-mono text-[11px] text-muted-foreground">
        {fields.slice(0, 4).map((k) => (
          <li key={k} className="truncate">
            <span className="text-foreground/80">{k.replace(/_/g, " ")}</span>:{" "}
            <span className="line-through opacity-70">{formatVal(meta.before[k])}</span>
            {" → "}
            <span>{formatVal(meta.after[k])}</span>
          </li>
        ))}
        {fields.length > 4 ? (
          <li className="text-[10px] opacity-70">+ {fields.length - 4} more</li>
        ) : null}
      </ul>
    );
  }
  return null;
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 40 ? s.slice(0, 37) + "…" : s;
}

/**
 * Expanded debrief for a `call` activity. Renders the data the live-call
 * screen captured: the summary the rep typed, every key/value they filled
 * into the script's capture fields, computed values, and the count of
 * discovery prompts / objections checked. Hidden behind a chevron on the
 * activity card so the timeline stays scannable by default.
 */
function CallDebrief({ activity }: { activity: Activity }) {
  const meta = (activity.metadata ?? {}) as Record<string, any>;
  const captures = (meta.captures ?? {}) as Record<string, unknown>;
  const computed = (meta.computed ?? {}) as Record<string, unknown>;
  const objections = (meta.objections_handled ?? {}) as Record<string, boolean>;

  const captureEntries = Object.entries(captures).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  const computedEntries = Object.entries(computed).filter(([, v]) => v !== "" && v !== null && v !== undefined);
  const objectionsHandledCount = Object.values(objections).filter(Boolean).length;
  const objectionsTotal = Object.keys(objections).length;

  // Everything pill-shaped (duration, outcome, script, prompt count) is
  // already rendered in the headline ActivityMeta row, so the debrief
  // focuses on what's actually substantive: summary, captures, computed
  // values, and the action to dive back into the script.
  const hasSubstance =
    !!activity.body
    || captureEntries.length > 0
    || computedEntries.length > 0
    || objectionsTotal > 0;

  return (
    <div className="mt-2 space-y-3 border-t border-border pt-2.5">
      {activity.body ? (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
          {activity.body}
        </p>
      ) : null}

      {captureEntries.length > 0 ? (
        <dl className="grid grid-cols-[minmax(130px,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
          {captureEntries.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{humanizeKey(k)}</dt>
              <dd className="whitespace-pre-wrap text-foreground">{formatLongVal(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}

      {computedEntries.length > 0 ? (
        <dl className="grid grid-cols-[minmax(130px,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px]">
          {computedEntries.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{humanizeKey(k)} (calc)</dt>
              <dd className="font-mono tabular-nums text-foreground">{formatLongVal(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}

      {objectionsTotal > 0 ? (
        <div className="text-[11px] text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground">
            {objectionsHandledCount}/{objectionsTotal}
          </span>{" "}
          objections handled
        </div>
      ) : null}

      {!hasSubstance ? (
        <p className="text-[12px] italic text-muted-foreground">
          No notes or captures recorded. Open in script view to add some, or use a script with
          capture blocks on your next call.
        </p>
      ) : null}

      {activity.lead_id ? (
        <div className="flex justify-end">
          <Link
            href={`/leads/${activity.lead_id}/call?activity=${activity.id}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            Open in script view
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function humanizeKey(k: string): string {
  return k.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLongVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}
