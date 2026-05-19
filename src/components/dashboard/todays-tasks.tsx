"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActions, useTodaysTasks, useOverview } from "@/lib/store";
import { cn, relativeTime } from "@/lib/utils";

export function TodaysTasks() {
  const tasks = useTodaysTasks();
  const leads = useOverview();
  const actions = useActions();

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">Today's tasks</h3>
          <p className="text-[11px] text-muted-foreground">
            {tasks.length} due in the next 24h
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs">
          <Link href="/tasks">View all</Link>
        </Button>
      </div>
      <ul className="divide-y">
        {tasks.length === 0 ? (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">
            All clear — no pending tasks.
          </li>
        ) : (
          tasks.map((t) => {
            const lead = leads.find((l) => l.id === t.lead_id);
            return (
              <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                <button
                  onClick={() => actions.completeActivity(t.id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Complete task"
                >
                  <Circle className="h-4 w-4 group-hover:hidden" />
                  <CheckCircle2 className="hidden h-4 w-4 text-foreground group-hover:block" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm">{t.title ?? "Task"}</span>
                    <span
                      suppressHydrationWarning
                      className={cn(
                        "rounded px-1 py-0.5 text-[10px]",
                        new Date(t.due_at!) < new Date()
                          ? "bg-stage-lost/10 text-stage-lost"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {dueLabel(t.due_at!)}
                    </span>
                  </div>
                  {lead ? (
                    <Link
                      href={`/leads/${lead.id}`}
                      className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <span className="truncate">{lead.name}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </Link>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                  {relativeTime(t.created_at)}
                </span>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function dueLabel(due: string) {
  const ms = +new Date(due) - Date.now();
  if (ms < 0) return "Overdue";
  const hrs = Math.round(ms / 3600000);
  if (hrs < 1) return "<1h";
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}
