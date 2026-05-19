"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Database, Loader2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import {
  countSampleData, clearSampleData, insertSampleData,
  type SampleDataCounts,
} from "@/lib/supabase/api";
import { buildSamplePayload } from "@/lib/sample-data";
import { useAuth } from "@/lib/auth";
import { useRefreshWorkspace } from "@/lib/store";

/**
 * Demo-data panel for the workspace settings page. Lets an authenticated user
 * insert the bundled mock catalog into Supabase (flagged `is_sample = true`)
 * for one-click demos, then remove it just as cleanly when they're done.
 */
export function SampleDataPanel() {
  const supabase = React.useMemo(() => createClient(), []);
  const refresh = useRefreshWorkspace();
  const { user } = useAuth();
  const [counts, setCounts] = React.useState<SampleDataCounts | null>(null);
  const [working, setWorking] = React.useState<"insert" | "clear" | null>(null);
  const [confirmClear, setConfirmClear] = React.useState(false);

  const recount = React.useCallback(async () => {
    try {
      const c = await countSampleData(supabase);
      setCounts(c);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // eslint-disable-next-line no-console
      console.error("countSampleData failed:", err);
      toast.error(`Sample-data check failed: ${msg}`);
      setCounts({ companies: 0, leads: 0 });
    }
  }, [supabase]);

  React.useEffect(() => {
    void recount();
  }, [recount]);

  const hasSample = (counts?.companies ?? 0) + (counts?.leads ?? 0) > 0;
  const loading = counts === null;

  async function handleInsert() {
    if (!user) return;
    setWorking("insert");
    try {
      const payload = buildSamplePayload(user.id);
      await insertSampleData(supabase, payload);
      await Promise.all([recount(), refresh()]);
      toast.success("Sample data inserted", {
        description: `${payload.companies.length} companies, ${payload.leads.length} leads.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Insert failed: ${msg}`);
    } finally {
      setWorking(null);
    }
  }

  async function handleClear() {
    setWorking("clear");
    setConfirmClear(false);
    try {
      await clearSampleData(supabase);
      await Promise.all([recount(), refresh()]);
      toast.success("Sample data cleared");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Clear failed: ${msg}`);
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
            <Database className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-sm font-medium">Sample data</div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {loading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking workspace…
                  </span>
                ) : hasSample ? (
                  <>
                    Demo catalog currently loaded —{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {counts!.companies}
                    </span>{" "}
                    {counts!.companies === 1 ? "company" : "companies"},{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {counts!.leads}
                    </span>{" "}
                    {counts!.leads === 1 ? "lead" : "leads"}.
                  </>
                ) : (
                  "Populate the workspace with a demo catalog for screenshots or stakeholder walk-throughs. Inserted rows are tagged so removal is safe."
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={handleInsert}
                disabled={loading || hasSample || working !== null}
              >
                {working === "insert" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Inserting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" /> Insert sample data
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmClear(true)}
                disabled={loading || !hasSample || working !== null}
              >
                {working === "clear" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Clearing…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" /> Clear sample data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Clear sample data?
            </DialogTitle>
            <DialogDescription>
              This removes every row tagged as sample —{" "}
              <span className="font-mono tabular-nums">{counts?.companies ?? 0}</span> companies,{" "}
              <span className="font-mono tabular-nums">{counts?.leads ?? 0}</span> leads, plus
              every deal, qualification, and activity attached to those leads. Rows you created
              yourself are not touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear}>
              <Trash2 className="h-3.5 w-3.5" /> Clear sample data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
