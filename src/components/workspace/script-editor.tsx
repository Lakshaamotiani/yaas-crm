"use client";

import * as React from "react";
import {
  ChevronDown, ChevronRight, Plus, Trash2, ArrowUp, ArrowDown,
  ClipboardList, MessageSquareQuote, FileText, Sigma, Sparkles, ShieldQuestion,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type {
  ScriptSection, ScriptBlock, CaptureField, FieldType, FieldBinding, ObjectionItem,
  DiscoveryPrompt,
} from "@/lib/constants";
import { useAvailableFields } from "./script-fields-context";

const uid = () => Math.random().toString(36).slice(2, 10);

const BLOCK_OPTIONS: Array<{ kind: ScriptBlock["kind"]; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { kind: "capture",   label: "Capture",    icon: ClipboardList },
  { kind: "say-this",  label: "Say this",   icon: MessageSquareQuote },
  { kind: "discovery", label: "Discovery",  icon: FileText },
  { kind: "calc",      label: "Math",       icon: Sigma },
  { kind: "pitch",     label: "Pitch",      icon: Sparkles },
  { kind: "objection", label: "Objections", icon: ShieldQuestion },
];

const BINDINGS: FieldBinding[] = [
  "qualification.budget_range",
  "qualification.decision_maker",
  "qualification.pain_points",
  "qualification.goals",
  "qualification.fit_score",
  "lead.tags",
  "lead.service_type",
  "deal.value_mrr",
];

export function ScriptEditor({
  section, index,
  onChange, onRemove, onMoveUp, onMoveDown,
  onPatchBlock, onReorderBlock, onRemoveBlock, onAddBlock,
}: {
  section: ScriptSection;
  index: number;
  onChange: (p: Partial<ScriptSection>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onPatchBlock: (blockIdx: number, p: Partial<ScriptBlock>) => void;
  onReorderBlock: (blockIdx: number, dir: -1 | 1) => void;
  onRemoveBlock: (blockIdx: number) => void;
  onAddBlock: (kind: ScriptBlock["kind"]) => void;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-md border bg-card">
      <div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1.5">
        <CollapsibleTrigger asChild>
          <button className="flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </CollapsibleTrigger>
        <span className="grid h-5 w-5 place-items-center rounded bg-foreground/10 font-mono text-[10px] font-semibold tabular-nums">
          {index + 1}
        </span>
        <Input
          value={section.heading}
          onChange={(e) => onChange({ heading: e.target.value })}
          className="h-7 border-0 bg-transparent px-2 text-[13px] font-medium shadow-none focus-visible:ring-0"
          placeholder="Section heading"
        />
        <Input
          type="number"
          value={section.minutes ?? ""}
          onChange={(e) => onChange({ minutes: e.target.value ? parseInt(e.target.value, 10) : undefined })}
          className="h-7 w-16 border-0 bg-transparent px-1 text-right font-mono text-[11px] tabular-nums shadow-none focus-visible:ring-0"
          placeholder="min"
        />
        <div className="ml-auto flex items-center gap-0.5">
          <span className="font-mono text-[10px] text-muted-foreground">
            {section.blocks.length} blocks
          </span>
          <Button size="icon-sm" variant="ghost" onClick={onMoveUp} disabled={!onMoveUp}>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onMoveDown} disabled={!onMoveDown}>
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="space-y-2.5 p-3">
          {section.blocks.map((b, i) => (
            <BlockEditor
              key={b.id}
              block={b}
              onChange={(p) => onPatchBlock(i, p)}
              onRemove={() => onRemoveBlock(i)}
              onMoveUp={i > 0 ? () => onReorderBlock(i, -1) : undefined}
              onMoveDown={i < section.blocks.length - 1 ? () => onReorderBlock(i, 1) : undefined}
            />
          ))}

          <AddBlockPalette onAdd={onAddBlock} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AddBlockPalette({
  onAdd,
}: {
  onAdd: (kind: ScriptBlock["kind"]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add block
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {BLOCK_OPTIONS.map((o) => (
          <DropdownMenuItem key={o.kind} onClick={() => onAdd(o.kind)}>
            <o.icon /> {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Block editor — dispatches to one of the kind-specific editors
// ============================================================================

function BlockEditor({
  block, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  block: ScriptBlock;
  onChange: (p: Partial<ScriptBlock>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const meta = BLOCK_OPTIONS.find((o) => o.kind === block.kind)!;
  const Icon = meta.icon;

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/20 px-2 py-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {meta.label}
        </span>
        <Input
          value={block.hint ?? ""}
          onChange={(e) => onChange({ hint: e.target.value })}
          placeholder="Optional hint shown above the block"
          className="h-6 flex-1 border-0 bg-transparent px-2 text-[11px] italic shadow-none focus-visible:ring-0"
        />
        <div className="ml-auto flex items-center gap-0.5">
          <Button size="icon-sm" variant="ghost" onClick={onMoveUp} disabled={!onMoveUp}>
            <ArrowUp className="h-3 w-3" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onMoveDown} disabled={!onMoveDown}>
            <ArrowDown className="h-3 w-3" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        {block.kind === "say-this" || block.kind === "pitch" ? (
          <TextBlockEditor block={block} onChange={onChange} />
        ) : null}
        {block.kind === "discovery" ? (
          <DiscoveryBlockEditor block={block} onChange={onChange} />
        ) : null}
        {block.kind === "capture" ? (
          <CaptureBlockEditor block={block} onChange={onChange} />
        ) : null}
        {block.kind === "calc" ? (
          <CalcBlockEditor block={block} onChange={onChange} />
        ) : null}
        {block.kind === "objection" ? (
          <ObjectionBlockEditor block={block} onChange={onChange} />
        ) : null}
      </div>
    </div>
  );
}

function TextBlockEditor({
  block, onChange,
}: { block: ScriptBlock; onChange: (p: Partial<ScriptBlock>) => void }) {
  return (
    <div className="space-y-1.5">
      <Textarea
        value={block.text ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={6}
        placeholder={
          block.kind === "pitch"
            ? "Personalized pitch text. Use {{field_id}} to interpolate captured values."
            : "Script text to read. Use {{field_id}} for live token substitution."
        }
        className="font-mono text-[12px]"
      />
      <p className="text-[10px] text-muted-foreground/70">
        Tokens: <code className="rounded bg-muted px-1">{"{{contact_name}}"}</code>{" "}
        <code className="rounded bg-muted px-1">{"{{contact_company}}"}</code> · any capture/calc field id from this script.
      </p>
    </div>
  );
}

function DiscoveryBlockEditor({
  block, onChange,
}: { block: ScriptBlock; onChange: (p: Partial<ScriptBlock>) => void }) {
  const prompts = block.prompts ?? [];

  function patch(i: number, p: Partial<DiscoveryPrompt>) {
    onChange({ prompts: prompts.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  }
  function remove(i: number) {
    onChange({ prompts: prompts.filter((_, j) => j !== i) });
  }
  function add() {
    onChange({ prompts: [...prompts, { id: uid(), text: "" }] });
  }

  return (
    <div className="space-y-2">
      {prompts.map((p, i) => (
        <DiscoveryPromptEditor
          key={p.id}
          prompt={p}
          onChange={(patchObj) => patch(i, patchObj)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={add} className="h-7 w-full justify-start text-xs text-muted-foreground">
        <Plus className="h-3 w-3" /> Add prompt
      </Button>
    </div>
  );
}

function DiscoveryPromptEditor({
  prompt, onChange, onRemove,
}: {
  prompt: DiscoveryPrompt;
  onChange: (p: Partial<DiscoveryPrompt>) => void;
  onRemove: () => void;
}) {
  const fields = useAvailableFields();
  const hasExtras = !!prompt.script || !!prompt.captureId;
  const [expanded, setExpanded] = React.useState(hasExtras);

  React.useEffect(() => {
    if (hasExtras) setExpanded(true);
  }, [hasExtras]);

  return (
    <div className="group rounded border bg-muted/15 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted-foreground/60">·</span>
        <Input
          value={prompt.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Discovery prompt"
          className="h-7 border-0 bg-transparent px-1 text-[12px] shadow-none focus-visible:ring-0"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setExpanded((v) => !v)}
          className={expanded || hasExtras ? "text-foreground" : "text-muted-foreground/60 opacity-0 group-hover:opacity-100"}
          aria-label="Toggle script + binding"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {expanded ? (
        <div className="mt-1.5 space-y-2 pl-4">
          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Suggested words (optional) — supports {"{{token}}"}
            </Label>
            <Textarea
              value={prompt.script ?? ""}
              onChange={(e) => onChange({ script: e.target.value || undefined })}
              rows={2}
              placeholder='e.g. "Just so I have the full picture, what kind of budget are you working with for this?"'
              className="font-mono text-[12px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Auto-check when this capture field is filled (optional)
            </Label>
            <Select
              value={prompt.captureId ?? "__none"}
              onValueChange={(v) => onChange({ captureId: v === "__none" ? undefined : v })}
            >
              <SelectTrigger className="h-7 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No binding</SelectItem>
                {fields.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label} <span className="ml-1 font-mono text-[10px] text-muted-foreground">{f.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CaptureBlockEditor({
  block, onChange,
}: { block: ScriptBlock; onChange: (p: Partial<ScriptBlock>) => void }) {
  const fields = block.fields ?? [];

  function patch(i: number, p: Partial<CaptureField>) {
    onChange({ fields: fields.map((f, j) => (j === i ? { ...f, ...p } : f)) });
  }
  function remove(i: number) {
    onChange({ fields: fields.filter((_, j) => j !== i) });
  }
  function add() {
    onChange({
      fields: [...fields, { id: `field_${fields.length + 1}`, label: "New field", type: "text" }],
    });
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="rounded border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">
          No fields yet.
        </p>
      ) : null}
      {fields.map((f, i) => (
        <CaptureFieldEditor
          key={i}
          field={f}
          onChange={(p) => patch(i, p)}
          onRemove={() => remove(i)}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={add} className="h-7 w-full justify-start text-xs text-muted-foreground">
        <Plus className="h-3 w-3" /> Add field
      </Button>
    </div>
  );
}

function CaptureFieldEditor({
  field, onChange, onRemove,
}: {
  field: CaptureField;
  onChange: (p: Partial<CaptureField>) => void;
  onRemove: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = React.useState(
    !!field.options || !!field.bindTo || !!field.hint,
  );
  const isSelectish = field.type === "select" || field.type === "multi-select";

  function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  return (
    <div className="space-y-2 rounded border bg-muted/20 p-2">
      <div className="grid grid-cols-[1.4fr_1fr_140px_28px] gap-2">
        <div className="space-y-1">
          <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Label</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            className="h-7 text-[12px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">ID (token)</Label>
          <Input
            value={field.id}
            onChange={(e) => onChange({ id: slug(e.target.value) })}
            className="h-7 font-mono text-[11px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Type</Label>
          <Select value={field.type} onValueChange={(v: FieldType) => onChange({ type: v })}>
            <SelectTrigger className="h-7 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Short text</SelectItem>
              <SelectItem value="long-text">Long text</SelectItem>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="currency">Currency</SelectItem>
              <SelectItem value="percent">Percent</SelectItem>
              <SelectItem value="boolean">Yes / No</SelectItem>
              <SelectItem value="select">Select</SelectItem>
              <SelectItem value="multi-select">Multi-select</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onRemove}
          className="mt-5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      <button
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-[10px] text-muted-foreground/80 hover:text-foreground"
      >
        {showAdvanced ? "Hide" : "Show"} advanced (placeholder, binding{isSelectish ? ", options" : ""})
      </button>

      {showAdvanced ? (
        <div className="space-y-2 rounded border border-dashed bg-background px-2.5 py-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Placeholder</Label>
              <Input
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ placeholder: e.target.value })}
                className="h-7 text-[12px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Bind to</Label>
              <Select
                value={field.bindTo ?? "__none"}
                onValueChange={(v) => onChange({ bindTo: v === "__none" ? undefined : (v as FieldBinding) })}
              >
                <SelectTrigger className="h-7 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No binding</SelectItem>
                  {BINDINGS.map((b) => (
                    <SelectItem key={b} value={b}>{b.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isSelectish ? (
            <OptionsEditor
              value={field.options ?? []}
              onChange={(options) => onChange({ options })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OptionsEditor({
  value, onChange,
}: {
  value: { id: string; label: string; weight?: number }[];
  onChange: (v: { id: string; label: string; weight?: number }[]) => void;
}) {
  function slug(s: string) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  return (
    <div className="space-y-1">
      <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Options</Label>
      <ul className="space-y-1">
        {value.map((o, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_60px_24px] gap-1.5">
            <Input
              value={o.label}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...next[i], label: e.target.value };
                onChange(next);
              }}
              placeholder="Label"
              className="h-7 text-[12px]"
            />
            <Input
              value={o.id}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...next[i], id: slug(e.target.value) };
                onChange(next);
              }}
              placeholder="id"
              className="h-7 font-mono text-[11px]"
            />
            <Input
              type="number"
              value={o.weight ?? ""}
              onChange={(e) => {
                const next = [...value];
                next[i] = { ...next[i], weight: e.target.value ? parseInt(e.target.value, 10) : undefined };
                onChange(next);
              }}
              placeholder="weight"
              className="h-7 text-right font-mono text-[11px] tabular-nums"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </li>
        ))}
        <li>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start text-[11px] text-muted-foreground"
            onClick={() => onChange([...value, { id: `opt_${value.length + 1}`, label: "" }])}
          >
            <Plus className="h-3 w-3" /> Add option
          </Button>
        </li>
      </ul>
    </div>
  );
}

function ObjectionBlockEditor({
  block, onChange,
}: { block: ScriptBlock; onChange: (p: Partial<ScriptBlock>) => void }) {
  const objections: ObjectionItem[] = block.objections ?? [];

  function patch(i: number, p: Partial<ObjectionItem>) {
    onChange({ objections: objections.map((o, j) => (j === i ? { ...o, ...p } : o)) });
  }
  function remove(i: number) {
    onChange({ objections: objections.filter((_, j) => j !== i) });
  }
  function add() {
    onChange({
      objections: [
        ...objections,
        { id: uid(), trigger: "", response: "" },
      ],
    });
  }
  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= objections.length) return;
    const next = [...objections];
    [next[i], next[target]] = [next[target], next[i]];
    onChange({ objections: next });
  }

  return (
    <div className="space-y-2">
      {objections.length === 0 ? (
        <p className="rounded border border-dashed px-3 py-3 text-center text-[11px] text-muted-foreground">
          No objections yet. Add the ones you actually hear on calls.
        </p>
      ) : null}

      {objections.map((o, i) => (
        <div key={o.id} className="space-y-2 rounded border bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Trigger phrase
            </Label>
            <div className="ml-auto flex items-center gap-0.5">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => move(i, 1)}
                disabled={i === objections.length - 1}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => remove(i)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Input
            value={o.trigger}
            onChange={(e) => patch(i, { trigger: e.target.value })}
            placeholder={`"It's too expensive"`}
            className="h-8 text-[12px] font-medium italic"
          />

          <div className="space-y-1">
            <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Rebuttal — supports {"{{token}}"} substitution
            </Label>
            <Textarea
              value={o.response}
              onChange={(e) => patch(i, { response: e.target.value })}
              rows={4}
              placeholder="Looking at your numbers — today you're at {{current_monthly_spend}}/mo plus your own time…"
              className="font-mono text-[12px]"
            />
          </div>
        </div>
      ))}

      <Button variant="ghost" size="sm" onClick={add} className="h-7 w-full justify-start text-xs text-muted-foreground">
        <Plus className="h-3 w-3" /> Add objection
      </Button>
    </div>
  );
}

function CalcBlockEditor({
  block, onChange,
}: { block: ScriptBlock; onChange: (p: Partial<ScriptBlock>) => void }) {
  return (
    <div className="grid grid-cols-[1fr_1.6fr_120px] gap-2">
      <div className="space-y-1">
        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Label</Label>
        <Input
          value={block.label ?? ""}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-7 text-[12px]"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Formula</Label>
        <Input
          value={block.formula ?? ""}
          onChange={(e) => onChange({ formula: e.target.value })}
          placeholder="current_mrr * 12"
          className="h-7 font-mono text-[12px]"
        />
        <p className="text-[10px] text-muted-foreground/70">
          Functions: min, max, round, ceil, floor, abs, clamp, if. Ops: + − × ÷ % ( ).
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-[9px] uppercase tracking-wider text-muted-foreground">Format</Label>
        <Select
          value={block.format ?? "number"}
          onValueChange={(v: "currency" | "percent" | "number") => onChange({ format: v })}
        >
          <SelectTrigger className="h-7 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="currency">Currency</SelectItem>
            <SelectItem value="percent">Percent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
