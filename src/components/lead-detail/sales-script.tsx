"use client";

import * as React from "react";
import {
  ChevronDown, FileText, Phone,
  ClipboardList, MessageSquareQuote, Sigma, Sparkles, ShieldQuestion, Clock, CircleDashed,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ScriptBlock } from "@/lib/constants";
import { useScripts } from "@/lib/store";

interface Props {
  defaultOpen?: boolean;
  onUseInCall?: (scriptId: string) => void;
  /** Optional initial script id; defaults to workspace default. */
  scriptId?: string;
}

const BLOCK_META: Record<
  ScriptBlock["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  capture:     { label: "Capture",   icon: ClipboardList,      tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  "say-this":  { label: "Say this",  icon: MessageSquareQuote, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  discovery:   { label: "Discovery", icon: FileText,           tone: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
  calc:        { label: "Math",      icon: Sigma,              tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  pitch:       { label: "Pitch",     icon: Sparkles,           tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" },
  objection:   { label: "Objections",icon: ShieldQuestion,     tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-500/10" },
};

export function SalesScript({ defaultOpen = false, onUseInCall, scriptId }: Props) {
  const scripts = useScripts();
  const [open, setOpen] = React.useState(defaultOpen);
  const initialId = React.useMemo(
    () => scriptId ?? scripts.find((s) => s.isDefault)?.id ?? scripts[0]?.id,
    [scriptId, scripts],
  );
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialId);
  const script = scripts.find((s) => s.id === selectedId) ?? scripts[0];

  if (!script) return null;

  const totalMin = script.sections.reduce((n, s) => n + (s.minutes ?? 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border bg-card">
      {/* Header: icon, title, expand chevron, Use in call.
          Single row, single source of truth for the script name — no
          redundant dropdown trigger competing for the same horizontal space.
          Script switching lives inside the expanded body. */}
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center gap-2.5 p-3 text-left">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <FileText className="h-4 w-4" />
          </div>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
            {script.name}
          </span>
          {totalMin ? (
            <span className="hidden shrink-0 items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground sm:inline-flex">
              <Clock className="h-2.5 w-2.5" />
              ~{totalMin} min
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          {onUseInCall ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onUseInCall(script.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onUseInCall(script.id);
                }
              }}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-2 rounded-md bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              )}
            >
              <Phone className="h-3.5 w-3.5" />
              Use in call
            </span>
          ) : null}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="space-y-4 border-t px-4 py-4">
          {/* Script switcher + summary live INSIDE the expanded view, so the
              header stays single-row and clean. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {scripts.length > 1 ? (
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Script
                </span>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger className="h-7 min-w-0 max-w-[280px] gap-2 px-2 text-[12px] [&>span]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scripts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}{s.isDefault ? " · default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : <span />}
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {script.sections.length} section{script.sections.length === 1 ? "" : "s"}
              {totalMin ? ` · ~${totalMin} min` : ""}
            </span>
          </div>

          {script.sections.map((sec, i) => (
            <section key={sec.id} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-foreground/10 font-mono text-[10px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em]">{sec.heading}</h4>
                {sec.minutes ? (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {sec.minutes}m
                  </span>
                ) : null}
              </div>
              {/* Full block contents, rendered for reading (not for filling).
                  Mirrors the live-call surface but read-only — same shape so
                  reps recognize the structure when they go into call mode. */}
              <div className="space-y-2 pl-7">
                {sec.blocks.map((b) => (
                  <BlockPreview key={b.id} block={b} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Block preview — read-only render of every script block kind. Same visual
// language as the live call screen so the structure is familiar, but without
// any interactive controls (no checkboxes that toggle, no inputs that save).
// ============================================================================

function BlockPreview({ block }: { block: ScriptBlock }) {
  const meta = BLOCK_META[block.kind];
  const Icon = meta.icon;

  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tracking-tight",
            meta.tone,
          )}
        >
          <Icon className="h-2.5 w-2.5" />
          {meta.label}
        </span>
        {block.hint ? (
          <span className="text-[11px] italic text-muted-foreground">{block.hint}</span>
        ) : null}
      </div>

      {block.kind === "say-this" || block.kind === "pitch" ? (
        block.text ? (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
            {block.text}
          </p>
        ) : null
      ) : null}

      {block.kind === "discovery" && block.prompts?.length ? (
        <ul className="space-y-1.5 text-[13px]">
          {block.prompts.map((p) => (
            <li key={p.id} className="flex gap-2">
              <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <div className="text-foreground">{p.text}</div>
                {p.script ? (
                  <div className="mt-0.5 whitespace-pre-wrap text-[12px] italic leading-relaxed text-muted-foreground">
                    {p.script}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {block.kind === "capture" && block.fields?.length ? (
        <dl className="grid grid-cols-[minmax(120px,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
          {block.fields.map((f) => (
            <React.Fragment key={f.id}>
              <dt className="flex items-center gap-1 text-muted-foreground">
                {f.label}
                {f.required ? <span className="text-destructive">*</span> : null}
              </dt>
              <dd className="font-mono text-[11px] tabular-nums text-muted-foreground/80">
                {f.type}
                {f.bindTo ? (
                  <span className="ml-1.5 text-muted-foreground/60">
                    → {String(f.bindTo)}
                  </span>
                ) : null}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}

      {block.kind === "calc" ? (
        <div className="space-y-0.5 text-[13px]">
          {block.label ? <div className="text-foreground">{block.label}</div> : null}
          {block.formula ? (
            <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground">
              {block.formula}
            </code>
          ) : null}
          {block.format ? (
            <div className="font-mono text-[10px] tabular-nums text-muted-foreground">
              format: {block.format}
            </div>
          ) : null}
        </div>
      ) : null}

      {block.kind === "objection" && block.objections?.length ? (
        <ul className="space-y-2 text-[13px]">
          {block.objections.map((o) => (
            <li key={o.id} className="space-y-0.5">
              <div className="font-medium text-foreground">"{o.trigger}"</div>
              <div className="whitespace-pre-wrap pl-3 text-muted-foreground">{o.response}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
