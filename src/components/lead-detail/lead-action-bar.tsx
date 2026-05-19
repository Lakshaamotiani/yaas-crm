"use client";

import * as React from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarDays, Phone, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";
import { useActions } from "@/lib/store";
import { cn, formatDate } from "@/lib/utils";

/**
 * Compact action bar at the top of the lead detail's main column. Three
 * equal-weight outline buttons — no card wrapper, no primary tone — so the
 * row reads as a quiet shelf of options rather than a competing block.
 *
 *   Log call         → routes to the live call screen
 *   Schedule meeting → title + date + time + duration → pending meeting
 *   Add task         → title + date + time → pending task
 */
export function LeadActionBar({
  leadId,
  onLogCall,
}: {
  leadId: string;
  onLogCall: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" className="flex-1 min-w-[120px]" onClick={onLogCall}>
        <Phone className="h-3.5 w-3.5" /> Log call
      </Button>
      <ScheduleMeetingTrigger leadId={leadId} />
      <AddTaskTrigger leadId={leadId} />
    </div>
  );
}

// ============================================================================
// Add task — title + date + time
// ============================================================================

function AddTaskTrigger({ leadId }: { leadId: string }) {
  const actions = useActions();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState<Date | undefined>(() => roundedHourFromNow(1));
  const [time, setTime] = React.useState<string>(() => toTimeString(roundedHourFromNow(1)));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      const next = roundedHourFromNow(1);
      setDue(next);
      setTime(toTimeString(next));
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  function save() {
    const cleaned = title.trim();
    if (!cleaned) {
      toast.error("Add a short title for the task");
      inputRef.current?.focus();
      return;
    }
    const dueAt = combineDateTime(due, time);
    actions.logActivity({
      lead_id: leadId,
      type: "task",
      title: cleaned,
      status: "pending",
      due_at: dueAt ? dueAt.toISOString() : null,
    });
    toast.success(
      dueAt ? `Task added · ${formatDate(dueAt, "short")} ${formatTime12h(dueAt)}` : "Task added",
    );
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 min-w-[120px]">
          <Plus className="h-3.5 w-3.5" /> Add task
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] space-y-3 p-3">
        <FieldText
          id="task-title"
          label="Task"
          value={title}
          onChange={setTitle}
          onEnter={save}
          inputRef={inputRef}
          placeholder="Follow up with Riley"
        />

        <FieldDateTime
          dateLabel="Due"
          date={due}
          onDate={setDue}
          time={time}
          onTime={setTime}
          quickPicks={[
            { label: "Today",     date: setHour(daysFromNow(0), 17, 0) },
            { label: "Tomorrow",  date: setHour(daysFromNow(1), 9, 0) },
            { label: "+3d",       date: setHour(daysFromNow(3), 9, 0) },
            { label: "Next week", date: setHour(daysFromNow(7), 9, 0) },
          ]}
          onClearDate={() => setDue(undefined)}
        />

        <ActionFooter onCancel={() => setOpen(false)} onSave={save} saveLabel="Add task" saveIcon={CalendarClock} />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Schedule meeting — title + date + time + duration + optional notes
// ============================================================================

const DURATIONS = [15, 30, 45, 60] as const;
type DurationMin = typeof DURATIONS[number];

function ScheduleMeetingTrigger({ leadId }: { leadId: string }) {
  const actions = useActions();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>(() => roundedHourFromNow(1));
  const [time, setTime] = React.useState<string>(() => toTimeString(roundedHourFromNow(1)));
  const [duration, setDuration] = React.useState<DurationMin>(30);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      const next = roundedHourFromNow(1);
      setDate(next);
      setTime(toTimeString(next));
      setDuration(30);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  function save() {
    const cleaned = title.trim() || "Meeting";
    const start = combineDateTime(date, time);
    if (!start) {
      toast.error("Pick a date and time for the meeting");
      return;
    }
    actions.logActivity({
      lead_id: leadId,
      type: "meeting",
      title: cleaned,
      status: "pending",
      due_at: start.toISOString(),
      metadata: { duration_min: duration },
    });
    toast.success(
      `Meeting scheduled · ${formatDate(start, "short")} ${formatTime12h(start)} · ${duration} min`,
    );
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 min-w-[140px]">
          <CalendarDays className="h-3.5 w-3.5" /> Schedule meeting
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] space-y-3 p-3">
        <FieldText
          id="meeting-title"
          label="Meeting"
          value={title}
          onChange={setTitle}
          onEnter={save}
          inputRef={inputRef}
          placeholder="Discovery call"
        />

        <FieldDateTime
          dateLabel="When"
          date={date}
          onDate={setDate}
          time={time}
          onTime={setTime}
          quickPicks={[
            { label: "Today",     date: setHour(daysFromNow(0), 15, 0) },
            { label: "Tomorrow",  date: setHour(daysFromNow(1), 10, 0) },
            { label: "+3d",       date: setHour(daysFromNow(3), 10, 0) },
            { label: "Next week", date: setHour(daysFromNow(7), 10, 0) },
          ]}
        />

        <div className="space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Duration</Label>
          <div className="flex gap-1">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDuration(m)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1.5 text-[12px] font-mono tabular-nums transition-colors",
                  duration === m
                    ? "border-foreground bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {m}m
              </button>
            ))}
          </div>
        </div>

        <ActionFooter onCancel={() => setOpen(false)} onSave={save} saveLabel="Schedule" saveIcon={CalendarDays} />
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Shared field bits (kept private to this file — single consumer)
// ============================================================================

