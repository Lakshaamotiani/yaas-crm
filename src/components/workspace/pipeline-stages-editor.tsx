"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowUp, ArrowDown, Trash2, Plus, Star, Loader2, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useActions, usePipelineStages, useOverview } from "@/lib/store";
import {
  STAGE_TONE, STAGE_TONE_OPTIONS, type StageKind, type StageTone, type PipelineStage,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const KIND_META: Record<StageKind, { label: string; hint: string }> = {
  open: { label: "Open", hint: "Counts as active pipeline" },
  won:  { label: "Won",  hint: "Counts as a placement / closed-won" },
  lost: { label: "Lost", hint: "Counts as a loss" },
};

/**
 * Admin editor for the live `pipeline_stages` config. Everything downstream
 * (kanban, dashboard analytics, filters) keys off these rows by `kind`, so
 * renaming / recolouring / reordering is safe. Deleting a stage forces a
 * reassignment target so no deal is ever orphaned.
 */
export function PipelineStagesEditor() {
  const stages = usePipelineStages();
  const leads = useOverview();
  const actions = useActions();
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState<PipelineStage | null>(null);

  // Deal volume per stage — every lead has exactly one deal, so the overview
  // rows are a faithful count for the "N deals will move" warning.
  const countByStage = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      if (l.deal_stage) m.set(l.deal_stage, (m.get(l.deal_stage) ?? 0) + 1);
    }
    return m;
  }, [leads]);

  async function wrap(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...stages];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    wrap(() => actions.reorderStages(next.map((s) => s.id)), "Order updated");
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {stages.map((s, i) => (
          <StageRow
            key={s.id}
            stage={s}
            index={i}
            total={stages.length}
            dealCount={countByStage.get(s.id) ?? 0}
            busy={busy}
            onMove={move}
            onRename={(label) =>
              label.trim() && label !== s.label
                ? wrap(() => actions.updateStage(s.id, { label: label.trim() }), "Stage renamed")
                : undefined
            }
            onTone={(tone) => wrap(() => actions.updateStage(s.id, { tone }), "Colour updated")}
            onKind={(kind) => wrap(() => actions.updateStage(s.id, { kind }), "Role updated")}
            onDefault={() => wrap(() => actions.setDefaultStage(s.id), `"${s.label}" is now the default`)}
            onDelete={() => setDeleting(s)}
          />
        ))}
      </ul>

      <AddStageRow
        busy={busy}
        onAdd={(input) => wrap(() => actions.createStage(input), `Added "${input.label}"`)}
      />

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        The <strong className="text-foreground">role</strong> drives analytics, not the name —
        won/lost stages set <code>closed_at</code> and feed Editors Placed &amp; Win rate.
        The <Star className="-mt-0.5 inline h-3 w-3 fill-current" /> stage is where brand-new
        leads land.
      </p>

      <DeleteStageDialog
        stage={deleting}
        stages={stages}
        dealCount={deleting ? countByStage.get(deleting.id) ?? 0 : 0}
        onCancel={() => setDeleting(null)}
        onConfirm={async (reassignToId) => {
          const s = deleting;
          setDeleting(null);
          if (!s) return;
          await wrap(() => actions.deleteStage(s.id, reassignToId), `Deleted "${s.label}"`);
        }}
      />
    </div>
  );
}

