"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SOURCE_KEYS = [
  "yaas_form", "referral", "outbound", "inbound_email", "linkedin", "event", "other",
] as const;

export function SourceLabels({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {SOURCE_KEYS.map((k) => (
        <div key={k} className="grid grid-cols-[110px_1fr] items-center gap-2 rounded-md border bg-card px-3 py-2">
          <Label className="font-mono text-[11px] text-muted-foreground">{k}</Label>
          <Input
            value={value[k] ?? ""}
            onChange={(e) => onChange({ ...value, [k]: e.target.value })}
            className="h-8 text-sm"
            placeholder={k}
          />
        </div>
      ))}
      <p className="col-span-full text-[10px] text-muted-foreground">
        Source <em>keys</em> are fixed (they map to a database enum). You can only edit the displayed labels.
      </p>
    </div>
  );
}
