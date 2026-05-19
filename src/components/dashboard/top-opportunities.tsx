"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StageChip } from "@/components/stage-chip";
import { cn, formatMoney, initials } from "@/lib/utils";
import type { LeadOverview } from "@/lib/types";
import { useStageRoles } from "@/lib/store";

/**
 * Top open opportunities — surfaces the deals worth most owner attention.
 * Ranked by deal value (MRR).
 * Open stages only.
 */
export function TopOpportunities({
  leads, limit = 5,
}: {
  leads: LeadOverview[];
  limit?: number;
}) {
  const { isOpen } = useStageRoles();
  const rows = React.useMemo(() => {
    return leads
      .filter((l) => isOpen(l.deal_stage))
      .map((l) => ({
        lead: l,
        score: l.value_mrr ?? 0,
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }, [leads, limit, isOpen]);

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">Top open opportunities</h3>
          <p className="text-[11px] text-muted-foreground">
            Ranked by editors × MRR
          </p>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {rows.length} of {leads.filter((l) => isOpen(l.deal_stage)).length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center px-4 py-8 text-center text-[12px] text-muted-foreground">
          No open opportunities with editors + MRR yet.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map(({ lead }) => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-2.5 hover:bg-accent/40"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {initials(lead.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium tracking-tight">
                      {lead.name}
                    </span>
                    {lead.deal_stage ? <StageChip stage={lead.deal_stage} /> : null}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {lead.company?.name ?? "—"}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground/80">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  {/* editors_needed removed */}
                </span>
                <span className={cn(
                  "font-mono text-[12px] tabular-nums text-foreground",
                  !lead.value_mrr && "text-muted-foreground",
                )}>
                  {lead.value_mrr
                    ? `${formatMoney(lead.value_mrr, lead.value_currency, { compact: true })}/mo`
                    : "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
