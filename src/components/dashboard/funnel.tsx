"use client";

import { cn, formatCurrency } from "@/lib/utils";
import type { LeadOverview } from "@/lib/types";
import { usePipelineStages } from "@/lib/store";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";

/**
 * Pipeline health funnel for YAAS Sales CRM.
 * Bar magnitude = MRR in that stage.
 */
export function PipelineFunnel({
  leads,
  compareLeads,
}: {
  leads: LeadOverview[];
  compareLeads?: LeadOverview[];
}) {
  const allStages = usePipelineStages();
  const funnelStages = allStages.filter((s) => s.kind !== "lost");

  const bucketize = (xs: LeadOverview[]) =>
    funnelStages.map((stage) => {
      const inStage = xs.filter((l) => l.deal_stage === stage.id);
      return {
        stage: stage.id,
        label: stage.label,
        count: inStage.length,
        mrr: inStage.reduce((s, l) => s + (l.value_mrr ?? 0), 0),
      };
    });

  const buckets = bucketize(leads);
  const compareBuckets = compareLeads ? bucketize(compareLeads) : null;
  const maxMrr = Math.max(1, ...buckets.map((b) => b.mrr));

  const gridCols = compareBuckets
    ? "grid-cols-[120px_minmax(0,1fr)_80px_80px_56px]"
    : "grid-cols-[120px_minmax(0,1fr)_80px_80px]";

  const deltaPct = (cur: number, prev: number) =>
    prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight">Pipeline health</h3>
        <p className="text-[12px] text-muted-foreground">
          Bar = MRR in stage{compareLeads ? " · comparing" : ""}
        </p>
      </div>

      <div className={cn("grid gap-y-2 text-[12px]", gridCols)}>
        {/* Header */}
        <span className="text-muted-foreground font-medium">Stage</span>
        <span />
        <span className="text-right text-muted-foreground font-medium">MRR</span>
        <span className="text-right text-muted-foreground font-medium">Deals</span>
        {compareBuckets && <span />}

        {buckets.map((b, i) => {
          const cmp = compareBuckets?.[i];
          const widthPct = b.mrr === 0 ? 0 : Math.max(3, Math.round((b.mrr / maxMrr) * 100));
          const dlt = cmp ? deltaPct(b.mrr, cmp.mrr) : null;

          return (
            <React.Fragment key={b.stage}>
              <span className="truncate text-foreground pr-2 self-center">{b.label}</span>

              {/* Bar */}
              <div className="flex items-center pr-3">
                <div className="h-2 rounded-full bg-muted w-full">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>

              <span className="text-right tabular-nums self-center font-medium">
                {formatCurrency(b.mrr, { compact: true })}
              </span>
              <span className="text-right tabular-nums self-center text-muted-foreground">
                {b.count} deal{b.count === 1 ? "" : "s"}
              </span>

              {compareBuckets && (
                <span className="text-right tabular-nums self-center pl-2">
                  {dlt === null ? (
                    <Minus className="inline h-3 w-3 text-muted-foreground" />
                  ) : dlt > 0 ? (
                    <span className="text-green-500 flex items-center justify-end gap-0.5">
                      <ArrowUp className="h-3 w-3" />{dlt}%
                    </span>
                  ) : dlt < 0 ? (
                    <span className="text-red-500 flex items-center justify-end gap-0.5">
                      <ArrowDown className="h-3 w-3" />{Math.abs(dlt)}%
                    </span>
                  ) : (
                    <Minus className="inline h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

import * as React from "react";
