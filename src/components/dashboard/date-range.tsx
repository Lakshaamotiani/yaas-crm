"use client";

import * as React from "react";
import { CalendarRange, GitCompareArrows, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";

export type RangePreset = "today" | "week" | "month" | "quarter" | "ytd" | "custom";
export type CompareMode = "none" | "previous" | "previous_year" | "custom";

export interface Range {
  from: Date;
  to: Date;
  preset: RangePreset;
  compare: {
    mode: CompareMode;
    from?: Date;
    to?: Date;
  };
}

const startOfDay = (d: Date) => { const n = new Date(d); n.setHours(0,0,0,0); return n; };
const endOfDay = (d: Date) => { const n = new Date(d); n.setHours(23,59,59,999); return n; };

export function rangeFor(
  preset: RangePreset,
  opts?: { custom?: { from: Date; to: Date }; compare?: Range["compare"] }
): Range {
  const now = new Date();
  let from: Date, to: Date;
  switch (preset) {
    case "today":
      from = startOfDay(now); to = endOfDay(now); break;
    case "week":
      from = startOfDay(now); from.setDate(from.getDate() - 6); to = endOfDay(now); break;
    case "month":
      from = startOfDay(now); from.setDate(from.getDate() - 29); to = endOfDay(now); break;
    case "quarter":
      from = startOfDay(now); from.setDate(from.getDate() - 89); to = endOfDay(now); break;
    case "ytd":
      from = startOfDay(new Date(now.getFullYear(), 0, 1)); to = endOfDay(now); break;
    case "custom":
      from = startOfDay(opts?.custom?.from ?? new Date(now.getFullYear(), now.getMonth(), 1));
      to = endOfDay(opts?.custom?.to ?? now);
      break;
  }
  return {
    preset,
    from,
    to,
    compare: opts?.compare ?? { mode: "previous" },
  };
}

/** Resolve the compare window from the main range. */
export function compareWindow(range: Range): { from: Date; to: Date } | null {
  const { compare, from, to } = range;
  const span = to.getTime() - from.getTime();
  switch (compare.mode) {
    case "none": return null;
    case "previous": {
      const pTo = new Date(from.getTime() - 1);
      const pFrom = new Date(pTo.getTime() - span);
      return { from: startOfDay(pFrom), to: endOfDay(pTo) };
    }
    case "previous_year": {
      const pFrom = new Date(from); pFrom.setFullYear(pFrom.getFullYear() - 1);
      const pTo = new Date(to); pTo.setFullYear(pTo.getFullYear() - 1);
      return { from: startOfDay(pFrom), to: endOfDay(pTo) };
    }
    case "custom":
      if (compare.from && compare.to) {
        return { from: startOfDay(compare.from), to: endOfDay(compare.to) };
      }
      return null;
  }
}

const PRESET_LABELS: Record<RangePreset, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  quarter: "Last 90 days",
  ytd: "Year to date",
  custom: "Custom",
};

const COMPARE_LABELS: Record<CompareMode, string> = {
  none:           "Off",
  previous:       "Previous period",
  previous_year:  "Previous year",
  custom:         "Custom",
};

