"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search, KanbanSquare, List, SlidersHorizontal, Plus,
  X, Check, Eye, EyeOff, Upload,
} from "lucide-react";
import { ImportDialog } from "@/components/pipeline/import-dialog";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { ListView } from "@/components/pipeline/list-view";
import { useOverview, useProfiles, useTemplates, useStageRoles } from "@/lib/store";
import { cn, formatCurrency, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function PipelinePage() {
  const leads = useOverview();
  const profiles = useProfiles();
  const { sourceLabels } = useTemplates();
  const [view, setView] = React.useState<"kanban" | "list">("kanban");

  // Kanban doesn't fit on a phone (horizontal scroll across 7 columns + DnD
  // is unworkable on touch). Auto-pin to list view below md and keep it
  // there as long as the viewport stays narrow.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      if (mq.matches) setView("list");
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [query, setQuery] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [owner, setOwner] = React.useState<string>("all");
  const [source, setSource] = React.useState<string>("all");
  const [openOnly, setOpenOnly] = React.useState(true);
  const { openIds } = useStageRoles();

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (!l.deal_stage) return false;
      if (openOnly && !openIds.has(l.deal_stage)) return false;
      if (owner !== "all" && l.owner_id !== owner) return false;
      if (source !== "all" && l.source !== source) return false;
      if (!q) return true;
      const hay = [
        l.name,
        l.company?.name,
        l.company?.domain,
        l.email,
        l.role,
        l.service_type,
        ...(l.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, query, owner, source, openOnly, openIds]);

  const totalOpenMrr = filtered.reduce((s, l) => s + (l.value_mrr ?? 0), 0);
  const activeFilters = (owner !== "all" ? 1 : 0) + (source !== "all" ? 1 : 0);

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title={
          <span className="inline-flex items-baseline gap-2.5">
            <span>Pipeline</span>
            <span className="font-mono text-[12px] tabular-nums font-normal text-muted-foreground">
              {filtered.length}
            </span>
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono tabular-nums text-foreground">
              {formatCurrency(totalOpenMrr, { compact: true })}
            </span>
            <span className="text-muted-foreground/70">open MRR</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/leads/new"><Plus /> Add Lead</Link>
            </Button>
          </>
        }
      />

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Tabs value={view} onValueChange={(v) => setView(v as any)} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3 sm:px-6">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, email…"
              className="h-8 w-full pl-8 text-sm"
            />
          </div>

          <FilterPopover
            owner={owner} setOwner={setOwner}
            source={source} setSource={setSource}
            profiles={profiles}
            sourceLabels={sourceLabels}
            activeCount={activeFilters}
            onClear={() => { setOwner("all"); setSource("all"); }}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpenOnly((v) => !v)}
            className={cn("h-8", openOnly && "text-foreground")}
            title={openOnly ? "Showing open stages only" : "Showing all stages"}
          >
            {openOnly ? <Eye /> : <EyeOff />}
            {openOnly ? "Open only" : "All stages"}
          </Button>

          {/* Kanban/list toggle is desktop-only — mobile is always list */}
          <div className="ml-auto hidden md:block">
            <TabsList className="h-8">
              <TabsTrigger value="kanban" className="h-6 gap-1 px-2 text-xs">
                <KanbanSquare className="h-3.5 w-3.5" /> Board
              </TabsTrigger>
              <TabsTrigger value="list" className="h-6 gap-1 px-2 text-xs">
                <List className="h-3.5 w-3.5" /> List
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="kanban" className="m-0 min-h-0 flex-1">
          <KanbanBoard
            leads={filtered}
            visibleStages={openOnly ? Array.from(openIds) : undefined}
          />
        </TabsContent>
        <TabsContent value="list" className="m-0 min-h-0 flex-1 overflow-auto">
          <ListView leads={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterPopover({
  owner, setOwner, source, setSource, profiles, sourceLabels, activeCount, onClear,
}: {
  owner: string;
  setOwner: (v: string) => void;
  source: string;
  setSource: (v: string) => void;
  profiles: { id: string; full_name: string | null }[];
  sourceLabels: Record<string, string>;
  activeCount: number;
  onClear: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2", activeCount > 0 && "border-foreground/40")}
        >
          <SlidersHorizontal />
          <span>Filter</span>
          {activeCount > 0 ? (
            <span className="grid h-4 min-w-4 place-items-center rounded bg-foreground px-1 font-mono text-[10px] font-medium tabular-nums text-background">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Filter
          </span>
          {activeCount > 0 ? (
            <button
              onClick={onClear}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          ) : null}
        </div>

        <FilterGroup
          label="Owner"
          options={[
            { value: "all", label: "All owners" },
            ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? "—", avatar: p.full_name })),
          ]}
          value={owner}
          onChange={setOwner}
        />

        <Separator />

        <FilterGroup
          label="Source"
          options={[
            { value: "all", label: "All sources" },
            ...Object.entries(sourceLabels).map(([id, label]) => ({ value: id, label })),
          ]}
          value={source}
          onChange={setSource}
        />
      </PopoverContent>
    </Popover>
  );
}

function FilterGroup({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string; avatar?: string | null }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-1.5 py-1.5">
      <Label className="px-1.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </Label>
      <ul className="space-y-0.5">
        {options.map((o) => (
          <li key={o.value}>
            <button
              onClick={() => onChange(o.value)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors",
                value === o.value
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {o.avatar !== undefined ? (
                o.value === "all" ? (
                  <span className="h-5 w-5" />
                ) : (
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[9px]">{initials(o.avatar ?? "?")}</AvatarFallback>
                  </Avatar>
                )
              ) : null}
              <span className="flex-1 truncate">{o.label}</span>
              {value === o.value ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
