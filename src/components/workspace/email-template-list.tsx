"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EmailTemplate } from "@/lib/constants";

export function EmailTemplateList({
  value,
  onChange,
}: {
  value: EmailTemplate[];
  onChange: (v: EmailTemplate[]) => void;
}) {
  const uid = () => Math.random().toString(36).slice(2, 8);

  function patch(idx: number, p: Partial<EmailTemplate>) {
    onChange(value.map((t, i) => (i === idx ? { ...t, ...p } : t)));
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  function add() {
    onChange([
      ...value,
      { id: uid(), name: "New template", subject: "Subject — {{company}}", body: "" },
    ]);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          No templates yet
        </div>
      ) : (
        value.map((t, i) => (
          <div key={t.id} className="space-y-2 rounded-md border bg-card p-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</Label>
                <Input
                  value={t.name}
                  onChange={(e) => patch(i, { name: e.target.value })}
                  placeholder="Intro"
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(i)}
                aria-label="Remove template"
                className="mt-5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</Label>
              <Input
                value={t.subject}
                onChange={(e) => patch(i, { subject: e.target.value })}
                placeholder="Quick intro — YAAS Sales CRM"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Body (optional)</Label>
              <Textarea
                rows={3}
                value={t.body ?? ""}
                onChange={(e) => patch(i, { body: e.target.value })}
                placeholder="Hey {{name}}, …"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Tokens: <code className="rounded bg-muted px-1 py-0.5">{"{{name}}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{company}}"}</code>{" "}
              <code className="rounded bg-muted px-1 py-0.5">{"{{role}}"}</code>
            </p>
          </div>
        ))
      )}
      <Button variant="outline" size="sm" onClick={add} className="w-full">
        <Plus className="h-3.5 w-3.5" /> Add template
      </Button>
    </div>
  );
}
