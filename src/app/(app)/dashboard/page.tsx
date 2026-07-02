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
import { useOverview, useStageRoles, useProfiles } from "@/lib/store";
import { formatCurrency, formatDate, initials } from "@/lib/utils";

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

        {/* Monthly closures table */}
        <MonthlyClosures leads={leads} from={range.from} to={range.to} roles={roles} />

        {/* Today's tasks — full-width since Open Opportunities was removed */}
        <div className="grid grid-cols-1 gap-3">
          <TodaysTasks />
        </div>
      </div>
    </div>
  );
}

// ---------- monthly closures table ----------

function MonthlyClosures({
  leads, from, to, roles,
}: {
  leads: ReturnType<typeof useOverview>;
  from: Date; to: Date;
  roles: StageRoles;
}) {
  const profiles = useProfiles();
  const profileMap = React.useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name ?? p.email ?? "—"])),
    [profiles],
  );

  const closed = leads.filter(
    (l) => roles.isWon(l.deal_stage) && l.closed_at &&
      withinRange(new Date(l.closed_at), from, to),
  );

  if (closed.length === 0) return null;

  const totalOneTime = closed.reduce((s, l) => s + (l.value_one_time ?? 0), 0);
  const totalRetainerAnnual = closed.reduce((s, l) => s + (l.value_mrr ?? 0) * 12, 0);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b">
        <h3 className="text-[13px] font-semibold tracking-tight">Closures this period</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {formatDate(from, "medium")} — {formatDate(to, "medium")}
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Brand</th>
              <th className="px-4 py-2 text-left font-medium">Owner</th>
              <th className="px-4 py-2 text-left font-medium">Type</th>
              <th className="px-4 py-2 text-right font-medium">Deal Value</th>
              <th className="px-4 py-2 text-right font-medium">Annualised</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {closed.map((l) => {
              const isRetainer = (l.value_mrr ?? 0) > 0;
              const dealValue = isRetainer
                ? `${formatCurrency(l.value_mrr ?? 0, { compact: true })}/mo`
                : formatCurrency(l.value_one_time ?? 0, { compact: true });
              const annualised = isRetainer
                ? formatCurrency((l.value_mrr ?? 0) * 12, { compact: true })
                : "—";
              const owner = l.owner_id ? (profileMap.get(l.owner_id) ?? "—") : "—";
              const brand = l.company?.name ?? l.name;
              return (
                <tr key={l.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5 font-medium">{brand}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{owner}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      isRetainer
                        ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                        : "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                    }`}>
                      {isRetainer ? "Retainer" : "One-time"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{dealValue}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{annualised}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t bg-muted/20 text-[11px] font-semibold">
            {totalOneTime > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-muted-foreground">Total One-Time Closed</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(totalOneTime, { compact: true })}</td>
                <td className="px-4 py-2 text-right text-muted-foreground">—</td>
              </tr>
            )}
            {totalRetainerAnnual > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-muted-foreground">Total Retainers Closed (Annualised)</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">—</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(totalRetainerAnnual, { compact: true })}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      {/* Mobile card stack */}
      <ul className="divide-y md:hidden">
        {closed.map((l) => {
          const isRetainer = (l.value_mrr ?? 0) > 0;
          const dealValue = isRetainer
            ? `${formatCurrency(l.value_mrr ?? 0, { compact: true })}/mo`
            : formatCurrency(l.value_one_time ?? 0, { compact: true });
          const annualised = isRetainer ? formatCurrency((l.value_mrr ?? 0) * 12, { compact: true }) : null;
          const owner = l.owner_id ? (profileMap.get(l.owner_id) ?? "—") : "—";
          const brand = l.company?.name ?? l.name;
          return (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border bg-muted text-[10px] font-semibold">
                {initials(brand)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{brand}</span>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums">{dealValue}</span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{owner} · {isRetainer ? "Retainer" : "One-time"}</span>
                  {annualised && <span className="text-[11px] text-muted-foreground">{annualised}/yr</span>}
                </div>
              </div>
            </li>
          );
        })}
        <li className="px-4 py-3 bg-muted/20 space-y-1">
          {totalOneTime > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">One-time total</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalOneTime, { compact: true })}</span>
            </div>
          )}
          {totalRetainerAnnual > 0 && (
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">Retainers annualised</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalRetainerAnnual, { compact: true })}</span>
            </div>
          )}
        </li>
      </ul>
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
