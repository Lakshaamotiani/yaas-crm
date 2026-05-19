"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SalesScript } from "@/lib/constants";
import { sectionProgress } from "@/lib/script-runtime";

export function SectionNav({
  script,
  activeId,
  captures,
  promptDone,
  objectionHandled,
  onJump,
}: {
  script: SalesScript;
  activeId: string;
  captures: Record<string, unknown>;
  promptDone: Record<string, boolean>;
  objectionHandled: Record<string, boolean>;
  onJump: (id: string) => void;
}) {
  return (
    <nav className="space-y-1">
      <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Sections
      </div>
      {script.sections.map((s, idx) => {
        const progress = sectionProgress(s.blocks, captures, promptDone, objectionHandled);
        const active = activeId === s.id;
        const totalTrackable = progress.totalFields + progress.totalPrompts + progress.totalObjections;
        const filled = progress.pct >= 100 && totalTrackable > 0;
        return (
          <button
            key={s.id}
            onClick={() => onJump(s.id)}
            className={cn(
              "group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
              {filled ? (
                <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-2.5 w-2.5" />
                </span>
              ) : (
                <Circle
                  className={cn(
                    "h-3 w-3",
                    active ? "text-foreground" : "text-muted-foreground/40",
                  )}
                />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[12px] font-medium">{s.heading}</span>
                {s.minutes ? (
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {s.minutes}m
                  </span>
                ) : null}
              </div>
              {totalTrackable > 0 ? (
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full transition-all",
                        filled ? "bg-emerald-500/70" : "bg-foreground/60",
                      )}
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {progress.pct}%
                  </span>
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </nav>
  );
}