function StageRow({
  stage, index, total, dealCount, busy,
  onMove, onRename, onTone, onKind, onDefault, onDelete,
}: {
  stage: PipelineStage;
  index: number;
  total: number;
  dealCount: number;
  busy: boolean;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRename: (label: string) => void;
  onTone: (tone: StageTone) => void;
  onKind: (kind: StageKind) => void;
  onDefault: () => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = React.useState(stage.label);
  React.useEffect(() => setLabel(stage.label), [stage.label]);

  return (
    <li className="group grid grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-2 rounded-md border bg-card px-2 py-1.5">
      {/* Reorder */}
      <div className="flex flex-col">
        <button
          type="button"
          disabled={busy || index === 0}
          onClick={() => onMove(index, -1)}
          className="text-muted-foreground/50 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          aria-label="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          type="button"
          disabled={busy || index === total - 1}
          onClick={() => onMove(index, 1)}
          className="text-muted-foreground/50 transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          aria-label="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>

      {/* Colour swatch */}
      <TonePicker tone={stage.tone} disabled={busy} onPick={onTone} />

      {/* Label (inline) */}
      <Input
        value={label}
        disabled={busy}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => onRename(label)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setLabel(stage.label);
        }}
        className="h-7 border-0 px-1 text-[13px] font-medium shadow-none focus-visible:ring-0"
        placeholder="Stage name"
      />

      {/* Deal count */}
      <span
        className="grid h-[18px] min-w-[18px] place-items-center rounded border bg-background px-1 font-mono text-[10px] tabular-nums text-muted-foreground"
        title={`${dealCount} deal${dealCount === 1 ? "" : "s"} in this stage`}
      >
        {dealCount}
      </span>

      {/* Role / kind */}
      <Select value={stage.kind} disabled={busy} onValueChange={(v) => onKind(v as StageKind)}>
        <SelectTrigger className="h-7 w-[92px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(KIND_META) as StageKind[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {KIND_META[k].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Default */}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy || stage.is_default}
        onClick={onDefault}
        title={stage.is_default ? "Default stage for new leads" : "Make default for new leads"}
        className={cn(stage.is_default ? "text-amber-500" : "text-muted-foreground/40 hover:text-foreground")}
      >
        <Star className={cn("h-3.5 w-3.5", stage.is_default && "fill-current")} />
      </Button>

      {/* Delete */}
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={busy || total <= 1 || stage.is_default}
        onClick={onDelete}
        title={
          total <= 1
            ? "Can't delete the only stage"
            : stage.is_default
              ? "Make another stage the default first"
              : "Delete stage"
        }
        className="text-muted-foreground/40 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

function TonePicker({
  tone, disabled, onPick,
}: {
  tone: StageTone;
  disabled: boolean;
  onPick: (t: StageTone) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Pick colour"
          className={cn(
            "h-4 w-4 rounded-full ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
            STAGE_TONE[tone].dot,
          )}
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-4 gap-1.5">
          {STAGE_TONE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onPick(t)}
              aria-label={t}
              className={cn(
                "h-6 w-6 rounded-full ring-offset-background transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                STAGE_TONE[t].dot,
                t === tone && "ring-2 ring-foreground ring-offset-2",
              )}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AddStageRow({
  busy, onAdd,
}: {
  busy: boolean;
  onAdd: (input: { label: string; kind: StageKind; tone: StageTone }) => void;
}) {
  const [label, setLabel] = React.useState("");
  const [kind, setKind] = React.useState<StageKind>("open");
  const [tone, setTone] = React.useState<StageTone>("new");

  const add = () => {
    if (!label.trim()) return;
    onAdd({ label: label.trim(), kind, tone });
    setLabel("");
    setKind("open");
    setTone("new");
  };

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2 rounded-md border border-dashed px-2 py-1.5">
      <TonePicker tone={tone} disabled={busy} onPick={setTone} />
      <Input
        value={label}
        disabled={busy}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); add(); }
        }}
        placeholder="New stage name…"
        className="h-7 border-0 px-1 text-[13px] shadow-none focus-visible:ring-0"
      />
      <Select value={kind} disabled={busy} onValueChange={(v) => setKind(v as StageKind)}>
        <SelectTrigger className="h-7 w-[92px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(KIND_META) as StageKind[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">{KIND_META[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" disabled={busy || !label.trim()} onClick={add}>
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </div>
  );
}

function DeleteStageDialog({
  stage, stages, dealCount, onCancel, onConfirm,
}: {
  stage: PipelineStage | null;
  stages: PipelineStage[];
  dealCount: number;
  onCancel: () => void;
  onConfirm: (reassignToId: string) => void;
}) {
  const others = stages.filter((s) => s.id !== stage?.id);
  const [target, setTarget] = React.useState<string>("");

  React.useEffect(() => {
    // Default the reassignment target to the adjacent stage.
    if (stage) setTarget(others[0]?.id ?? "");
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={!!stage} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Delete “{stage?.label}”
          </DialogTitle>
          <DialogDescription>
            {dealCount > 0 ? (
              <>
                <strong className="text-foreground">{dealCount}</strong> deal
                {dealCount === 1 ? "" : "s"} currently sit in this stage. Choose where
                they should move — this can&apos;t be undone.
              </>
            ) : (
              <>This stage has no deals. It will be removed from the pipeline.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Move deals to</label>
          <Select value={target || undefined} onValueChange={setTarget}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select a stage" /></SelectTrigger>
            <SelectContent>
              {others.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", STAGE_TONE[s.tone].dot)} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!target}
            onClick={() => onConfirm(target)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete stage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
