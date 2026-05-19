"use client";

import * as React from "react";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, closestCorners,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type DealStage } from "@/lib/constants";
import { LeadCard } from "./lead-card";
import type { LeadOverview } from "@/lib/types";
import { useActions, usePipelineStages } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";

interface Props {
  leads: LeadOverview[];
  /** Subset of stages to render as columns (and to allow drops into). Defaults to all stages. */
  visibleStages?: DealStage[];
}

export function KanbanBoard({ leads, visibleStages }: Props) {
  const actions = useActions();
  const allStages = usePipelineStages();
  const stages = React.useMemo(
    () =>
      visibleStages
        ? allStages.filter((s) => visibleStages.includes(s.id))
        : allStages,
    [allStages, visibleStages],
  );

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Record<DealStage, LeadOverview[]>>(
    () => groupByStage(leads, stages.map((s) => s.id))
  );

  // Sync from props whenever the upstream list (or visible stages) changes
  React.useEffect(() => {
    setItems(groupByStage(leads, stages.map((s) => s.id)));
  }, [leads, stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findStage = (id: string): DealStage | null => {
    for (const s of stages) {
      if (items[s.id]?.some((l) => l.id === id)) return s.id;
    }
    return null;
  };

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeStage = findStage(activeId);
    const overStage = (stages.find((s) => s.id === overId)?.id) ?? findStage(overId);
    if (!activeStage || !overStage || activeStage === overStage) return;

    setItems((prev) => {
      const active = prev[activeStage].find((l) => l.id === activeId);
      if (!active) return prev;
      const newFrom = prev[activeStage].filter((l) => l.id !== activeId);
      const newTo = [...prev[overStage]];
      const overIndex = newTo.findIndex((l) => l.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : newTo.length;
      newTo.splice(insertAt, 0, active);
      return { ...prev, [activeStage]: newFrom, [overStage]: newTo };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeStage = findStage(activeId);
    const overStage = (stages.find((s) => s.id === overId)?.id) ?? findStage(overId);
    if (!activeStage || !overStage) return;

    let toIndex = 0;
    setItems((prev) => {
      const col = prev[overStage];
      const activeIdx = col.findIndex((l) => l.id === activeId);
      const overIdx = col.findIndex((l) => l.id === overId);
      let next = col;
      if (activeIdx !== -1 && overIdx !== -1 && activeIdx !== overIdx) {
        next = arrayMove(col, activeIdx, overIdx);
      }
      toIndex = Math.max(0, next.findIndex((l) => l.id === activeId));
      return { ...prev, [overStage]: next };
    });

    const lead = leads.find((l) => l.id === activeId);
    if (lead?.deal_id) actions.moveDeal(lead.deal_id, overStage, toIndex);
  }

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4 scrollbar-thin">
        {stages.map((stage) => (
          <Column key={stage.id} stage={stage.id} label={stage.label} leads={items[stage.id] ?? []} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 150 }}>
        {activeLead ? <LeadCard lead={activeLead} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const COLUMN_PAGE = 60;

function Column({ stage, label, leads }: { stage: DealStage; label: string; leads: LeadOverview[] }) {
  const totalMrr = leads.reduce((sum, l) => sum + (l.value_mrr ?? 0), 0);
  const { setNodeRef } = useSortable({ id: stage, data: { type: "column" } });
  // Render in pages — a stage with 700+ imported leads otherwise mounts
  // 700 dnd-kit sortables and freezes the board. Count badge stays accurate;
  // List view shows everything unpaged.
  const [limit, setLimit] = React.useState(COLUMN_PAGE);
  React.useEffect(() => { setLimit(COLUMN_PAGE); }, [stage]);
  const shown = leads.slice(0, limit);
  const remaining = leads.length - shown.length;

  return (
    <div
      ref={setNodeRef}
      className="flex h-full w-[288px] shrink-0 flex-col rounded-lg border bg-muted/20"
    >
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/80">{label}</span>
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded border bg-background px-1 font-mono text-[10px] font-medium tabular-nums text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {formatCurrency(totalMrr, { compact: true })}
        </span>
      </div>
      <SortableContext id={stage} items={shown.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto p-2 scrollbar-thin">
          {shown.map((lead) => (
            <SortableLeadCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 ? (
            <div className="grid place-items-center rounded-md border border-dashed py-10 text-[11px] text-muted-foreground">
              Drag leads here
            </div>
          ) : null}
          {remaining > 0 ? (
            <button
              type="button"
              onClick={() => setLimit((n) => n + COLUMN_PAGE)}
              className="w-full rounded-md border border-dashed py-2 text-[11px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              Show {Math.min(COLUMN_PAGE, remaining)} more · {remaining} hidden
            </button>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableLeadCard({ lead }: { lead: LeadOverview }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: "lead" },
  });

  return (
    <LeadCard
      lead={lead}
      innerRef={setNodeRef}
      attributes={attributes}
      listeners={listeners}
      dragging={isDragging}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
    />
  );
}

function groupByStage(
  leads: LeadOverview[],
  visible: DealStage[],
): Record<DealStage, LeadOverview[]> {
  const groups = Object.fromEntries(visible.map((s) => [s, [] as LeadOverview[]])) as Record<
    DealStage,
    LeadOverview[]
  >;
  for (const l of leads) {
    if (l.deal_stage && groups[l.deal_stage]) groups[l.deal_stage].push(l);
  }
  for (const s of visible) {
    groups[s].sort((a, b) => (a.deal_position ?? 0) - (b.deal_position ?? 0));
  }
  return groups;
}