function FieldText({
  id, label, value, onChange, onEnter, inputRef, placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  onEnter: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );
}

function FieldDateTime({
  dateLabel, date, onDate, time, onTime, quickPicks, onClearDate,
}: {
  dateLabel: string;
  date: Date | undefined;
  onDate: (d: Date | undefined) => void;
  time: string;
  onTime: (t: string) => void;
  quickPicks: Array<{ label: string; date: Date }>;
  onClearDate?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground">{dateLabel}</Label>
      <div className="flex items-center gap-1.5">
        <DatePicker
          value={date}
          onChange={(d) => onDate(d ?? undefined)}
          size="sm"
          align="start"
          placeholder="Date"
          clearable={!!onClearDate}
          className="flex-1"
        />
        <Input
          type="time"
          value={time}
          onChange={(e) => onTime(e.target.value)}
          className="h-8 w-[110px] font-mono tabular-nums"
          aria-label="Time"
        />
      </div>
      <div className="flex flex-wrap gap-1 pt-0.5">
        {quickPicks.map((p) => (
          <Chip
            key={p.label}
            onClick={() => {
              onDate(p.date);
              onTime(toTimeString(p.date));
            }}
          >
            {p.label}
          </Chip>
        ))}
        {onClearDate ? <Chip onClick={onClearDate}>No date</Chip> : null}
      </div>
    </div>
  );
}

function ActionFooter({
  onCancel, onSave, saveLabel, saveIcon: Icon,
}: {
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
  saveIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        <Icon className="h-3.5 w-3.5" /> {saveLabel}
      </Button>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
    >
      {children}
    </button>
  );
}

// ============================================================================
// Date / time helpers
// ============================================================================

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function setHour(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

/** Round forward to the next whole hour, then add `addHours` more. Used to
 *  initialise pickers so the suggested time isn't "5:47pm" but "6:00pm". */
function roundedHourFromNow(addHours: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + addHours);
  return d;
}

function toTimeString(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function combineDateTime(date: Date | undefined, time: string): Date | null {
  if (!date) return null;
  const [hh, mm] = time.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const out = new Date(date);
  out.setHours(hh, mm, 0, 0);
  return out;
}

function formatTime12h(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m}${ampm}`;
}
