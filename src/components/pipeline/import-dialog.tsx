"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, ArrowRight,
  ArrowLeft, Users, Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useActions, useOverview, useCompanies, useProfiles } from "@/lib/store";
import { useCurrentUser } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { fetchAllCompaniesLite } from "@/lib/supabase/api";
import { cn, extractDomain, initials } from "@/lib/utils";
import {
  parseCsv, normalizeRows, groupByCompany, summarize,
  IMPORT_FIELD_LABELS, REQUIRED_FIELDS,
  type ParseResult, type Mapping, type ImportField,
  type NormalizedRow, type CompanyGroup, type ImportSummary,
} from "@/lib/csv-import";
import type { CompanyLink } from "@/lib/types";

type Step = "upload" | "map" | "review" | "importing" | "done";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const actions = useActions();
  const me = useCurrentUser();
  const profiles = useProfiles();
  const existingLeads = useOverview();
  const existingCompanies = useCompanies();
  const supabase = React.useMemo(() => createClient(), []);

  // Owner assignment for imported leads. "single" → one owner (default:
  // the importer). "rotate" → round-robin across the ordered picked set,
  // same logic as the bulk action bar so behavior is consistent.
  const [ownerMode, setOwnerMode] = React.useState<"single" | "rotate">("single");
  const [singleOwner, setSingleOwner] = React.useState<string>("");
  const [rotateOwners, setRotateOwners] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (me) setSingleOwner(me.id);
    setRotateOwners(profiles.map((p) => p.id));
  }, [me, profiles]);

  const [step, setStep] = React.useState<Step>("upload");
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [mapping, setMapping] = React.useState<Mapping>({});
  const [normalized, setNormalized] = React.useState<NormalizedRow[]>([]);
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ leads: number; companies: number } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      // Reset everything when the dialog closes so a second import is clean.
      setStep("upload");
      setParsed(null);
      setMapping({});
      setNormalized([]);
      setGroups([]);
      setSummary(null);
      setBusy(false);
      setResult(null);
    }
  }, [open]);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const res = await parseCsv(file);
      if (res.rows.length === 0) {
        toast.error("No data rows found in that file");
        return;
      }
      setParsed(res);
      setMapping(res.autoMapping);
      setStep("map");
    } catch (err) {
      toast.error(`Couldn't parse CSV: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  function recompute(nextMapping: Mapping) {
    if (!parsed) return;
    const rows = normalizeRows(parsed.rows, nextMapping, existingLeads);
    const grps = groupByCompany(rows, existingCompanies);
    setNormalized(rows);
    setGroups(grps);
    setSummary(summarize(rows, grps));
  }

  function goToReview() {
    const missing = REQUIRED_FIELDS.filter((f) => !mapping[f]);
    if (missing.length) {
      toast.error(`Map a column for: ${missing.map((f) => IMPORT_FIELD_LABELS[f]).join(", ")}`);
      return;
    }
    recompute(mapping);
    setStep("review");
  }

  function toggleImportAnyway(rowIndex: number) {
    const next = normalized.map((r) =>
      r.rowIndex === rowIndex ? { ...r, importAnyway: !r.importAnyway } : r,
    );
    setNormalized(next);
    setSummary(summarize(next, groups));
  }

  async function runImport() {
    if (!me) return;
    setStep("importing");
    setBusy(true);
    try {
      // Authoritative existing-company resolution: the store list is capped
      // at Supabase's 1,000-row default, so re-resolve every group against a
      // fully-paginated name→id map. Without this, a company name beyond row
      // 1,000 (e.g. after a partial prior import) slips past dedup and trips
      // the companies_name_lower unique index.
      const allCompanies = await fetchAllCompaniesLite(supabase);
      const existingIdByName = new Map<string, string>();
      for (const c of allCompanies) {
        existingIdByName.set(c.name.trim().toLowerCase(), c.id);
      }

      // Resolve a stable company_id per group: existing match, or a fresh
      // UUID for a company we're about to create.
      const groupCompanyId = new Map<string, string>();
      const newCompanies: Array<Record<string, unknown>> = [];
      for (const g of groups) {
        // g.key is the normalized company name; prefer the authoritative
        // lookup, then the store-resolved match.
        const resolvedExistingId =
          existingIdByName.get(g.key) ?? g.existingCompanyId ?? null;
        if (resolvedExistingId) {
          groupCompanyId.set(g.key, resolvedExistingId);
          continue;
        }
        const id = uid();
        groupCompanyId.set(g.key, id);
        const links: CompanyLink[] = [];
        if (g.website) {
          links.push({
            id: uid(),
            type: "website",
            url: g.website.startsWith("http") ? g.website : `https://${g.website}`,
          });
        }
        if (g.youtube) links.push({ id: uid(), type: "youtube", url: g.youtube });
        newCompanies.push({
          id,
          name: g.name,
          domain: extractDomain(g.website),
          industry: null,
          size: null,
          notes: null,
          tags: [],
          links,
        });
      }

      // Resolve the owner per lead. Round-robin walks the ordered picked
      // set deterministically (lead[i] → rotateOwners[i % n]); single mode
      // assigns everyone to one person.
      const rotation =
        ownerMode === "rotate" && rotateOwners.length > 0 ? rotateOwners : null;
      const fallbackOwner = singleOwner || me.id;
      let rotIdx = 0;

      const nowIso = new Date().toISOString();
      const leads: Array<Record<string, unknown>> = [];
      for (const r of normalized) {
        const include =
          r.status === "new" || (r.status === "duplicate" && r.importAnyway);
        if (!include) continue;
        const ownerId = rotation
          ? rotation[rotIdx++ % rotation.length]
          : fallbackOwner;
        leads.push({
          id: uid(),
          owner_id: ownerId,
          company_id: r.companyKey ? groupCompanyId.get(r.companyKey) ?? null : null,
          name: r.name,
          email: r.email,
          phone: r.phone,
          role: r.role,
          service_type: null, // legacy CSV imports: service mapping not auto-resolved
          additional_info: r.additionalInfo,
          source: "yaas_form",
          status: "active",
          tags: [],
          source_submission_id: r.submissionId,
          created_at: r.submittedAtIso ?? nowIso,
        });
      }

      // Only create companies that actually have ≥1 imported lead attached.
      const usedCompanyIds = new Set(leads.map((l) => l.company_id).filter(Boolean));
      const companiesToCreate = newCompanies.filter((c) => usedCompanyIds.has(c.id));

      await actions.importLeads({ newCompanies: companiesToCreate, leads });
      setResult({ leads: leads.length, companies: companiesToCreate.length });
      setStep("done");
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : "unknown"}`);
      setStep("review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV export of form submissions."}
            {step === "map" && "Confirm how columns map to CRM fields."}
            {step === "review" && "Review duplicates and company grouping before importing."}
            {step === "importing" && "Importing…"}
            {step === "done" && "Import complete."}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator step={step} />

        {step === "upload" ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[3/1] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40"
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
            <div className="text-center">
              <div className="text-sm font-medium text-foreground">Choose a CSV file</div>
              <div className="mt-0.5 text-[11px]">Click to browse</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </button>
        ) : null}

        {step === "map" && parsed ? (
          <MapStep
            parsed={parsed}
            mapping={mapping}
            onChange={setMapping}
            onBack={() => setStep("upload")}
            onNext={goToReview}
          />
        ) : null}

        {step === "review" && summary ? (
          <ReviewStep
            normalized={normalized}
            groups={groups}
            summary={summary}
            onToggle={toggleImportAnyway}
            onBack={() => setStep("map")}
            onImport={runImport}
            profiles={profiles}
            ownerMode={ownerMode}
            setOwnerMode={setOwnerMode}
            singleOwner={singleOwner}
            setSingleOwner={setSingleOwner}
            rotateOwners={rotateOwners}
            setRotateOwners={setRotateOwners}
          />
        ) : null}

        {step === "importing" ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin" />
            Writing leads + companies…
          </div>
        ) : null}

        {step === "done" && result ? (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <div>
              <div className="text-sm font-medium">
                Imported {result.leads} {result.leads === 1 ? "lead" : "leads"}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {result.companies} new {result.companies === 1 ? "company" : "companies"} created
              </div>
            </div>
            <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "map", label: "Map" },
    { id: "review", label: "Review" },
  ];
  const idx = step === "importing" || step === "done" ? 3 : steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {steps.map((s, i) => (
        <React.Fragment key={s.id}>
          <span className={cn("font-medium", i <= idx && "text-foreground")}>{s.label}</span>
          {i < steps.length - 1 ? <span className="text-muted-foreground/40">›</span> : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function MapStep({
  parsed, mapping, onChange, onBack, onNext,
}: {
  parsed: ParseResult;
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const fields = Object.keys(IMPORT_FIELD_LABELS) as ImportField[];
  const NONE = "__none";
  return (
    <div className="space-y-3">
      <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1 scrollbar-thin">
        {fields.map((f) => {
          const required = REQUIRED_FIELDS.includes(f);
          return (
            <div key={f} className="flex items-center gap-3">
              <div className="w-[140px] shrink-0 text-[12px]">
                {IMPORT_FIELD_LABELS[f]}
                {required ? <span className="ml-0.5 text-destructive">*</span> : null}
              </div>
              <Select
                value={mapping[f] ?? NONE}
                onValueChange={(v) =>
                  onChange({ ...mapping, [f]: v === NONE ? undefined : v })
                }
              >
                <SelectTrigger className="h-8 flex-1 text-[12px]">
                  <SelectValue placeholder="— not mapped —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— not mapped —</SelectItem>
                  {parsed.headers.map((h) => (
                    <SelectItem key={h} value={h}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {parsed.rows.length} rows detected · auto-mapped from headers — adjust any that look wrong.
      </p>
      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={onNext}>
          Review <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

type Profile = { id: string; full_name: string | null; role: string | null };

function ReviewStep({
  normalized, groups, summary, onToggle, onBack, onImport,
  profiles, ownerMode, setOwnerMode, singleOwner, setSingleOwner,
  rotateOwners, setRotateOwners,
}: {
  normalized: NormalizedRow[];
  groups: CompanyGroup[];
  summary: ImportSummary;
  onToggle: (rowIndex: number) => void;
  onBack: () => void;
  onImport: () => void;
  profiles: Profile[];
  ownerMode: "single" | "rotate";
  setOwnerMode: (m: "single" | "rotate") => void;
  singleOwner: string;
  setSingleOwner: (id: string) => void;
  rotateOwners: string[];
  setRotateOwners: (ids: string[]) => void;
}) {
  const rowByIndex = React.useMemo(() => {
    const m = new Map<number, NormalizedRow>();
    for (const r of normalized) m.set(r.rowIndex, r);
    return m;
  }, [normalized]);

  // Ungrouped rows (no company info) get their own pseudo-group at the end.
  const ungrouped = normalized.filter((r) => !r.companyKey);

  function toggleRotate(id: string) {
    setRotateOwners(
      rotateOwners.includes(id)
        ? rotateOwners.filter((x) => x !== id)
        : [...rotateOwners, id],
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Chip tone="default">{summary.total} rows</Chip>
        <Chip tone="good">{summary.willImport} will import</Chip>
        {summary.duplicates > 0 ? <Chip tone="warn">{summary.duplicates} duplicates</Chip> : null}
        {summary.invalid > 0 ? <Chip tone="bad">{summary.invalid} invalid</Chip> : null}
        <Chip tone="default">
          {summary.companies} companies
          {summary.multiContactCompanies > 0 ? ` (${summary.multiContactCompanies} multi-contact)` : ""}
        </Chip>
      </div>

      {/* Owner assignment for the imported leads */}
      <div className="rounded-md border border-border p-2.5">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Assign owner
          </span>
          <div className="ml-auto flex rounded-md border p-0.5">
            {(["single", "rotate"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOwnerMode(m)}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] transition-colors",
                  ownerMode === m
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "single" ? "One person" : "Round-robin"}
              </button>
            ))}
          </div>
        </div>
        {ownerMode === "single" ? (
          <Select value={singleOwner} onValueChange={setSingleOwner}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              {summary.willImport} leads spread evenly, in the checked order.
            </p>
            <div className="flex flex-wrap gap-1">
              {profiles.map((p) => {
                const order = rotateOwners.indexOf(p.id);
                const on = order !== -1;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleRotate(p.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors",
                      on
                        ? "border-foreground bg-accent text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Avatar className="h-4 w-4">
                      <AvatarFallback className="text-[8px]">{initials(p.full_name)}</AvatarFallback>
                    </Avatar>
                    {p.full_name ?? "—"}
                    {on ? <span className="font-mono text-[9px] text-muted-foreground">#{order + 1}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1 scrollbar-thin">
        {groups.map((g) => (
          <div key={g.key} className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5 text-[12px]">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-medium">{g.name}</span>
              {g.existingCompanyId ? (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  existing
                </span>
              ) : (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  new
                </span>
              )}
              {g.rowIndexes.length > 1 ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="h-3 w-3" /> {g.rowIndexes.length}
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {g.rowIndexes.map((ri) => {
                const r = rowByIndex.get(ri);
                if (!r) return null;
                return <RowLine key={ri} row={r} onToggle={onToggle} />;
              })}
            </ul>
          </div>
        ))}

        {ungrouped.length > 0 ? (
          <div className="rounded-md border border-border">
            <div className="border-b border-border bg-muted/30 px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
              No company
            </div>
            <ul className="divide-y divide-border">
              {ungrouped.map((r) => (
                <RowLine key={r.rowIndex} row={r} onToggle={onToggle} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={onImport} disabled={summary.willImport === 0}>
          Import {summary.willImport} {summary.willImport === 1 ? "lead" : "leads"}
        </Button>
      </div>
    </div>
  );
}

function RowLine({
  row, onToggle,
}: {
  row: NormalizedRow;
  onToggle: (rowIndex: number) => void;
}) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-[12px]">
      <div className="min-w-0 flex-1">
        <div className="truncate">
          {row.name || <span className="text-muted-foreground italic">no name</span>}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {row.email ?? "—"}
        </div>
      </div>
      {row.status === "new" ? (
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
          new
        </span>
      ) : row.status === "invalid" ? (
        <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-2.5 w-2.5" /> {row.note}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onToggle(row.rowIndex)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] transition-colors",
            row.importAnyway
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400",
          )}
          title={row.note}
        >
          {row.importAnyway ? "import anyway" : "duplicate · skip"}
        </button>
      )}
    </li>
  );
}

function Chip({
  children, tone,
}: {
  children: React.ReactNode;
  tone: "default" | "good" | "warn" | "bad";
}) {
  const cls = {
    default: "bg-muted text-muted-foreground",
    good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bad: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  }[tone];
  return <span className={cn("rounded px-2 py-0.5 font-mono tabular-nums", cls)}>{children}</span>;
}
