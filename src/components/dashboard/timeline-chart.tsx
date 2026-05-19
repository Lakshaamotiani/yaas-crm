"use client";

import * as React from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import type { Lead, Deal } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Point {
  date: string;          // day key for current period
  bucket: number;        // 0-based offset from start of current period
  leads: number;
  closes: number;
  compareLeads?: number; // aligned by bucket offset
  compareCloses?: number;
  compareDate?: string;
}

export function TimelineChart({
  leads, deals, from, to, compare,
}: {
  leads: Lead[];
  deals: Deal[];
  from: Date;
  to: Date;
  compare?: { from: Date; to: Date } | null;
}) {
  const data: Point[] = React.useMemo(() => {
    const days: Point[] = [];
    const start = startOfDay(from);
    const end = startOfDay(to);
    const cStart = compare ? startOfDay(compare.from) : null;

    let bucket = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      const point: Point = {
        date: k,
        bucket,
        leads: leads.filter((l) => l.created_at.slice(0, 10) === k).length,
        closes: deals.filter((dl) => dl.closed_at && dl.closed_at.slice(0, 10) === k).length,
      };

      if (cStart) {
        const cd = new Date(cStart);
        cd.setDate(cd.getDate() + bucket);
        if (cd <= startOfDay(compare!.to)) {
          const ck = cd.toISOString().slice(0, 10);
          point.compareDate = ck;
          point.compareLeads = leads.filter((l) => l.created_at.slice(0, 10) === ck).length;
          point.compareCloses = deals.filter((dl) => dl.closed_at && dl.closed_at.slice(0, 10) === ck).length;
        }
      }

      days.push(point);
      bucket++;
    }
    return days;
  }, [leads, deals, from, to, compare]);

  const showCompare = Boolean(compare);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-[13px] font-semibold tracking-tight">New leads & closes</h3>
          <p className="text-[11px] text-muted-foreground">
            {data.length} day{data.length === 1 ? "" : "s"} in range
            {showCompare ? <span className="ml-1">· comparing</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <Legend variant="solid"  tone="bg-foreground" label="New leads" />
          <Legend variant="solid"  tone="bg-emerald-500" label="Closed won" />
          {showCompare ? (
            <>
              <span className="mx-1 h-3 w-px bg-border" />
              <Legend variant="dashed" tone="bg-foreground/40" label="Compare: leads" />
              <Legend variant="dashed" tone="bg-emerald-500/50" label="Compare: closes" />
            </>
          ) : null}
        </div>
      </div>
      <div className="h-[240px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 18, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="leadFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.28} />
                <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => formatDate(v, "short")}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={28}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                color: "hsl(var(--popover-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 11,
                padding: "6px 8px",
              }}
              labelFormatter={(label) => formatDate(label, "long")}
            />
            <Area
              type="monotone"
              dataKey="leads"
              name="New leads"
              stroke="hsl(var(--foreground))"
              strokeWidth={1.5}
              fill="url(#leadFill)"
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="closes"
              name="Closed won"
              stroke="#10b981"
              strokeWidth={1.5}
              fill="url(#closeFill)"
              dot={false}
            />
            {showCompare ? (
              <>
                <Line
                  type="monotone"
                  dataKey="compareLeads"
                  name="Compare: leads"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="compareCloses"
                  name="Compare: closes"
                  stroke="#10b981"
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
                  strokeOpacity={0.5}
                  dot={false}
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ tone, label, variant }: { tone: string; label: string; variant: "solid" | "dashed" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {variant === "solid" ? (
        <span className={`h-2 w-2 rounded-full ${tone}`} />
      ) : (
        <span className={`h-px w-3 border-t border-dashed ${tone.replace("bg-", "border-")}`} />
      )}
      {label}
    </span>
  );
}

function startOfDay(d: Date) {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}
