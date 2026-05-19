"use client";

import * as React from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OptionItem } from "@/lib/constants";

export function OptionList({
  value,
  onChange,
}: {
  value: OptionItem[];
  onChange: (v: OptionItem[]) => void;
}) {
  const [draftLabel, setDraftLabel] = React.useState("");
  const [draftId, setDraftId] = React.useState("");

  function slug(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  function add() {
    const label = draftLabel.trim();
    if (!label) return;
    const id = draftId.trim() || slug(label);
    if (!id || value.some((v) => v.id === id)) return;
    onChange([...value, { id, label }]);
    setDraftLabel("");
    setDraftId("");
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {value.length === 0 ? (
          <li className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
            No options yet
          </li>
        ) : (
          value.map((o, i) => (
            <li
              key={o.id}
              className="group grid grid-cols-[14px_1fr_1fr_auto] items-center gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
              <Input
                value={o.label}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...next[i], label: e.target.value };
                  onChange(next);
                }}
                className="h-7 border-0 px-1 text-[13px] shadow-none focus-visible:ring-0"
                placeholder="Label"
              />
              <Input
                value={o.id}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = { ...next[i], id: slug(e.target.value) };
                  onChange(next);
                }}
                className="h-7 border-0 px-1 font-mono text-[11px] text-muted-foreground shadow-none focus-visible:ring-0"
                placeholder="id"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="opacity-0 group-hover:opacity-100"
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))
        )}
      </ul>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <Input
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder="Label"
          className="h-8 text-sm"
        />
        <Input
          value={draftId}
          onChange={(e) => setDraftId(slug(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
          }}
          placeholder={draftLabel ? slug(draftLabel) : "id (auto)"}
          className="h-8 font-mono text-xs"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!draftLabel.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
