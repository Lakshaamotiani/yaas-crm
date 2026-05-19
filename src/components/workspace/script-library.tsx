"use client";

import * as React from "react";
import {
  Plus, Star, Copy, Trash2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SalesScript, ScriptSection, ScriptBlock } from "@/lib/constants";
import { useActions, useTemplates } from "@/lib/store";
import { ScriptEditor } from "./script-editor";
import { ScriptFieldsProvider } from "./script-fields-context";

const uid = () => Math.random().toString(36).slice(2, 10);

export function ScriptLibrary() {
  const { salesScripts } = useTemplates();
  const actions = useActions();

  const [selectedId, setSelectedId] = React.useState<string>(
    () => salesScripts.find((s) => s.isDefault)?.id ?? salesScripts[0]?.id ?? "",
  );

  // Stay valid if the selected script gets deleted
  React.useEffect(() => {
    if (!salesScripts.some((s) => s.id === selectedId)) {
      setSelectedId(salesScripts[0]?.id ?? "");
    }
  }, [salesScripts, selectedId]);

  const selected = salesScripts.find((s) => s.id === selectedId);

  function updateScript(next: SalesScript) {
    actions.updateTemplates({
      salesScripts: salesScripts.map((s) => (s.id === next.id ? next : s)),
    });
  }

  function createScript() {
    const id = uid();
    const fresh: SalesScript = {
      id,
      name: "New script",
      description: "",
      sections: [
        {
          id: uid(),
          heading: "Opening",
          minutes: 2,
          blocks: [
            { id: uid(), kind: "discovery", prompts: [{ id: uid(), text: "Confirm the agenda" }] },
          ],
        },
      ],
    };
    actions.updateTemplates({ salesScripts: [...salesScripts, fresh] });
    setSelectedId(id);
  }

  function duplicate(s: SalesScript) {
    const fresh: SalesScript = {
      ...JSON.parse(JSON.stringify(s)),
      id: uid(),
      name: `${s.name} (copy)`,
      isDefault: false,
    };
    // Reassign ids inside so the copy doesn't share child ids
    fresh.sections = fresh.sections.map((sec) => ({
      ...sec,
      id: uid(),
      blocks: sec.blocks.map((b) => ({ ...b, id: uid() })),
    }));
    actions.updateTemplates({ salesScripts: [...salesScripts, fresh] });
    setSelectedId(fresh.id);
  }

  function remove(s: SalesScript) {
    if (salesScripts.length <= 1) return;
    actions.updateTemplates({
      salesScripts: salesScripts.filter((x) => x.id !== s.id),
    });
  }

  function setDefault(s: SalesScript) {
    actions.updateTemplates({
      salesScripts: salesScripts.map((x) => ({ ...x, isDefault: x.id === s.id })),
    });
  }

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border bg-card">
      <aside className="border-r bg-muted/20">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Scripts
          </span>
          <Button size="icon-sm" variant="ghost" onClick={createScript} aria-label="New script">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <ul className="p-1.5">
          {salesScripts.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "group flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
                  selectedId === s.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <ChevronRight
                  className={cn(
                    "mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform",
                    selectedId === s.id ? "rotate-90 text-foreground" : "text-muted-foreground/40",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium">{s.name}</span>
                    {s.isDefault ? (
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                    ) : null}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground/80">
                    {s.sections.length} section{s.sections.length === 1 ? "" : "s"}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0">
        {selected ? (
          <ScriptFieldsProvider script={selected}>
            <ScriptEditorPane
              script={selected}
              onChange={updateScript}
              onDuplicate={() => duplicate(selected)}
              onDelete={() => remove(selected)}
              onSetDefault={() => setDefault(selected)}
              canDelete={salesScripts.length > 1}
            />
          </ScriptFieldsProvider>
        ) : (
          <div className="grid h-full place-items-center p-12 text-center text-[13px] text-muted-foreground">
            Pick a script to edit.
          </div>
        )}
      </div>
    </div>
  );
}

function ScriptEditorPane({
  script, onChange, onDuplicate, onDelete, onSetDefault, canDelete,
}: {
  script: SalesScript;
  onChange: (s: SalesScript) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  canDelete: boolean;
}) {
  function patch(p: Partial<SalesScript>) {
    onChange({ ...script, ...p });
  }

  function patchSection(idx: number, p: Partial<ScriptSection>) {
    const next = script.sections.map((s, i) => (i === idx ? { ...s, ...p } : s));
    patch({ sections: next });
  }

  function reorderSection(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= script.sections.length) return;
    const next = [...script.sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    patch({ sections: next });
  }

  function removeSection(idx: number) {
    patch({ sections: script.sections.filter((_, i) => i !== idx) });
  }

  function addSection() {
    patch({
      sections: [
        ...script.sections,
        { id: uid(), heading: "New section", minutes: 3, blocks: [] },
      ],
    });
  }

  function patchBlock(secIdx: number, blockIdx: number, p: Partial<ScriptBlock>) {
    const next = script.sections.map((s, i) => {
      if (i !== secIdx) return s;
      return {
        ...s,
        blocks: s.blocks.map((b, j) => (j === blockIdx ? { ...b, ...p } : b)),
      };
    });
    patch({ sections: next });
  }

  function reorderBlock(secIdx: number, blockIdx: number, dir: -1 | 1) {
    const section = script.sections[secIdx];
    const target = blockIdx + dir;
    if (target < 0 || target >= section.blocks.length) return;
    const blocks = [...section.blocks];
    [blocks[blockIdx], blocks[target]] = [blocks[target], blocks[blockIdx]];
    patchSection(secIdx, { blocks });
  }

  function removeBlock(secIdx: number, blockIdx: number) {
    const section = script.sections[secIdx];
    patchSection(secIdx, { blocks: section.blocks.filter((_, j) => j !== blockIdx) });
  }

  function addBlock(secIdx: number, kind: ScriptBlock["kind"]) {
    const section = script.sections[secIdx];
    const fresh = makeBlock(kind);
    patchSection(secIdx, { blocks: [...section.blocks, fresh] });
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          <Input
            value={script.name}
            onChange={(e) => patch({ name: e.target.value })}
            className="h-8 border-0 px-0 text-[15px] font-semibold tracking-tight shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={script.isDefault ? "secondary" : "ghost"}
            onClick={onSetDefault}
            className="gap-1.5"
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                script.isDefault && "fill-amber-500 text-amber-500",
              )}
            />
            {script.isDefault ? "Default" : "Set default"}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onDuplicate} aria-label="Duplicate">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label="Delete"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Description</Label>
          <Textarea
            value={script.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            rows={2}
            placeholder="When to use this script…"
          />
        </div>

        <div className="space-y-3">
          {script.sections.map((sec, idx) => (
            <ScriptEditor
              key={sec.id}
              section={sec}
              index={idx}
              onChange={(p) => patchSection(idx, p)}
              onRemove={() => removeSection(idx)}
              onMoveUp={idx > 0 ? () => reorderSection(idx, -1) : undefined}
              onMoveDown={idx < script.sections.length - 1 ? () => reorderSection(idx, 1) : undefined}
              onPatchBlock={(blockIdx, p) => patchBlock(idx, blockIdx, p)}
              onReorderBlock={(blockIdx, dir) => reorderBlock(idx, blockIdx, dir)}
              onRemoveBlock={(blockIdx) => removeBlock(idx, blockIdx)}
              onAddBlock={(kind) => addBlock(idx, kind)}
            />
          ))}

          <Button variant="outline" size="sm" onClick={addSection} className="w-full">
            <Plus className="h-3.5 w-3.5" /> Add section
          </Button>
        </div>
      </div>
    </div>
  );
}

function makeBlock(kind: ScriptBlock["kind"]): ScriptBlock {
  const base: ScriptBlock = { id: uid(), kind };
  switch (kind) {
    case "say-this":
      return { ...base, text: "" };
    case "pitch":
      return { ...base, text: "" };
    case "discovery":
      return { ...base, prompts: [{ id: uid(), text: "" }] };
    case "capture":
      return { ...base, fields: [{ id: "field_id", label: "Label", type: "text" }] };
    case "calc":
      return { ...base, label: "New metric", formula: "0", format: "number" };
    case "objection":
      return {
        ...base,
        objections: [{ id: uid(), trigger: "", response: "" }],
      };
  }
}
