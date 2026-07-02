"use client";

import * as React from "react";
import {
  Trophy, TrendingUp, CheckCircle2, KanbanSquare, Layers,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DateRangePicker, rangeFor, compareWindow, type Range } from "@/components/dashboard/date-range";
import { Stat, HeroStat } from "@/components/dashboard/stats-cards";
import { PipelineFunnel } from "@/components/dashboard/funnel";
import { EditorsOverTimeChart } from "@/components/dashboard/editors-chart";
import { TodaysTasks } from "@/components/dashboard/todays-tasks";
import { useOverview, useStageRoles } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

/** Won/lost/open classification, keyed off each stage's semantic `kind`. */
type StageRoles = Pick<ReturnType<typeof useStageRoles>, "isWon" | "isLost" | "isOpen">;

export default function DashboardPage() {
  const leads = useOverview();
  const { isWon, isLost, isOpen } = useStageRoles();
  const [range, setRange] = React.useState<Range>(() => rangeFor("month"));

  const cw = compareWindow(range);

  const roles: StageRoles = { isWon, isLost, isOpen };
  const m = computeMetrics(leads, range.from, range.to, roles);
  const cm = cw ? computeMetrics(leads, cw.from, cw.to, roles) : null;

  const delta = (cur: number, prev: number | undefined | null) => {
    if (prev == null) return undefined;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Dashboard"
        subtitle={
          <span suppressHydrationWarning>
            <span className="tabular-nums">{formatDate(range.from, "medium")}</span>
            <span className="px-1.5 text-muted-foreground/60">→</span>
            <span className="tabular-nums">{formatDate(range.to, "medium")}</span>
          </span>
        }
        actions={<DateRangePicker value={range} onChange={setRange} />}
      />

      <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
        {/* KPI row — ARR is the hero. Five supporting stats: MRR,
            total revenue projected, deals closed, deals in pipeline, win
            rate. On lg screens all six sit in one row; on md it wraps. */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <HeroStat
            className="col-span-2 md:col-span-1"
            label="Total Revenue Closed"
            value={formatCurrency(m.arr, { compact: true })}
            delta={delta(m.arr, cm?.arr)}
            icon={Trophy}
            secondary={<span>MRR ×12 + one-time</span>}
          />
          <Stat
            label="MRR"
            value={formatCurrency(m.closedMrr, { compact: true })}
            delta={delta(m.closedMrr, cm?.closedMrr)}
            compareValue={cm ? formatCurrency(cm.closedMrr, { compact: true }) : undefined}
            icon={Trophy}
            hint="closed-won monthly"
          />
          <Stat
            label="Total Revenue Projected"
            value={formatCurrency(m.pipelineMrr, { compact: true })}
            delta={delta(m.pipelineMrr, cm?.pipelineMrr)}
            compareValue={cm ? formatCurrency(cm.pipelineMrr, { compact: true }) : undefined}
            icon={TrendingUp}
            hint="open pipeline MRR + one-time"
          />
          <Stat
            label="Deals Closed"
            value={m.closedCount.toString()}
            delta={delta(m.closedCount, cm?.closedCount)}
            compareValue={cm ? cm.closedCount.toString() : undefined}
            icon={CheckCircle2}
            hint="closed-won in range"
          />
          <Stat
            label="Deals in Pipeline"
            value={m.openDeals.toString()}
            delta={delta(m.openDeals, cm?.openDeals)}
            compareValue={cm ? cm.openDeals.toString() : undefined}
            icon={KanbanSquare}
            hint="open stages"
          />
          <Stat
            label="Win Rate"
            value={`${m.winRate}%`}
            delta={delta(m.winRate, cm?.winRate)}
            compareValue={cm ? `${cm.winRate}%` : undefined}
            icon={Layers}
            hint={`${m.closedCount} won · ${m.lostCount} lost`}
          />
        </div>

        {/* Charts row — revenue closed over time + pipeline funnel */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <EditorsOverTimeChart
            leads={leads}
            from={range.from}
            to={range.to}
            compare={cw}
          />
          <PipelineFunnel
            leads={leads.filter((l) => withinRange(new Date(l.created_at), range.from, range.to))}
            compareLeads={
              cw
                ? leads.filter((l) => withinRange(new Date(l.created_at), cw.from, cw.to))
                : undefined
            }
          />
        </div>

        {/* Today's tasks — full-width since Open Opportunities was removed */}
        <div className="grid grid-cols-1 gap-3">
          <TodaysTasks />
        </div>
      </div>
    </div>
  );
}

// ---------- metrics ----------

function withinRange(t: Date, from: Date, to: Date) {
  return t >= from && t <= to;
}

interface DashboardMetrics {
  /** Annualised MRR + one-time payments from closed-won deals in range. */
  arr: number;
  closedMrr: number;
  closedOneTime: number;
  /** MRR + one-time from deals currently in open-kind stages. */
  pipelineMrr: number;
  closedCount: number;
  lostCount: number;
  openDeals: number;
  winRate: number;
}

function computeMetrics(
  allLeads: ReturnType<typeof useOverview>,
  from: Date,
  to: Date,
  roles: StageRoles,
): DashboardMetrics {
  const closedInRange = allLeads.filter(
    (l) => roles.isWon(l.deal_stage) && l.closed_at &&
      withinRange(new Date(l.closed_at), from, to),
  );
  const lostInRange = allLeads.filter(
    (l) => roles.isLost(l.deal_stage) && l.closed_at &&
      withinRange(new Date(l.closed_at), from, to),
  );

  const closedMrr = closedInRange.reduce((s, l) => s + (l.value_mrr ?? 0), 0);
  const closedOneTime = closedInRange.reduce((s, l) => s + (l.value_one_time ?? 0), 0);
  const arr = closedMrr * 12 + closedOneTime;
  const closedCount = closedInRange.length;
  const lostCount = lostInRange.length;

  const openLeads = allLeads.filter((l) => roles.isOpen(l.deal_stage));
  const pipelineMrr = openLeads.reduce(
    (s, l) => s + (l.value_mrr ?? 0) + (l.value_one_time ?? 0), 0,
  );
  const openDeals = openLeads.length;

  const totalClosed = closedCount + lostCount;
  const winRate = totalClosed === 0 ? 0 : Math.round((closedCount / totalClosed) * 100);

  return {
    arr,
    closedMrr,
    closedOneTime,
    pipelineMrr,
    closedCount,
    lostCount,
    openDeals,
    winRate,
  };
}
