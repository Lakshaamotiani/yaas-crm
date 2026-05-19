"use client";

import * as React from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function StringList({
  value,
  onChange,
  placeholder = "Add value",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");

  function add() {
    const v = draft.trim();
    if (!v || value.includes(v)) return;
    onChange([...value, v]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {value.length === 0 ? (
          <li className="rounded-md border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
            No values yet
          </li>
        ) : (
          value.map((v, i) => (
            <li
              key={`${v}-${i}`}
              className="group flex items-center gap-2 rounded-md border bg-card px-2 py-1.5"
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <Input
                value={v}
                onChange={(e) => {
                  const next = [...value];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className="h-7 border-0 px-1 text-[13px] shadow-none focus-visible:ring-0"
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
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}
