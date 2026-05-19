"use client";

import * as React from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Download, Upload, Trash2, Loader2, AlertTriangle, FileJson, FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { fetchWorkspace, type WorkspaceBackup } from "@/lib/supabase/api";
import { useActions } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const CONFIRM_WORD = "DELETE";

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  return formatDate(new Date(), "medium").replace(/[\s,]+/g, "-").toLowerCase();
}

/**
 * Admin-only workspace data tools: full JSON backup + flat CSV export,
 * JSON restore (merge or replace), and a typed-confirmation destructive
 * "clear everything" action. Rendered in Settings → Workspace under an
 * AdminOnly guard by the caller.
 */
export function WorkspaceDataPanel() {
  const supabase = React.useMemo(() => createClient(), []);
  const actions = useActions();

  const [working, setWorking] = React.useState<null | "json" | "csv" | "import" | "clear">(null);
  const [clearOpen, setClearOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [importOpen, setImportOpen] = React.useState(false);
  const [pendingBackup, setPendingBackup] = React.useState<WorkspaceBackup | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function exportJson() {
    setWorking("json");
    try {
      const data = await fetchWorkspace(supabase);
      const backup: WorkspaceBackup = {
        version: 1,
        exported_at: new Date().toISOString(),
        companies: data.companies,
        leads: data.leads,
        deals: data.deals,
        qualifications: data.qualifications,
        activities: data.activities,
      };
      downloadBlob(
        JSON.stringify(backup, null, 2),
        `editors-crm-backup-${todayStamp()}.json`,
        "application/json",
      );
      toast.success("Backup downloaded");
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setWorking(null);
    }
  }

  async function exportCsv() {
    setWorking("csv");
    try {
      const data = await fetchWorkspace(supabase);
      const companyById = new Map(data.companies.map((c) => [c.id, c]));
      const dealByLead = new Map(data.deals.map((d) => [d.lead_id, d]));
      const rows = data.leads.map((l) => {
        const c = l.company_id ? companyById.get(l.company_id) : null;
        const d = dealByLead.get(l.id);
        return {
          Name: l.name,
          Email: l.email ?? "",
          Phone: l.phone ?? "",
          Role: l.role ?? "",
          Company: c?.name ?? "",
          Website: c?.domain ?? "",
          Stage: d?.stage ?? "",
          MRR: d?.value_mrr ?? "",
          Currency: d?.value_currency ?? "",
          "One-time": d?.value_one_time ?? "",
          "Service type": l.service_type ?? "",
          Source: l.source,
          "Created at": l.created_at,
        };
      });
      downloadBlob(
        Papa.unparse(rows),
        `editors-crm-leads-${todayStamp()}.csv`,
        "text/csv",
      );
      toast.success("CSV exported");
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setWorking(null);
    }
  }

  function onPickBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as WorkspaceBackup;
        if (parsed.version !== 1 || !Array.isArray(parsed.leads)) {
          throw new Error("Not a valid Editors CRM backup file");
        }
        setPendingBackup(parsed);
        setImportOpen(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Invalid backup file");
      }
    };
    reader.readAsText(file);
  }

  async function runRestore(mode: "merge" | "replace") {
    if (!pendingBackup) return;
    setImportOpen(false);
    setWorking("import");
    try {
      await actions.restoreBackup(pendingBackup, mode);
      toast.success(
        mode === "replace" ? "Workspace replaced from backup" : "Backup merged in",
      );
    } catch (err) {
      toast.error(`Restore failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setWorking(null);
      setPendingBackup(null);
    }
  }

  async function runClear() {
    setClearOpen(false);
    setConfirmText("");
    setWorking("clear");
    try {
      await actions.clearWorkspace();
      toast.success("Workspace data cleared");
    } catch (err) {
      toast.error(`Clear failed: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setWorking(null);
    }
  }

  const busy = working !== null;

  return (
    <>
      <Card className="space-y-5 p-5">
        {/* Backup / export */}
        <div className="space-y-2">
          <div>
            <div className="text-sm font-medium">Export</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              JSON is a full, restorable backup. CSV is a flat leads sheet for spreadsheets.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportJson} disabled={busy}>
              {working === "json" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
              Export JSON
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={busy}>
              {working === "csv" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              Export CSV
            </Button>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Restore */}
        <div className="space-y-2">
          <div>
            <div className="text-sm font-medium">Restore from backup</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Upload a JSON backup. Merge keeps existing records; replace wipes first.
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            {working === "import" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Choose backup file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickBackup(f);
              e.target.value = "";
            }}
          />
        </div>

        <div className="h-px bg-border" />

        {/* Danger zone */}
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" /> Danger zone
          </div>
          <p className="text-[12px] text-muted-foreground">
            Permanently delete every lead, deal, qualification, activity, and company. Your
            team, sales scripts, and settings are kept. Export a backup first.
          </p>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setClearOpen(true)}
            disabled={busy}
          >
            {working === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Clear all workspace data
          </Button>
        </div>
      </Card>

      {/* Typed-confirmation clear modal */}
      <Dialog open={clearOpen} onOpenChange={(v) => { setClearOpen(v); if (!v) setConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Clear all workspace data?
            </DialogTitle>
            <DialogDescription>
              This deletes <strong>all leads, deals, qualifications, activities, and
              companies</strong>. It cannot be undone. Type{" "}
              <code className="rounded bg-muted px-1 font-mono">{CONFIRM_WORD}</code> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoFocus
            className="font-mono"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={confirmText !== CONFIRM_WORD}
              onClick={runClear}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge vs replace modal */}
      <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) setPendingBackup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore backup</DialogTitle>
            <DialogDescription>
              {pendingBackup
                ? `${pendingBackup.leads.length} leads · ${pendingBackup.companies.length} companies · exported ${formatDate(pendingBackup.exported_at, "medium")}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => runRestore("merge")}
              className="w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-foreground/40"
            >
              <div className="text-[13px] font-medium">Merge</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Add records from the backup. Anything already present (same id) is left as-is.
              </div>
            </button>
            <button
              type="button"
              onClick={() => runRestore("replace")}
              className="w-full rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:border-destructive/60"
            >
              <div className="text-[13px] font-medium text-destructive">Replace</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Wipe all current workspace data first, then import the backup exactly.
              </div>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
