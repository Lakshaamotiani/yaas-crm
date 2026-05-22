"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLead, narrativeActivities, useActions } from "@/lib/store";
import { LeadSidebar } from "@/components/lead-detail/lead-sidebar";
import { SalesScript } from "@/components/lead-detail/sales-script";
import { ActivityTimeline } from "@/components/lead-detail/activity-timeline";
import { NotesComposer } from "@/components/lead-detail/notes-composer";
import { LeadActionBar } from "@/components/lead-detail/lead-action-bar";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { lead, deal, qualification, company, activities } = useLead(params.id);
  const actions = useActions();
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const visibleActivities = React.useMemo(() => narrativeActivities(activities), [activities]);

  if (!lead) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Lead not found.</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.push("/pipeline")}>
            <ArrowLeft /> Back to pipeline
          </Button>
        </div>
      </div>
    );
  }

  const startCall = (scriptId?: string) => {
    const qs = scriptId ? `?script=${encodeURIComponent(scriptId)}` : "";
    router.push(`/leads/${lead.id}/call${qs}`);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await actions.deleteLead(lead.id);
    router.push("/pipeline");
  };

  const displayName = company?.name ?? lead.name;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 pt-3 sm:px-6 sm:pt-4">
        <Link
          href="/pipeline"
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Pipeline
        </Link>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[12px] text-muted-foreground hover:text-destructive"
          disabled={deleting}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete lead
        </Button>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {displayName}?</DialogTitle>
              <DialogDescription>
                This will permanently delete this lead along with all deals, notes, and activity history. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-b p-4 md:hidden">
        <LeadActionBar leadId={lead.id} onLogCall={() => startCall()} />
      </div>

      <div className="grid flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
        <LeadSidebar
          lead={lead}
          deal={deal}
          qualification={qualification}
        />

        <div className="flex min-w-0 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin sm:p-6">
            <div className="hidden md:block">
              <LeadActionBar leadId={lead.id} onLogCall={() => startCall()} />
            </div>
            <SalesScript onUseInCall={(id) => startCall(id)} />
            <NotesComposer leadId={lead.id} />

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Activity
                </h2>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {visibleActivities.length} entr{visibleActivities.length === 1 ? "y" : "ies"}
                </span>
              </div>
              <ActivityTimeline activities={visibleActivities} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
