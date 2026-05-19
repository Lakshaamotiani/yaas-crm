"use client";

import * as React from "react";
import { toast } from "sonner";
import { StickyNote, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/store";

export function NotesComposer({ leadId }: { leadId: string }) {
  const actions = useActions();
  const [value, setValue] = React.useState("");

  function submit() {
    const body = value.trim();
    if (!body) return;
    actions.logActivity({ lead_id: leadId, type: "note", title: "Note", body });
    setValue("");
    toast.success("Note added");
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        <span>Add a note</span>
        <span className="ml-auto text-[10px] tracking-widest opacity-60">⌘+↵</span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={3}
        placeholder="What did you learn?"
        className="border-0 px-0 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={submit} disabled={!value.trim()}>
          <Send /> Add note
        </Button>
      </div>
    </div>
  );
}
