"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ExternalLink, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useActions, useOverview, useAllPendingTasks, useStoreActivities } from "@/lib/store";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

const RECENT_COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

export default function TasksPage() {
  const pending = useAllPendingTasks();
  const allActivities = useStoreActivities();
  const leads = useOverview();
  const actions = useActions();
  const [showCompleted, setShowCompleted] = React.useState(false);

  // Recently completed tasks — shown when the user toggles the filter so a
  // task ticked off by mistake is recoverable beyond the toast's 6-second
  // window. 24h cutoff keeps the list focused on this-shift work.
  const recentlyCompleted = React.useMemo(() => {
    const cutoff = Date.now() - RECENT_COMPLETED_WINDOW_MS;
    return allActivities
      .filter(
        (a) =>
          a.type === "task" &&
          a.status === "completed" &&
          a.completed_at &&
          +new Date(a.completed_at) >= cutoff,
      )
      .sort((a, b) => +new Date(b.completed_at!) - +new Date(a.completed_at!));
  }, [allActivities]);

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Tasks"
        subtitle={`${pending.length} pending${recentlyCompleted.length > 0 ? ` · ${recentlyCompleted.length} done today` : ""}`}
        actions={
          recentlyCompleted.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCompleted((s) => !s)}
            >
              {showCompleted ? "Hide completed" : `Show ${recentlyCompleted.length} completed`}
            </Button>
          ) : null
        }
      />

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        <section className="space-y-2">
          <div className="overflow-hidden rounded-lg border bg-card">
            <ul className="divide-y">
              {pending.length === 0 ? (
                <li className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Nothing on your plate.
                </li>
              ) : (
                pending.map((t) => {
                  const lead = leads.find((l) => l.id === t.lead_id);
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => actions.completeActivity(t.id)}
                        className="-my-1 -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
                        aria-label="Mark task done"
                      >
                        <Circle className="h-4 w-4 group-hover:hidden" />
                        <CheckCircle2 className="hidden h-4 w-4 text-foreground group-hover:block" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm">{t.title ?? "Task"}</span>
                          {t.due_at ? (
                            <span
                              suppressHydrationWarning
                              className={cn(
                                "rounded px-1 py-0.5 text-[10px]",
                                new Date(t.due_at) < new Date()
                                  ? "bg-stage-lost/10 text-stage-lost"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              Due {formatDateTime(t.due_at)}
                            </span>
                          ) : (
                            <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                              No due date
                            </span>
                          )}
                        </div>
                        {t.body ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{t.body}</p>
                        ) : null}
                        {lead ? (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {lead.name} <ExternalLink className="h-2.5 w-2.5" />
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
        </section>

        {showCompleted && recentlyCompleted.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                Completed today
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Click Undo to bring a task back to pending.
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <ul className="divide-y">
                {recentlyCompleted.map((t) => {
                  const lead = leads.find((l) => l.id === t.lead_id);
                  return (
                    <li key={t.id} className="group flex items-center gap-3 px-4 py-3 opacity-70">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm line-through">{t.title ?? "Task"}</span>
                          <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                            Done {relativeTime(t.completed_at!)}
                          </span>
                        </div>
                        {lead ? (
                          <Link
                            href={`/leads/${lead.id}`}
                            className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            {lead.name} <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          actions.uncompleteActivity(t.id)
                        }
                      >
                        <Undo2 className="h-3 w-3" /> Undo
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
