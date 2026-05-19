"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface StatProps {
  label: string;
  value: string;
  delta?: number;            // percent vs compare period
  compareValue?: string;     // raw compare value to show under the stat
  icon: LucideIcon;
  hint?: string;
}

export function Stat({ label, value, delta, compareValue, icon: Icon, hint }: StatProps) {
  const hasDelta = typeof delta === "number";
  const direction = !hasDelta ? "neutral" : delta! > 0 ? "up" : delta! < 0 ? "down" : "neutral";

  return (
    <div className="group rounded-lg border bg-card p-4 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        {hasDelta ? <DeltaBadge value={delta!} direction={direction} /> : null}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px]">
        {compareValue !== undefined ? (
          <span className="font-mono tabular-nums text-muted-foreground/80">
            vs <span className="text-foreground/80">{compareValue}</span>
          </span>
        ) : hint ? (
          <span className="text-muted-foreground/80">{hint}</span>
        ) : <span />}
        {compareValue !== undefined && hint ? (
          <span className="truncate text-muted-foreground/60">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

function DeltaBadge({ value, direction }: { value: number; direction: "up" | "down" | "neutral" }) {
  const tone =
    direction === "up"   ? "text-emerald-600 dark:text-emerald-400" :
    direction === "down" ? "text-rose-600 dark:text-rose-400" :
    "text-muted-foreground";
  const Icon = direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded font-mono text-[10px] font-medium tabular-nums",
        tone
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {Math.abs(Math.round(value))}%
    </span>
  );
}

export function moneyStat(value: number, delta?: number) {
  return { value: formatCurrency(value, { compact: true }), delta };
}

/**
 * Hero stat for the dashboard — same shell as the standard `Stat` so it fits
 * cleanly in a 5-column row, but with the number sized up and a soft accent
 * ring so it reads as the headline metric.
 */
export function HeroStat({
  label, value, delta, secondary, icon: Icon, className,
}: {
  label: string;
  value: string;
  delta?: number;
  secondary?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const hasDelta = typeof delta === "number";
  const direction = !hasDelta ? "neutral" : delta! > 0 ? "up" : delta! < 0 ? "down" : "neutral";
  return (
    <div className={cn("rounded-lg border bg-card p-4 transition-colors", className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </span>
        {Icon ? <Icon className="h-3.5 w-3.5 text-foreground/70" /> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        {hasDelta ? <DeltaBadge value={delta!} direction={direction} /> : null}
      </div>
      {secondary ? (
        <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{secondary}</div>
      ) : null}
    </div>
  );
}
