"use client";

import * as React from "react";
import {
  Check, MessageSquareQuote, Sigma, Sparkles, ClipboardList, FileText,
  ShieldQuestion, ChevronRight, ChevronDown, Link2,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { isPromptDone, isFieldFilled } from "@/lib/script-runtime";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatCurrency } from "@/lib/utils";
import { tryEvaluate } from "@/lib/calc";
import { formatValue } from "@/lib/script-runtime";
import { FieldInput } from "./field-input";
import { TokenText } from "./token-text";
import { Checkbox } from "@/components/ui/checkbox";
import type { CaptureField, ScriptBlock } from "@/lib/constants";

// ============================================================================
// Block label badge — small uppercase tag above each block
// ============================================================================

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

function BlockBadge({ kind }: { kind: ScriptBlock["kind"] }) {
  const meta = BLOCK_META[kind];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
        meta.tone,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function BlockShell({
  kind, hint, children,
}: {
  kind: ScriptBlock["kind"];
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-start gap-2">
        <BlockBadge kind={kind} />
        {hint ? (
          <span className="text-[11px] leading-[1.55] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// ============================================================================
// CAPTURE
// ============================================================================

export function CaptureBlock({
  block, captures, onChange,
}: {
  block: ScriptBlock;
  captures: Record<string, unknown>;
  onChange: (id: string, value: unknown) => void;
}) {
  if (!block.fields) return null;
  return (
    <BlockShell kind="capture" hint={block.hint}>
      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.fields.map((f) => (
          <CaptureFieldRow
            key={f.id}
            field={f}
            value={captures[f.id]}
            onChange={(v) => onChange(f.id, v)}
          />
        ))}
      </div>
    </BlockShell>
  );
}

function CaptureFieldRow({
  field, value, onChange,
}: {
  field: CaptureField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const isLong = field.type === "long-text" || field.type === "multi-select";
  return (
    <div className={cn("space-y-1.5", isLong && "sm:col-span-2 lg:col-span-3")}>
      <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {field.label}
        {field.bindTo ? (
          <span className="ml-1 normal-case tracking-tight text-muted-foreground/60">
            · syncs to {prettyBindLabel(field.bindTo)}
          </span>
        ) : null}
      </label>
      <FieldInput field={field} value={value} onChange={onChange} />
      {field.hint ? (
        <p className="text-[10px] text-muted-foreground/70">{field.hint}</p>
      ) : null}
    </div>
  );
}

function prettyBindLabel(bind: string) {
  return bind.replace(/^[^.]+\./, "").replace(/_/g, " ");
}

// ============================================================================
// SAY THIS  +  PITCH
// ============================================================================

export function SayThisBlock({
  block, context, fields,
}: {
  block: ScriptBlock;
  context: Record<string, unknown>;
  fields: Record<string, CaptureField>;
}) {
  return (
    <BlockShell
      kind={block.kind === "pitch" ? "pitch" : "say-this"}
      hint={block.hint ?? "Read this verbatim — filled tokens auto-populate from above"}
    >
      <div className="rounded-lg border bg-card px-4 py-3.5">
        <TokenText
          text={block.text ?? ""}
          context={context}
          fields={fields}
          className="text-foreground/90"
        />
      </div>
    </BlockShell>
  );
}

export function PitchBlock({
  block, context, fields,
}: {
  block: ScriptBlock;
  context: Record<string, unknown>;
  fields: Record<string, CaptureField>;
}) {
  return (
    <BlockShell kind="pitch" hint={block.hint ?? "Personalized pitch — tokens fill from captured numbers"}>
      <div className="rounded-lg border bg-card px-5 py-4">
        {/* Pitch is the same neutral surface as Say This, just with slightly more
            breathing room + a touch larger text so it feels like a moment. */}
        <TokenText
          text={block.text ?? ""}
          context={context}
          fields={fields}
          className="text-[15px] leading-relaxed text-foreground"
        />
      </div>
    </BlockShell>
  );
}

// ============================================================================
// DISCOVERY
// ============================================================================

export function DiscoveryBlock({
  block, promptDone, setPromptDone, captures, fields,
}: {
  block: ScriptBlock;
  promptDone: Record<string, boolean>;
  setPromptDone: (id: string, done: boolean) => void;
  captures: Record<string, unknown>;
  fields: Record<string, CaptureField>;
}) {
  if (!block.prompts) return null;
  return (
    <BlockShell kind="discovery" hint={block.hint}>
      <ul className="space-y-3 rounded-lg border bg-card p-4">
        {block.prompts.map((p) => {
          const autoChecked = !!(p.captureId && isFieldFilled(captures[p.captureId]));
          const done = isPromptDone(p, captures, promptDone);
          const linkedField = p.captureId ? fields[p.captureId] : undefined;

          return (
            <li key={p.id} className="space-y-1.5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`prompt-${p.id}`}
                  checked={done}
                  // If auto-checked from a bound capture, clicking just toggles
                  // the manual flag — unchecking won't un-fill the capture.
                  onCheckedChange={(v) => setPromptDone(p.id, v === true)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <label
                      htmlFor={`prompt-${p.id}`}
                      className={cn(
                        "cursor-pointer text-[14px] leading-relaxed text-foreground/90",
                        done && "text-muted-foreground line-through decoration-muted-foreground/40",
                      )}
                    >
                      {p.text}
                    </label>
                    {linkedField ? (
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-medium tracking-tight",
                              autoChecked
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-border bg-muted/40 text-muted-foreground",
                            )}
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            {linkedField.label}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-[11px]">
                          {autoChecked
                            ? `Auto-checked when "${linkedField.label}" is filled below.`
                            : `Fill "${linkedField.label}" below to auto-check this.`}
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  {p.script ? (
                    <p
                      className={cn(
                        "mt-1 pl-0.5 text-[13px] italic leading-relaxed text-muted-foreground",
                        done && "opacity-60",
                      )}
                    >
                      {p.script}
                    </p>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </BlockShell>
  );
}

// ============================================================================
// CALC — derived metric, evaluated live from the context
// ============================================================================

export function CalcBlock({
  block, context,
}: {
  block: ScriptBlock;
  context: Record<string, unknown>;
}) {
  const v = block.formula ? tryEvaluate(block.formula, context) : undefined;
  const formatted = React.useMemo(() => {
    if (v === undefined) return "—";
    if (block.format === "currency") return formatCurrency(v);
    if (block.format === "percent")  return `${Math.round(v)}%`;
    return formatValue(v, "number");
  }, [v, block.format]);

  const filled = v !== undefined;

  return (
    <div className="inline-flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {block.label ?? "Calc"}
      </span>
      <span
        className={cn(
          "font-mono text-[20px] font-semibold leading-none tabular-nums tracking-tight",
          filled ? "text-foreground" : "text-muted-foreground/50",
        )}
      >
        {formatted}
      </span>
      {block.formula ? (
        <code className="text-[10px] text-muted-foreground/60">{block.formula}</code>
      ) : null}
    </div>
  );
}

/**
 * Groups consecutive CALC blocks into a single grid so they render as a
 * dashboard-style row instead of stacked cards.
 */
export function CalcGroup({
  blocks, context,
}: {
  blocks: ScriptBlock[];
  context: Record<string, unknown>;
}) {
  return (
    <BlockShell kind="calc" hint="Live math from your captures above">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {blocks.map((b) => <CalcBlock key={b.id} block={b} context={context} />)}
      </div>
    </BlockShell>
  );
}

// ============================================================================
// OBJECTION
// ============================================================================

export function ObjectionBlock({
  block, context, fields, handled, setHandled,
}: {
  block: ScriptBlock;
  context: Record<string, unknown>;
  fields: Record<string, CaptureField>;
  handled: Record<string, boolean>;
  setHandled: (id: string, done: boolean) => void;
}) {
  if (!block.objections) return null;

  const total = block.objections.length;
  const done = block.objections.filter((o) => handled[o.id]).length;

  return (
    <BlockShell
      kind="objection"
      hint={block.hint ?? "If they push back, open the matching card and read the personalized rebuttal."}
    >
      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{done}/{total}</span>
            <span className="ml-1">addressed</span>
          </span>
        </div>
        <ul className="divide-y">
          {block.objections.map((obj) => (
            <ObjectionItemRow
              key={obj.id}
              objection={obj}
              context={context}
              fields={fields}
              isHandled={!!handled[obj.id]}
              onToggle={(v) => setHandled(obj.id, v)}
            />
          ))}
        </ul>
      </div>
    </BlockShell>
  );
}

function ObjectionItemRow({
  objection, context, fields, isHandled, onToggle,
}: {
  objection: { id: string; trigger: string; response: string };
  context: Record<string, unknown>;
  fields: Record<string, CaptureField>;
  isHandled: boolean;
  onToggle: (v: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <li className={cn("group transition-colors", isHandled && "bg-emerald-500/[0.03]")}>
        <div className="flex items-stretch">
          <CollapsibleTrigger asChild>
            <button className="flex flex-1 items-start gap-2.5 px-3 py-2.5 text-left">
              {open ? (
                <ChevronDown className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              ) : (
                <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={cn(
                  "text-[13px] font-medium leading-snug text-foreground/90",
                  isHandled && "text-muted-foreground line-through decoration-muted-foreground/40",
                )}
              >
                "{objection.trigger}"
              </span>
            </button>
          </CollapsibleTrigger>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(!isHandled);
            }}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 self-center mr-3 rounded-md border px-2 py-1 text-[10px] font-medium tracking-tight transition-colors",
              isHandled
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {isHandled ? <Check className="h-3 w-3" /> : null}
            {isHandled ? "Handled" : "Mark handled"}
          </button>
        </div>
        <CollapsibleContent>
          <div className="border-t bg-muted/20 px-9 py-3">
            <TokenText
              text={objection.response}
              context={context}
              fields={fields}
              className="text-foreground/90"
            />
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  );
}