export function DateRangePicker({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const [open, setOpen] = React.useState(false);
  // Which draft does the calendar edit when the user clicks dates?
  const [target, setTarget] = React.useState<"range" | "compare">("range");

  const [draftRange, setDraftRange] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from: value.from,
    to: value.to,
  });
  const [draftCompare, setDraftCompare] = React.useState<{ from: Date | undefined; to: Date | undefined }>({
    from: value.compare.from,
    to: value.compare.to,
  });

  React.useEffect(() => {
    if (open) {
      setDraftRange({ from: value.from, to: value.to });
      setDraftCompare({ from: value.compare.from, to: value.compare.to });
      setTarget(value.preset === "custom" ? "range" : "range");
    }
  }, [open, value]);

  function pickPreset(p: RangePreset) {
    if (p === "custom") {
      setTarget("range");
      return;
    }
    onChange(rangeFor(p, { compare: value.compare }));
    setOpen(false);
  }

  function pickCompare(m: CompareMode) {
    if (m === "custom") {
      setTarget("compare");
      return;
    }
    onChange({
      ...value,
      compare: { mode: m },
    });
    if (m === "none") setOpen(false);
  }

  function apply() {
    if (target === "range") {
      if (!draftRange.from || !draftRange.to) return;
      onChange(
        rangeFor("custom", {
          custom: { from: draftRange.from, to: draftRange.to },
          compare: value.compare,
        })
      );
    } else {
      if (!draftCompare.from || !draftCompare.to) return;
      onChange({
        ...value,
        compare: { mode: "custom", from: draftCompare.from, to: draftCompare.to },
      });
    }
    setOpen(false);
  }

  const cw = compareWindow(value);
  const calendarSelected = target === "range" ? draftRange : draftCompare;
  const calendarOnSelect = target === "range" ? setDraftRange : setDraftCompare;
  const canApply = target === "range"
    ? Boolean(draftRange.from && draftRange.to)
    : Boolean(draftCompare.from && draftCompare.to);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="text-xs font-medium tracking-tight">{PRESET_LABELS[value.preset]}</span>
            <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline" suppressHydrationWarning>
              {fmt(value.from)}–{fmt(value.to)}
            </span>
            {/* Inline comparison hint — visible on mobile too, so the user
                knows whether the dashboard numbers are showing deltas at a
                glance without opening the popover. The dedicated badge to
                the right is hidden on mobile to save space. */}
            {value.compare.mode !== "none" ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="text-muted-foreground/40">·</span>
                <GitCompareArrows className="h-2.5 w-2.5" />
                vs {value.compare.mode === "previous_year" ? "yr" : "prev"}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          collisionPadding={16}
          className="w-[540px] max-w-[calc(100vw-2rem)] overflow-hidden p-0"
        >
          {/* Range presets */}
          <PresetSection
            label="Range"
            options={(["today", "week", "month", "quarter", "ytd", "custom"] as RangePreset[]).map((p) => ({
              id: p,
              label: PRESET_LABELS[p],
            }))}
            activeId={value.preset}
            onPick={(id) => pickPreset(id as RangePreset)}
          />

          {/* Compare presets */}
          <PresetSection
            label="Compare"
            options={(["none", "previous", "previous_year", "custom"] as CompareMode[]).map((m) => ({
              id: m,
              label: COMPARE_LABELS[m],
            }))}
            activeId={value.compare.mode}
            onPick={(id) => pickCompare(id as CompareMode)}
          />

          {/* Calendar */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {target === "range" ? "Select range" : "Compare window"}
                </span>
                <CalendarTargetSwitch
                  target={target}
                  setTarget={setTarget}
                  showCompare={value.compare.mode === "custom"}
                />
              </div>
              <span className="font-mono tabular-nums text-muted-foreground" suppressHydrationWarning>
                {calendarSelected.from && calendarSelected.to
                  ? `${fmt(calendarSelected.from)} – ${fmt(calendarSelected.to)}`
                  : calendarSelected.from
                    ? `${fmt(calendarSelected.from)} – …`
                    : "Pick a start date"}
              </span>
            </div>

            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={calendarSelected.from ?? value.from}
              selected={{ from: calendarSelected.from, to: calendarSelected.to }}
              onSelect={(r) => calendarOnSelect({ from: r?.from, to: r?.to })}
              className="p-0"
            />

            <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={apply} disabled={!canApply}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {value.compare.mode !== "none" && cw ? (
        <button
          onClick={() => onChange({ ...value, compare: { mode: "none" } })}
          className="hidden h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
          title="Click to disable compare"
        >
          <GitCompareArrows className="h-3 w-3" />
          vs <span className="font-mono" suppressHydrationWarning>{fmt(cw.from)}–{fmt(cw.to)}</span>
        </button>
      ) : null}
    </div>
  );
}

function PresetSection({
  label, options, activeId, onPick,
}: {
  label: string;
  options: { id: string; label: string }[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="border-b px-3 py-2.5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium tracking-tight transition-colors",
              activeId === o.id
                ? "border-foreground/40 bg-accent text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:text-foreground"
            )}
          >
            {o.label}
            {activeId === o.id ? <Check className="h-3 w-3" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarTargetSwitch({
  target, setTarget, showCompare,
}: {
  target: "range" | "compare";
  setTarget: (t: "range" | "compare") => void;
  showCompare: boolean;
}) {
  if (!showCompare) return null;
  return (
    <div className="inline-flex h-6 items-center rounded-md border p-0.5 text-[10px]">
      {(["range", "compare"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTarget(t)}
          className={cn(
            "h-5 rounded-sm px-1.5 transition-colors",
            target === t
              ? "bg-accent text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t === "range" ? "Range" : "Compare"}
        </button>
      ))}
    </div>
  );
}

function fmt(d: Date) {
  return formatDate(d, "short");
}
