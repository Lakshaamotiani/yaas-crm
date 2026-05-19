"use client";

import * as React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { LeadOverview } from "@/lib/types";
import type { Range } from "./date-range";
import { formatCurrency } from "@/lib/utils";

interface DataPoint {
  date: string;
  cumulative: number;
  compareCumulative?: number;
}

interface Props {
  leads: LeadOverview[];
  from: Date;
  to: Date;
  compare?: { from: Date; to: Date } | null;
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildSeries(leads: LeadOverview[], from: Date, to: Date): DataPoint[] {
  const wonLeads = leads.filter((l) => l.closed_at && l.deal_stage === "closed_won");
  const revOnDay = new Map<string, number>();
  for (const l of wonLeads) {
    const key = dayKey(new Date(l.closed_at!));
    // Overall revenue per closed deal: annualised MRR + one-time. This is
    // the full contract value attributable to the day it was won.
    const rev = (l.value_mrr ?? 0) * 12 + (l.value_one_time ?? 0);
    revOnDay.set(key, (revOnDay.get(key) ?? 0) + rev);
  }
  const days = eachDay(from, to);
  let running = 0;
  return days.map((d) => {
    running += revOnDay.get(dayKey(d)) ?? 0;
    return {
      date: d.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      cumulative: running,
    };
  });
}

export function EditorsOverTimeChart({ leads, from, to, compare }: Props) {
  const series = React.useMemo(() => buildSeries(leads, from, to), [leads, from, to]);
  const compareSeries = React.useMemo(
    () => (compare ? buildSeries(leads, compare.from, compare.to) : null),
    [leads, compare],
  );

  const data: DataPoint[] = series.map((pt, i) => ({
    ...pt,
    compareCumulative: compareSeries?.[i]?.cumulative,
  }));

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-[13px] font-semibold tracking-tight">Overall revenue closed over time</h3>
        <p className="text-[12px] text-muted-foreground">
          Cumulative revenue from closed-won deals (annualised MRR + one-time)
          {compare ? " · comparing" : ""}
        </p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
            width={60}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatCurrency(value, { compact: true }),
              name === "cumulative" ? "Revenue closed" : "Compare: Revenue closed",
            ]}
          />
          {compare && <Legend />}
          <Area
            type="monotone"
            dataKey="cumulative"
            name="Revenue closed"
            stroke="hsl(var(--primary))"
            fill="url(#mrrGrad)"
            strokeWidth={2}
            dot={false}
          />
          {compare && (
            <Area
              type="monotone"
              dataKey="compareCumulative"
              name="Compare: Revenue closed"
              stroke="hsl(var(--muted-foreground))"
              fill="none"
              strokeDasharray="4 2"
              strokeWidth={1.5}
              dot={false}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
