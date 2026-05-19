"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StageChip } from "@/components/stage-chip";
import { Badge } from "@/components/ui/badge";
import { cn, initials, formatMoney, relativeTime } from "@/lib/utils";
import type { LeadOverview } from "@/lib/types";
import { BulkActionBar } from "./bulk-action-bar";

export function ListView({ leads }: { leads: LeadOverview[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Drop ids that are no longer in the (possibly re-filtered) list so the
  // bulk bar count stays honest.
  React.useEffect(() => {
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(leads.map((l) => l.id));
      const next = new Set<string>();
      for (const id of prev) if (present.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [leads]);

  const allSelected = leads.length > 0 && selected.size === leads.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) =>
      prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)),
    );
  }
  const clear = React.useCallback(() => setSelected(new Set()), []);
  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  return (
    <div className="px-4 pb-24 sm:px-6">
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <Th className="w-9">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 cursor-pointer accent-foreground"
                  />
                </Th>
                <Th className="w-[28%]">Lead</Th>
                <Th>Stage</Th>
                <Th>MRR</Th>
                <Th>Fit</Th>
                <Th>Tags</Th>
                <Th className="text-right">Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {leads.map((l) => {
                const isSel = selected.has(l.id);
                return (
                  <tr
                    key={l.id}
                    className={cn("group hover:bg-accent/40", isSel && "bg-accent/30")}
                  >
                    <Td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${l.name}`}
                        checked={isSel}
                        onChange={() => toggle(l.id)}
                        className="h-3.5 w-3.5 cursor-pointer accent-foreground"
                      />
                    </Td>
                    <Td>
                      <Link href={`/leads/${l.id}`} className="flex items-center gap-2.5">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="bg-muted text-[10px]">{initials(l.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium tracking-tight">{l.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {l.company?.name ?? l.email ?? "—"}
                          </div>
                        </div>
                      </Link>
                    </Td>
                    <Td>{l.deal_stage ? <StageChip stage={l.deal_stage} /> : "—"}</Td>
                    <Td>
                      <span className="font-mono text-xs">
                        {l.value_mrr && l.value_mrr > 0 ? formatMoney(l.value_mrr, l.value_currency) : "—"}
                      </span>
                    </Td>
                    <Td>
                      <FitBadge score={l.fit_score} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {l.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-right text-xs text-muted-foreground">
                      <span suppressHydrationWarning>{relativeTime(l.updated_at)}</span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {leads.length === 0 ? (
          <div className="grid place-items-center py-16 text-sm text-muted-foreground">
            No leads match your filters.
          </div>
        ) : null}
      </div>

      {/* Mobile card stack — tap a card to open; tap the checkbox to select */}
      <ul className="divide-y rounded-lg border bg-card md:hidden">
        {leads.length === 0 ? (
          <li className="px-4 py-12 text-center text-sm text-muted-foreground">
            No leads match your filters.
          </li>
        ) : (
          leads.map((l) => {
            const isSel = selected.has(l.id);
            return (
              <li key={l.id} className={cn("flex items-stretch", isSel && "bg-accent/30")}>
                <label className="flex shrink-0 items-center pl-3.5 pr-1">
                  <input
                    type="checkbox"
                    aria-label={`Select ${l.name}`}
                    checked={isSel}
                    onChange={() => toggle(l.id)}
                    className="h-4 w-4 cursor-pointer accent-foreground"
                  />
                </label>
                <Link href={`/leads/${l.id}`} className="block min-w-0 flex-1 py-3 pl-1.5 pr-3.5 active:bg-accent">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-[10px]">{initials(l.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-medium tracking-tight">{l.name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {l.company?.name ?? l.email ?? "—"}
                          </div>
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground" suppressHydrationWarning>
                          {relativeTime(l.updated_at)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {l.deal_stage ? <StageChip stage={l.deal_stage} /> : null}
                        {l.value_mrr && l.value_mrr > 0 ? (
                          <span className="font-mono text-[11px] tabular-nums text-foreground/80">
                            {formatMoney(l.value_mrr, l.value_currency)}
                          </span>
                        ) : null}
                        <FitBadge score={l.fit_score} />
                        {l.tags.slice(0, 2).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">
                            {t}
                          </Badge>
                        ))}
                        {l.tags.length > 2 ? (
                          <span className="text-[10px] text-muted-foreground">+{l.tags.length - 2}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })
        )}
      </ul>

      <BulkActionBar selectedIds={selectedIds} onClear={clear} />
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2 text-left font-medium", className)}>{children}</th>;
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>;
}

function FitBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const dot =
    score >= 80 ? "bg-stage-won"
    : score >= 60 ? "bg-stage-proposal"
    : "bg-stage-new";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/80">
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {score}
    </span>
  );
}
