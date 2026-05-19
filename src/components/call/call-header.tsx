"use client";

import * as React from "react";
import Link from "next/link";
import { X, Play, Pause, FileText } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StageChip } from "@/components/stage-chip";
import { cn, initials } from "@/lib/utils";
import { useCompany } from "@/lib/store";
import type { Lead, Deal } from "@/lib/types";
import type { SalesScript } from "@/lib/constants";

export interface TimerState {
  running: boolean;
  accumulatedMs: number;
  runStartedAt: number | null;
}

export function CallHeader({
  lead,
  deal,
  scripts,
  activeScript,
  onScriptChange,
  timer,
  onToggleTimer,
  onExit,
}: {
  lead: Lead;
  deal: Deal | null;
  scripts: SalesScript[];
  activeScript: SalesScript;
  onScriptChange: (id: string) => void;
  timer: TimerState;
  onToggleTimer: () => void;
  onExit: () => void;
}) {
  const company = useCompany(lead.company_id);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card/40 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/30 sm:h-16 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
          <AvatarFallback className="bg-foreground text-[11px] font-semibold text-background">
            {initials(lead.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/leads/${lead.id}`}
              className="truncate text-[13px] font-semibold tracking-tight hover:underline sm:text-[14px]"
            >
              {lead.name}
            </Link>
            {/* Stage chip drops on mobile to save horizontal room — the
                lead's stage is visible on its detail page anyway. */}
            {deal?.stage ? (
              <span className="hidden sm:inline-flex">
                <StageChip stage={deal.stage} />
              </span>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {company?.name ?? lead.email ?? "—"}
          </div>
        </div>
      </div>

      <div className="hidden h-6 w-px bg-border md:block" />

      <div className="hidden items-center gap-2 md:flex">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={activeScript.id} onValueChange={onScriptChange}>
          <SelectTrigger className="h-8 w-[200px] text-[12px]">
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

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Timer timer={timer} onToggle={onToggleTimer} />
        <Button variant="ghost" size="icon-sm" onClick={onExit} aria-label="Exit call">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

function Timer({ timer, onToggle }: { timer: TimerState; onToggle: () => void }) {
  // Drive a re-render every second while running so the displayed elapsed
  // ticks up. State lives in the parent so saving the call activity can
  // read the same value.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!timer.running) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer.running]);

  const elapsedMs =
    timer.accumulatedMs +
    (timer.running && timer.runStartedAt ? Date.now() - timer.runStartedAt : 0);
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const mm = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const ss = (totalSec % 60).toString().padStart(2, "0");

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 font-mono text-[12px] tabular-nums transition-colors",
        "hover:bg-accent",
        timer.running
          ? "border-emerald-500/40 text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
      title={timer.running ? "Pause call timer" : elapsedMs > 0 ? "Resume call timer" : "Start call timer"}
      aria-label={timer.running ? "Pause timer" : "Start timer"}
      suppressHydrationWarning
    >
      {timer.running ? (
        <Pause className="h-3 w-3 text-emerald-600 dark:text-emerald-400" fill="currentColor" />
      ) : (
        <Play
          className={cn(
            "h-3 w-3",
            elapsedMs > 0 ? "text-foreground" : "text-muted-foreground",
          )}
          fill="currentColor"
        />
      )}
      {mm}:{ss}
    </button>
  );
}
