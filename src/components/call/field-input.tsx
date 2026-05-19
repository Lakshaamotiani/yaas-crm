"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CaptureField } from "@/lib/constants";

/** Inline editor for a single capture field. Compact and dense for live use. */
export function FieldInput({
  field, value, onChange, className,
}: {
  field: CaptureField;
  value: unknown;
  onChange: (v: unknown) => void;
  className?: string;
}) {
  switch (field.type) {
    case "currency":
      return <CurrencyInput value={value as number | undefined} onChange={onChange} placeholder={field.placeholder} className={className} />;

    case "percent":
      return <PercentInput value={value as number | undefined} onChange={onChange} placeholder={field.placeholder} className={className} />;

    case "number":
      return <NumberInput value={value as number | undefined} onChange={onChange} placeholder={field.placeholder} className={className} />;

    case "text":
      return (
        <Input
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn("h-9 text-[13px]", className)}
        />
      );

    case "long-text":
      return (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={cn("text-[13px]", className)}
        />
      );

    case "boolean":
      return (
        <div className={cn("inline-flex h-9 items-center gap-1 rounded-md border bg-card p-1", className)}>
          {(["yes", "no"] as const).map((opt) => {
            const isYes = opt === "yes";
            const active = value === isYes;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(isYes)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-sm px-3 text-[12px] font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isYes ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
      );

    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger className={cn("h-9 text-[13px]", className)}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multi-select": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={cn("flex flex-wrap gap-1", className)}>
          {(field.options ?? []).map((o) => {
            const active = arr.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  onChange(active ? arr.filter((id) => id !== o.id) : [...arr, o.id])
                }
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[12px] font-medium transition-colors",
                  active
                    ? "border-foreground/40 bg-accent text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? <Check className="h-3 w-3" /> : null}
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
  }
}

function CurrencyInput({
  value, onChange, placeholder, className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">$</span>
      <Input
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setDraft(next);
          onChange(next === "" ? undefined : parseFloat(next));
        }}
        placeholder={placeholder}
        className="h-9 pl-6 text-right font-mono text-[13px] tabular-nums"
      />
    </div>
  );
}

function PercentInput({
  value, onChange, placeholder, className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <div className={cn("relative", className)}>
      <Input
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          const next = e.target.value.replace(/[^\d.]/g, "");
          setDraft(next);
          onChange(next === "" ? undefined : parseFloat(next));
        }}
        placeholder={placeholder}
        className="h-9 pr-6 text-right font-mono text-[13px] tabular-nums"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">%</span>
    </div>
  );
}

function NumberInput({
  value, onChange, placeholder, className,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value?.toString() ?? "");
  React.useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <Input
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.-]/g, "");
        setDraft(next);
        onChange(next === "" ? undefined : parseFloat(next));
      }}
      placeholder={placeholder}
      className={cn("h-9 text-right font-mono text-[13px] tabular-nums", className)}
    />
  );
}
