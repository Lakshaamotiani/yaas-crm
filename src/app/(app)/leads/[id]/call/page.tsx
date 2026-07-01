"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActions, useLead, useScripts, useScript } from "@/lib/store";
import {
  buildContext, fieldsIndex, resolveBindings, sectionProgress,
} from "@/lib/script-runtime";
import { CallHeader } from "@/components/call/call-header";
import { SectionNav } from "@/components/call/section-nav";
import {
  CaptureBlock, SayThisBlock, PitchBlock, DiscoveryBlock, CalcGroup, ObjectionBlock,
} from "@/components/call/blocks";
import type { ScriptBlock, SalesScript } from "@/lib/constants";

const OUTCOMES = [
  { id: "qualified",  label: "Qualified — advance" },
  { id: "follow-up",  label: "Needs follow-up" },
  { id: "not-fit",    label: "Not a fit" },
  { id: "no-show",    label: "No show" },
];

export default function CallPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const actions = useActions();
  const { lead, deal, company, activities: leadActivities } = useLead(params.id);
  const scripts = useScripts();

  const requestedScriptId = searchParams.get("script") ?? undefined;
  const editingActivityId = searchParams.get("activity") ?? null;

  // When opened with `?activity=<id>`, hydrate the screen from that past
  // call's saved payload — same script, same captures, same outcome — so
  // the user can re-read or amend it in the full live-call surface. Without
  // the param this stays null and the screen behaves as a fresh new call.
  const hydrationSource = React.useMemo(() => {
    if (!editingActivityId) return null;
    const found = leadActivities.find((a) => a.id === editingActivityId);
    if (!found || found.type !== "call") return null;
    const meta = (found.metadata ?? {}) as Record<string, any>;
    return {
      activityId: found.id,
      scriptId: typeof meta.script_id === "string" ? meta.script_id : undefined,
      captures: (meta.captures ?? {}) as Record<string, unknown>,
      promptDone: (meta.prompts_done ?? {}) as Record<string, boolean>,
      objectionHandled: (meta.objections_handled ?? {}) as Record<string, boolean>,
      outcome: typeof meta.outcome === "string" ? meta.outcome : "qualified",
      summary: found.body ?? "",
      durationMin: typeof meta.duration === "number" ? meta.duration : 0,
    };
  }, [editingActivityId, leadActivities]);

  const isEditing = !!hydrationSource;
  const [scriptId, setScriptId] = React.useState<string | undefined>(
    hydrationSource?.scriptId ?? requestedScriptId,
  );
  const script = useScript(scriptId);

  const [captures, setCaptures] = React.useState<Record<string, unknown>>(
    hydrationSource?.captures ?? {},
  );
  const [promptDone, setPromptDoneState] = React.useState<Record<string, boolean>>(
    hydrationSource?.promptDone ?? {},
  );
  const [objectionHandled, setObjectionHandledState] = React.useState<Record<string, boolean>>(
    hydrationSource?.objectionHandled ?? {},
  );
  const [outcome, setOutcome] = React.useState<string>(hydrationSource?.outcome ?? "qualified");
  const [summary, setSummary] = React.useState<string>(hydrationSource?.summary ?? "");
  const [activeSection, setActiveSection] = React.useState<string>("");

  // Call timer — explicit start/pause control. accumulatedMs is the total
  // tracked time across all run segments; runStartedAt is when the current
  // segment began (null when paused). Default is stopped at 00:00 so the
  // rep clicks ▶ when they actually start the call.
  const [timerRunning, setTimerRunning] = React.useState(false);
  const [timerAccumulatedMs, setTimerAccumulatedMs] = React.useState(0);
  const [timerRunStartedAt, setTimerRunStartedAt] = React.useState<number | null>(null);

  function toggleTimer() {
    if (timerRunning) {
      // Pause: capture the elapsed run segment into accumulated, clear segment.
      const segment = timerRunStartedAt ? Date.now() - timerRunStartedAt : 0;
      setTimerAccumulatedMs(timerAccumulatedMs + segment);
      setTimerRunStartedAt(null);
      setTimerRunning(false);
    } else {
      // Start / resume.
      setTimerRunStartedAt(Date.now());
      setTimerRunning(true);
    }
  }

  function getElapsedMs() {
    return (
      timerAccumulatedMs +
      (timerRunning && timerRunStartedAt ? Date.now() - timerRunStartedAt : 0)
    );
  }

  const fields = React.useMemo(
    () => (script ? fieldsIndex(script) : {}),
    [script],
  );
  const context = React.useMemo(
    () => (script ? buildContext(script, captures, lead, deal, company) : { ...captures }),
    [script, captures, lead, deal, company],
  );

  // Track which section is in view as the user scrolls
  const sectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  React.useEffect(() => {
    if (!script) return;
    setActiveSection(script.sections[0]?.id ?? "");
  }, [script]);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection((visible.target as HTMLElement).dataset.section ?? "");
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [script]);

  if (!lead) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Lead not found.</p>
          <Button variant="ghost" size="sm" className="mt-3" asChild>
            <Link href="/pipeline"><ArrowLeft /> Back</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!script || scripts.length === 0) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No script available.</p>
          <Button variant="ghost" size="sm" className="mt-3" asChild>
            <Link href="/settings/workspace">Create a script</Link>
          </Button>
        </div>
      </div>
    );
  }

  function setCapture(id: string, value: unknown) {
    setCaptures((c) => ({ ...c, [id]: value }));
  }

  function setPromptDone(id: string, done: boolean) {
    setPromptDoneState((p) => ({ ...p, [id]: done }));
  }

  function setObjectionHandled(id: string, done: boolean) {
    setObjectionHandledState((p) => ({ ...p, [id]: done }));
  }

  function jumpTo(id: string) {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  }

  function logAndExit() {
    if (!script || !lead) return;
    // When editing an existing call, preserve its original duration unless
    // the timer ran again during this session. Otherwise compute fresh.
    const elapsedMs = getElapsedMs();
    const elapsedMin = elapsedMs > 0
      ? Math.max(1, Math.round(elapsedMs / 60000))
      : (hydrationSource?.durationMin ?? 1);

    // Sync bound captures back to lead / qualification / deal records
    const bindings = resolveBindings(script, captures);
    if (Object.keys(bindings.qualification).length > 0) {
      actions.updateQualification(lead.id, bindings.qualification as any);
    }
    if (Object.keys(bindings.lead).length > 0) {
      actions.updateLead(lead.id, bindings.lead as any);
    }
    if (deal && Object.keys(bindings.deal).length > 0) {
      actions.updateDeal(deal.id, bindings.deal as any);
    }

    // Snapshot computed values into the activity for posterity
    const computed: Record<string, unknown> = {};
    for (const sec of script.sections) {
      for (const blk of sec.blocks) {
        if (blk.kind === "calc" && blk.formula) {
          const key = blk.id || (blk.label ?? "calc")
            .toLowerCase().replace(/[^a-z0-9]+/g, "_");
          computed[key] = context[key];
        }
      }
    }

    const titleStr = `Discovery call · ${OUTCOMES.find((o) => o.id === outcome)?.label ?? outcome}`;
    const metadataPayload = {
      script_id: script.id,
      script_name: script.name,
      duration: elapsedMin,
      outcome,
      captures,
      computed,
      prompts_done: promptDone,
      objections_handled: objectionHandled,
    };

    if (hydrationSource) {
      // Re-opened a past call → update in place, don't create a duplicate.
      actions.updateCallActivity(hydrationSource.activityId, {
        body: summary || null,
        metadata: metadataPayload,
      });
      toast.success("Call updated");
    } else {
      actions.logActivity({
        lead_id: lead.id,
        type: "call",
        title: titleStr,
        body: summary || null,
        metadata: metadataPayload,
      });
      // Only advance the deal stage on the FIRST log of a call — not when
      // someone re-opens a historical call to amend captures.
      if (outcome === "qualified" && deal) {
        actions.advanceStage(deal.id);
      }
      toast.success("Call logged");
    }

    router.push(`/leads/${lead.id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex h-screen flex-col bg-background">
      <CallHeader
        lead={lead}
        deal={deal}
        scripts={scripts}
        activeScript={script}
        onScriptChange={(id) => setScriptId(id)}
        timer={{
          running: timerRunning,
          accumulatedMs: timerAccumulatedMs,
          runStartedAt: timerRunStartedAt,
        }}
        onToggleTimer={toggleTimer}
        onExit={() => router.push(`/leads/${lead.id}`)}
      />

      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left rail — section nav. Desktop only; on mobile the script
            scrolls naturally and the nav would steal precious vertical space. */}
        <aside className="hidden overflow-y-auto border-r bg-card/20 p-3 scrollbar-thin md:block">
          <SectionNav
            script={script}
            activeId={activeSection}
            captures={captures}
            promptDone={promptDone}
            objectionHandled={objectionHandled}
            onJump={jumpTo}
          />
        </aside>

        {/* Main scrollable script */}
        <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin md:flex-none">
          <div className="mx-auto max-w-3xl space-y-8 px-4 py-5 pb-24 sm:px-8 sm:py-6 sm:pb-32">
            <ScriptHeader script={script} />
            {script.sections.map((sec) => (
              <SectionView
                key={sec.id}
                section={sec}
                fields={fields}
                context={context}
                captures={captures}
                promptDone={promptDone}
                objectionHandled={objectionHandled}
                onCapture={setCapture}
                onPromptDone={setPromptDone}
                onObjectionHandled={setObjectionHandled}
                refSetter={(el) => (sectionRefs.current[sec.id] = el)}
              />
            ))}
          </div>
        </main>

        {/* Right rail — outcome & save. Stacks below the script on mobile so
            the call's "wrap up" controls are always reachable by scrolling. */}
        <aside className="flex flex-col overflow-y-auto border-t bg-card/20 scrollbar-thin md:border-l md:border-t-0">
          <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Wrap up
            </h3>

            <CallSummaryStats
              script={script}
              captures={captures}
              promptDone={promptDone}
              objectionHandled={objectionHandled}
            />

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Summary</Label>
              <Textarea
                rows={6}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="What did they say, what's the next step?"
              />
            </div>

            {/* Auto-sync explainer — useful onboarding context the first
                time someone uses live mode, but heavy for mobile where
                vertical space is precious. Hide below sm. */}
            <div className="hidden rounded-md border bg-card p-2.5 text-[11px] text-muted-foreground sm:block">
              <div className="mb-1 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Auto-syncs on save
              </div>
              <ul className="list-disc space-y-0.5 pl-4">
                <li>Captures with bindings update qualification fields</li>
                <li>Computed values stored on activity</li>
                <li>Qualified outcome advances stage when on Call Booked</li>
              </ul>
            </div>
          </div>

          <div className="sticky bottom-0 mt-auto flex items-center gap-2 border-t bg-card/95 p-3 backdrop-blur sm:p-4">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/leads/${lead.id}`)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1" onClick={logAndExit}>
              <Save /> {isEditing ? "Save changes" : "Log call"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- bits ------------------------------------------------------------

function ScriptHeader({ script }: { script: SalesScript }) {
  const totalMin = script.sections.reduce((n, s) => n + (s.minutes ?? 0), 0);
  return (
    <div className="space-y-1.5 border-b pb-5">
      <div className="flex items-center gap-2">
        <h1 className="text-[20px] font-semibold tracking-tight">{script.name}</h1>
        {script.isDefault ? (
          <span className="rounded-md border bg-card px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Default
          </span>
        ) : null}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {script.description ?? "Live call mode"} · {script.sections.length} sections{totalMin ? ` · ~${totalMin} min` : ""}
      </p>
    </div>
  );
}

function SectionView({
  section, fields, context, captures, promptDone, objectionHandled,
  onCapture, onPromptDone, onObjectionHandled, refSetter,
}: {
  section: SalesScript["sections"][number];
  fields: Record<string, import("@/lib/constants").CaptureField>;
  context: Record<string, unknown>;
  captures: Record<string, unknown>;
  promptDone: Record<string, boolean>;
  objectionHandled: Record<string, boolean>;
  onCapture: (id: string, value: unknown) => void;
  onPromptDone: (id: string, done: boolean) => void;
  onObjectionHandled: (id: string, done: boolean) => void;
  refSetter: (el: HTMLElement | null) => void;
}) {
  // Group consecutive CALC blocks into a single grid
  const groups = React.useMemo(() => groupBlocks(section.blocks), [section.blocks]);
  return (
    <section
      ref={refSetter}
      data-section={section.id}
      id={`section-${section.id}`}
      className="scroll-mt-20 space-y-5"
    >
      <header className="flex items-baseline justify-between gap-3 border-b pb-2.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-[15px] font-semibold tracking-tight">{section.heading}</h2>
          {section.minutes ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              ~{section.minutes} min
            </span>
          ) : null}
        </div>
      </header>

      <div className="space-y-5">
        {groups.map((g, i) => {
          if (g.length === 1) {
            const b = g[0];
            return (
              <BlockRouter
                key={b.id}
                block={b}
                fields={fields}
                context={context}
                captures={captures}
                promptDone={promptDone}
                objectionHandled={objectionHandled}
                onCapture={onCapture}
                onPromptDone={onPromptDone}
                onObjectionHandled={onObjectionHandled}
              />
            );
          }
          // multiple consecutive calc blocks
          return <CalcGroup key={i} blocks={g} context={context} />;
        })}
      </div>
    </section>
  );
}

function BlockRouter({
  block, fields, context, captures, promptDone, objectionHandled,
  onCapture, onPromptDone, onObjectionHandled,
}: {
  block: ScriptBlock;
  fields: Record<string, import("@/lib/constants").CaptureField>;
  context: Record<string, unknown>;
  captures: Record<string, unknown>;
  promptDone: Record<string, boolean>;
  objectionHandled: Record<string, boolean>;
  onCapture: (id: string, value: unknown) => void;
  onPromptDone: (id: string, done: boolean) => void;
  onObjectionHandled: (id: string, done: boolean) => void;
}) {
  switch (block.kind) {
    case "capture":
      return <CaptureBlock block={block} captures={captures} onChange={onCapture} />;
    case "say-this":
      return <SayThisBlock block={block} context={context} fields={fields} />;
    case "pitch":
      return <PitchBlock block={block} context={context} fields={fields} />;
    case "discovery":
      return (
        <DiscoveryBlock
          block={block}
          promptDone={promptDone}
          setPromptDone={onPromptDone}
          captures={captures}
          fields={fields}
        />
      );
    case "calc":
      return <CalcGroup blocks={[block]} context={context} />;
    case "objection":
      return (
        <ObjectionBlock
          block={block}
          context={context}
          fields={fields}
          handled={objectionHandled}
          setHandled={onObjectionHandled}
        />
      );
  }
}

function groupBlocks(blocks: ScriptBlock[]): ScriptBlock[][] {
  const out: ScriptBlock[][] = [];
  for (const b of blocks) {
    if (b.kind === "calc" && out.length > 0 && out[out.length - 1].every((x) => x.kind === "calc")) {
      out[out.length - 1].push(b);
    } else {
      out.push([b]);
    }
  }
  return out;
}

function CallSummaryStats({
  script, captures, promptDone, objectionHandled,
}: {
  script: SalesScript;
  captures: Record<string, unknown>;
  promptDone: Record<string, boolean>;
  objectionHandled: Record<string, boolean>;
}) {
  const totals = script.sections.reduce(
    (acc, s) => {
      const p = sectionProgress(s.blocks, captures, promptDone, objectionHandled);
      acc.filled += p.filledFields + p.filledPrompts + p.filledObjections;
      acc.total += p.totalFields + p.totalPrompts + p.totalObjections;
      return acc;
    },
    { filled: 0, total: 0 },
  );
  const pct = totals.total === 0 ? 0 : Math.round((totals.filled / totals.total) * 100);
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Script progress</span>
        <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
          {totals.filled}/{totals.total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-foreground transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
